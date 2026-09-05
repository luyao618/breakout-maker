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
    subtitle: "一束光，化作三道轨迹",
    icon: Sparkles,
  },
  multiShot: { title: "流星齐射", subtitle: "三枚光球，同时出击", icon: Zap },
  fireball: {
    title: "烈焰穿透",
    subtitle: "击穿砖阵，让火焰蔓延",
    icon: Flame,
  },
  widePaddle: { title: "引力展开", subtitle: "接住更多可能", icon: Maximize2 },
  extraLife: {
    title: "星火重生",
    subtitle: "多一次机会，再来一场",
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
            ? `穿透模式 · ${snapshot.pulseTime.toFixed(1)}s`
            : ready
              ? "清场冲击 + 5 秒火球"
              : `击碎砖块，积蓄能量 · ${Math.floor(snapshot.energy)}%`}
        </small>
      </span>
      <kbd>E</kbd>
    </button>
  );
}

export function ArcadeOverlay({
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
  const latestCombo = [...engine.feedback]
    .reverse()
    .find(
      (event) =>
        event.kind === "brick" &&
        (event.points ?? 0) > 0 &&
        (event.combo ?? 0) >= 3,
    );
  const comboRecent =
    latestCombo &&
    engine.elapsed - latestCombo.time < 1.4 &&
    snapshot.status === "playing";
  const pulseEvent = [...engine.feedback]
    .reverse()
    .find((event) => event.kind === "pulse");
  const pulseRecent = pulseEvent && engine.elapsed - pulseEvent.time < 1.6;
  const info = pickup ? powerInfo[pickup.type] : null;
  const Icon = info?.icon ?? Sparkles;
  return (
    <div
      className={`arcade-overlay ${snapshot.pulseTime > 0 ? "overdrive-active" : ""}`}
      aria-hidden="true"
    >
      {snapshot.pulseTime > 0 && <div className="overdrive-frame" />}
      {pulseRecent && (
        <div className="nova-title" key={pulseEvent.id}>
          <span>SUPERNOVA</span>
          <strong>超 新 星</strong>
        </div>
      )}
      {comboRecent && !pulseRecent && (
        <div
          className={`combo-flash combo-tier-${Math.min(3, Math.floor((latestCombo.combo ?? 0) / 5))}`}
          key={latestCombo.id}
        >
          <span className="combo-number">
            {latestCombo.combo}
            <i>×</i>
          </span>
          <div>
            <strong>
              {(latestCombo.combo ?? 0) >= 10
                ? "势不可挡"
                : (latestCombo.combo ?? 0) >= 5
                  ? "连锁反应"
                  : "漂亮连击"}
            </strong>
            <span>CHAIN REACTION</span>
          </div>
        </div>
      )}
      {info && pickup && (
        <div
          className="pickup-announcement"
          key={pickup.id}
          style={
            {
              "--pickup-color": POWER_COLORS[pickup.type],
            } as React.CSSProperties
          }
        >
          <span className="pickup-symbol">
            <Icon size={24} />
          </span>
          <span>
            <strong>{info.title}</strong>
            <small>{info.subtitle}</small>
          </span>
        </div>
      )}
      <div className="active-power-strip">
        {snapshot.activePowerUps.map((power) => {
          const p = powerInfo[power.type];
          const PowerIcon = p.icon;
          return (
            <div
              key={power.type}
              style={
                {
                  "--pickup-color": POWER_COLORS[power.type],
                } as React.CSSProperties
              }
            >
              <PowerIcon size={13} />
              <span>{p.title}</span>
              <b>{Math.ceil(power.timer)}s</b>
              <i
                style={{
                  transform: `scaleX(${Math.min(1, power.timer / (power.type === "fireball" ? 8 : 10))})`,
                }}
              />
            </div>
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
