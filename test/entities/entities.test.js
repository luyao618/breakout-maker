/**
 * entities.test.js — Tests for Ball, Paddle, Brick, BrickField
 */

const { TestRunner, assert, assertClose, assertEqual, loadGameContext } = require('../testutils');
const ctx = loadGameContext();
const { Ball, Paddle, Brick, BrickField, C } = ctx;

const suite = new TestRunner('Entities');

// =============================================================================
// Ball
// =============================================================================

suite.test('Ball.launch(0): sets velocity straight up', () => {
  const ball = new Ball(100, 200);
  ball.launch(0);
  assertClose(ball.vx, 0, 0.01, 'vx should be 0');
  assertClose(ball.vy, -C.BALL_SPEED, 0.01, 'vy should be -BALL_SPEED');
});

suite.test('Ball.launch(angle): sets correct velocity at 30 degrees', () => {
  const ball = new Ball(100, 200);
  ball.launch(Math.PI / 6); // 30 degrees
  assertClose(ball.vx, ball.speed * Math.sin(Math.PI / 6), 0.01, 'vx = speed * sin(30)');
  assertClose(ball.vy, -ball.speed * Math.cos(Math.PI / 6), 0.01, 'vy = -speed * cos(30)');
});

suite.test('Ball.launch(): uses default angle', () => {
  const ball = new Ball(100, 200);
  ball.launch();
  // Default angle is C.LAUNCH_ANGLE (45 degrees)
  assertClose(ball.vx, ball.speed * Math.sin(C.LAUNCH_ANGLE), 0.01);
  assertClose(ball.vy, -ball.speed * Math.cos(C.LAUNCH_ANGLE), 0.01);
});

suite.test('Ball.update(): moves ball by velocity * dt', () => {
  const ball = new Ball(100, 200);
  ball.vx = 150;
  ball.vy = -260;
  const dt = C.FIXED_DT;
  const expectedX = 100 + 150 * dt;
  const expectedY = 200 + (-260) * dt;
  ball.update(dt);
  assertClose(ball.x, expectedX, 0.01, 'X position');
  assertClose(ball.y, expectedY, 0.01, 'Y position');
});

suite.test('Ball.update(): stores trail positions', () => {
  const ball = new Ball(100, 200);
  ball.vx = 10;
  ball.vy = -20;
  assertEqual(ball.trail.length, 0, 'Trail starts empty');
  ball.update(C.FIXED_DT);
  assertEqual(ball.trail.length, 1, 'Trail has 1 entry after 1 update');
  ball.update(C.FIXED_DT);
  assertEqual(ball.trail.length, 2, 'Trail has 2 entries after 2 updates');
});

suite.test('Ball.normalizeSpeed(): normalises velocity magnitude', () => {
  const ball = new Ball(100, 200);
  ball.vx = 200;
  ball.vy = -300;
  ball.normalizeSpeed();
  const actualSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  assertClose(actualSpeed, C.BALL_SPEED, 0.01, 'Speed should be normalized to BALL_SPEED');
});

suite.test('Ball.normalizeSpeed(): preserves direction', () => {
  const ball = new Ball(100, 200);
  ball.vx = 200;
  ball.vy = -300;
  const origAngle = Math.atan2(ball.vy, ball.vx);
  ball.normalizeSpeed();
  const newAngle = Math.atan2(ball.vy, ball.vx);
  assertClose(newAngle, origAngle, 0.001, 'Direction should be preserved');
});

suite.test('Ball.normalizeSpeed(): handles near-zero velocity', () => {
  const ball = new Ball(100, 200);
  ball.vx = 0;
  ball.vy = 0;
  ball.normalizeSpeed();
  // Should default to straight up
  assertClose(ball.vx, 0, 0.01, 'vx should be 0');
  assertClose(ball.vy, -ball.speed, 0.01, 'vy should be -speed');
});

suite.test('Ball: default radius is C.BALL_RADIUS', () => {
  const ball = new Ball(100, 200);
  assertEqual(ball.radius, C.BALL_RADIUS, 'Default radius');
});

suite.test('Ball: custom radius', () => {
  const ball = new Ball(100, 200, 10);
  assertEqual(ball.radius, 10, 'Custom radius');
});

// =============================================================================
// Paddle
// =============================================================================

