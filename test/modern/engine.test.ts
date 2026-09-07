import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  GameEngine,
  C,
  LEVEL_VERSION,
  PROGRESS_KEY,
  generateLevel,
  levels,
  loadProgress,
  saveProgress,
  validateLevel,
} from "../../web/game/engine";
import type { GameSnapshot, Level } from "../../web/game/types";
import {
  Brick,
  BrickMapper,
  PowerUpDrop,
  PowerUpType,
} from "../../web/game/legacy.js";

function fixture(overrides: Partial<Level> = {}): Level {
  return {
    name: "Test field",
    gridWidth: 16,
    gridHeight: 8,
    ballSpeed: 280,
    paddleWidth: 100,
    lives: 3,
    bricks: [{ row: 0, col: 4, hp: 1 }],
    ...overrides,
  };
}

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(PROGRESS_KEY, initial);
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
  vi.stubGlobal("localStorage", storage);
  return storage;
}

function loseBall(engine: GameEngine) {
  for (const ball of engine.scene.balls) {
    ball.x = 5;
    ball.y = C.SCREEN_H + ball.radius + 2;
    ball.vx = 0;
    ball.vy = ball.speed;
  }
  engine.update(C.FIXED_DT);
}

function hitOnlyBrick(engine: GameEngine) {
  const brick = engine.scene.brickField.bricks.flat().find((b) => b?.alive)!;
  const rect = engine.scene.brickField.getBrickRect(brick.row, brick.col);
  const ball = engine.scene.balls[0];
  ball.x = rect.x + rect.w / 2;
  ball.y = rect.y + rect.h + ball.radius + 2;
  ball.vx = 0;
  ball.vy = -ball.speed;
  engine.update(C.FIXED_DT);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("original gameplay adapter", () => {
  it("loads authored campaign data without altering layouts, lives, speeds or difficulty", () => {
    const paths = readdirSync(new URL("../../levels/", import.meta.url))
      .filter((name) => /^level-\d+\.json$/.test(name))
      .sort();
    const source = paths.map((name) =>
      JSON.parse(
        readFileSync(new URL(`../../levels/${name}`, import.meta.url), "utf8"),
      ),
    );
    expect(levels).toEqual(source);
    for (const level of levels) expect(validateLevel(level)).toEqual(level);
  });

  it("launches at the original angle, bounds paddle movement and steps at 60 Hz", () => {
    const engine = new GameEngine(fixture(), 0);
    expect(engine.getSnapshot()).toMatchObject({
      status: "ready",
      lives: 3,
      score: 0,
      total: 1,
    });
    engine.move(-200);
    engine.update(C.FIXED_DT);
    expect(engine.scene.paddle.x).toBe(45);
    engine.move(999);
    engine.update(C.FIXED_DT);
    expect(engine.scene.paddle.x).toBe(330);
    const ball = engine.scene.balls[0];
    engine.launch();
    expect(ball.vx).toBeCloseTo(280 * Math.sin(C.LAUNCH_ANGLE));
    expect(ball.vy).toBeCloseTo(-280 * Math.cos(C.LAUNCH_ANGLE));
    const y = ball.y;
    engine.update(C.FIXED_DT / 2);
    expect(ball.y).toBe(y);
    engine.update(C.FIXED_DT / 2);
    expect(ball.y).toBeCloseTo(y + ball.vy * C.FIXED_DT);
    const beforeGap = ball.y;
    engine.update(20);
    expect(ball.y).toBeCloseTo(beforeGap + ball.vy * C.FIXED_DT * C.MAX_STEPS);
    engine.dispose();
  });

  it("serves, reflects and restarts at the comfortable near-edge paddle", () => {
    const source = fixture();
    const engine = new GameEngine(source, 0);
    const paddle = engine.scene.paddle;
    expect(source.paddleWidth).toBe(100);
    expect(engine.level.paddleWidth).toBe(100);
    expect(paddle.width).toBe(90);
    expect(paddle.baseWidth).toBe(90);
    expect(paddle.y).toBe(605);
    expect(engine.scene.balls[0].y).toBe(591);
    engine.launch();
    const ball = engine.scene.balls[0];
    ball.x = paddle.x;
    ball.y = paddle.y - paddle.height / 2 - ball.radius - 1;
    ball.vx = 0;
    ball.vy = ball.speed;
    engine.update(C.FIXED_DT);
    expect(ball.vy).toBeLessThan(0);
    expect(ball.y).toBeLessThan(paddle.y - paddle.height / 2);
    loseBall(engine);
    expect(engine.status).toBe("ready");
    expect(engine.scene.balls[0].y).toBe(591);
    paddle.setWide(7);
    engine.restart();
    expect(engine.scene.paddle.width).toBe(90);
    expect(engine.scene.paddle.y).toBe(605);
    expect(engine.scene.balls[0].y).toBe(591);
    engine.dispose();
  });

  it("smooths pointer movement before collisions and keeps the served ball attached", () => {
    const engine = new GameEngine(fixture(), 0);
    const paddle = engine.scene.paddle;
    const origin = paddle.x;
    const target = 320;
    engine.movePointer(target);
    expect(paddle.x).toBe(origin);
    engine.update(C.FIXED_DT / 2);
    expect(paddle.x).toBe(origin);
    engine.update(C.FIXED_DT / 2);
    expect(paddle.x).toBeGreaterThan(origin);
    expect(paddle.x).toBeLessThan(target);
    expect(engine.scene.balls[0].x).toBe(paddle.x);
    expect(paddle.getBounds().left).toBe(paddle.x - paddle.width / 2);
    for (let step = 0; step < 5; step++) {
      const previous = paddle.x;
      engine.update(C.FIXED_DT);
      expect(paddle.x).toBeGreaterThan(previous);
      expect(paddle.x).toBeLessThanOrEqual(target);
      expect(engine.scene.balls[0].x).toBe(paddle.x);
    }
    // At 100 ms the travel is effectively settled, with no overshoot.
    expect(Math.abs(target - paddle.x)).toBeLessThan((target - origin) * 0.02);
    engine.move(80);
    engine.update(C.FIXED_DT);
    engine.launch();
    const ball = engine.scene.balls[0];
    // This ball misses the old and target positions, but must hit the
    // intermediate paddle position shown for this simulation frame.
    ball.x = 200;
    ball.y = paddle.y - paddle.height / 2 - ball.radius - 1;
    ball.vx = 0;
    ball.vy = ball.speed;
    engine.movePointer(320);
    engine.update(C.FIXED_DT);
    expect(ball.vy).toBeLessThan(0);
    expect(paddle.x).toBeLessThan(240);
    expect(paddle.x).toBeGreaterThan(160);
    expect(paddle._targetX).toBe(paddle.x);
    engine.dispose();
  });

  it("clamps pointer targets without overshoot and lets direct controls take over", () => {
    const engine = new GameEngine(fixture(), 0);
    const paddle = engine.scene.paddle;
    engine.movePointer(-1000);
    let previous = paddle.x;
    for (let step = 0; step < 20; step++) {
      engine.update(C.FIXED_DT);
      expect(paddle.x).toBeLessThanOrEqual(previous);
      expect(paddle.x).toBeGreaterThanOrEqual(45);
      previous = paddle.x;
    }
    expect(paddle.x).toBe(45);
    engine.movePointer(1000);
    engine.update(C.FIXED_DT);
    expect(paddle.x).toBeGreaterThan(45);
    engine.move(125);
    engine.update(C.FIXED_DT);
    expect(paddle.x).toBe(125);
    engine.update(C.FIXED_DT);
    expect(paddle.x).toBe(125);
    engine.movePointer(NaN);
    engine.movePointer(Infinity);
    engine.update(C.FIXED_DT);
    expect(paddle.x).toBe(125);
    engine.dispose();
  });

  it("discards pending pointer travel on pause, restart and disposal", () => {
    const engine = new GameEngine(fixture(), 0);
    engine.movePointer(320);
    engine.update(C.FIXED_DT);
    engine.pause();
    const pausedX = engine.scene.paddle.x;
    engine.movePointer(40);
    engine.update(1);
    engine.resume();
    engine.update(C.FIXED_DT);
    expect(engine.scene.paddle.x).toBe(pausedX);
    engine.movePointer(40);
    engine.restart();
    engine.update(C.FIXED_DT);
    expect(engine.scene.paddle.x).toBe(C.SCREEN_W / 2);
    const paddle = engine.scene.paddle;
    engine.movePointer(320);
    engine.dispose();
    engine.movePointer(40);
    engine.update(1);
    expect(paddle.x).toBe(C.SCREEN_W / 2);
  });

  it("freezes a paused game, resumes the prior launch state, and restarts cleanly", () => {
    const engine = new GameEngine(fixture(), 0);
    engine.pause();
    engine.resume();
    expect(engine.status).toBe("ready");
    engine.launch();
    engine.update(C.FIXED_DT);
    engine.pause();
    const ball = { ...engine.scene.balls[0] };
    const paddleX = engine.scene.paddle.x;
    engine.move(30);
    engine.update(30);
    engine.launch();
    expect(engine.status).toBe("paused");
    expect(engine.scene.balls[0]).toMatchObject(ball);
    expect(engine.scene.paddle.x).toBe(paddleX);
    engine.resume();
    expect(engine.status).toBe("playing");
    engine.update(C.FIXED_DT);
    expect(engine.scene.balls[0].y).not.toBe(ball.y);
    engine.scene._activatePowerUp(PowerUpType.SPLIT);
    engine.restart();
    expect(engine.status).toBe("ready");
    expect(engine.scene.balls).toHaveLength(1);
    expect(engine.scene.activePowerUps).toHaveLength(0);
    expect(engine.getSnapshot()).toMatchObject({
      score: 0,
      destroyed: 0,
      lives: 3,
    });
    const finalSnapshot = engine.getSnapshot();
    engine.dispose();
    engine.dispose();
    engine.launch();
    engine.update(1);
    expect(engine.getSnapshot()).toEqual(finalSnapshot);
  });

  it("returns to ready after a lost ball and ends only after all lives are spent", () => {
    const engine = new GameEngine(fixture({ lives: 2 }), 0);
    engine.launch();
    engine.scene._activatePowerUp(PowerUpType.SPLIT);
    expect(engine.scene.balls).toHaveLength(3);
    // Losing one ball during multiball must not deduct a life.
    engine.scene.balls[0].y = C.SCREEN_H + 20;
    engine.update(C.FIXED_DT);
    expect(engine.scene.balls).toHaveLength(2);
    expect(engine.scene.lives).toBe(2);
    loseBall(engine);
    expect(engine.getSnapshot()).toMatchObject({ status: "ready", lives: 1 });
    expect(engine.scene.balls).toHaveLength(1);
    engine.launch();
    loseBall(engine);
    expect(engine.getSnapshot()).toMatchObject({ status: "lost", lives: 0 });
    engine.update(10);
    expect(engine.scene.lives).toBe(0);
    engine.dispose();
  });

  it("uses original brick damage, fireball iron resistance, score and win transition", () => {
    const ordinary = new Brick(0, 0, 3);
    expect(ordinary.hit(true)).toBe(true);
    const iron = new Brick(0, 0, 999);
    expect(iron.hp).toBe(10);
    expect(iron.hit(true)).toBe(false);
    expect(iron.hp).toBe(9);
    memoryStorage();
    const engine = new GameEngine(
      fixture({ bricks: [{ row: 0, col: 4, hp: 2 }] }),
      5,
    );
    engine.launch();
    hitOnlyBrick(engine);
    expect(engine.getSnapshot()).toMatchObject({
      status: "playing",
      score: 0,
      destroyed: 0,
    });
    hitOnlyBrick(engine);
    expect(engine.getSnapshot()).toMatchObject({
      status: "won",
      score: 10,
      destroyed: 1,
      combo: 1,
    });
    expect(loadProgress().unlockedLevels).toBe(levels.length);
    engine.dispose();
  });

  it("bounds all five tactical power-up behaviors and timed expiry through the real catch path", () => {
    const engine = new GameEngine(fixture({ lives: 3 }), 0);
    engine.launch();
    const catchDrop = (type: PowerUpDrop["type"]) => {
      engine.scene.powerUpDrops.push(
        new PowerUpDrop(
          engine.scene.paddle.x,
          engine.scene.paddle.y - 10,
          type,
        ),
      );
      engine.update(C.FIXED_DT);
    };
    catchDrop(PowerUpType.SPLIT);
    expect(engine.scene.balls).toHaveLength(3);
    catchDrop(PowerUpType.MULTI_SHOT);
    expect(engine.scene.balls).toHaveLength(4);
    catchDrop(PowerUpType.FIREBALL);
    expect(engine.scene.balls.filter((ball) => ball.isFireball)).toHaveLength(
      1,
    );
    expect(engine.getSnapshot().activePowerUps).toEqual([
      { type: "fireball", timer: expect.closeTo(4) },
    ]);
    catchDrop(PowerUpType.WIDE_PADDLE);
    expect(engine.scene.paddle.width).toBe(112.5);
    engine.scene.lives = 2;
    catchDrop(PowerUpType.EXTRA_LIFE);
    catchDrop(PowerUpType.EXTRA_LIFE);
    expect(engine.scene.lives).toBe(3);
    expect(engine.scene.powerUpDrops).toHaveLength(0);
    // Keep balls away from collisions while advancing the original timers.
    for (let frame = 0; frame < 601; frame++) {
      for (const ball of engine.scene.balls) {
        ball.x = 187;
        ball.y = 400;
      }
      engine.update(C.FIXED_DT);
    }
    expect(engine.scene.balls.every((ball) => !ball.isFireball)).toBe(true);
    expect(engine.scene.paddle.width).toBe(90);
    expect(engine.getSnapshot().activePowerUps).toEqual([]);
    engine.dispose();
  });

  it("notifies immediately for state changes without flooding the UI on idle frames", () => {
    const snapshots: GameSnapshot[] = [];
    const engine = new GameEngine(fixture(), 0, (snapshot) =>
      snapshots.push(snapshot),
    );
    for (let i = 0; i < 120; i++) engine.update(C.FIXED_DT);
    expect(snapshots).toHaveLength(1);
    engine.launch();
    engine.pause();
    expect(snapshots.map((snapshot) => snapshot.status)).toEqual([
      "ready",
      "playing",
      "paused",
    ]);
    engine.dispose();
  });
});

describe("campaign persistence boundaries", () => {
  it("opens all stages immediately even for old partial progress", () => {
    memoryStorage(
      JSON.stringify({ unlockedLevels: 11, levelVersion: LEVEL_VERSION }),
    );
    expect(loadProgress().unlockedLevels).toBe(levels.length);
    saveProgress({ unlockedLevels: 7, levelVersion: LEVEL_VERSION });
    expect(loadProgress().unlockedLevels).toBe(levels.length);
    saveProgress({ unlockedLevels: 50, levelVersion: LEVEL_VERSION });
    expect(loadProgress().unlockedLevels).toBe(levels.length);
  });

  it("defaults safely for malformed, outdated, unavailable and out-of-range storage", () => {
    for (const value of [
      "{",
      "null",
      "{}",
      '{"levelVersion":2,"unlockedLevels":12}',
      '{"levelVersion":3,"unlockedLevels":-50}',
    ]) {
      memoryStorage(value);
      expect(loadProgress().unlockedLevels).toBe(levels.length);
    }
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("disabled");
      },
      setItem() {
        throw new Error("full");
      },
    });
    expect(loadProgress().unlockedLevels).toBe(levels.length);
    expect(() =>
      saveProgress({ unlockedLevels: 7, levelVersion: LEVEL_VERSION }),
    ).not.toThrow();
  });

  it("does not unlock campaign levels when a custom image or AI level wins", () => {
    const storage = memoryStorage();
    const engine = new GameEngine(fixture(), -1);
    engine.launch();
    hitOnlyBrick(engine);
    expect(engine.status).toBe("won");
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(loadProgress().unlockedLevels).toBe(levels.length);
    engine.dispose();
  });
});

