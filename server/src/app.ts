import express from "express";
import cors from "cors";
import type { Level, GenerateRequest } from "./types.js";
import { generateLevel } from "./generate-level.js";
import {
  DEFAULT_IMAGE_MODEL,
  ImageProviderError,
  type ImageGenerationOptions,
} from "./generate-image.js";
import { TrialQuotaStore } from "./trial-quota.js";

export const PERSONAL_MODELS = [
  { id: "Kwai-Kolors/Kolors", label: "Kolors · 经济生图" },
  { id: "Qwen/Qwen-Image", label: "Qwen-Image · 精细生图" },
];

interface AppOptions {
  quota: TrialQuotaStore;
  publicDir?: string;
  generator?: (
    prompt: string,
    options?: ImageGenerationOptions,
  ) => Promise<Level>;
  defaultModel?: string;
}

export function createApp({
  quota,
  publicDir,
  generator = generateLevel,
  defaultModel = DEFAULT_IMAGE_MODEL,
}: AppOptions) {
  const app = express();
  let activeGenerations = 0;
  // Only the loopback nginx proxy may supply a forwarded client address.
  app.set("trust proxy", "loopback");
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "2kb" }));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", timestamp: new Date().toISOString() }),
  );
  app.get("/api/generation-quota", (req, res, next) => {
    try {
      res.json({
        ...quota.get(req.ip || req.socket.remoteAddress || ""),
        defaultModel,
        models: PERSONAL_MODELS,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/generate-level", async (req, res) => {
    let usingOwnKey = false;
    let clientIp = "";
    try {
      const body = (req.body ?? {}) as Partial<GenerateRequest>;
      if (
        typeof body.prompt !== "string" ||
        !body.prompt.trim() ||
        body.prompt.trim().length > 140
      ) {
        res
          .status(400)
          .json({
            error: "描述长度需要在 1-140 字之间",
            code: "INVALID_PROMPT",
          });
        return;
      }
      let apiKey: string | undefined;
      if (body.apiKey !== undefined) {
        if (
          typeof body.apiKey !== "string" ||
          !/^sk-[A-Za-z0-9_-]{20,200}$/.test(body.apiKey.trim())
        ) {
          res
            .status(400)
            .json({
              error: "请填写有效的硅基流动 API Key",
              code: "INVALID_API_KEY",
            });
          return;
        }
        apiKey = body.apiKey.trim();
        usingOwnKey = true;
      }
      if (
        body.model !== undefined &&
        (!usingOwnKey ||
          !PERSONAL_MODELS.some((model) => model.id === body.model))
      ) {
        res
          .status(400)
          .json({
            error: "请在个人密钥模式中选择支持的生图模型",
            code: "INVALID_MODEL",
          });
        return;
      }
      clientIp = req.ip || req.socket.remoteAddress || "";
      const current = quota.get(clientIp);
      if (!usingOwnKey && current.remaining === 0) {
        res
          .status(403)
          .json({
            error: "这个 IP 的 3 次体验已用完，请填写自己的 API Key 继续",
            code: "TRIAL_EXHAUSTED",
            requiresApiKey: true,
            quota: current,
          });
        return;
      }
      if (activeGenerations >= 1) {
        res
          .status(429)
          .json({
            error: "工坊正在铸造另一份灵感，请稍后再试",
            code: "BUSY",
            quota: current,
          });
        return;
      }
      // Reserve durably before awaiting the provider. Provider failures are attempts too.
      if (!usingOwnKey && !quota.consume(clientIp)) {
        res
          .status(403)
          .json({
            error: "体验已用完，请使用自己的 API Key",
            code: "TRIAL_EXHAUSTED",
            quota: quota.get(clientIp),
          });
        return;
      }
      activeGenerations++;
      try {
        const level = await generator(body.prompt.trim(), {
          apiKey,
          model: usingOwnKey ? body.model || defaultModel : defaultModel,
        });
        res.json({ ...level, quota: quota.get(clientIp), usingOwnKey });
      } finally {
        activeGenerations--;
      }
    } catch (error) {
      let status = 500,
        code = "GENERATION_FAILED",
        message = "生成失败，请重试";
      if (error instanceof ImageProviderError) {
        if (usingOwnKey && [401, 403].includes(error.status)) {
          status = 401;
          code = "PERSONAL_KEY_REJECTED";
          message = "个人 API Key 无效或无权使用该模型，请检查密钥";
        } else if (usingOwnKey && error.status === 402) {
          status = 402;
          code = "PERSONAL_BALANCE_REQUIRED";
          message = "个人 API 账户余额不足，请充值或选择其他模型";
        } else if (error.status === 429) {
          status = 503;
          message = "模型服务繁忙，请稍后重试";
        }
        console.error("[generate-level] Provider status", error.status);
      } else if (
        error instanceof Error &&
        "isTimeout" in error &&
        error.isTimeout
      ) {
        status = 504;
        code = "GENERATION_TIMEOUT";
        message = "图片生成超时，请稍后重试";
      } else {
        // Do not log request bodies, credentials, or upstream error objects.
        console.error("[generate-level] Generation or quota storage failed");
      }
      let current;
      try {
        if (clientIp) current = quota.get(clientIp);
      } catch {
        /* Fail closed. */
      }
      res.status(status).json({ error: message, code, quota: current });
    }
  });

  app.use("/api", (_req, res) => res.status(404).json({ error: "接口不存在" }));
  if (publicDir) {
    app.use(express.static(publicDir));
    app.get("*", (_req, res) =>
      res.sendFile("index.html", { root: publicDir }),
    );
  }
  app.use(
    (
      error: Error & { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const badRequest = error.status === 400 || error.status === 413;
      res
        .status(badRequest ? error.status! : 503)
        .json({
          error: badRequest
            ? "请求格式无效或内容过长"
            : "体验额度暂时无法读取，请稍后重试",
          code: badRequest ? "INVALID_REQUEST" : "QUOTA_UNAVAILABLE",
        });
    },
  );
  return app;
}
