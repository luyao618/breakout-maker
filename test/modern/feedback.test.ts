import { afterEach, describe, expect, it, vi } from "vitest";
import {
  C,
  GameEngine,
  PROGRESS_KEY,
  loadProgress,
} from "../../web/game/engine";
import { FeedbackStream } from "../../web/game/feedback";
import { PowerUpDrop, PowerUpType } from "../../web/game/legacy.js";
import type { Brick } from "../../web/game/legacy.js";
import type { Level } from "../../web/game/types";

function fixture(bricks?: Level["bricks"]): Level {
  return {
    name: "Reactor test",
    gridWidth: 16,
    gridHeight: 10,
    ballSpeed: 280,
    paddleWidth: 100,
    lives: 3,
    bricks:
      bricks ??
      [0, 5, 6].flatMap((row) =>
        Array.from({ length: 16 }, (_, col) => ({ row, col, hp: 1 })),
      ),
  };
}

function hit(engine: GameEngine, row: number, col: number) {
  const rect = engine.scene.brickField.getBrickRect(row, col);
  const ball = engine.scene.balls[0];
  ball.x = rect.x + rect.w / 2;
  ball.y = rect.y + rect.h + ball.radius + 2;
  ball.vx = 0;
  ball.vy = -ball.speed;
  engine.update(C.FIXED_DT);
}

function charge(engine: GameEngine) {
  for (let col = 0; col < 9; col++) hit(engine, 0, col);
  expect(engine.getSnapshot()).toMatchObject({ energy: 100, pulseReady: true });
}

