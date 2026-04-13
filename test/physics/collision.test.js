/**
 * collision.test.js — Collision detection tests for the sweepBallVsRect method
 *
 * Tests the swept ray-vs-expanded-AABB algorithm used for ball-vs-brick collision.
 *
 * NOTE: sweepBallVsRect returns { t, nx, ny } where nx/ny are 0 or non-zero.
 * They indicate WHICH axis the collision occurred on (used for velocity reflection).
 * nx !== 0 means reflect vx; ny !== 0 means reflect vy.
 */

const { TestRunner, assert, assertClose, assertEqual, loadGameContext } = require('../testutils');
const ctx = loadGameContext();
const { CollisionDetector, Ball, C } = ctx;

const suite = new TestRunner('CollisionDetector');

// =============================================================================
// sweepBallVsRect — Basic Directional Hits
// =============================================================================

suite.test('sweepBallVsRect: ball moving down hits brick (Y-axis collision)', () => {
  // Ball at y=-5, vy=1200, dt=1/60 => travels 20px. Brick at y=10, h=4.
  // Expanded y = 10-4=6, expanded h = 4+8=12. t = (6-(-5))/20 = 11/20 = 0.55
  const ball = new Ball(15, -5);
  ball.vx = 0;
  ball.vy = 1200;
  const rect = { x: 10, y: 10, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null, 'Should hit brick');
  assert(result.ny !== 0, 'Should be a Y-axis collision');
  assertEqual(result.nx, 0, 'nx should be 0 for vertical hit');
});

suite.test('sweepBallVsRect: ball moving up hits brick (Y-axis collision)', () => {
  // Ball at y=30, vy=-1200, dt=1/60 => travels -20px. Brick at y=10, h=4.
  // Expanded bottom = 10+4+4=18. t = (18-30)/(-20) = -12/-20 = 0.6
  const ball = new Ball(15, 30);
  ball.vx = 0;
  ball.vy = -1200;
  const rect = { x: 10, y: 10, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null, 'Should hit brick');
  assert(result.ny !== 0, 'Should be a Y-axis collision');
  assertEqual(result.nx, 0, 'nx should be 0');
});

suite.test('sweepBallVsRect: ball moving right hits brick (X-axis collision)', () => {
  const ball = new Ball(0, 12);
  ball.vx = 1200;
  ball.vy = 0;
  const rect = { x: 10, y: 10, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null, 'Should hit brick');
  assert(result.nx !== 0, 'Should be an X-axis collision');
  assertEqual(result.ny, 0, 'ny should be 0 for horizontal hit');
});

suite.test('sweepBallVsRect: ball moving left hits brick (X-axis collision)', () => {
  const ball = new Ball(30, 12);
  ball.vx = -1200;
  ball.vy = 0;
  const rect = { x: 10, y: 10, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null, 'Should hit brick');
  assert(result.nx !== 0, 'Should be an X-axis collision');
  assertEqual(result.ny, 0, 'ny should be 0');
});

// =============================================================================
// sweepBallVsRect — Diagonal Hits
// =============================================================================

suite.test('sweepBallVsRect: diagonal ball hits brick', () => {
  const ball = new Ball(0, 0);
  ball.vx = 600;
  ball.vy = 600;
  const rect = { x: 8, y: 8, w: 10, h: 10 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null, 'Diagonal ball should hit brick');
  assert(result.t > 0 && result.t <= 1, 'Hit within ray range');
});

suite.test('sweepBallVsRect: steep diagonal from left hits X-axis', () => {
  // Ball moving mostly right with small Y component
  const ball = new Ball(0, 12);
  ball.vx = 1200;
  ball.vy = 60;
  const rect = { x: 12, y: 10, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null, 'Should hit');
  assert(result.nx !== 0, 'Steep horizontal hit should have nx != 0');
});

// =============================================================================
// sweepBallVsRect — Misses
// =============================================================================