describe("creative mode boundaries", () => {
  it("preserves median-cut image mapping, one-hit colored bricks and bright background removal", () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255, 120, 30, 90, 255]);
    const result = BrickMapper.imageToLevel(
      { width: 2, height: 1, data },
      2,
      1,
    );
    expect(result).toMatchObject({
      ballSpeed: 280,
      paddleWidth: 120,
      lives: 5,
    });
    expect(result.bricks).toEqual([
      { row: 0, col: 1, hp: 1, color: "#781e5a" },
    ]);
  });

  it("rejects invalid grids, out-of-bounds or duplicate bricks before constructing a scene", () => {
    const badLevels = [
      fixture({ gridWidth: 0 }),
      fixture({ ballSpeed: Infinity }),
      fixture({ bricks: [] }),
      fixture({ bricks: [{ row: 8, col: 0, hp: 1 }] }),
      fixture({
        bricks: [
          { row: 0, col: 0, hp: 1 },
          { row: 0, col: 0, hp: 2 },
        ],
      }),
    ];
    for (const level of badLevels)
      expect(() => new GameEngine(level, -1)).toThrow();
  });

  it("sends the real prompt and returns a validated API result without a fallback level", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(fixture()), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateLevel("  月亮  ");
    expect(result.name).toBe("Test field");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generate-level",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ prompt: "月亮" }),
      }),
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Creative service unavailable" }), {
        status: 503,
      }),
    );
    await expect(generateLevel("moon")).rejects.toThrow(
      "Creative service unavailable",
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ gridWidth: 5, bricks: [] }), {
        status: 200,
      }),
    );
    await expect(generateLevel("moon")).rejects.toThrow();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(generateLevel("moon")).rejects.toThrow("暂时无法连接创作服务");
  });

  it("forwards cancellation and validates an empty prompt before making any request", async () => {
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      if (init.signal?.aborted)
        return Promise.reject(new DOMException("Aborted", "AbortError"));
      return Promise.resolve(new Response(JSON.stringify(fixture())));
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateLevel("  ")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    const controller = new AbortController();
    controller.abort();
    await expect(
      generateLevel("moon", controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("playable presentation boundaries", () => {
  it("rejects generated bricks that overlap the paddle or fall outside the board", () => {
    expect(() =>
      validateLevel(
        fixture({
          gridWidth: 1,
          gridHeight: 2,
          bricks: [{ row: 1, col: 0, hp: 1 }],
        }),
      ),
    ).toThrow("可游玩的区域");
  });
  it("clears expired combo display without modifying original scoring state", () => {
    const engine = new GameEngine(fixture(), 0);
    engine.scene.scoreSystem._combo = 4;
    engine.scene.scoreSystem._lastHit = performance.now() - C.COMBO_TIMEOUT - 1;
    expect(engine.getSnapshot().combo).toBe(0);
    expect(engine.scene.scoreSystem._combo).toBe(4);
    engine.dispose();
  });
});
