import {
  Flame,
  Heart,
  Maximize2,
  Music2,
  Radio,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import type { GameEngine } from "../game/engine";
import type { GameSnapshot, PowerUpKind } from "../game/types";
import { POWER_COLORS } from "../game/feedback";

const powerInfo: Record<
  PowerUpKind,
  { title: string; subtitle: string; icon: typeof Zap }
> = {
  split: {
    title: "光球裂变",
    subtitle: "新增两球 · 场上最多四球",
    icon: Sparkles,
  },
  multiShot: {
    title: "流星齐射",
    subtitle: "挡板发出两球 · 上限四球",
    icon: Zap,
  },
  fireball: {
    title: "烈焰穿透",
    subtitle: "单球强化 · 4 秒 / 6 次碰砖",
    icon: Flame,
  },
  widePaddle: {
    title: "引力展开",
    subtitle: "挡板加宽 25% · 持续 7 秒",
    icon: Maximize2,
  },
  extraLife: {
    title: "星火重生",
    subtitle: "恢复一命 · 每局限一次",
    icon: Heart,
  },
};

export function PulseControl({
  snapshot,
  onPulse,
  compact = false,
}: {
  snapshot: GameSnapshot;
  onPulse: () => void;
  compact?: boolean;
}) {
  const ready = snapshot.pulseReady;
  const active = snapshot.pulseTime > 0;
  return (
    <button
      className={`pulse-control ${ready ? "charged" : ""} ${active ? "overdriving" : ""} ${compact ? "compact" : ""}`}
      disabled={!ready || snapshot.status !== "playing"}
      onClick={onPulse}
      aria-label={
        ready ? "释放超新星脉冲" : `超新星蓄能 ${Math.floor(snapshot.energy)}%`
      }
    >
      <span className="pulse-reactor">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="27" className="reactor-track" />
          <circle
            cx="32"
            cy="32"
            r="27"
            className="reactor-fill"
            strokeDasharray="169.65"
            strokeDashoffset={169.65 * (1 - snapshot.energy / 100)}
          />
        </svg>
        <Zap size={22} fill={ready ? "currentColor" : "none"} />
      </span>
      <span className="pulse-label">
        <span className="eyebrow">
          {active ? "OVERDRIVE" : ready ? "READY TO IGNITE" : "SUPERNOVA"}
        </span>
        <strong>
          {active ? "超新星爆发" : ready ? "释放超新星" : "超新星蓄能"}
        </strong>
        <small>
          {active
            ? "定向冲击 · 每块 1 点伤害"
            : ready
              ? "跟随挡板瞄准 · 最多命中 5 砖"
              : `击碎砖块，积蓄能量 · ${Math.floor(snapshot.energy)}%`}
        </small>
      </span>
      <kbd>E</kbd>
    </button>
  );
}

/** Only a border treatment remains on the playfield; all status text is outside it. */
export function ArcadeOverlay({ snapshot }: { snapshot: GameSnapshot }) {
  return snapshot.pulseTime > 0 ? (
    <div className="arcade-overlay overdrive-active" aria-hidden="true">
      <div className="overdrive-frame" />
    </div>
  ) : null;
}

/** One universal status area inside the page header, outside every playfield. */
export function PowerStatusBar({
  engine,
  snapshot,
}: {
  engine: GameEngine;
  snapshot: GameSnapshot;
}) {
  const pickup =
    snapshot.lastPickup && engine.elapsed - snapshot.lastPickup.time < 2.6
      ? snapshot.lastPickup
      : null;
  const info = pickup ? powerInfo[pickup.type] : null;
  const pulseActive = snapshot.pulseTime > 0;
  const Icon = info?.icon ?? (pulseActive ? Zap : Sparkles);
  return (
    <div className="power-status-bar" aria-label="道具状态">
      <div
        className={`power-status-message ${pickup ? "has-pickup" : ""}`}
        role={pickup ? "status" : undefined}
        style={
          pickup
            ? ({
                "--pickup-color": POWER_COLORS[pickup.type],
              } as React.CSSProperties)
            : undefined
        }
      >
        <Icon size={13} />
        <span>
          {info
            ? `获得${info.title}`
            : pulseActive
              ? "超新星 · 定向破甲"
              : snapshot.combo >= 3
                ? `连锁反应 · ×${snapshot.combo}`
                : snapshot.activePowerUps.length
                  ? "道具效果持续中"
                  : `光球 ${snapshot.ballCount}/4 · 瞄准弱点`}
        </span>
      </div>
      <div className="power-status-timers" aria-label="持续效果倒计时">
        {snapshot.activePowerUps.map((power) => {
          const PowerIcon = powerInfo[power.type].icon;
          return (
            <span
              key={power.type}
              title={powerInfo[power.type].title}
              style={{ color: POWER_COLORS[power.type] }}
            >
              <PowerIcon size={12} />
              <b>{Math.ceil(power.timer)}s</b>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function AudioDeck({
  muted,
  music,
  onMute,
  onMusic,
}: {
  muted: boolean;
  music: boolean;
  onMute: () => void;
  onMusic: () => void;
}) {
  return (
    <div className="audio-deck">
      <div className="audio-deck-label">
        <Radio size={12} />
        <span className="eyebrow">SONIC ATMOSPHERE</span>
      </div>
      <div>
        <button
          className={!muted ? "enabled" : ""}
          aria-pressed={!muted}
          onClick={onMute}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}空间音效
          <span>{muted ? "OFF" : "ON"}</span>
        </button>
        <button
          className={music ? "enabled" : ""}
          aria-pressed={music}
          onClick={onMusic}
        >
          <Music2 size={15} />
          星际电台<span>{music ? "ON" : "OFF"}</span>
        </button>
      </div>
      <p>戴上耳机，听见每一次反弹。</p>
    </div>
  );
}
