// src/entities/particle.js
// Provides: Particle
// Depends: (none)

class Particle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {string} color - CSS colour
   */
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 200;
    this.vy = (Math.random() - 0.5) * 200 - 50; // biased upward
    this.life = 0.5 + Math.random() * 0.3;
    this.maxLife = this.life;
    this.color = color;
    this.size = 2 + Math.random() * 3;
  }

  /** Advance the particle (with gravity). */
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 200 * dt; // gravity
    this.life -= dt;
  }

  /** Current opacity (fades as life drains). */
  get alpha() {
    return Math.max(0, this.life / this.maxLife);
  }

  /** True when the particle should be removed. */
  get dead() {
    return this.life <= 0;
  }
}
