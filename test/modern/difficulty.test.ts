import { afterEach, describe, expect, it, vi } from "vitest";
import { BALANCE, C, GameEngine, validateLevel } from "../../web/game/engine";
import { PowerUpDrop } from "../../web/game/legacy.js";
import type { Level } from "../../web/game/types";

function fixture(
  bricks: Level["bricks"] = Array.from({ length: 48 }, (_, i) => ({
    row: Math.floor(i / 16),
    col: i % 16,
    hp: 1,
  })),
): Level {
  return {
    name: "Tactical fixture",
    gridWidth: 16,
    gridHeight: 10,
    ballSpeed: 320,
    paddleWidth: 96,
    lives: 3,
    bricks,
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

function coast(engine: GameEngine, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / C.FIXED_DT); i++) {
    for (const ball of engine.scene.balls) {
      ball.x = 180;
      ball.y = 450;
      ball.vx = 0;
      ball.vy = -ball.speed;
    }
    engine.update(C.FIXED_DT);
  }
}

afterEach(() => vi.restoreAllMocks());

describe("tactical brick rules", () => {
  it("preserves authored roles and difficulty metadata without mutating input", () => {
    const level = {
      ...fixture([{ row: 0, col: 0, hp: 2, kind: "armor" }]),
      difficulty: 5,
      briefing: "Aim through the left channel.",
    } as Level;
    const copy = JSON.parse(JSON.stringify(level));
    expect(validateLevel(level)).toEqual(level);
    const engine = new GameEngine(level, -1);
    expect(engine.scene.brickField.bricks[0][0]?.kind).toBe("armor");
    engine.scene.brickField.bricks[0][0]?.hit();
    expect(level).toEqual(copy);
    for (const bad of [
      { ...level, difficulty: 0 },
      { ...level, briefing: [] },
      fixture([{ row: 0, col: 0, hp: 1, kind: "armor" }]),
      fixture([{ row: 0, col: 0, hp: 3, kind: "reactor" }]),
      fixture([{ row: 0, col: 0, hp: 1, kind: "unknown" as "normal" }]),
    ])
      expect(() => validateLevel(bad)).toThrow();
    engine.dispose();
  });

  it("armor takes one damage, reflects fireballs, and cannot repeat-hit while departing", () => {
    const engine = new GameEngine(
      fixture([{ row: 2, col: 8, hp: 3, kind: "armor" }]),
      -1,
    );
    engine.launch();
    engine.scene._activatePowerUp("fireball");
    hit(engine, 2, 8);
    const ball = engine.scene.balls[0];
    expect(engine.scene.brickField.bricks[2][8]).toMatchObject({
      hp: 2,
      alive: true,
    });
    expect(ball.vy).toBeGreaterThan(0);
    expect(ball.fireballContacts).toBe(5);
    expect(engine.getSnapshot().energy).toBe(1);
    for (let i = 0; i < 4; i++) engine.update(C.FIXED_DT);
    expect(engine.scene.brickField.bricks[2][8]?.hp).toBe(2);
    expect(ball.fireballContacts).toBe(5);
    engine.dispose();
  });

  it("reactors damage adjacent cells once without secondary explosions or farming resources", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const engine = new GameEngine(
      fixture([
        { row: 3, col: 6, hp: 2, kind: "reactor" },
        { row: 3, col: 7, hp: 2, kind: "reactor" },
        { row: 3, col: 8, hp: 1 },
        { row: 2, col: 5, hp: 1 },
        { row: 2, col: 6, hp: 2, kind: "armor" },
        { row: 0, col: 0, hp: 1 },
      ]),
      -1,
    );
    engine.launch();
    engine.scene.brickField.bricks[3][7]!.hp = 1;
    hit(engine, 3, 6);
    expect(engine.getSnapshot().energy).toBe(0);
    hit(engine, 3, 6);
    expect(engine.scene.brickField.bricks[3][6]?.alive).toBe(false);
    expect(engine.scene.brickField.bricks[3][7]?.alive).toBe(false);
    expect(engine.scene.brickField.bricks[2][5]?.alive).toBe(false);
    expect(engine.scene.brickField.bricks[2][6]?.hp).toBe(1);
    expect(engine.scene.brickField.bricks[3][8]?.alive).toBe(true);
    expect(engine.getSnapshot()).toMatchObject({
      destroyed: 3,
      energy: 4,
      combo: 1,
      score: 30,
    });
    expect(engine.scene.powerUpDrops).toHaveLength(1);
    expect(
      engine.feedback.filter((event) => event.kind === "powerSpawn"),
    ).toHaveLength(1);
    engine.dispose();
  });

  it("accelerators boost only the striking ball and cap velocity at 130% of the stage speed", () => {
    const engine = new GameEngine(
      fixture([
        { row: 2, col: 5, hp: 2, kind: "accelerator" },
        { row: 2, col: 9, hp: 2, kind: "accelerator" },
        { row: 0, col: 0, hp: 1 },
      ]),
      -1,
    );
    engine.launch();
    engine.scene._activatePowerUp("split");
    hit(engine, 2, 5);
    expect(engine.scene.balls[0].speed).toBeCloseTo(320 * 1.12);
    hit(engine, 2, 5);
    expect(engine.scene.balls[0].speed).toBeCloseTo(320 * 1.12 ** 2);
    hit(engine, 2, 9);
    expect(engine.scene.balls[0].speed).toBe(416);
    hit(engine, 2, 9);
    const ball = engine.scene.balls[0];
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(416);
    expect(engine.scene.balls[1].speed).toBe(320);
    expect(engine.getSnapshot()).toMatchObject({
      ballCount: 3,
      maxBallSpeed: 416,
    });
    engine.dispose();
  });
});