suite.test('sweepBallVsRect: ball misses brick (too far to the right)', () => {
  const ball = new Ball(50, 5);
  ball.vx = 0;
  ball.vy = 300;
  const rect = { x: 10, y: 10, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result === null, 'Ball to the right should miss brick');
});

suite.test('sweepBallVsRect: ball moves away from brick', () => {
  const ball = new Ball(0, 12);
  ball.vx = -300;
  ball.vy = 0;
  const rect = { x: 10, y: 10, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result === null, 'Ball moving away should miss');
});

suite.test('sweepBallVsRect: ball too far to reach brick in one tick', () => {
  const ball = new Ball(20, 0);
  ball.vx = 0;
  ball.vy = 300;
  const rect = { x: 10, y: 100, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result === null, 'Brick too far away');
});

suite.test('sweepBallVsRect: parallel ball passes alongside brick', () => {
  const ball = new Ball(50, 0);
  ball.vx = 0;
  ball.vy = 300;
  const rect = { x: 10, y: 2, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result === null, 'Parallel ball should miss');
});

// =============================================================================
// sweepBallVsRect — Zero and Edge Cases
// =============================================================================

suite.test('sweepBallVsRect: zero velocity ball does not crash', () => {
  const ball = new Ball(15, 12);
  ball.vx = 0;
  ball.vy = 0;
  const rect = { x: 10, y: 10, w: 10, h: 4 };
  const dt = 1 / 60;
  // Should not throw — result can be null or t=0, either is fine
  CollisionDetector.sweepBallVsRect(ball, rect, dt);
});

suite.test('sweepBallVsRect: very thin brick still detectable', () => {
  const ball = new Ball(20, 0);
  ball.vx = 0;
  ball.vy = 600;
  const rect = { x: 15, y: 5, w: 10, h: 1 }; // Very thin brick
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null, 'Should detect thin brick');
});

// =============================================================================
// Anti-Tunneling — Fast Ball Scenarios
// =============================================================================

suite.test('anti-tunneling: ball at 1000px/s through brick', () => {
  const ball = new Ball(15, 0);
  ball.vx = 0;
  ball.vy = 1000;
  const rect = { x: 10, y: 8, w: 10, h: 4 };
  const dt = 1 / 60; // Travel ~16.7px
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null, 'Should detect at 1000 px/s');
});

suite.test('anti-tunneling: ball at 2000px/s through brick', () => {
  const ball = new Ball(15, 0);
  ball.vx = 0;
  ball.vy = 2000;
  const rect = { x: 10, y: 20, w: 10, h: 4 };
  const dt = 1 / 60; // Travel ~33.3px
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null, 'Should detect at 2000 px/s');
});

suite.test('anti-tunneling: ball at 5000px/s through brick', () => {
  const ball = new Ball(15, 0);
  ball.vx = 0;
  ball.vy = 5000;
  const rect = { x: 10, y: 40, w: 10, h: 4 };
  const dt = 1 / 60; // Travel ~83px
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null, 'Fast ball should still be detected (swept)');
});

suite.test('anti-tunneling: fast ball misses distant brick', () => {
  const ball = new Ball(50, 0);
  ball.vx = 0;
  ball.vy = 3000;
  const rect = { x: 10, y: 10, w: 10, h: 4 }; // Brick is to the left
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result === null, 'Ball should miss brick not in path');
});

suite.test('anti-tunneling: diagonal fast ball', () => {
  const speed = 1500;
  const angle = Math.PI / 4;
  const ball = new Ball(0, 0);
  ball.vx = speed * Math.sin(angle);
  ball.vy = speed * Math.cos(angle);
  const rect = { x: 10, y: 10, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null, 'Diagonal fast ball should be detected');
});

// =============================================================================
// Normal Axis Tests (nx/ny flag which axis to reflect)
// =============================================================================

suite.test('normal: vertical approach gives ny != 0, nx == 0', () => {
  const ball = new Ball(15, -5);
  ball.vx = 0;
  ball.vy = 1200;
  const rect = { x: 10, y: 10, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null, 'Should hit');
  assertEqual(result.nx, 0, 'nx should be 0 (Y-axis collision)');
  assert(result.ny !== 0, 'ny should be non-zero');
});

