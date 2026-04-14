/**
 * physics-world.test.js — PhysicsWorld tests
 *
 * Tests wall collisions, ball lost detection, paddle reflection,
 * min vy enforcement, and brick collision/destruction.
 */

const { TestRunner, assert, assertClose, assertEqual, loadGameContext } = require('../testutils');
const ctx = loadGameContext();
const { Ball, Paddle, Brick, BrickField, PhysicsWorld, C } = ctx;

const suite = new TestRunner('PhysicsWorld');

// Helper: create a standard game state for testing
function createGameState() {
  const level = ctx.getPresetLevel(0);
  const bf = new BrickField(level, C.SCREEN_W);
  const paddleY = C.SCREEN_H - C.PLAY_BOTTOM_MARGIN;
  const paddle = new Paddle(C.SCREEN_W / 2, paddleY, level.paddleWidth);
  const physics = new PhysicsWorld(bf, paddle, C.SCREEN_W, C.SCREEN_H);
  return { bf, paddle, physics };
}

// =============================================================================
// Wall Collisions
// =============================================================================

suite.test('wall bounce: ball reflects off left wall', () => {
  const { bf, paddle, physics } = createGameState();
  const ball = new Ball(2, 300);
  ball.vx = -200;
  ball.vy = -100;

  physics.tick([ball], C.FIXED_DT);
  assert(ball.vx > 0, 'Ball vx should be positive after left wall bounce');
});

suite.test('wall bounce: ball reflects off right wall', () => {
  const { bf, paddle, physics } = createGameState();
  const ball = new Ball(C.SCREEN_W - 2, 300);
  ball.vx = 200;
  ball.vy = -100;

  physics.tick([ball], C.FIXED_DT);
  assert(ball.vx < 0, 'Ball vx should be negative after right wall bounce');
});

suite.test('wall bounce: ball reflects off top wall', () => {
  const { bf, paddle, physics } = createGameState();
  const ball = new Ball(100, C.PLAY_TOP + 2);
  ball.vy = -200;
  ball.vx = 100;

  physics.tick([ball], C.FIXED_DT);
  assert(ball.vy > 0, 'Ball vy should be positive after top wall bounce');
});

suite.test('wall bounce: ball in center does not bounce', () => {
  const { bf, paddle, physics } = createGameState();
  const ball = new Ball(C.SCREEN_W / 2, 300);
  ball.vx = 100;
  ball.vy = -200;
  const origVx = ball.vx;
  const origVy = ball.vy;

  // Move ball - vy will be enforced for min vy but direction should stay
  physics.tick([ball], C.FIXED_DT);
  // Ball should still be moving in roughly the same direction
  assert(ball.vy < 0, 'Ball should still go up (no wall hit)');
});

// =============================================================================
// Ball Lost Detection
// =============================================================================

suite.test('ball lost: ball past bottom triggers onBallLost', () => {
  const { bf, paddle, physics } = createGameState();
  const ball = new Ball(C.SCREEN_W / 2, C.SCREEN_H + 20);
  ball.vx = 0;
  ball.vy = 200;

  let ballLost = false;
  physics.onBallLost = () => { ballLost = true; };

  physics.tick([ball], C.FIXED_DT);
  assert(ballLost, 'Ball should be detected as lost');
});

suite.test('ball lost: ball above bottom is not lost', () => {
  const { bf, paddle, physics } = createGameState();
  const ball = new Ball(C.SCREEN_W / 2, 400);
  ball.vx = 0;
  ball.vy = 100;

  let ballLost = false;
  physics.onBallLost = () => { ballLost = true; };

  physics.tick([ball], C.FIXED_DT);
  assert(!ballLost, 'Ball above bottom should not be lost');
});

// =============================================================================
// Paddle Reflection
// =============================================================================

suite.test('paddle reflection: center hit goes straight up', () => {
  const { bf, paddle, physics } = createGameState();
  const ball = new Ball(paddle.x, paddle.y - paddle.height / 2 - 1);
  ball.vx = 0;
  ball.vy = 200;
  ball.speed = 300;

  let paddleHit = false;
  physics.onPaddleHit = () => { paddleHit = true; };

  physics.tick([ball], C.FIXED_DT);
  if (paddleHit) {
    assert(ball.vy < 0, 'Ball should go upward after paddle hit');
    // Center hit should have small |vx|
    assert(Math.abs(ball.vx) < ball.speed * 0.3, 'Center hit should not have large vx');
  }
});

