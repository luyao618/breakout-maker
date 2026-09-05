import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import {
  GameEngine, C, LEVEL_VERSION, PROGRESS_KEY, generateLevel, levels,
  loadProgress, saveProgress, validateLevel,
} from '../../web/game/engine';
import type { GameSnapshot, Level } from '../../web/game/types';
import { Brick, BrickMapper, PowerUpDrop, PowerUpType } from '../../web/game/legacy.js';

function fixture(overrides: Partial<Level> = {}): Level {
  return {
    name: 'Test field', gridWidth: 16, gridHeight: 8,
    ballSpeed: 280, paddleWidth: 100, lives: 3,
    bricks: [{ row: 0, col: 4, hp: 1 }], ...overrides,
  };
}

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(PROGRESS_KEY, initial);
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
  vi.stubGlobal('localStorage', storage);
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

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('original gameplay adapter', () => {
  it('loads all original level data without altering layouts, lives, speeds or difficulty', () => {
    const paths = readdirSync(new URL('../../levels/', import.meta.url)).filter((name) => /^level-\d+\.json$/.test(name)).sort();
    const source = paths.map((name) => JSON.parse(readFileSync(new URL(`../../levels/${name}`, import.meta.url), 'utf8')));
    expect(levels).toEqual(source);
    for (const level of levels) expect(validateLevel(level)).toEqual(level);
  });

  it('launches at the original angle, bounds paddle movement and steps at 60 Hz', () => {
    const engine = new GameEngine(fixture(), 0);
    expect(engine.getSnapshot()).toMatchObject({ status: 'ready', lives: 3, score: 0, total: 1 });
    engine.move(-200);
    engine.update(C.FIXED_DT);
    expect(engine.scene.paddle.x).toBe(50);
    engine.move(999);
    engine.update(C.FIXED_DT);
    expect(engine.scene.paddle.x).toBe(325);
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

  it('freezes a paused game, resumes the prior launch state, and restarts cleanly', () => {
    const engine = new GameEngine(fixture(), 0);
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('ready');
    engine.launch();
    engine.update(C.FIXED_DT);
    engine.pause();
    const ball = { ...engine.scene.balls[0] };
    const paddleX = engine.scene.paddle.x;
    engine.move(30);
    engine.update(30);
    engine.launch();
    expect(engine.status).toBe('paused');
    expect(engine.scene.balls[0]).toMatchObject(ball);
    expect(engine.scene.paddle.x).toBe(paddleX);
    engine.resume();
    expect(engine.status).toBe('playing');
    engine.update(C.FIXED_DT);
    expect(engine.scene.balls[0].y).not.toBe(ball.y);
    engine.scene._activatePowerUp(PowerUpType.SPLIT);
    engine.restart();
    expect(engine.status).toBe('ready');
    expect(engine.scene.balls).toHaveLength(1);
    expect(engine.scene.activePowerUps).toHaveLength(0);
    expect(engine.getSnapshot()).toMatchObject({ score: 0, destroyed: 0, lives: 3 });
    const finalSnapshot = engine.getSnapshot();
    engine.dispose();
    engine.dispose();
    engine.launch();
    engine.update(1);
    expect(engine.getSnapshot()).toEqual(finalSnapshot);
  });

  it('returns to ready after a lost ball and ends only after all lives are spent', () => {
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
    expect(engine.getSnapshot()).toMatchObject({ status: 'ready', lives: 1 });
    expect(engine.scene.balls).toHaveLength(1);
    engine.launch();
    loseBall(engine);
    expect(engine.getSnapshot()).toMatchObject({ status: 'lost', lives: 0 });
    engine.update(10);
    expect(engine.scene.lives).toBe(0);
    engine.dispose();
  });

  it('uses original brick damage, fireball iron resistance, score and win transition', () => {
    const ordinary = new Brick(0, 0, 3);
    expect(ordinary.hit(true)).toBe(true);
    const iron = new Brick(0, 0, 999);
    expect(iron.hp).toBe(10);
    expect(iron.hit(true)).toBe(false);
    expect(iron.hp).toBe(9);
    memoryStorage();
    const engine = new GameEngine(fixture({ bricks: [{ row: 0, col: 4, hp: 2 }] }), 5);
    engine.launch();
    hitOnlyBrick(engine);
    expect(engine.getSnapshot()).toMatchObject({ status: 'playing', score: 0, destroyed: 0 });
    hitOnlyBrick(engine);
    expect(engine.getSnapshot()).toMatchObject({ status: 'won', score: 10, destroyed: 1, combo: 1 });
    expect(loadProgress().unlockedLevels).toBe(7);
    engine.dispose();
  });

  it('preserves all five power-up behaviors and timed expiry through the real catch path', () => {
    const engine = new GameEngine(fixture({ lives: 8 }), 0);
    engine.launch();
    const catchDrop = (type: PowerUpDrop['type']) => {
      engine.scene.powerUpDrops.push(new PowerUpDrop(engine.scene.paddle.x, engine.scene.paddle.y - 10, type));
      engine.update(C.FIXED_DT);
    };
    catchDrop(PowerUpType.SPLIT);
    expect(engine.scene.balls).toHaveLength(3);
    catchDrop(PowerUpType.MULTI_SHOT);
    expect(engine.scene.balls).toHaveLength(6);
    catchDrop(PowerUpType.FIREBALL);
    expect(engine.scene.balls.every((ball) => ball.isFireball)).toBe(true);
    expect(engine.getSnapshot().activePowerUps).toEqual([{ type: 'fireball', timer: expect.closeTo(8 - C.FIXED_DT) }]);
    catchDrop(PowerUpType.WIDE_PADDLE);
    expect(engine.scene.paddle.width).toBe(150);
    catchDrop(PowerUpType.EXTRA_LIFE);
    catchDrop(PowerUpType.EXTRA_LIFE);
    expect(engine.scene.lives).toBe(9);
    expect(engine.scene.powerUpDrops).toHaveLength(0);
    // Keep balls away from collisions while advancing the original timers.
    for (let frame = 0; frame < 601; frame++) {
      for (const ball of engine.scene.balls) { ball.x = 187; ball.y = 400; }
      engine.update(C.FIXED_DT);
    }
    expect(engine.scene.balls.every((ball) => !ball.isFireball)).toBe(true);
    expect(engine.scene.paddle.width).toBe(100);
    expect(engine.getSnapshot().activePowerUps).toEqual([]);
    engine.dispose();
  });

  it('notifies immediately for state changes without flooding the UI on idle frames', () => {
    const snapshots: GameSnapshot[] = [];
    const engine = new GameEngine(fixture(), 0, (snapshot) => snapshots.push(snapshot));
    for (let i = 0; i < 120; i++) engine.update(C.FIXED_DT);
    expect(snapshots).toHaveLength(1);
    engine.launch();
    engine.pause();
    expect(snapshots.map((snapshot) => snapshot.status)).toEqual(['ready', 'playing', 'paused']);
    engine.dispose();
  });
});

describe('campaign persistence boundaries', () => {
  it('retains version 3 progress and never relocks completed levels', () => {
    memoryStorage(JSON.stringify({ unlockedLevels: 11, levelVersion: LEVEL_VERSION }));
    expect(loadProgress().unlockedLevels).toBe(11);
    saveProgress({ unlockedLevels: 7, levelVersion: LEVEL_VERSION });
    expect(loadProgress().unlockedLevels).toBe(11);
    saveProgress({ unlockedLevels: 50, levelVersion: LEVEL_VERSION });
    expect(loadProgress().unlockedLevels).toBe(levels.length);
  });

  it('defaults safely for malformed, outdated, unavailable and out-of-range storage', () => {
    for (const value of ['{', 'null', '{}', '{"levelVersion":2,"unlockedLevels":12}', '{"levelVersion":3,"unlockedLevels":-50}']) {
      memoryStorage(value);
      expect(loadProgress().unlockedLevels).toBe(6);
    }
    vi.stubGlobal('localStorage', { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('full'); } });
    expect(loadProgress().unlockedLevels).toBe(6);
    expect(() => saveProgress({ unlockedLevels: 7, levelVersion: LEVEL_VERSION })).not.toThrow();
  });

  it('does not unlock campaign levels when a custom image or AI level wins', () => {
    const storage = memoryStorage();
    const engine = new GameEngine(fixture(), -1);
    engine.launch();
    hitOnlyBrick(engine);
    expect(engine.status).toBe('won');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(loadProgress().unlockedLevels).toBe(6);
    engine.dispose();
  });
});

describe('creative mode boundaries', () => {
  it('preserves median-cut image mapping, one-hit colored bricks and bright background removal', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255, 120, 30, 90, 255]);
    const result = BrickMapper.imageToLevel({ width: 2, height: 1, data }, 2, 1);
    expect(result).toMatchObject({ ballSpeed: 280, paddleWidth: 120, lives: 5 });
    expect(result.bricks).toEqual([{ row: 0, col: 1, hp: 1, color: '#781e5a' }]);
  });

  it('rejects invalid grids, out-of-bounds or duplicate bricks before constructing a scene', () => {
    const badLevels = [
      fixture({ gridWidth: 0 }), fixture({ ballSpeed: Infinity }), fixture({ bricks: [] }),
      fixture({ bricks: [{ row: 8, col: 0, hp: 1 }] }),
      fixture({ bricks: [{ row: 0, col: 0, hp: 1 }, { row: 0, col: 0, hp: 2 }] }),
    ];
    for (const level of badLevels) expect(() => new GameEngine(level, -1)).toThrow();
  });

  it('sends the real prompt and returns a validated API result without a fallback level', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await generateLevel('  月亮  ');
    expect(result.name).toBe('Test field');
    expect(fetchMock).toHaveBeenCalledWith('/api/generate-level', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ prompt: '月亮' }),
    }));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Creative service unavailable' }), { status: 503 }));
    await expect(generateLevel('moon')).rejects.toThrow('Creative service unavailable');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ gridWidth: 5, bricks: [] }), { status: 200 }));
    await expect(generateLevel('moon')).rejects.toThrow();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(generateLevel('moon')).rejects.toThrow('暂时无法连接创作服务');
  });

  it('forwards cancellation and validates an empty prompt before making any request', async () => {
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      if (init.signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
      return Promise.resolve(new Response(JSON.stringify(fixture())));
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateLevel('  ')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    const controller = new AbortController();
    controller.abort();
    await expect(generateLevel('moon', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});


describe('playable presentation boundaries', () => {
  it('rejects generated bricks that overlap the paddle or fall outside the board', () => {
    expect(() => validateLevel(fixture({ gridWidth: 1, gridHeight: 2, bricks: [{ row: 1, col: 0, hp: 1 }] }))).toThrow('可游玩的区域');
  });
  it('clears expired combo display without modifying original scoring state', () => {
    const engine = new GameEngine(fixture(), 0);
    engine.scene.scoreSystem._combo = 4;
    engine.scene.scoreSystem._lastHit = performance.now() - C.COMBO_TIMEOUT - 1;
    expect(engine.getSnapshot().combo).toBe(0);
    expect(engine.scene.scoreSystem._combo).toBe(4);
    engine.dispose();
  });
});
