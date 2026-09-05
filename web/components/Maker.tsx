import { useState, useRef, useEffect } from "react";
import { ImagePlus, WandSparkles, ArrowRight, Play } from "lucide-react";
import { imageToLevel, generateLevel } from "../game/engine";
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
      );
      if (alive.current) setPreview(level);
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "暂时无法生成，请稍后重试。");
    } finally {
      if (alive.current) setBusy(false);
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
            disabled={!prompt.trim() || busy}
            onClick={() => void generate()}
          >
            {busy ? <span className="spinner" /> : <WandSparkles size={18} />}
            {busy ? "正在铸造你的宇宙…" : "生成关卡"}
            {!busy && <ArrowRight size={18} />}
          </button>
          <p className="privacy-note">
            由已连接的 AI 服务生成，复杂图案可能需要一些时间。
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
