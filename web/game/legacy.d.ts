import type { ActivePowerUp, BrickColor, Level, PowerUpKind } from "./types";

export const C: {
  FIXED_DT: number;
  MAX_STEPS: number;
  MAX_ACCUMULATOR: number;
  BALL_RADIUS: number;
  BALL_SPEED: number;
  MIN_VY_RATIO: number;
  LAUNCH_ANGLE: number;
  PADDLE_HEIGHT: number;
  MAX_PADDLE_SPEED: number;
  PADDLE_SMOOTHING: number;
  MAX_REFLECT_ANGLE: number;
  BRICK_GAP: number;
  INDESTRUCTIBLE_HP: number;
  IRONCLAD_HP: number;
  DEFAULT_LIVES: number;
  COMBO_TIMEOUT: number;
  COMBO_MULT: number;
  BASE_SCORE: number;
  PLAY_TOP: number;
  PLAY_BOTTOM_MARGIN: number;
  SCREEN_W: number;
  SCREEN_H: number;
};
export const Theme: {
  brick: Record<string, [string, string]>;
  [key: string]: unknown;
};
export const PowerUpType: {
  SPLIT: "split";
  MULTI_SHOT: "multiShot";
  FIREBALL: "fireball";
  WIDE_PADDLE: "widePaddle";
  EXTRA_LIFE: "extraLife";
};
export const POWER_UP_WEIGHTS: { type: PowerUpKind; weight: number }[];
export const POWER_UP_DROP_CHANCE: number;
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export class Ball {
  constructor(x: number, y: number, radius?: number);
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  speed: number;
  isFireball: boolean;
  fireballTimer: number;
  trail: { x: number; y: number }[];
  _dead?: boolean;
  launch(angle?: number): void;
  normalizeSpeed(): void;
  update(dt: number): void;
}
export class Paddle {
  constructor(x: number, y: number, width: number, height?: number);
  x: number;
  y: number;
  width: number;
  height: number;
  baseWidth: number;
  isWide: boolean;
  wideTimer: number;
  _targetX: number;
  setWide(duration: number): void;
  update(dt: number): void;
  moveTo(x: number, screenW: number): void;
  getBounds(): Bounds;
}
export class Brick {
  constructor(row: number, col: number, hp?: number, color?: BrickColor | null);
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  color: BrickColor | null;
  alive: boolean;
  shakeTimer: number;
  hit(isFireball?: boolean): boolean;
  update(dt: number): void;
}
export class BrickField {
  constructor(level: Level, screenW: number);
  gridW: number;
  gridH: number;
  bricks: (Brick | null)[][];
  totalDestructible: number;
  destroyed: number;
  brickW: number;
  brickH: number;
  offsetX: number;
  offsetY: number;
  getBrickRect(row: number, col: number): Rect;
  isCleared(): boolean;
  update(dt: number): void;
}
export class PowerUpDrop {
  constructor(x: number, y: number, type: PowerUpKind);
  x: number;
  y: number;
  type: PowerUpKind;
  radius: number;
  vy: number;
  alive: boolean;
  rotation: number;
  update(dt: number): void;
}
export class Particle {
  constructor(x: number, y: number, color: string);
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  readonly alpha: number;
  readonly dead: boolean;
  update(dt: number): void;
}
export class CollisionDetector {
  static sweepBallVsRect(
    ball: Ball,
    rect: Rect,
    dt: number,
  ): { t: number; nx: number; ny: number } | null;
}
export class PhysicsWorld {
  constructor(
    brickField: BrickField,
    paddle: Paddle,
    screenW: number,
    screenH: number,
  );
  bf: BrickField;
  paddle: Paddle;
  screenW: number;
  screenH: number;
  onBrickHit:
    | ((row: number, col: number, destroyed: boolean, brick: Brick) => void)
    | null;
  onBallLost: ((ball: Ball) => void) | null;
  onPaddleHit: ((ball: Ball) => void) | null;
  tick(balls: Ball[], dt: number): void;
}
export class ScoreSystem {
  score: number;
  _combo: number;
  _lastHit: number;
  comboTexts: { text: string; timer: number }[];
  onBrickHit(destroyed: boolean): void;
  update(dt: number): void;
}
export interface LegacyGameHost {
  renderer: { invalidateBrickCache(): void };
  stateMachine: { transition(state: string, data?: unknown): void };
}
export class GameScene {
  constructor(game: LegacyGameHost);
  balls: Ball[];
  paddle: Paddle;
  brickField: BrickField;
  physics: PhysicsWorld;
  scoreSystem: ScoreSystem;
  powerUpDrops: PowerUpDrop[];
  activePowerUps: ActivePowerUp[];
  particles: Particle[];
  level: Level;
  levelIndex: number;
  lives: number;
  _launched: boolean;
  _pendingTransition: { state: string; data: unknown } | null;
  enter(data: { level: Level; levelIndex: number }): void;
  exit(preserveState?: boolean): void;
  update(dt: number): void;
  onTap(x: number, y: number): void;
  onMove(x: number, y?: number): void;
  _activatePowerUp(type: PowerUpKind): void;
  _spawnBallOnPaddle(): void;
}
export class BrickMapper {
  static imageToLevel(
    imageData: Pick<ImageData, "data" | "width" | "height">,
    gridWidth?: number,
    gridHeight?: number,
  ): Level;
}
export class MedianCut {
  static quantize(pixels: number[][], count: number): number[][];
  static closestColor(pixel: number[], palette: number[][]): number[];
}
export const audio: {
  ctx: AudioContext | null;
  sfxGain: GainNode | null;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  _initialized: boolean;
  init(): void;
  toggleSfx(): void;
  stopMusic(): void;
};
export const LEVEL_DATA: Level[];
export function getPresetLevel(index: number): Level | null;
export function getTotalLevels(): number;
export function _applyColors(level: Level): Level;