function coast(engine: GameEngine, frames: number) {
  for (let i = 0; i < frames; i++) {
    for (const ball of engine.scene.balls) {
      ball.x = 180;
      ball.y = 450;
      ball.vx = 0;
      ball.vy = -ball.speed;
    }
    engine.update(C.FIXED_DT);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("reactor charge and exposed-field pulse", () => {
  it("requires full charge and live play, caps damage to 10 exposed bricks, and cannot recharge itself", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const engine = new GameEngine(fixture(), -1);
    expect(engine.activatePulse()).toBe(false);
    engine.launch();
    expect(engine.activatePulse()).toBe(false);
    charge(engine);
    engine.pause();
    const paused = engine.getSnapshot();
    expect(engine.activatePulse()).toBe(false);
    expect(engine.getSnapshot()).toEqual(paused);
    engine.resume();
    const scoreBefore = engine.getSnapshot().score;
    const destroyedBefore = engine.scene.brickField.destroyed;
    const rowsBefore = engine.scene.brickField.bricks.map(
      (row) => row.filter((brick) => brick?.alive).length,
    );
    expect(engine.activatePulse()).toBe(true);
    expect(engine.scene.brickField.destroyed - destroyedBefore).toBe(10);
    expect(
      engine.scene.brickField.bricks[0].filter((brick) => brick?.alive),
    ).toHaveLength(rowsBefore[0]);
    expect(
      engine.scene.brickField.bricks[5].filter((brick) => brick?.alive),
    ).toHaveLength(rowsBefore[5]);
    expect(engine.getSnapshot()).toMatchObject({
      energy: 0,
      pulseReady: false,
      pulseTime: 5,
      lives: 3,
    });
    expect(engine.getSnapshot().score).toBeGreaterThan(scoreBefore);
    expect(
      engine.scene.balls.every(
        (ball) => ball.isFireball && ball.fireballTimer === 5,
      ),
    ).toBe(true);
    const pulse = engine.feedback.find((event) => event.kind === "pulse")!;
    const emitted = engine.feedback.filter(
      (event) => event.kind === "brick" && event.id > pulse.id,
    );
    expect(emitted).toHaveLength(10);
    expect(
      emitted.every(
        (event) => Math.hypot(event.x - pulse.x, event.y - pulse.y) <= 140,
      ),
    ).toBe(true);
    expect(engine.activatePulse()).toBe(false);
    hit(engine, 0, 9);
    expect(engine.scene.brickField.bricks[0][9]?.alive).toBe(false);
    expect(engine.getSnapshot().energy).toBe(0);
    engine.scene.powerUpDrops = [];
    coast(engine, 301);
    expect(engine.getSnapshot().pulseTime).toBe(0);
    expect(engine.scene.balls.every((ball) => !ball.isFireball)).toBe(true);
    hit(engine, 0, 10);
    expect(engine.getSnapshot().energy).toBeGreaterThan(0);
    engine.dispose();
  });

  it("damages iron without awarding destruction score or energy and anchors sparse layouts to a real brick", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const engine = new GameEngine(
      fixture([
        ...Array.from({ length: 9 }, (_, col) => ({ row: 0, col, hp: 1 })),
        { row: 8, col: 0, hp: 999 },
        { row: 2, col: 15, hp: 1 },
      ]),
      -1,
    );
    engine.launch();
    charge(engine);
    const score = engine.getSnapshot().score;
    expect(engine.activatePulse()).toBe(true);
    const iron = engine.scene.brickField.bricks[8][0] as Brick;
    const ironRect = engine.scene.brickField.getBrickRect(8, 0);
    expect(iron).toMatchObject({ alive: true, hp: 9 });
    expect(engine.getSnapshot()).toMatchObject({
      score,
      destroyed: 9,
      energy: 0,
      status: "playing",
    });
    expect(engine.scene.brickField.bricks[2][15]?.alive).toBe(true);
    expect(
      engine.feedback.find((event) => event.kind === "pulse"),
    ).toMatchObject({
      x: ironRect.x + ironRect.w / 2,
      y: ironRect.y + ironRect.h / 2,
    });
    engine.dispose();
  });

  it("finishes a custom level on the skill frame without unlocking campaign progress", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    const engine = new GameEngine(
      fixture([
        ...Array.from({ length: 9 }, (_, col) => ({ row: 0, col, hp: 1 })),
        ...Array.from({ length: 4 }, (_, col) => ({
          row: 6,
          col: col + 6,
          hp: 1,
        })),
      ]),
      -1,
    );
    engine.launch();
    charge(engine);
    engine.activatePulse();
    expect(engine.getSnapshot()).toMatchObject({
      status: "won",
      destroyed: 13,
      total: 13,
      lives: 3,
    });
    expect(engine.feedback.at(-1)?.kind).toBe("win");
    expect(storage.setItem).not.toHaveBeenCalledWith(
      PROGRESS_KEY,
      expect.anything(),
    );
    expect(loadProgress().unlockedLevels).toBe(6);
    const won = engine.getSnapshot();
    engine.update(10);
    expect(engine.activatePulse()).toBe(false);
    expect(engine.getSnapshot()).toEqual(won);
    engine.dispose();
  });
});

