// src/entities/ball.js
// Provides: Ball
// Depends: C

class Ball {
  /**
   * @param {number} x  - centre x
   * @param {number} y  - centre y
   * @param {number} radius
   */
  constructor(x, y, radius = C.BALL_RADIUS) {
    this.x = x;
    this.y = y;
    this.radius = radius;

    this.vx = 0;
    this.vy = 0;
    this.speed = C.BALL_SPEED;

    this.isFireball = false;   // fireball mode — destroys any brick in one hit
    this.fireballTimer = 0;    // seconds remaining for fireball
    this.trail = [];           // last 5 positions for rendering a trail
  }

  /** Launch the ball at a given angle (radians, 0 = straight up). */
  launch(angle = C.LAUNCH_ANGLE) {
    this.vx = this.speed * Math.sin(angle);
    this.vy = -this.speed * Math.cos(angle);
  }

  /** Re-normalise velocity so its magnitude equals this.speed. */
  normalizeSpeed() {
    const mag = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (mag < 1) {
      // Near-zero velocity — default to straight up
      this.vx = 0;
      this.vy = -this.speed;
      return;
    }
    this.vx = (this.vx / mag) * this.speed;
    this.vy = (this.vy / mag) * this.speed;
  }

  /** Advance the ball by dt seconds. */
  update(dt) {
    // Store previous position for trail effect
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();

    // Tick fireball timer
    if (this.isFireball) {
      this.fireballTimer -= dt;
      if (this.fireballTimer <= 0) {
        this.isFireball = false;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}