suite.test('Paddle.moveTo(): clamps to left screen edge', () => {
  const paddle = new Paddle(100, 500, 120);
  paddle.moveTo(-100, C.SCREEN_W);
  paddle.update(C.FIXED_DT);
  assert(paddle.x >= paddle.width / 2, 'Paddle should not go past left edge');
});

suite.test('Paddle.moveTo(): clamps to right screen edge', () => {
  const paddle = new Paddle(100, 500, 120);
  paddle.moveTo(C.SCREEN_W + 100, C.SCREEN_W);
  paddle.update(C.FIXED_DT);
  assert(paddle.x <= C.SCREEN_W - paddle.width / 2, 'Paddle should not go past right edge');
});

suite.test('Paddle.moveTo(): moves toward target', () => {
  const paddle = new Paddle(100, 500, 120);
  paddle.moveTo(200, C.SCREEN_W);
  paddle.update(C.FIXED_DT);
  assert(paddle.x > 100, 'Paddle should move toward target');
});

suite.test('Paddle.moveTo(): NaN target is ignored', () => {
  const paddle = new Paddle(100, 500, 120);
  paddle.moveTo(NaN, C.SCREEN_W);
  paddle.update(C.FIXED_DT);
  // Target didn't change from constructor, so paddle should stay near 100
  assertClose(paddle.x, 100, 1, 'Paddle should not move on NaN');
});

suite.test('Paddle.setWide(): increases width by 1.5x', () => {
  const paddle = new Paddle(100, 500, 120);
  const originalWidth = paddle.width;
  paddle.setWide(5);
  assertEqual(paddle.width, originalWidth * 1.5, 'Width should be 1.5x');
  assert(paddle.isWide, 'isWide should be true');
});

suite.test('Paddle.setWide(): reverts after timer expires', () => {
  const paddle = new Paddle(100, 500, 120);
  paddle.setWide(0.1); // Very short duration
  assertEqual(paddle.width, 180, 'Should be wide');

  // Tick enough to expire the timer
  for (let i = 0; i < 20; i++) {
    paddle.update(C.FIXED_DT);
  }
  assert(!paddle.isWide, 'isWide should be false after timer');
  assertEqual(paddle.width, 120, 'Width should be back to base');
});

suite.test('Paddle.getBounds(): returns correct AABB', () => {
  const paddle = new Paddle(100, 500, 120, 10);
  const b = paddle.getBounds();
  assertEqual(b.left, 40, 'left = x - width/2');
  assertEqual(b.right, 160, 'right = x + width/2');
  assertEqual(b.top, 495, 'top = y - height/2');
  assertEqual(b.bottom, 505, 'bottom = y + height/2');
});

// =============================================================================
// Brick
// =============================================================================

suite.test('Brick.hit(): reduces hp and returns false when still alive', () => {
  const brick = new Brick(0, 0, 3);
  const destroyed = brick.hit();
  assert(!destroyed, 'Should not be destroyed');
  assertEqual(brick.hp, 2, 'HP should be 2');
  assert(brick.alive, 'Should still be alive');
});

suite.test('Brick.hit(): returns true when destroyed', () => {
  const brick = new Brick(0, 0, 1);
  const destroyed = brick.hit();
  assert(destroyed, 'Should be destroyed');
  assertEqual(brick.hp, 0, 'HP should be 0');
  assert(!brick.alive, 'Should not be alive');
});

suite.test('Brick.hit(): 2-hp brick takes 2 hits to destroy', () => {
  const brick = new Brick(0, 0, 2);
  assert(!brick.hit(), 'First hit should not destroy');
  assertEqual(brick.hp, 1);
  assert(brick.hit(), 'Second hit should destroy');
  assert(!brick.alive);
});

suite.test('Brick indestructible (hp=999) does not die', () => {
  const brick = new Brick(0, 0, C.INDESTRUCTIBLE_HP);
  const destroyed = brick.hit();
  assert(!destroyed, 'Indestructible brick should not be destroyed');
  assertEqual(brick.hp, C.INDESTRUCTIBLE_HP, 'HP should remain 999');
  assert(brick.alive, 'Should still be alive');
});

suite.test('Brick.hit(isFireball=true): instantly destroys normal brick', () => {
  const brick = new Brick(0, 0, 3);
  const destroyed = brick.hit(true);
  assert(destroyed, 'Fireball should destroy instantly');
  assert(!brick.alive);
});

