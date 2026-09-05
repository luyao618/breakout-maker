import {
  C,
  GameScene,
  LEVEL_DATA,
  BrickMapper,
  _applyColors,
  audio,
  PowerUpDrop,
  PowerUpType,
  POWER_UP_WEIGHTS,
} from "./legacy.js";
import type { Ball, PhysicsWorld } from "./legacy.js";
import { FeedbackStream, POWER_COLORS } from "./feedback";
import type {
  GameFeedback,
  GameProgress,
  GameSnapshot,
  GameStatus,
  Level,
  LevelBrick,
  PowerUpKind,
} from "./types";

export type {
  ActivePowerUp,
  BrickColor,
  GameProgress,
  GameSnapshot,
  GameStatus,
  GameFeedback,
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

/** Campaign access is open; legacy saves can no longer lock any stage. */
export function loadProgress(): GameProgress {
  return { unlockedLevels: levels.length, levelVersion: LEVEL_VERSION };
}

/** Keep the original persistence API compatible without restoring level gates. */
export function saveProgress(_progress: GameProgress): GameProgress {
  const next = loadProgress();
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    /* Optional storage. */
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
  elapsed = 0;
  private energy = 0;
  private pulseTime = 0;
  private bestCombo = 0;
  private lastComboTime = -Infinity;
  private lastPickup: GameSnapshot["lastPickup"] = null;
  private readonly feedbackStream = new FeedbackStream();
  private applyingPulse = false;
  private hasDroppedPower = false;
  private bricksWithoutDrop = 0;
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
    this.installFeedback();
    this.lastSnapshot = this.snapshot();
    this.publish(true);
  }

  get phase(): GameStatus {
    return this.status;
  }

  get feedback(): readonly GameFeedback[] {
    return this.feedbackStream.recent;
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
      const running = this.scene._launched;
      if (running) {
        this.elapsed += C.FIXED_DT;
        this.attractDrops(C.FIXED_DT);
      }
      const waitingPaddle = !running
        ? {
            width: this.scene.paddle.width,
            wideTimer: this.scene.paddle.wideTimer,
            isWide: this.scene.paddle.isWide,
          }
        : null;
      this.scene.update(C.FIXED_DT);
      // Legacy pre-launch movement also ticks the paddle effect; keep all effect
      // durations on the same simulation clock while waiting to relaunch.
      if (waitingPaddle) Object.assign(this.scene.paddle, waitingPaddle);
      if (running) this.pulseTime = Math.max(0, this.pulseTime - C.FIXED_DT);
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
    this.feedbackStream.emit(this.elapsed, {
      kind: "launch",
      x: this.scene.paddle.x,
      y: this.scene.balls[0]?.y ?? this.scene.paddle.y,
      color: "#b9fbff",
      strength: 0.7,
    });
    this.publish(true);
  }

  /** Discharge a charged reactor into the exposed edge of the remaining field. */
  activatePulse(): boolean {
    if (this.disposed || this.status !== "playing" || this.energy < 100)
      return false;
    const field = this.scene.brickField;
    const exposed = [];
    for (let col = 0; col < field.gridW; col++) {
      for (let row = field.gridH - 1; row >= 0; row--) {
        const brick = field.bricks[row][col];
        if (!brick?.alive) continue;
        const rect = field.getBrickRect(row, col);
        exposed.push({ brick, x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });
        break;
      }
    }
    // Anchor the blast to an actual brick, including sparse image/custom grids.
    exposed.sort(
      (a, b) =>
        b.y - a.y ||
        Math.abs(a.x - this.scene.paddle.x) -
          Math.abs(b.x - this.scene.paddle.x),
    );
    const anchor = exposed[0];
    if (!anchor) return false;
    const targets = exposed
      .filter(
        (target) => Math.hypot(target.x - anchor.x, target.y - anchor.y) <= 140,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - anchor.x, a.y - anchor.y) -
          Math.hypot(b.x - anchor.x, b.y - anchor.y),
      )
      .slice(0, 10);

    this.energy = 0;
    this.pulseTime = 5;
    for (const ball of this.scene.balls) {
      ball.isFireball = true;
      ball.fireballTimer = Math.max(ball.fireballTimer, 5);
    }
    const fire = this.scene.activePowerUps.find(
      (power) => power.type === "fireball",
    );
    if (fire) fire.timer = Math.max(fire.timer, 5);
    else this.scene.activePowerUps.push({ type: "fireball", timer: 5 });
    this.feedbackStream.emit(this.elapsed, {
      kind: "pulse",
      x: anchor.x,
      y: anchor.y,
      color: "#c5a5ff",
      strength: 1,
    });
    this.applyingPulse = true;
    try {
      for (const { brick } of targets) {
        const destroyed = brick.hit(true);
        if (destroyed) field.destroyed++;
        this.scene.physics.onBrickHit?.(brick.row, brick.col, destroyed, brick);
      }
    } finally {
      this.applyingPulse = false;
    }
    // Skill damage can clear the final brick outside the regular physics tick.
    if (this.scene._pendingTransition) {
      const pending = this.scene._pendingTransition;
      this.scene._pendingTransition = null;
      this.transition(pending.state);
    }
    this.publish(true);
    return true;
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
    this.elapsed = 0;
    this.energy = 0;
    this.pulseTime = 0;
    this.bestCombo = 0;
    this.lastComboTime = -Infinity;
    this.lastPickup = null;
    this.hasDroppedPower = false;
    this.bricksWithoutDrop = 0;
    this.feedbackStream.clear();
    this.installFeedback();
    this.status = "ready";
    this.resumeStatus = "ready";
    this.accumulator = 0;
    this.secondsSinceNotification = 0;
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
          lastPickup: this.lastSnapshot.lastPickup
            ? { ...this.lastSnapshot.lastPickup }
            : null,
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

  private installFeedback(): void {
    const scene = this.scene;
    const physics = scene.physics as PhysicsWorld & {
      _wallCollision(ball: Ball): void;
    };
    const originalBrickHit = physics.onBrickHit;
    const originalPaddleHit = physics.onPaddleHit;
    const originalBallLost = physics.onBallLost;
    const originalWallCollision = physics._wallCollision.bind(physics);

    // Preserve the original score formula while making its timeout pause-safe.
    scene.scoreSystem.onBrickHit = (destroyed) => {
      if (!destroyed) return;
      const score = scene.scoreSystem;
      score._combo =
        (this.elapsed - this.lastComboTime) * 1000 < C.COMBO_TIMEOUT
          ? score._combo + 1
          : 1;
      this.lastComboTime = this.elapsed;
      score._lastHit = this.elapsed * 1000;
      const points = Math.round(
        C.BASE_SCORE * (1 + (score._combo - 1) * C.COMBO_MULT),
      );
      score.score += points;
      this.bestCombo = Math.max(this.bestCombo, score._combo);
      if (score._combo >= 2) {
        score.comboTexts.push({
          text: `${score._combo}x Combo! +${points}`,
          timer: 1,
        });
      }
    };

    physics.onBrickHit = (row, col, destroyed, brick) => {
      const priorDrops = scene.powerUpDrops.length;
      const priorScore = scene.scoreSystem.score;
      originalBrickHit?.(row, col, destroyed, brick);
      const rect = scene.brickField.getBrickRect(row, col);
      const x = rect.x + rect.w / 2;
      const y = rect.y + rect.h / 2;
      const color = Array.isArray(brick.color)
        ? brick.color[0]
        : brick.color || "#b0a6ff";
      const combo = scene.scoreSystem._combo;
      this.feedbackStream.emit(this.elapsed, {
        kind: "brick",
        x,
        y,
        color,
        combo,
        points: scene.scoreSystem.score - priorScore,
        strength: destroyed ? Math.min(1.5, 0.9 + combo * 0.06) : 0.32,
      });
      if (!destroyed) return;

      // Direct pulse strikes and its fireballs cannot immediately recharge it.
      if (!this.applyingPulse && this.pulseTime <= 0) {
        this.energy = Math.min(
          100,
          this.energy + 9 + Math.min(3, Math.max(0, combo - 1)),
        );
      }

      if (scene.powerUpDrops.length === priorDrops) {
        this.bricksWithoutDrop++;
        const firstDropDue =
          !this.hasDroppedPower && scene.brickField.destroyed >= 4;
        if (firstDropDue || this.bricksWithoutDrop >= 7) {
          let kind: PowerUpKind = PowerUpType.SPLIT;
          if (!firstDropDue) {
            let roll =
              Math.random() *
              POWER_UP_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
            for (const entry of POWER_UP_WEIGHTS) {
              roll -= entry.weight;
              if (roll <= 0) {
                kind = entry.type;
                break;
              }
            }
          }
          scene.powerUpDrops.push(new PowerUpDrop(x, y, kind));
        }
      }
      const spawned = scene.powerUpDrops.slice(priorDrops);
      if (spawned.length > 0) {
        this.hasDroppedPower = true;
        this.bricksWithoutDrop = 0;
        for (const drop of spawned) {
          this.feedbackStream.emit(this.elapsed, {
            kind: "powerSpawn",
            x: drop.x,
            y: drop.y,
            color: POWER_COLORS[drop.type],
            power: drop.type,
            strength: 0.65,
          });
        }
      }
    };

    physics._wallCollision = (ball) => {
      const x = ball.x;
      const y = ball.y;
      originalWallCollision(ball);
      if (ball.x !== x || ball.y !== y) {
        this.feedbackStream.emit(this.elapsed, {
          kind: "wall",
          x: ball.x,
          y: ball.y,
          color: ball.isFireball ? "#ffb978" : "#85eaff",
          strength: 0.2,
        });
      }
    };
    physics.onPaddleHit = (ball) => {
      originalPaddleHit?.(ball);
      this.feedbackStream.emit(this.elapsed, {
        kind: "paddle",
        x: ball.x,
        y: ball.y,
        color: "#9bfff5",
        strength: 0.5,
      });
    };
    physics.onBallLost = (ball) => {
      originalBallLost?.(ball);
      if (scene.balls.every((candidate) => candidate._dead)) {
        this.lastComboTime = -Infinity;
        this.feedbackStream.emit(this.elapsed, {
          kind: "lifeLost",
          x: ball.x,
          y: C.SCREEN_H - 50,
          color: "#ff789d",
          strength: 1,
        });
      }
    };

    scene._activatePowerUp = (type) => {
      GameScene.prototype._activatePowerUp.call(scene, type);
      // A life caught on the exact final-ball frame is still a successful rescue.
      if (
        type === "extraLife" &&
        scene.lives > 0 &&
        scene.balls.length === 0 &&
        scene._pendingTransition?.state === "LOSE"
      ) {
        scene._pendingTransition = null;
        scene._spawnBallOnPaddle();
      }
      // Repeated split drops stay spectacular without unbounded exponential work.
      if (scene.balls.length > 24) scene.balls.length = 24;
      if (this.pulseTime > 0) {
        for (const ball of scene.balls) {
          ball.isFireball = true;
          ball.fireballTimer = Math.max(ball.fireballTimer, this.pulseTime);
        }
      }
      const longest = new Map<PowerUpKind, number>();
      for (const power of scene.activePowerUps) {
        longest.set(
          power.type,
          Math.max(longest.get(power.type) ?? 0, power.timer),
        );
      }
      scene.activePowerUps = [...longest].map(([powerType, timer]) => ({
        type: powerType,
        timer,
      }));
      const event = this.feedbackStream.emit(this.elapsed, {
        kind: "powerCollect",
        x: scene.paddle.x,
        y: scene.paddle.y,
        power: type,
        color: POWER_COLORS[type],
        strength: 1,
      });
      this.lastPickup = { id: event.id, type, time: this.elapsed };
    };
  }

  private attractDrops(dt: number): void {
    const paddle = this.scene.paddle;
    for (const drop of this.scene.powerUpDrops) {
      const dy = paddle.y - drop.y;
      const dx = paddle.x - drop.x;
      if (
        !drop.alive ||
        dy < 0 ||
        dy > 130 ||
        Math.abs(dx) > paddle.width / 2 + 55
      )
        continue;
      // A gentle final approach assists near catches, while steering still matters.
      const movement = Math.min(Math.abs(dx), (28 + 70 * (1 - dy / 130)) * dt);
      drop.x += Math.sign(dx) * movement;
    }
  }

  private transition(state: string): void {
    if (state === "PAUSED") {
      this.pause();
      return;
    }
    if (state !== "WIN" && state !== "LOSE") return;
    this.status = state === "WIN" ? "won" : "lost";
    this.feedbackStream.emit(this.elapsed, {
      kind: state === "WIN" ? "win" : "lose",
      x: C.SCREEN_W / 2,
      y: state === "WIN" ? 270 : this.scene.paddle.y,
      color: state === "WIN" ? "#b1ffe2" : "#ff869e",
      strength: 1,
    });
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
        (this.elapsed - this.lastComboTime) * 1000 < C.COMBO_TIMEOUT
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
      energy: this.energy,
      pulseReady: this.energy >= 100,
      pulseTime: this.pulseTime,
      bestCombo: this.bestCombo,
      elapsed: this.elapsed,
      lastPickup: this.lastPickup ? { ...this.lastPickup } : null,
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

export interface GenerationQuota {
  limit: number;
  used: number;
  remaining: number;
  defaultModel?: string;
  models?: { id: string; label: string }[];
}
export interface GenerationCredentials {
  apiKey: string;
  model?: string;
}
export class GenerationError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly quota?: GenerationQuota,
  ) {
    super(message);
  }
}
export async function getGenerationQuota(
  signal?: AbortSignal,
): Promise<GenerationQuota> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}api/generation-quota`,
    { signal, cache: "no-store" },
  );
  if (!response.ok) throw new Error("暂时无法读取体验次数，请稍后重试");
  const data = await response.json();
  if (
    !data ||
    !Number.isInteger(data.remaining) ||
    !Number.isInteger(data.limit)
  )
    throw new Error("体验次数返回异常");
  return data;
}

/** Calls the existing creative service; network and validation failures stay visible. */
export async function generateLevel(
  prompt: string,
  signal?: AbortSignal,
  credentials?: GenerationCredentials,
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
    const response = await fetch(
      `${import.meta.env.BASE_URL}api/generate-level`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: description,
          ...(credentials
            ? { apiKey: credentials.apiKey.trim(), model: credentials.model }
            : {}),
        }),
        signal: controller.signal,
      },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (
      !response.ok ||
      (isObject(payload) && typeof payload.error === "string")
    ) {
      throw new GenerationError(
        isObject(payload) && typeof payload.error === "string"
          ? payload.error
          : "创作服务暂时不可用，请稍后重试。",
        isObject(payload) && typeof payload.code === "string"
          ? payload.code
          : undefined,
        isObject(payload) && isObject(payload.quota)
          ? (payload.quota as unknown as GenerationQuota)
          : undefined,
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
