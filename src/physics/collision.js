// src/physics/collision.js
// Provides: CollisionDetector
// Depends: (none)

class CollisionDetector {
  /**
   * Swept collision test: ball centre ray vs Minkowski-expanded brick rect.
   * @param {Ball}   ball
   * @param {object} rect  - { x, y, w, h }
   * @param {number} dt    - timestep
   * @returns {{ t: number, nx: number, ny: number } | null}
   */
  static sweepBallVsRect(ball, rect, dt) {
    // Expand rect by ball radius on every side
    const expanded = {
      x: rect.x - ball.radius,
      y: rect.y - ball.radius,
      w: rect.w + ball.radius * 2,
      h: rect.h + ball.radius * 2,
    };

    const dx = ball.vx * dt;
    const dy = ball.vy * dt;

    let tMin = 0, tMax = 1;
    let normalX = 0, normalY = 0;

    // ---- X slab ----
    if (Math.abs(dx) < 1e-8) {
      // Ray is parallel to Y axis — must already be within X range
      if (ball.x < expanded.x || ball.x > expanded.x + expanded.w) return null;
    } else {
      let t1 = (expanded.x - ball.x) / dx;
      let t2 = (expanded.x + expanded.w - ball.x) / dx;
      let n = -1;
      if (t1 > t2) { [t1, t2] = [t2, t1]; n = 1; }
      if (t1 > tMin) { tMin = t1; normalX = n * Math.sign(dx) * -1; normalY = 0; }
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return null;
    }

    // ---- Y slab ----
    if (Math.abs(dy) < 1e-8) {
      if (ball.y < expanded.y || ball.y > expanded.y + expanded.h) return null;
    } else {
      let t1 = (expanded.y - ball.y) / dy;
      let t2 = (expanded.y + expanded.h - ball.y) / dy;
      let n = -1;
      if (t1 > t2) { [t1, t2] = [t2, t1]; n = 1; }
      if (t1 > tMin) { tMin = t1; normalX = 0; normalY = n * Math.sign(dy) * -1; }
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return null;
    }

    if (tMin < 0 || tMin > 1) return null;
    return { t: tMin, nx: normalX, ny: normalY };
  }
}
