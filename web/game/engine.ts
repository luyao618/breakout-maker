import {
  C,
  GameScene,
  LEVEL_DATA,
  BrickMapper,
  _applyColors,
  audio,
} from "./legacy.js";
import type {
  GameProgress,
  GameSnapshot,
  GameStatus,
  Level,
  LevelBrick,
} from "./types";

export type {
  ActivePowerUp,
  BrickColor,
  GameProgress,
  GameSnapshot,
  GameStatus,
  Level,
  LevelBrick,
  PowerUpKind,
} from "./types";
export { C, PowerUpType } from "./legacy.js";

export const PROGRESS_KEY = "breakout-maker-progress";
export const LEVEL_VERSION = 3;
export const levels: Level[] = LEVEL_DATA.map(
  (level) => JSON.parse(JSON.stringify(level)) as Level,
);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reject malformed creative payloads before they reach the original grid engine. */
export function validateLevel(value: unknown): Level {
  if (!isObject(value)) throw new Error("关卡数据无效，请重新生成。");
  const { name, gridWidth, gridHeight, ballSpeed, paddleWidth, lives, bricks } =
    value;
  const integerInRange = (n: unknown, min: number, max: number): n is number =>
    typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
  const numberInRange = (n: unknown, min: number, max: number): n is number =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 240 ||
    !integerInRange(gridWidth, 1, 128) ||
    !integerInRange(gridHeight, 1, 128) ||
    !numberInRange(ballSpeed, 1, 2000) ||
    !numberInRange(paddleWidth, 1, C.SCREEN_W) ||
    !integerInRange(lives, 1, 9) ||
    !Array.isArray(bricks) ||
    bricks.length === 0 ||
    bricks.length > gridWidth * gridHeight
  ) {
    throw new Error("关卡数据不完整或超出范围，请重新生成。");
  }

  const occupied = new Set<number>();
  const cleanBricks: LevelBrick[] = bricks.map((brick: unknown) => {
    if (
      !isObject(brick) ||
      !integerInRange(brick.row, 0, gridHeight - 1) ||
      !integerInRange(brick.col, 0, gridWidth - 1) ||
      !integerInRange(brick.hp, 1, 999)
    ) {
      throw new Error("关卡包含无效砖块，请重新生成。");
    }
    const cellSpan = (C.SCREEN_W - 20 + C.BRICK_GAP) / gridWidth;
    const brickBottom =
      C.PLAY_TOP + 10 + (brick.row + 1) * cellSpan - C.BRICK_GAP;
    if (
      brickBottom >=
      C.SCREEN_H -
        C.PLAY_BOTTOM_MARGIN -
        C.PADDLE_HEIGHT / 2 -
        C.BALL_RADIUS * 2
    ) {
      throw new Error("砖块超出了可游玩的区域，请重新生成。");
    }
    const position = brick.row * gridWidth + brick.col;
    if (occupied.has(position))
      throw new Error("关卡包含重叠砖块，请重新生成。");
    occupied.add(position);
    const clean: LevelBrick = { row: brick.row, col: brick.col, hp: brick.hp };
    if (brick.color !== undefined && brick.color !== null) {
      const validColor = (color: unknown): color is string =>
        typeof color === "string" &&
        /^#[0-9a-f]{3,8}$/i.test(color) &&
        [4, 5, 7, 9].includes(color.length);
      if (validColor(brick.color)) clean.color = brick.color;
      else if (
        Array.isArray(brick.color) &&
        brick.color.length === 2 &&
        brick.color.every(validColor)
      )
        clean.color = [brick.color[0], brick.color[1]];
      else throw new Error("关卡包含无效颜色，请重新生成。");
    }
    return clean;
  });
  return {
    name,
    gridWidth,
    gridHeight,
    ballSpeed,
    paddleWidth,
    lives,
    bricks: cleanBricks,
  };
}

function normalizeUnlocked(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(
        levels.length,
        Math.max(Math.min(6, levels.length), Math.floor(value)),
      )
    : Math.min(6, levels.length);
}

/** Uses the original key and version, so existing players retain their campaign. */
export function loadProgress(): GameProgress {
  const initial: GameProgress = {
    unlockedLevels: Math.min(6, levels.length),
    levelVersion: LEVEL_VERSION,
  };
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(PROGRESS_KEY) || "null",
    );
    if (isObject(stored) && stored.levelVersion === LEVEL_VERSION) {
      return {
        unlockedLevels: normalizeUnlocked(stored.unlockedLevels),
        levelVersion: LEVEL_VERSION,
      };
    }
  } catch {
    // Storage can be disabled, full, or left with a malformed older save.
  }
  return initial;
}