suite.test('normal: horizontal approach gives nx != 0, ny == 0', () => {
  const ball = new Ball(0, 12);
  ball.vx = 1200;
  ball.vy = 0;
  const rect = { x: 10, y: 10, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null, 'Should hit');
  assert(result.nx !== 0, 'nx should be non-zero');
  assertEqual(result.ny, 0, 'ny should be 0 (X-axis collision)');
});

suite.test('normal: exactly one axis is non-zero per collision', () => {
  // Try several directions
  const tests = [
    { x: 15, y: -5, vx: 0, vy: 1200 },    // downward
    { x: 15, y: 30, vx: 0, vy: -1200 },    // upward
    { x: 0, y: 12, vx: 1200, vy: 0 },      // rightward
    { x: 30, y: 12, vx: -1200, vy: 0 },    // leftward
  ];
  const rect = { x: 10, y: 10, w: 10, h: 4 };
  const dt = 1 / 60;

  for (const t of tests) {
    const ball = new Ball(t.x, t.y);
    ball.vx = t.vx;
    ball.vy = t.vy;
    const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
    if (result) {
      const axesHit = (result.nx !== 0 ? 1 : 0) + (result.ny !== 0 ? 1 : 0);
      assertEqual(axesHit, 1, 'Exactly one axis should be flagged for reflection');
    }
  }
});

// =============================================================================
// Collision Time (t) Precision
// =============================================================================

suite.test('collision time: t proportional to distance', () => {
  // Ball at y=0, vy=600, dt=1/60 => travels 10px.
  // Rect at y=5, h=4 => expanded y = 5-4=1. expanded h=4+8=12.
  // t = (1-0)/10 = 0.1
  const ball = new Ball(15, 0);
  ball.vx = 0;
  ball.vy = 600;
  const rect = { x: 10, y: 5, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result !== null);
  assertClose(result.t, 0.1, 0.01, 't should be ~0.1');
});

suite.test('collision time: closer brick has smaller t', () => {
  const ball1 = new Ball(15, 0);
  ball1.vx = 0;
  ball1.vy = 600;
  const ball2 = new Ball(15, 0);
  ball2.vx = 0;
  ball2.vy = 600;
  const dt = 1 / 60;

  const nearRect = { x: 10, y: 2, w: 10, h: 4 };
  const farRect = { x: 10, y: 6, w: 10, h: 4 };

  const nearResult = CollisionDetector.sweepBallVsRect(ball1, nearRect, dt);
  const farResult = CollisionDetector.sweepBallVsRect(ball2, farRect, dt);

  assert(nearResult !== null, 'Near rect should be hit');
  assert(farResult !== null, 'Far rect should be hit');
  assert(nearResult.t < farResult.t, 'Closer brick should have smaller t');
});

// =============================================================================
// Real-world Game Scenarios
// =============================================================================

suite.test('scenario: ball bouncing off brick from below', () => {
  // Ball at y=30 moving up, brick above
  const ball = new Ball(15, 30);
  ball.vx = 100;
  ball.vy = -1200;
  const brickRect = { x: 10, y: 10, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, brickRect, dt);
  assert(result !== null, 'Should collide with brick');
  assert(result.ny !== 0, 'Should flag Y-axis for reflection');
});

suite.test('scenario: ball barely misses brick edge', () => {
  // Ball at x=50, brick at x=0..10. With radius=4, expanded x=-4..14.
  // Ball x=50 is well outside.
  const ball = new Ball(50, 0);
  ball.vx = 0;
  ball.vy = 600;
  const rect = { x: 0, y: 5, w: 10, h: 4 };
  const dt = 1 / 60;
  const result = CollisionDetector.sweepBallVsRect(ball, rect, dt);
  assert(result === null, 'Ball should miss brick');
});

// Run the suite
suite.run().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
});
