import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Command,
  Expand,
  Flame,
  Heart,
  ImagePlus,
  Layers3,
  LockKeyhole,
  Maximize2,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  WandSparkles,
  Zap,
} from "lucide-react";
import {
  GameEngine,
  levels,
  loadProgress,
  saveProgress,
  setMuted,
} from "./game/engine";
import type { GameSnapshot } from "./game/types";
import BrickPreview from "./components/BrickPreview";
import ModalFrame from "./components/ModalFrame";
import Maker from "./components/Maker";
import { shortName } from "./lib/display";

const Arena = lazy(() => import("./Arena"));
type Modal = "levels" | "image" | "create" | "help" | null;
const colors = [
  "#b7a1ff",
  "#8ee7f0",
  "#f8b78c",
  "#94b7ff",
  "#d0a4e8",
  "#b8dbaa",
];
const powerNames: Record<string, string> = {
  split: "分裂球",
  multiShot: "多重发射",
  fireball: "火球穿透",
  widePaddle: "加宽挡板",
  extraLife: "额外生命",
};
const formatScore = (value: number) => String(value).padStart(6, "0");

export default function App() {
  const [modal, setModal] = useState<Modal>(null);
  const [selected, setSelected] = useState(0);
  const [unlocked, setUnlocked] = useState(() => loadProgress().unlockedLevels);
  const [muted, updateMuted] = useState(() => {
    try {
      return localStorage.getItem("astral-forge-muted") === "true";
    } catch {
      return false;
    }
  });
  const [quality, setQuality] = useState<"high" | "low">("high");
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [toast, setToast] = useState("");
  const currentEngine = useRef<GameEngine | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMuted(muted);
    try {
      localStorage.setItem("astral-forge-muted", String(muted));
    } catch {
      /* Optional preference. */
    }
  }, [muted]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => () => currentEngine.current?.dispose(), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const start = (level = levels[selected], index = selected) => {
    currentEngine.current?.dispose();
    const game = new GameEngine(level, index);
    currentEngine.current = game;
    setEngine(game);
    setSnapshot(game.getSnapshot());
    setModal(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const leave = () => {
    currentEngine.current?.dispose();
    currentEngine.current = null;
    setEngine(null);
    setSnapshot(null);
  };
  const openModal = (next: Modal) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setModal(next);
  };
  const closeModal = () => {
    setModal(null);
    requestAnimationFrame(() => returnFocus.current?.focus());
  };

  useEffect(() => {
    if (!engine) return;
    let frame = 0;
    let last = performance.now();
    let lastUi = 0;
    const tick = (now: number) => {
      engine.update(Math.min((now - last) / 1000, 0.1));
      last = now;
      if (now - lastUi > 80) {
        setSnapshot(engine.getSnapshot());
        lastUi = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const visibility = () => {
      if (document.hidden) engine.pause();
      last = performance.now();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [engine]);

  useEffect(() => {
    if (snapshot?.status === "won" && snapshot.levelIndex >= 0) {
      const next = Math.min(
        levels.length,
        Math.max(unlocked, snapshot.levelIndex + 2),
      );
      setUnlocked(next);
      saveProgress({ ...loadProgress(), unlockedLevels: next });
    }
  }, [snapshot?.status, snapshot?.levelIndex, unlocked]);

  useEffect(() => {
    if (!engine || modal) return;
    const keys = new Set<string>();
    const down = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLButtonElement &&
        ["Space", "Enter"].includes(event.code)
      )
        return;
      if (
        [
          "ArrowLeft",
          "ArrowRight",
          "Space",
          "KeyA",
          "KeyD",
          "Escape",
          "KeyP",
        ].includes(event.code)
      )
        event.preventDefault();
      if (event.repeat && ["Space", "Escape", "KeyP"].includes(event.code))
        return;
      keys.add(event.code);
      if (event.code === "Space") {
        if (engine.status === "paused") engine.resume();
        else engine.launch();
      }
      if (event.code === "Escape" || event.code === "KeyP") {
        if (engine.status === "paused") engine.resume();
        else engine.pause();
      }
    };
    const up = (event: KeyboardEvent) => keys.delete(event.code);
    let frame: number;
    let last = performance.now();
    const move = (now: number) => {
      const direction =
        Number(keys.has("ArrowRight") || keys.has("KeyD")) -
        Number(keys.has("ArrowLeft") || keys.has("KeyA"));
      if (direction && engine.status !== "paused")
        engine.move(
          (engine.scene.paddle?.x ?? 187.5) +
            direction * Math.min((now - last) / 1000, 0.03) * 420,
        );
      last = now;
      frame = requestAnimationFrame(move);
    };
    const blur = () => {
      keys.clear();
      engine.pause();
    };
    frame = requestAnimationFrame(move);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [engine, modal]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setToast("当前浏览器暂不支持全屏显示。");
    }
  };
  const playing = !!engine;
  const selectedLevel = levels[selected];
  const progress = snapshot
    ? Math.round((snapshot.destroyed / Math.max(snapshot.total, 1)) * 100)
    : 0;

  return (
    <div className={`app ${playing ? "is-playing" : ""}`}>
      <div className="ambient" aria-hidden="true">
        <div className="ambient-cloud cloud-one" />
        <div className="ambient-cloud cloud-two" />
        <div className="star-dust" />
      </div>
      <header className="site-header">
        <button
          className="brand"
          aria-label="造砖厂首页"
          onClick={() => {
            if (playing) engine.pause();
            else closeModal();
          }}
        >
          <span className="brand-mark">
            <Layers3 size={25} strokeWidth={1.6} />
          </span>
          <span className="brand-name">
            BREAKOUT
            <span className="brand-small">
              MAKER <i /> 造砖厂
            </span>
          </span>
        </button>
        <nav aria-label="主导航">
          <button
            className={!modal ? "active" : ""}
            onClick={() => {
              if (playing) engine.pause();
              else closeModal();
            }}
          >
            星界大厅
          </button>
          <button
            onClick={() => {
              engine?.pause();
              openModal("create");
            }}
          >
            创造工坊<span className="nav-badge">AI</span>
          </button>
        </nav>
        <div className="header-tools">
          <span className="edition mono">
            ASTRAL EDITION <span>02</span>
          </span>
          <button
            className="icon-button"
            aria-label={muted ? "开启声音" : "关闭声音"}
            aria-pressed={!muted}
            onClick={() => updateMuted(!muted)}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            className="icon-button fullscreen-button"
            aria-label="切换全屏"
            onClick={() => void toggleFullscreen()}
          >
            <Expand size={18} />
          </button>
        </div>
      </header>

      {!playing ? (
        <main className="lobby">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <div className="hero-eyebrow">
                <span className="signal-dot" />
                <span className="eyebrow">
                  A LITTLE BREAK. A NEW DIMENSION.
                </span>
              </div>
              <h1 id="hero-title">
                把想象，
                <br />
                击成<span className="dream-word">星光</span>
                <span className="title-period">。</span>
              </h1>
              <p className="hero-description">
                熟悉的打砖块，不一样的宇宙。
                <br />
                在光影之间反弹，让每一次碰撞都有回响。
              </p>
              <button
                className="button primary hero-cta"
                onClick={() => start()}
              >
                <Play size={17} fill="currentColor" />
                开始游戏
                <span className="button-divider" />
                <ArrowRight size={20} />
              </button>
              <button
                className="text-button how-to"
                onClick={() => openModal("help")}
              >
                <CircleHelp size={14} />
                第一次来？了解玩法
              </button>
              <div className="hero-facts">
                <div>
                  <strong>
                    13<span>个</span>
                  </strong>
                  <span>手工打造的关卡</span>
                </div>
                <i />
                <div>
                  <strong>
                    05<span>种</span>
                  </strong>
                  <span>意想不到的道具</span>
                </div>
                <i />
                <div>
                  <strong>∞</strong>
                  <span>属于你的想象</span>
                </div>
              </div>
            </div>
            <div className="showcase">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <span className="orbit-satellite satellite-one" />
              <span className="orbit-satellite satellite-two" />
              <div className="showcase-topline">
                <span className="eyebrow">
                  <span className="tiny-plus">+</span> THE ASTRAL FORGE
                </span>
                <span className="mono">EST. 2026</span>
              </div>
              <div className="hero-arena">
                <Suspense
                  fallback={
                    <div className="scene-loading">
                      <span className="spinner" />
                      正在点亮星界…
                    </div>
                  }
                >
                  <Arena
                    engine={null}
                    variant="showcase"
                    quality={quality}
                    reducedMotion={reducedMotion}
                  />
                </Suspense>
              </div>
              <div className="object-tag tag-top">
                <span className="tag-line" />
                <span>
                  <small>物质 / MATTER</small>每一块，皆有光
                </span>
              </div>
              <div className="object-tag tag-bottom">
                <span className="tag-dot" />
                <span>经典引力，全新维度</span>
              </div>
              <div className="showcase-bottomline">
                <span>
                  <span className="signal-dot" />
                  无限想象，准备就绪
                </span>
                <span className="mono">
                  DRAG TO EXPLORE <MousePointer2 size={12} />
                </span>
              </div>
            </div>
          </section>
          <section className="modes" aria-labelledby="modes-title">
            <div className="section-heading">
              <div>
                <span className="eyebrow">CHOOSE YOUR ORBIT</span>
                <h2 id="modes-title">每一种灵感，都有入口。</h2>
              </div>
              <span className="section-aside">
                选择你的方式，进入星界 <ArrowDown size={15} />
              </span>
            </div>
            <div className="mode-grid">
              <button
                className="mode-card level-mode"
                onClick={() => openModal("levels")}
              >
                <div className="mode-meta">
                  <span className="mono">01 / EXPLORE</span>
                  <span className="mode-pill">{unlocked} / 13 已解锁</span>
                </div>
                <div className="mode-content">
                  <div className="mode-icon">
                    <Layers3 size={24} strokeWidth={1.3} />
                  </div>
                  <div>
                    <h3>关卡漫游</h3>
                    <p>从第一束光，到最后一场星雨。</p>
                  </div>
                  <ArrowUpRightIcon />
                </div>
                <div className="card-spectrum">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </button>
              <button
                className="mode-card image-mode"
                onClick={() => openModal("image")}
              >
                <div className="mode-meta">
                  <span className="mono">02 / TRANSFORM</span>
                  <span className="mode-pill">由你定义</span>
                </div>
                <div className="mode-content">
                  <div className="mode-icon">
                    <ImagePlus size={24} strokeWidth={1.3} />
                  </div>
                  <div>
                    <h3>图片造境</h3>
                    <p>把喜欢的画面，变成下一场挑战。</p>
                  </div>
                  <ArrowUpRightIcon />
                </div>
                <div className="card-dots" aria-hidden="true">
                  {Array.from({ length: 35 }, (_, i) => (
                    <i key={i} />
                  ))}
                </div>
              </button>
              <button
                className="mode-card create-mode"
                onClick={() => openModal("create")}
              >
                <div className="mode-meta">
                  <span className="mono">03 / IMAGINE</span>
                  <span className="mode-pill">
                    <Sparkles size={11} />
                    AI 驱动
                  </span>
                </div>
                <div className="mode-content">
                  <div className="mode-icon">
                    <WandSparkles size={24} strokeWidth={1.3} />
                  </div>
                  <div>
                    <h3>灵感铸造</h3>
                    <p>一句天马行空，一片独一无二。</p>
                  </div>
                  <ArrowUpRightIcon />
                </div>
                <div className="card-wave" aria-hidden="true" />
              </button>
            </div>
          </section>
        </main>
      ) : (
        <main className="play-layout">
          <aside className="mission-panel">
            <button
              className="text-button back-button"
              onClick={() => engine.pause()}
            >
              <ArrowLeft size={15} />
              暂停 / 返回大厅
            </button>
            <span className="eyebrow">CURRENT EXPEDITION</span>
            <div className="mission-number">
              {snapshot && snapshot.levelIndex >= 0
                ? String(snapshot.levelIndex + 1).padStart(2, "0")
                : "∞"}
              <span>
                / {snapshot && snapshot.levelIndex >= 0 ? "13" : "CUSTOM"}
              </span>
            </div>
            <h1>{snapshot ? shortName(snapshot.levelName) : ""}</h1>
            <p>
              接住每一束光。
              <br />
              直到最后一块砖，化作星尘。
            </p>
            <div className="mission-preview">
              <BrickPreview
                level={engine.scene.level}
                color={
                  colors[(snapshot?.levelIndex ?? 0) % colors.length] ||
                  colors[0]
                }
              />
            </div>
            <div className="mission-progress">
              <span>
                星域清理 <b>{progress}%</b>
              </span>
              <div>
                <i style={{ width: `${progress}%` }} />
              </div>
              <small className="mono">
                {snapshot?.destroyed} / {snapshot?.total} BRICKS
              </small>
            </div>
            <div className="play-control-help">
              <span>
                <MousePointer2 size={15} />
                移动鼠标 / 滑动屏幕
              </span>
              <span>
                <kbd>←</kbd>
                <kbd>→</kbd>移动挡板
              </span>
              <span>
                <kbd>SPACE</kbd>发射光球
              </span>
              <span>
                <kbd>ESC</kbd>暂停探索
              </span>
            </div>
          </aside>
          <section className="game-stage" aria-label="打砖块游戏区域">
            <div className="stage-top">
              <span>
                <i className="signal-dot" />
                {snapshot?.status === "playing"
                  ? "正在探索"
                  : snapshot?.status === "ready"
                    ? "等待发射"
                    : "星界航行"}
              </span>
              <button
                className="icon-button"
                aria-label="暂停游戏"
                onClick={() => engine.pause()}
              >
                <Pause size={16} />
              </button>
            </div>
            <div className="game-arena">
              <Suspense
                fallback={
                  <div className="scene-loading">
                    <span className="spinner" />
                    载入星域…
                  </div>
                }
              >
                <Arena
                  variant="play"
                  engine={engine}
                  onMove={(x) => engine.move(x)}
                  onLaunch={() => engine.launch()}
                  quality={quality}
                  reducedMotion={reducedMotion}
                />
              </Suspense>
            </div>
            {snapshot?.status === "ready" && (
              <button
                className="launch-overlay"
                onClick={() => engine.launch()}
              >
                <span className="launch-orb" />
                <strong>点击发射</strong>
                <span>或按空格，开启这段旅程</span>
              </button>
            )}
            {snapshot &&
              ["paused", "won", "lost"].includes(snapshot.status) && (
                <div className="game-overlay">
                  <div className="result-sigil">
                    {snapshot.status === "won" ? (
                      <Sparkles size={35} />
                    ) : snapshot.status === "lost" ? (
                      <RotateCcw size={33} />
                    ) : (
                      <Pause size={33} />
                    )}
                  </div>
                  <span className="eyebrow">
                    {snapshot.status === "paused"
                      ? "TAKE A BREATH"
                      : snapshot.status === "won"
                        ? "ORBIT COMPLETE"
                        : "ANOTHER CHANCE AWAITS"}
                  </span>
                  <h2>
                    {snapshot.status === "paused"
                      ? "让星光，等一会儿。"
                      : snapshot.status === "won"
                        ? "这片星光，属于你。"
                        : "再出发，仍有星光。"}
                  </h2>
                  <p>
                    {snapshot.status === "paused"
                      ? "你的探索进度已保留。"
                      : `本次得分 ${snapshot.score.toLocaleString()} · 击碎 ${snapshot.destroyed} 块砖`}
                  </p>
                  <div className="overlay-actions">
                    {snapshot.status === "paused" ? (
                      <button
                        className="button primary"
                        onClick={() => engine.resume()}
                      >
                        <Play size={16} />
                        继续游戏
                      </button>
                    ) : snapshot.status === "won" &&
                      snapshot.levelIndex >= 0 &&
                      snapshot.levelIndex < levels.length - 1 ? (
                      <button
                        className="button primary"
                        onClick={() => {
                          const index = snapshot.levelIndex + 1;
                          setSelected(index);
                          start(levels[index], index);
                        }}
                      >
                        下一关
                        <ArrowRight size={16} />
                      </button>
                    ) : null}
                    <button
                      className="button secondary"
                      onClick={() => engine.restart()}
                    >
                      <RotateCcw size={16} />
                      重新挑战
                    </button>
                    <button className="text-button" onClick={leave}>
                      返回星界大厅
                    </button>
                  </div>
                </div>
              )}
            <div className="stage-bottom">
              <span className="mono">ASTRAL FORGE / BREAKOUT MAKER</span>
              <span className="mono">375 × 667</span>
            </div>
          </section>
          <aside className="telemetry-panel">
            <div className="score-readout">
              <span className="eyebrow">你的得分 / SCORE</span>
              <strong className="mono">
                {formatScore(snapshot?.score ?? 0)}
              </strong>
            </div>
            <div className="life-readout">
              <span className="eyebrow">剩余机会 / LIVES</span>
              <div aria-label={`${snapshot?.lives} 次机会`}>
                {Array.from(
                  { length: Math.min(snapshot?.lives ?? 0, 9) },
                  (_, i) => (
                    <Heart key={i} size={20} fill="currentColor" />
                  ),
                )}
              </div>
            </div>
            <div className="combo-readout">
              <span className="eyebrow">当前连击 / COMBO</span>
              <strong>
                ×{snapshot?.combo || 0}
                <Zap size={20} />
              </strong>
            </div>
            <div className="power-guide">
              <span className="eyebrow">接住意外之喜</span>
              {Object.entries(powerNames).map(([key, label], i) => (
                <div key={key}>
                  <span className={`power-token power-${i}`}>
                    {
                      [
                        <Sparkles size={14} />,
                        <Zap size={14} />,
                        <Flame size={14} />,
                        <Maximize2 size={14} />,
                        <Heart size={14} />,
                      ][i]
                    }
                  </span>
                  <span>{label}</span>
                  {snapshot?.activePowerUps.find(
                    (power) => power.type === key,
                  ) && (
                    <b className="mono">
                      {Math.ceil(
                        snapshot.activePowerUps.find(
                          (power) => power.type === key,
                        )!.timer,
                      )}
                      s
                    </b>
                  )}
                </div>
              ))}
            </div>
            <button
              className="quality-toggle"
              onClick={() => setQuality(quality === "high" ? "low" : "high")}
            >
              <span className="signal-dot" />
              {quality === "high" ? "细腻画质" : "流畅画质"}
              <span>切换</span>
            </button>
          </aside>
        </main>
      )}
      <footer className="site-footer">
        <span>
          <span className="footer-star">✧</span>{" "}
          为每一次微小的碰撞，创造一点宇宙。
        </span>
        <div>
          <button
            onClick={() => {
              engine?.pause();
              openModal("help");
            }}
          >
            玩法指南 <ArrowRight size={12} />
          </button>
          <span className="mono">MADE OF BRICKS & DREAMS</span>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {modal === "levels" && (
        <ModalFrame
          title="下一站，哪片星域？"
          eyebrow="LEVEL SELECT / 13 ORBITS"
          onClose={closeModal}
          wide
        >
          <p className="modal-intro">
            前六关已为你点亮。完成挑战，解锁更远的风景。
          </p>
          <div className="level-grid">
            {levels.map((level, index) => (
              <button
                className={`level-card ${index === selected ? "selected" : ""}`}
                key={level.name}
                disabled={index >= unlocked}
                onClick={() => setSelected(index)}
              >
                <div className="level-card-top">
                  <span className="mono">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {index >= unlocked ? (
                    <LockKeyhole size={13} />
                  ) : index === selected ? (
                    <Check size={15} />
                  ) : null}
                </div>
                <BrickPreview
                  level={level}
                  color={colors[index % colors.length]}
                />
                <strong>{shortName(level.name)}</strong>
                <small>
                  {index >= unlocked
                    ? "完成前一关解锁"
                    : `${level.bricks.length} 块砖 · ${level.lives} 次机会`}
                </small>
              </button>
            ))}
          </div>
          <div className="level-select-footer">
            <div>
              <span className="eyebrow">准备探索</span>
              <strong>{shortName(selectedLevel.name)}</strong>
            </div>
            <button className="button primary" onClick={() => start()}>
              <Play size={16} fill="currentColor" />
              进入星域
              <ArrowRight size={18} />
            </button>
          </div>
        </ModalFrame>
      )}
      {(modal === "image" || modal === "create") && (
        <ModalFrame
          title={modal === "image" ? "让画面，有了引力。" : "想象，即将成形。"}
          eyebrow={
            modal === "image" ? "IMAGE TO ORBIT" : "THE IMAGINATION STUDIO"
          }
          onClose={closeModal}
        >
          <Maker mode={modal} onPlay={(level) => start(level, -1)} />
        </ModalFrame>
      )}
      {modal === "help" && (
        <ModalFrame
          title="一点反弹，无限可能。"
          eyebrow="A QUICK FIELD GUIDE"
          onClose={closeModal}
        >
          <p className="modal-intro">
            移动挡板接住光球，击碎所有砖块，即可完成关卡。
          </p>
          <div className="help-grid">
            <div>
              <MousePointer2 />
              <h3>跟随你的指尖</h3>
              <p>
                鼠标左右移动，或在游戏区域滑动。也可以用方向键 / A、D 控制挡板。
              </p>
            </div>
            <div>
              <Play />
              <h3>发射第一束光</h3>
              <p>
                点击游戏区域或按空格发球。落空会消耗一次机会，点击即可再次出发。
              </p>
            </div>
            <div>
              <Command />
              <h3>找到反弹的角度</h3>
              <p>
                挡板边缘让光球斜向反弹，中心让它更直。快速连续击碎砖块可获得连击加分。
              </p>
            </div>
            <div>
              <Sparkles />
              <h3>接住掉落的惊喜</h3>
              <p>
                五种道具随机掉落：分裂球、多重发射、火球穿透、加宽挡板和额外生命。
              </p>
            </div>
          </div>
          <div className="help-footer">
            <span>
              <kbd>ESC</kbd> / <kbd>P</kbd> 随时暂停 · 切换页面会自动暂停
            </span>
            <button className="button primary" onClick={closeModal}>
              准备好了
              <ArrowRight size={16} />
            </button>
          </div>
        </ModalFrame>
      )}
    </div>
  );
}

function ArrowUpRightIcon() {
  return (
    <span className="mode-arrow">
      <ArrowRight size={19} />
    </span>
  );
}