describe("drop assistance and game feedback", () => {
  it("guarantees a first drop by brick 4 and a later drop after 7 unlucky destructions", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const engine = new GameEngine(fixture(), -1);
    engine.launch();
    for (let col = 0; col < 3; col++) hit(engine, 0, col);
    expect(engine.scene.powerUpDrops).toHaveLength(0);
    hit(engine, 0, 3);
    expect(engine.scene.powerUpDrops.map((drop) => drop.type)).toEqual([
      "split",
    ]);
    for (let col = 4; col < 10; col++) hit(engine, 0, col);
    expect(engine.scene.powerUpDrops).toHaveLength(1);
    hit(engine, 0, 10);
    expect(engine.scene.powerUpDrops).toHaveLength(2);
    expect(
      engine.feedback.filter((event) => event.kind === "powerSpawn"),
    ).toHaveLength(2);
    engine.dispose();
  });

  it("gently draws nearby drops into a real catch while distant drops still require steering", () => {
    const engine = new GameEngine(fixture(), -1);
    engine.launch();
    const paddle = engine.scene.paddle;
    const near = new PowerUpDrop(
      paddle.x + paddle.width / 2 + 4,
      paddle.y - 50,
      "widePaddle",
    );
    const far = new PowerUpDrop(5, paddle.y - 50, "extraLife");
    engine.scene.powerUpDrops.push(near, far);
    const originalNearX = near.x;
    engine.update(C.FIXED_DT);
    expect(near.x).toBeLessThan(originalNearX);
    expect(originalNearX - near.x).toBeLessThan(2);
    expect(far.x).toBe(5);
    coast(engine, 30);
    expect(engine.getSnapshot().lastPickup?.type).toBe("widePaddle");
    expect(engine.scene.paddle.width).toBe(150);
    expect(engine.scene.lives).toBe(3);
    expect(
      engine.feedback.filter((event) => event.kind === "powerCollect"),
    ).toHaveLength(1);
    engine.dispose();
  });

  it("emits real wall/paddle impacts and only reports life loss when the final ball falls", () => {
    const engine = new GameEngine(fixture(), -1);
    engine.launch();
    const ball = engine.scene.balls[0];
    ball.x = 2;
    ball.y = 400;
    ball.vx = -200;
    ball.vy = -180;
    engine.update(C.FIXED_DT);
    expect(engine.feedback.at(-1)?.kind).toBe("wall");
    ball.x = engine.scene.paddle.x;
    ball.y = engine.scene.paddle.y - 10;
    ball.vx = 0;
    ball.vy = ball.speed;
    engine.update(C.FIXED_DT);
    expect(engine.feedback.at(-1)?.kind).toBe("paddle");
    engine.scene._activatePowerUp(PowerUpType.SPLIT);
    ball.x = 5;
    ball.y = C.SCREEN_H + 30;
    engine.update(C.FIXED_DT);
    expect(
      engine.feedback.filter((event) => event.kind === "lifeLost"),
    ).toHaveLength(0);
    for (const remaining of engine.scene.balls) {
      remaining.x = 5;
      remaining.y = C.SCREEN_H + 30;
    }
    engine.update(C.FIXED_DT);
    expect(
      engine.feedback.filter((event) => event.kind === "lifeLost"),
    ).toHaveLength(1);
    expect(engine.getSnapshot()).toMatchObject({ lives: 2, status: "ready" });
    engine.dispose();
  });

  it("bounds repeated multiball and timed-power bookkeeping without changing life/score", () => {
    const engine = new GameEngine(fixture(), -1);
    engine.launch();
    for (let i = 0; i < 10; i++) {
      engine.scene._activatePowerUp("split");
      engine.scene._activatePowerUp("fireball");
      engine.scene._activatePowerUp("widePaddle");
    }
    expect(engine.scene.balls).toHaveLength(24);
    expect(engine.getSnapshot().activePowerUps).toHaveLength(2);
    expect(engine.getSnapshot()).toMatchObject({ lives: 3, score: 0 });
    engine.dispose();
  });
});