describe("bounded powers and resources", () => {
  it("keeps fire on one ball and consumes its sixth contact without spreading to clones", () => {
    const engine = new GameEngine(fixture(), -1);
    engine.launch();
    engine.scene._activatePowerUp("fireball");
    engine.scene._activatePowerUp("split");
    engine.scene._activatePowerUp("split");
    engine.scene._activatePowerUp("multiShot");
    expect(engine.scene.balls).toHaveLength(4);
    expect(engine.scene.balls.filter((ball) => ball.isFireball)).toHaveLength(
      1,
    );
    for (let col = 0; col < 5; col++) hit(engine, 0, col);
    expect(engine.scene.balls[0].fireballContacts).toBe(1);
    hit(engine, 0, 5);
    expect(engine.scene.balls.every((ball) => !ball.isFireball)).toBe(true);
    expect(
      engine
        .getSnapshot()
        .activePowerUps.some((power) => power.type === "fireball"),
    ).toBe(false);
    engine.dispose();
  });

  it("uses paddle position to aim pulse, deals only one damage, and grants no fire or drops", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const engine = new GameEngine(
      fixture([
        ...Array.from({ length: 25 }, (_, i) => ({
          row: Math.floor(i / 16),
          col: i % 16,
          hp: 1,
        })),
        ...Array.from({ length: 5 }, (_, col) => ({ row: 8, col, hp: 1 })),
        ...Array.from({ length: 5 }, (_, i) => ({
          row: 5,
          col: i + 11,
          hp: 2,
        })),
      ]),
      -1,
    );
    engine.launch();
    for (let i = 0; i < 25; i++) hit(engine, Math.floor(i / 16), i % 16);
    engine.scene.powerUpDrops = [];
    engine.move(375);
    coast(engine, C.FIXED_DT);
    expect(engine.getSnapshot().energy).toBe(100);
    expect(engine.activatePulse()).toBe(true);
    const pulse = engine.feedback.find((event) => event.kind === "pulse")!;
    expect(pulse.x).toBeGreaterThan(280);
    expect(
      engine.scene.brickField.bricks[8].filter((brick) => brick?.alive),
    ).toHaveLength(5);
    expect(
      engine.scene.brickField.bricks[5].filter((brick) => brick?.hp === 1)
        .length,
    ).toBeGreaterThan(0);
    expect(engine.getSnapshot()).toMatchObject({ destroyed: 25, energy: 0 });
    expect(engine.scene.powerUpDrops).toHaveLength(0);
    expect(engine.scene.balls.every((ball) => !ball.isFireball)).toBe(true);
    engine.dispose();
  });

  it("caps active drops, uses simulation-time cooldown, and excludes life while healthy", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const engine = new GameEngine(fixture(), -1);
    engine.launch();
    hit(engine, 0, 0);
    expect(engine.scene.powerUpDrops).toHaveLength(1);
    hit(engine, 0, 1);
    expect(engine.scene.powerUpDrops).toHaveLength(1);
    engine.pause();
    engine.update(100);
    engine.resume();
    hit(engine, 0, 2);
    expect(engine.scene.powerUpDrops).toHaveLength(1);
    coast(engine, BALANCE.dropCooldown);
    engine.scene.powerUpDrops = [
      new PowerUpDrop(20, 120, "split"),
      new PowerUpDrop(40, 120, "fireball"),
    ];
    hit(engine, 0, 3);
    expect(engine.scene.powerUpDrops).toHaveLength(2);
    engine.scene.powerUpDrops = [];
    const random = vi.mocked(Math.random);
    random.mockReturnValue(0.999);
    for (let index = 4; index < 19; index++)
      hit(engine, Math.floor(index / 16), index % 16);
    expect(engine.scene.powerUpDrops[0].type).toBe("widePaddle");
    engine.dispose();
  });

  it("repairs a lost life once per run, cannot stockpile, and resets the allowance on restart", () => {
    const engine = new GameEngine(fixture(), -1);
    engine.launch();
    engine.scene._activatePowerUp("extraLife");
    expect(engine.scene.lives).toBe(3);
    engine.scene.lives = 2;
    engine.scene._activatePowerUp("extraLife");
    expect(engine.scene.lives).toBe(3);
    engine.scene.lives = 1;
    engine.scene._activatePowerUp("extraLife");
    expect(engine.scene.lives).toBe(1);
    engine.restart();
    engine.scene.lives = 2;
    engine.scene._activatePowerUp("extraLife");
    expect(engine.scene.lives).toBe(3);
    engine.dispose();
  });

  it("does not rescue a final lost ball after the run's life repair was already used", () => {
    const level = fixture();
    level.lives = 1;
    const engine = new GameEngine(level, -1);
    engine.launch();
    engine.scene._lifeRepairs = 1;
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
    expect(engine.getSnapshot()).toMatchObject({ status: "lost", lives: 0 });
    engine.dispose();
  });

  it("caps score multiplier while energy stays independent of the combo", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const engine = new GameEngine(fixture(), -1);
    engine.launch();
    for (let col = 0; col < 11; col++) hit(engine, 0, col);
    const previousScore = engine.getSnapshot().score;
    hit(engine, 0, 11);
    expect(engine.getSnapshot().score - previousScore).toBe(40);
    expect(engine.getSnapshot()).toMatchObject({ energy: 48, combo: 12 });
    engine.dispose();
  });
});