suite.test('Brick.hit(isFireball=true): does not destroy indestructible', () => {
  const brick = new Brick(0, 0, C.INDESTRUCTIBLE_HP);
  const destroyed = brick.hit(true);
  assert(!destroyed, 'Fireball should not destroy indestructible');
  assert(brick.alive);
});

suite.test('Brick.update(): decrements shakeTimer', () => {
  const brick = new Brick(0, 0, 2);
  brick.hit(); // Sets shakeTimer
  assert(brick.shakeTimer > 0, 'shakeTimer should be set after hit');
  // Tick enough to clear shake
  for (let i = 0; i < 30; i++) {
    brick.update(C.FIXED_DT);
  }
  assert(brick.shakeTimer <= 0, 'shakeTimer should be 0 after ticking');
});

// =============================================================================
// BrickField
// =============================================================================

suite.test('BrickField: creates grid from level descriptor', () => {
  const level = {
    name: 'Test', gridWidth: 3, gridHeight: 2,
    ballSpeed: 300, paddleWidth: 90, lives: 3,
    bricks: [
      { row: 0, col: 0, hp: 1 },
      { row: 0, col: 2, hp: 2 },
      { row: 1, col: 1, hp: 1 },
    ],
  };
  const bf = new BrickField(level, 375);
  assert(bf.bricks[0][0] !== null, 'Brick at (0,0) should exist');
  assert(bf.bricks[0][1] === null, 'Brick at (0,1) should be null');
  assert(bf.bricks[0][2] !== null, 'Brick at (0,2) should exist');
  assert(bf.bricks[1][1] !== null, 'Brick at (1,1) should exist');
  assertEqual(bf.totalDestructible, 3, 'Should have 3 destructible bricks');
});

suite.test('BrickField.isCleared(): false when bricks remain', () => {
  const level = {
    name: 'Test', gridWidth: 2, gridHeight: 1,
    ballSpeed: 300, paddleWidth: 90, lives: 3,
    bricks: [{ row: 0, col: 0, hp: 1 }, { row: 0, col: 1, hp: 1 }],
  };
  const bf = new BrickField(level, 375);
  assert(!bf.isCleared(), 'Should not be cleared');
});

suite.test('BrickField.isCleared(): true when all destructible bricks gone', () => {
  const level = {
    name: 'Test', gridWidth: 2, gridHeight: 1,
    ballSpeed: 300, paddleWidth: 90, lives: 3,
    bricks: [
      { row: 0, col: 0, hp: 1 },
      { row: 0, col: 1, hp: C.INDESTRUCTIBLE_HP },
    ],
  };
  const bf = new BrickField(level, 375);
  assertEqual(bf.totalDestructible, 1, 'Only 1 destructible brick');

  // Destroy the destructible one
  bf.bricks[0][0].hit();
  bf.destroyed++;
  assert(bf.isCleared(), 'Should be cleared (only destructible brick gone)');
});

suite.test('BrickField.isCleared(): indestructible-only level is cleared immediately', () => {
  const level = {
    name: 'Test', gridWidth: 1, gridHeight: 1,
    ballSpeed: 300, paddleWidth: 90, lives: 3,
    bricks: [{ row: 0, col: 0, hp: C.INDESTRUCTIBLE_HP }],
  };
  const bf = new BrickField(level, 375);
  assertEqual(bf.totalDestructible, 0, '0 destructible bricks');
  assert(bf.isCleared(), 'Should be cleared (no destructible bricks)');
});

suite.test('BrickField.getBrickRect(): returns valid rectangle', () => {
  const level = {
    name: 'Test', gridWidth: 4, gridHeight: 2,
    ballSpeed: 300, paddleWidth: 90, lives: 3,
    bricks: [{ row: 0, col: 0, hp: 1 }],
  };
  const bf = new BrickField(level, 375);
  const rect = bf.getBrickRect(0, 0);
  assert(typeof rect.x === 'number', 'Should have x');
  assert(typeof rect.y === 'number', 'Should have y');
  assert(typeof rect.w === 'number' && rect.w > 0, 'Should have positive w');
  assert(typeof rect.h === 'number' && rect.h > 0, 'Should have positive h');
});

// Run
suite.run().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
});