describe("simulation clock and feed lifecycle", () => {
  it("keeps timed powers synchronized while waiting to relaunch after a lost life", () => {
    const engine = new GameEngine(fixture(), -1);
    engine.launch();
    engine.scene._activatePowerUp("widePaddle");
    engine.scene.balls[0].x = 5;
    engine.scene.balls[0].y = C.SCREEN_H + 30;
    engine.update(C.FIXED_DT);
    const waiting = engine.getSnapshot();
    const wideTime = engine.scene.paddle.wideTimer;
    expect(waiting.status).toBe("ready");
    for (let i = 0; i < 700; i++) engine.update(C.FIXED_DT);
    expect(engine.getSnapshot()).toEqual(waiting);
    expect(engine.scene.paddle.wideTimer).toBe(wideTime);
    expect(engine.scene.paddle.width).toBe(150);
    engine.dispose();
  });

  it("honors an extra-life catch on the frame the final ball is lost", () => {
    const level = fixture();
    level.lives = 1;
    const engine = new GameEngine(level, -1);
    engine.launch();
    engine.scene.balls[0].x = 5;
    engine.scene.balls[0].y = C.SCREEN_H + 30;
    engine.scene.powerUpDrops.push(
      new PowerUpDrop(
        engine.scene.paddle.x,
        engine.scene.paddle.y - 8,
        "extraLife",
      ),
    );
    engine.update(C.FIXED_DT);
    expect(engine.getSnapshot()).toMatchObject({
      status: "ready",
      lives: 1,
      score: 0,
    });
    expect(engine.scene.balls).toHaveLength(1);
    expect(engine.feedback.some((event) => event.kind === "lose")).toBe(false);
    engine.dispose();
  });

  it("freezes combo, pulse, pickups and all effect timers during a long pause", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const engine = new GameEngine(fixture(), -1);
    engine.launch();
    charge(engine);
    engine.activatePulse();
    engine.scene._activatePowerUp("widePaddle");
    engine.pause();
    const paused = engine.getSnapshot();
    const events = engine.feedback.slice();
    const fireTimer = engine.scene.balls[0].fireballTimer;
    const wideTimer = engine.scene.paddle.wideTimer;
    vi.spyOn(performance, "now").mockReturnValue(9_000_000);
    engine.update(3600);
    expect(engine.getSnapshot()).toEqual(paused);
    expect(engine.feedback).toEqual(events);
    expect(engine.scene.balls[0].fireballTimer).toBe(fireTimer);
    expect(engine.scene.paddle.wideTimer).toBe(wideTimer);
    engine.resume();
    hit(engine, 0, 9);
    expect(engine.getSnapshot().combo).toBe(paused.combo + 1);
    engine.scene.powerUpDrops = [];
    coast(engine, 121);
    expect(engine.getSnapshot().combo).toBe(0);
    expect(engine.getSnapshot().bestCombo).toBe(paused.combo + 1);
    engine.dispose();
  });

  it("resets all run state on restart and keeps feedback ids usable by existing consumers", () => {
    const engine = new GameEngine(fixture(), -1);
    engine.launch();
    charge(engine);
    engine.scene._activatePowerUp("fireball");
    engine.activatePulse();
    const lastId = engine.feedback.at(-1)!.id;
    engine.restart();
    expect(engine.feedback).toEqual([]);
    expect(engine.getSnapshot()).toMatchObject({
      elapsed: 0,
      energy: 0,
      pulseReady: false,
      pulseTime: 0,
      combo: 0,
      bestCombo: 0,
      lastPickup: null,
      score: 0,
      destroyed: 0,
      lives: 3,
    });
    engine.launch();
    expect(engine.feedback.at(-1)?.id).toBeGreaterThan(lastId);
    hit(engine, 0, 0);
    expect(
      engine.feedback.filter((event) => event.kind === "brick"),
    ).toHaveLength(1);
    expect(engine.getSnapshot().score).toBe(10);
    engine.dispose();
  });

  it("retains only 64 recent events without draining one consumer's copy", () => {
    const feed = new FeedbackStream();
    for (let i = 0; i < 100; i++) {
      feed.emit(i / 60, {
        kind: "wall",
        x: 4,
        y: 200,
        color: "#fff",
        strength: 0.2,
      });
    }
    const firstConsumer = feed.recent.filter((event) => event.id > 95);
    expect(feed.recent).toHaveLength(64);
    expect(feed.recent[0].id).toBe(37);
    expect(feed.recent.filter((event) => event.id > 95)).toEqual(firstConsumer);
    feed.clear();
    expect(
      feed.emit(0, {
        kind: "launch",
        x: 100,
        y: 560,
        color: "#fff",
        strength: 1,
      }).id,
    ).toBe(101);
  });
});
