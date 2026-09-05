import { useState, useRef, useEffect } from "react";
import { ImagePlus, WandSparkles, ArrowRight, Play } from "lucide-react";
import {
  imageToLevel,
  generateLevel,
  getGenerationQuota,
  GenerationError,
  type GenerationQuota,
} from "../game/engine";
import type { Level } from "../game/types";
import BrickPreview from "./BrickPreview";
import { shortName } from "../lib/display";

export default function Maker({
  mode,
  onPlay,
}: {
  mode: "image" | "create";
  onPlay: (level: Level) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [quota, setQuota] = useState<GenerationQuota | null>(null);
  const [quotaError, setQuotaError] = useState("");
  const [ownKey, setOwnKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("Kwai-Kolors/Kolors");
  const refreshQuota = async (signal?: AbortSignal) => {
    try {
      const next = await getGenerationQuota(signal);
      if (alive.current) {
        setQuota(next);
        setQuotaError("");
        if (next.remaining === 0) setOwnKey(true);
      }
    } catch {
      if (alive.current && !signal?.aborted)
        setQuotaError("暂时无法读取体验次数，请重试");
    }
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Level | null>(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (mode !== "create") return;
    const request = new AbortController();
    void refreshQuota(request.signal);
    return () => request.abort();
  }, [mode]);
  const convert = async (file?: File) => {
    if (!file || busy) return;
    setError("");
    setBusy(true);
    setPreview(null);
    try {
      const level = await imageToLevel(file);
      if (alive.current) {
        setPreview(level);
        setFileName(file.name);
      }
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error ? e.message : "图片读取失败，请选择另一张图片。",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const generate = async () => {
    if (!prompt.trim() || busy) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const level = await generateLevel(
        prompt.trim(),
        controller.current.signal,
        ownKey ? { apiKey, model } : undefined,
      );
      if (alive.current) setPreview(level);
    } catch (e) {
      if (alive.current) {
        setError(e instanceof Error ? e.message : "暂时无法生成，请稍后重试。");
        if (e instanceof GenerationError && e.quota)
          setQuota((q) => ({ ...q, ...e.quota! }));
        if (e instanceof GenerationError && e.code === "TRIAL_EXHAUSTED")
          setOwnKey(true);
      }
    } finally {
      if (alive.current) {
        setBusy(false);
        void refreshQuota();
      }
    }
  };
  return (
    <div className="maker">
      <p className="modal-intro">
        {mode === "image"
          ? "一张照片，一段回忆。把你喜欢的画面，变成可以击碎的像素宇宙。"
          : "描述脑海里的画面，让 AI 将想象铸造成独一无二的砖块关卡。"}
      </p>
      {mode === "image" ? (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="file-input"
            aria-label="上传图片"
            onChange={(e) => void convert(e.target.files?.[0])}
          />
          <button
            className={`upload-zone ${dragging ? "dragging" : ""}`}
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void convert(e.dataTransfer.files[0]);
            }}
          >
            <ImagePlus size={32} strokeWidth={1.2} />
            <strong>
              {busy ? "正在提取色彩…" : fileName || "点击选择，或拖入一张图片"}
            </strong>
            <span>JPG、PNG、WebP、GIF · 最多 10 MB</span>
          </button>
          <p className="privacy-note">
            图片仅在你的设备上处理，无需上传服务器。
          </p>
        </>
      ) : (
        <>
          <div
            className={`generation-quota ${quota?.remaining === 0 ? "exhausted" : ""}`}
            role="status"
          >
            <span>
              <strong>
                {quota
                  ? `共享体验剩余 ${quota.remaining} / ${quota.limit} 次`
                  : "正在读取体验次数…"}
              </strong>
              <small>每个 IP 累计 3 次，刷新不会重置</small>
            </span>
            <div className="quota-dots" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <i
                  key={i}
                  className={i < (quota?.remaining ?? 0) ? "available" : ""}
                />
              ))}
            </div>
          </div>
          {quotaError && (
            <div className="quota-error">
              {quotaError}
              <button onClick={() => void refreshQuota()}>重新读取</button>
            </div>
          )}
          <div className="personal-api">
            <label className="own-key-toggle">
              <input
                type="checkbox"
                checked={ownKey}
                disabled={busy || quota?.remaining === 0}
                onChange={(e) => setOwnKey(e.target.checked)}
              />
              <span>
                {quota?.remaining === 0
                  ? "体验已用完，使用自己的 API Key 继续"
                  : "使用自己的 API Key，不消耗共享体验"}
              </span>
            </label>
            {ownKey && (
              <div className="key-settings">
                <label htmlFor="personal-api-key">硅基流动 API Key</label>
                <div className="key-input-row">
                  <input
                    id="personal-api-key"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={203}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-…"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    disabled={busy || !apiKey}
                    onClick={() => setApiKey("")}
                  >
                    清除
                  </button>
                </div>
                <label htmlFor="personal-model">生图模型</label>
                <select
                  id="personal-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={busy}
                >
                  {(
                    quota?.models || [
                      { id: "Kwai-Kolors/Kolors", label: "Kolors · 经济生图" },
                      { id: "Qwen/Qwen-Image", label: "Qwen-Image · 精细生图" },
                    ]
                  ).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p>
                  密钥仅在当前窗口用于生成请求，不写入持久存储；关闭窗口即清除。费用与额度由你的硅基流动账户承担。
                  <a
                    href="https://cloud.siliconflow.cn/account/ak"
                    target="_blank"
                    rel="noreferrer"
                  >
                    获取 API Key ↗
                  </a>
                </p>
              </div>
            )}
          </div>
          <label className="prompt-label" htmlFor="creation-prompt">
            你的灵感
          </label>
          <textarea
            id="creation-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={140}
            placeholder="例如：一座漂浮在星空中的城堡…"
            rows={4}
            disabled={busy}
          />
          <div className="prompt-bottom">
            <div className="prompt-tags">
              {["城堡", "心形", "星空", "小猫"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setPrompt(tag)}
                  disabled={busy}
                >
                  {tag}
                </button>
              ))}
            </div>
            <span className="mono muted">{prompt.length}/140</span>
          </div>
          <button
            className="button primary full-width"
            disabled={
              !prompt.trim() ||
              busy ||
              (ownKey
                ? !/^sk-[A-Za-z0-9_-]{20,200}$/.test(apiKey.trim())
                : quota?.remaining === 0)
            }
            onClick={() => void generate()}
          >
            {busy ? <span className="spinner" /> : <WandSparkles size={18} />}
            {busy ? "正在铸造你的宇宙…" : "生成关卡"}
            {!busy && <ArrowRight size={18} />}
          </button>
          <p className="privacy-note">
            {ownKey
              ? apiKey.trim()
                ? "使用个人密钥生成；不会回退到共享密钥。"
                : "填写自己的 API Key 后，即可继续生成。"
              : "共享模型：Kolors · 发起生成即计次，生成失败也会计次。"}
          </p>
        </>
      )}
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {preview && (
        <div className="creation-preview">
          <div className="creation-art">
            <BrickPreview level={preview} />
          </div>
          <div>
            <span className="eyebrow">READY TO PLAY</span>
            <h3>{shortName(preview.name)}</h3>
            <p>
              {preview.bricks.length} 块砖 · {preview.lives ?? 5} 次机会
            </p>
            <button className="button primary" onClick={() => onPlay(preview)}>
              <Play size={16} fill="currentColor" />
              开始挑战
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
