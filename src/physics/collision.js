// src/physics/collision.js
// Provides: CollisionDetector

class CollisionDetector {
  /** Swept ball-center ray against the radius-expanded rectangle. */
  static sweepBallVsRect(ball, rect, dt) {
    const left = rect.x - ball.radius;
    const right = rect.x + rect.w + ball.radius;
    const top = rect.y - ball.radius;
    const bottom = rect.y + rect.h + ball.radius;
    const dx = ball.vx * dt;
    const dy = ball.vy * dt;
    let enter = -Infinity;
    let exit = Infinity;
    let nx = 0;
    let ny = 0;
    for (const axis of [
      { start: ball.x, delta: dx, low: left, high: right, x: 1 },
      { start: ball.y, delta: dy, low: top, high: bottom, x: 0 },
    ]) {
      if (Math.abs(axis.delta) < 1e-8) {
        if (axis.start < axis.low || axis.start > axis.high) return null;
        continue;
      }
      const a = (axis.low - axis.start) / axis.delta;
      const b = (axis.high - axis.start) / axis.delta;
      const entry = Math.min(a, b);
      if (entry > enter) {
        enter = entry;
        const normal = axis.delta > 0 ? -1 : 1;
        nx = axis.x ? normal : 0;
        ny = axis.x ? 0 : normal;
      }
      exit = Math.min(exit, Math.max(a, b));
    }
    if (enter > exit || exit < 0 || enter > 1) return null;
    if (enter < -1e-8) {
      // A touching/overlapping ball moving out must not re-hit the same face.
      const faces = [
        { distance: Math.abs(ball.x - left), nx: -1, ny: 0 },
        { distance: Math.abs(right - ball.x), nx: 1, ny: 0 },
        { distance: Math.abs(ball.y - top), nx: 0, ny: -1 },
        { distance: Math.abs(bottom - ball.y), nx: 0, ny: 1 },
      ].sort((a, b) => a.distance - b.distance);
      const face = faces[0];
      if (dx * face.nx + dy * face.ny >= 0) return null;
      return { t: 0, nx: face.nx, ny: face.ny };
    }
    return { t: Math.max(0, enter), nx, ny };
  }
}