export function saveProgress(progress: GameProgress): GameProgress {
  const next: GameProgress = {
    unlockedLevels: Math.max(
      loadProgress().unlockedLevels,
      normalizeUnlocked(progress.unlockedLevels),
    ),
    levelVersion: LEVEL_VERSION,
  };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    /* Offline play still works. */
  }
  return next;
}

export function setMuted(muted: boolean): void {
  audio.sfxEnabled = !muted;
  if (audio.sfxGain) audio.sfxGain.gain.value = muted ? 0 : 0.3;
}

export function isMuted(): boolean {
  return !audio.sfxEnabled;
}

function unlockAudio(): void {
  if (!audio.sfxEnabled || typeof window === "undefined") return;
  const compatibleWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  if (!window.AudioContext && !compatibleWindow.webkitAudioContext) return;
  try {
    audio.init();
  } catch {
    /* A denied audio device must not prevent launching. */
  }
}

/** A view-independent host around the original GameScene and 60 Hz simulation. */
export class GameEngine {
  readonly scene: GameScene;
  readonly level: Level;
  readonly levelIndex: number;
  status: GameStatus = "ready";
  private accumulator = 0;
  private disposed = false;
  private resumeStatus: "ready" | "playing" = "ready";
  private lastSnapshot: GameSnapshot;
  private lastSignature = "";
  private secondsSinceNotification = 0;
  private readonly onStateChange?: (snapshot: GameSnapshot) => void;

  constructor(
    level: Level,
    levelIndex: number,
    onStateChange?: (snapshot: GameSnapshot) => void,
  ) {
    this.level = validateLevel(level);
    this.levelIndex = Number.isInteger(levelIndex) ? levelIndex : -1;
    this.onStateChange = onStateChange;
    this.scene = new GameScene({
      renderer: {
        invalidateBrickCache() {
          /* Three reads the live brick grid. */
        },
      },
      stateMachine: { transition: (state) => this.transition(state) },
    });
    this.scene.enter({
      level: _applyColors(this.level),
      levelIndex: this.levelIndex,
    });
    this.lastSnapshot = this.snapshot();
    this.publish(true);
  }

  get phase(): GameStatus {
    return this.status;
  }

  update(dt: number): void {
    if (this.disposed || (this.status !== "ready" && this.status !== "playing"))
      return;
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.accumulator = Math.min(this.accumulator + dt, C.MAX_ACCUMULATOR);
    this.secondsSinceNotification += Math.min(dt, C.MAX_ACCUMULATOR);
    let steps = 0;
    while (
      this.accumulator + Number.EPSILON >= C.FIXED_DT &&
      steps < C.MAX_STEPS
    ) {
      this.scene.update(C.FIXED_DT);
      this.accumulator = Math.max(0, this.accumulator - C.FIXED_DT);
      steps++;
      // Legacy callbacks may have changed status during the tick.
      if (this.phase !== "ready" && this.phase !== "playing") break;
      this.status = this.scene._launched ? "playing" : "ready";
    }
    this.publish();
  }

  move(x: number): void {
    if (
      this.disposed ||
      (this.status !== "ready" && this.status !== "playing") ||
      !Number.isFinite(x)
    )
      return;
    this.scene.onMove(x);
  }

  launch(): void {
    if (this.disposed || this.status !== "ready") return;
    unlockAudio();
    this.scene._launched = true;
    for (const ball of this.scene.balls) {
      ball.speed = this.level.ballSpeed || C.BALL_SPEED;
      ball.launch();
    }
    this.status = "playing";
    this.publish(true);
  }

  pause(): void {
    if (this.disposed || (this.status !== "playing" && this.status !== "ready"))
      return;
    this.resumeStatus = this.status;
    this.status = "paused";
    this.accumulator = 0;
    this.publish(true);
  }

  resume(): void {
    if (this.disposed || this.status !== "paused") return;
    this.status = this.resumeStatus;
    this.accumulator = 0;
    this.publish(true);
  }

  restart(): void {
    if (this.disposed) return;
    this.scene.enter({
      level: _applyColors(this.level),
      levelIndex: this.levelIndex,
    });
    this.status = "ready";
    this.resumeStatus = "ready";
    this.accumulator = 0;
    this.publish(true);
  }

  setMuted(muted: boolean): void {
    setMuted(muted);
  }

  getSnapshot(): GameSnapshot {
    return this.disposed
      ? {
          ...this.lastSnapshot,
          activePowerUps: this.lastSnapshot.activePowerUps.map((p) => ({
            ...p,
          })),
        }
      : this.snapshot();
  }

