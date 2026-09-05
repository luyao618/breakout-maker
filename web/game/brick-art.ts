import type { BrickKind } from "./types";

/** The same engraved marks identify tactical bricks in 3D, previews and Canvas. */
export const BRICK_MARKS: Record<Exclude<BrickKind, "normal">, string> = {
  armor: "M24 22 H76 V49 Q74 68 50 81 Q26 68 24 49 Z M36 40 H64 M36 53 H64",
  reactor:
    "M50 22 L78 50 L50 78 L22 50 Z M50 8 V22 M50 78 V92 M8 50 H22 M78 50 H92 M43 43 H57 V57 H43 Z",
  accelerator: "M25 26 L50 47 L75 26 M25 51 L50 72 L75 51",
};

export const BRICK_INFO = {
  armor: { title: "装甲", color: "#b8ccf4", rule: "2–3 次命中 · 阻挡穿透" },
  reactor: { title: "反应堆", color: "#ffc971", rule: "击破弱点 · 周围爆破" },
  accelerator: {
    title: "加速",
    color: "#80efc8",
    rule: "命中提速 · 上限 130%",
  },
} as const;

export function drawBrickMark(
  context: CanvasRenderingContext2D,
  kind: Exclude<BrickKind, "normal">,
  x: number,
  y: number,
  size: number,
): void {
  context.save();
  context.translate(x, y);
  context.scale(size / 100, size / 100);
  const path = new Path2D(BRICK_MARKS[kind]);
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = "#f5f3ff";
  context.lineWidth = 9;
  context.stroke(path);
  context.strokeStyle = "#172137";
  context.lineWidth = 5;
  context.stroke(path);
  context.restore();
}
