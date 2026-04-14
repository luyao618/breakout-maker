import "dotenv/config";
import express from "express";
import cors from "cors";
import { generateLevel } from "./generate-level.js";
import type { GenerateRequest } from "./types.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// Startup check
if (!process.env.LLM_API_KEY) {
  console.error("ERROR: LLM_API_KEY environment variable is required");
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: "1kb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Generate level
app.post("/api/generate-level", async (req, res) => {
  try {
    const body = req.body as Partial<GenerateRequest>;

    // Validate prompt
    if (!body.prompt || typeof body.prompt !== "string") {
      res.status(400).json({ error: "请提供关卡描述 (prompt)" });
      return;
    }

    const prompt = body.prompt.trim();
    if (prompt.length === 0 || prompt.length > 140) {
      res.status(400).json({ error: "描述长度需要在 1-140 字之间" });
      return;
    }

    const level = await generateLevel(prompt);
    res.json(level);
  } catch (err) {
    console.error("[generate-level] Error:", err);
    const isTimeout = err instanceof Error && (err as any).isTimeout;
    const status = isTimeout ? 504 : 500;
    // Always return a user-friendly Chinese message
    let message = "生成失败，请重试";
    if (isTimeout) {
      message = "AI 生成超时，请重试";
    } else if (err instanceof Error) {
      // Keep our own Chinese messages, translate others
      if (/[\u4e00-\u9fa5]/.test(err.message)) {
        message = err.message;
      }
    }
    res.status(status).json({ error: message });
  }
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[server] Unhandled error:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
);

app.listen(PORT, () => {
  console.log(`🧱 Breakout Maker server running on http://localhost:${PORT}`);
});