  dispose(): void {
    if (this.disposed) return;
    this.lastSnapshot = this.snapshot();
    this.disposed = true;
    this.scene.exit();
    this.accumulator = 0;
  }

  private transition(state: string): void {
    if (state === "PAUSED") {
      this.pause();
      return;
    }
    if (state !== "WIN" && state !== "LOSE") return;
    this.status = state === "WIN" ? "won" : "lost";
    this.accumulator = 0;
    if (
      state === "WIN" &&
      this.levelIndex >= 0 &&
      this.levelIndex < levels.length
    ) {
      saveProgress({
        unlockedLevels: this.levelIndex + 2,
        levelVersion: LEVEL_VERSION,
      });
    }
  }

  private snapshot(): GameSnapshot {
    return {
      status: this.status,
      phase: this.status,
      score: this.scene.scoreSystem.score,
      lives: this.scene.lives,
      combo:
        performance.now() - this.scene.scoreSystem._lastHit < C.COMBO_TIMEOUT
          ? this.scene.scoreSystem._combo
          : 0,
      destroyed: this.scene.brickField.destroyed,
      total: this.scene.brickField.totalDestructible,
      levelIndex: this.levelIndex,
      levelName: this.level.name,
      activePowerUps: this.scene.activePowerUps.map(({ type, timer }) => ({
        type,
        timer,
      })),
    };
  }

  private publish(force = false): void {
    const next = this.snapshot();
    const signature = JSON.stringify({
      ...next,
      activePowerUps: next.activePowerUps.map((power) => ({
        ...power,
        timer: Math.ceil(power.timer * 10) / 10,
      })),
    });
    const meaningfulChange =
      next.status !== this.lastSnapshot.status ||
      next.score !== this.lastSnapshot.score ||
      next.lives !== this.lastSnapshot.lives ||
      next.destroyed !== this.lastSnapshot.destroyed;
    if (
      (force || meaningfulChange || this.secondsSinceNotification >= 0.1) &&
      signature !== this.lastSignature
    ) {
      this.lastSignature = signature;
      this.secondsSinceNotification = 0;
      this.lastSnapshot = next;
      this.onStateChange?.(next);
    }
  }
}

/** Same centered 56 × 40 crop and median-cut palette as the original image mode. */
export async function imageToLevel(file: File): Promise<Level> {
  if (file.type && !file.type.startsWith("image/"))
    throw new Error("请选择一张图片。");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("图片过大，请选择 10 MB 以内的图片。");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("无法读取这张图片，请尝试其他图片。"));
      img.src = objectUrl;
    });
    const gridW = 56,
      gridH = 40;
    const targetAspect = gridW / gridH;
    const sourceWidth = Math.min(
      image.naturalWidth,
      image.naturalHeight * targetAspect,
    );
    const sourceHeight = Math.min(
      image.naturalHeight,
      image.naturalWidth / targetAspect,
    );
    const canvas = document.createElement("canvas");
    canvas.width = gridW * 4;
    canvas.height = gridH * 4;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("当前浏览器无法读取图片像素。");
    context.drawImage(
      image,
      (image.naturalWidth - sourceWidth) / 2,
      (image.naturalHeight - sourceHeight) / 2,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const level = BrickMapper.imageToLevel(
      context.getImageData(0, 0, canvas.width, canvas.height),
      gridW,
      gridH,
    );
    if (level.bricks.length === 0)
      throw new Error(
        "这张图片太亮，没有可生成的砖块。请换一张色彩更丰富的图片。",
      );
    return validateLevel(level);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Calls the existing creative service; network and validation failures stay visible. */
export async function generateLevel(
  prompt: string,
  signal?: AbortSignal,
): Promise<Level> {
  const description = prompt.trim();
  if (!description) throw new Error("请先描述你想创造的关卡。");
  if (description.length > 140)
    throw new Error("请将创意描述控制在 140 字以内。");
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 180_000);
  try {
    const response = await fetch("/api/generate-level", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: description }),
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (
      !response.ok ||
      (isObject(payload) && typeof payload.error === "string")
    ) {
      throw new Error(
        isObject(payload) && typeof payload.error === "string"
          ? payload.error
          : "创作服务暂时不可用，请稍后重试。",
      );
    }
    return _applyColors(validateLevel(payload));
  } catch (error) {
    if (timedOut) throw new Error("创造关卡超时，请稍后重试。");
    if (error instanceof TypeError && !controller.signal.aborted) {
      throw new Error("暂时无法连接创作服务，请稍后重试。");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