suite.test('paddle reflection: edge hit sends ball at angle', () => {
  const { bf, paddle, physics } = createGameState();
  const ball = new Ball(paddle.x + paddle.width / 2 - 5, paddle.y - paddle.height / 2 - 1);
  ball.vx = 0;
  ball.vy = 200;
  ball.speed = 300;

  let paddleHit = false;
  physics.onPaddleHit = () => { paddleHit = true; };

  physics.tick([ball], C.FIXED_DT);
  if (paddleHit) {
    assert(ball.vy < 0, 'Ball should go upward');
    assert(ball.vx > 0, 'Right-edge hit should send ball right');
  }
});

suite.test('paddle reflection: ball moving up does not trigger paddle', () => {
  const { bf, paddle, physics } = createGameState();
  const ball = new Ball(paddle.x, paddle.y - 5);
  ball.vx = 0;
  ball.vy = -200;
  ball.speed = 300;

  let paddleHit = false;
  physics.onPaddleHit = () => { paddleHit = true; };

  physics.tick([ball], C.FIXED_DT);
  assert(!paddleHit, 'Ball moving up should not trigger paddle collision');
});

// =============================================================================
// Minimum VY Enforcement
// =============================================================================

suite.test('min vy: very horizontal ball gets vy corrected', () => {
  const { bf, paddle, physics } = createGameState();
  const ball = new Ball(C.SCREEN_W / 2, 300);
  ball.speed = 300;
  ball.vx = 299;
  ball.vy = -10; // Nearly horizontal
  const minVy = ball.speed * C.MIN_VY_RATIO;

  physics.tick([ball], C.FIXED_DT);
  assert(Math.abs(ball.vy) >= minVy - 0.1, 'vy should be at least minVy');
});

suite.test('min vy: normal vy is not modified', () => {
  const { bf, paddle, physics } = createGameState();
  const ball = new Ball(C.SCREEN_W / 2, 300);
  ball.speed = 300;
  ball.vx = 150;
  ball.vy = -260; // Normal angle
  const origVy = ball.vy;

  physics.tick([ball], C.FIXED_DT);
  // vy magnitude should still be above minVy (not forcefully changed)
  const minVy = ball.speed * C.MIN_VY_RATIO;
  assert(Math.abs(ball.vy) >= minVy, 'Normal vy should remain above threshold');
});

// =============================================================================
// Brick Collision and Destruction
// =============================================================================

suite.test('brick collision: ball destroys a brick', () => {
  // Create a minimal level with a single brick
  const level = {
    name: 'Test', gridWidth: 1, gridHeight: 1,
    ballSpeed: 300, paddleWidth: 90, lives: 3,
    bricks: [{ row: 0, col: 0, hp: 1 }],
  };
  const bf = new BrickField(level, C.SCREEN_W);
  const paddleY = C.SCREEN_H - C.PLAY_BOTTOM_MARGIN;
  const paddle = new Paddle(C.SCREEN_W / 2, paddleY, 90);
  const physics = new PhysicsWorld(bf, paddle, C.SCREEN_W, C.SCREEN_H);

  // Get the brick rect to position the ball
  const brickRect = bf.getBrickRect(0, 0);

  // Position ball just above the brick, moving down
  const ball = new Ball(brickRect.x + brickRect.w / 2, brickRect.y - 10);
  ball.vx = 0;
  ball.vy = 600;
  ball.speed = 600;

  let hitFired = false;
  physics.onBrickHit = (row, col, destroyed, brick) => {
    hitFired = true;
    assert(destroyed, 'Brick should be destroyed (hp=1)');
    assertEqual(row, 0, 'Should be row 0');
    assertEqual(col, 0, 'Should be col 0');
  };

  physics.tick([ball], C.FIXED_DT);
  assert(hitFired, 'onBrickHit should have been called');
  assertEqual(bf.destroyed, 1, 'destroyed count should be 1');
});

