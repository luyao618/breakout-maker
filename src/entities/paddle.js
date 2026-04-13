// src/entities/paddle.js
// Provides: Paddle
// Depends: C

class Paddle {
  /**
   * @param {number} x      - centre x
   * @param {number} y      - centre y
   * @param {number} width   - initial width
   * @param {number} height
   */
  constructor(x, y, width, height = C.PADDLE_HEIGHT) {
    this.x = x;
    this.y = y;
    this.baseWidth = width;
    this.width = width;
    this.height = height;

    this._targetX = x;  // smoothed movement target

    this.isWide = false;
    this.wideTimer = 0;
  }

  /** Activate the "wide paddle" power-up for a given duration (seconds). */
  setWide(duration) {
    this.isWide = true;
    this.wideTimer = duration;
    this.width = this.baseWidth * 1.5;
  }

  /** Advance paddle state by dt seconds. */
  update(dt) {
    // Wide paddle timer
    if (this.isWide) {
      this.wideTimer -= dt;
      if (this.wideTimer <= 0) {
        this.isWide = false;
        this.width = this.baseWidth;
      }
    }

    // Smooth interpolation toward target position
    const diff = this._targetX - this.x;
    this.x += diff * Math.min(1, C.PADDLE_SMOOTHING * dt * 60);
  }

  /**
   * Set the desired paddle position (clamped to screen bounds).
   * @param {number} x        - desired centre x
   * @param {number} screenW  - canvas / screen width
   */
  moveTo(x, screenW) {
    if (isNaN(x)) return;
    const half = this.width / 2;
    this._targetX = Math.max(half, Math.min(screenW - half, x));
  }

  /** Return an axis-aligned bounding box for the paddle. */
  getBounds() {
    return {
      left:   this.x - this.width / 2,
      right:  this.x + this.width / 2,
      top:    this.y - this.height / 2,
      bottom: this.y + this.height / 2,
    };
  }
}