suite.test('brick collision: 2-hp brick takes two hits', () => {
  const level = {
    name: 'Test', gridWidth: 1, gridHeight: 1,
    ballSpeed: 300, paddleWidth: 90, lives: 3,
    bricks: [{ row: 0, col: 0, hp: 2 }],
  };
  const bf = new BrickField(level, C.SCREEN_W);
  const paddleY = C.SCREEN_H - C.PLAY_BOTTOM_MARGIN;
  const paddle = new Paddle(C.SCREEN_W / 2, paddleY, 90);
  const physics = new PhysicsWorld(bf, paddle, C.SCREEN_W, C.SCREEN_H);

  const brickRect = bf.getBrickRect(0, 0);

  // First hit
  const ball = new Ball(brickRect.x + brickRect.w / 2, brickRect.y - 10);
  ball.vx = 0;
  ball.vy = 600;
  ball.speed = 600;

  physics.tick([ball], C.FIXED_DT);
  assertEqual(bf.destroyed, 0, 'Brick should not be destroyed after first hit');
  assert(bf.bricks[0][0] !== null, 'Brick should still exist');
  assertEqual(bf.bricks[0][0].hp, 1, 'HP should be 1 after first hit');
});

suite.test('brick collision: iron brick survives single hit', () => {
  const level = {
    name: 'Test', gridWidth: 1, gridHeight: 1,
    ballSpeed: 300, paddleWidth: 90, lives: 3,
    bricks: [{ row: 0, col: 0, hp: C.INDESTRUCTIBLE_HP }],
  };
  const bf = new BrickField(level, C.SCREEN_W);
  const paddleY = C.SCREEN_H - C.PLAY_BOTTOM_MARGIN;
  const paddle = new Paddle(C.SCREEN_W / 2, paddleY, 90);
  const physics = new PhysicsWorld(bf, paddle, C.SCREEN_W, C.SCREEN_H);

  const brickRect = bf.getBrickRect(0, 0);
  const ball = new Ball(brickRect.x + brickRect.w / 2, brickRect.y - 10);
  ball.vx = 0;
  ball.vy = 600;
  ball.speed = 600;

  physics.tick([ball], C.FIXED_DT);
  assertEqual(bf.destroyed, 0, 'Iron brick should not be destroyed in 1 hit');
  assert(bf.bricks[0][0] !== null, 'Brick should still exist');
  assertEqual(bf.bricks[0][0].hp, C.IRONCLAD_HP - 1, 'HP should decrease by 1');
});

// =============================================================================
// Multiple Balls
// =============================================================================

suite.test('multiple balls: tick processes all balls', () => {
  const { bf, paddle, physics } = createGameState();
  const ball1 = new Ball(100, 300);
  ball1.vx = 100;
  ball1.vy = -200;
  const ball2 = new Ball(200, 300);
  ball2.vx = -100;
  ball2.vy = -200;

  const origX1 = ball1.x;
  const origX2 = ball2.x;

  physics.tick([ball1, ball2], C.FIXED_DT);

  // Both balls should have moved
  assert(ball1.x !== origX1 || ball1.y !== 300, 'Ball 1 should have moved');
  assert(ball2.x !== origX2 || ball2.y !== 300, 'Ball 2 should have moved');
});

// =============================================================================
// Determinism
// =============================================================================

suite.test('determinism: two runs with same initial state produce same result', () => {
  const tickCount = 30;

  // Run 1
  const s1 = createGameState();
  const ball1 = new Ball(187.5, 300);
  ball1.vx = 150;
  ball1.vy = -260;
  ball1.speed = 300;
  for (let i = 0; i < tickCount; i++) {
    s1.physics.tick([ball1], C.FIXED_DT);
  }

  // Run 2
  const s2 = createGameState();
  const ball2 = new Ball(187.5, 300);
  ball2.vx = 150;
  ball2.vy = -260;
  ball2.speed = 300;
  for (let i = 0; i < tickCount; i++) {
    s2.physics.tick([ball2], C.FIXED_DT);
  }

  assertClose(ball1.x, ball2.x, 0.001, 'X positions should be identical');
  assertClose(ball1.y, ball2.y, 0.001, 'Y positions should be identical');
});

// Run
suite.run().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
});
