// src/entities/brick.js
// Provides: Brick
// Depends: C

class Brick {
  /**
   * @param {number} row
   * @param {number} col
   * @param {number} hp     - hit points (>= INDESTRUCTIBLE_HP = unbreakable)
   * @param {string|null} color - override colour, or null for hp-based
   */
  constructor(row, col, hp = 1, color = null) {
    this.row = row;
    this.col = col;
    this.hp = hp;
    this.maxHp = hp;
    this.color = color;     // explicit colour override
    this.alive = true;
    this.shakeTimer = 0;    // visual feedback on hit
  }

  /**
   * Register a hit on this brick.
   * @param {boolean} isFireball - if true, brick is destroyed instantly
   * @returns {boolean} true if the brick was destroyed by this hit
   */
  hit(isFireball = false) {
    // Indestructible bricks only shake
    if (this.hp >= C.INDESTRUCTIBLE_HP) {
      this.shakeTimer = 0.15;
      return false;
    }

    if (isFireball) {
      this.hp = 0;
    } else {
      this.hp--;
    }

    if (this.hp <= 0) {
      this.alive = false;
      return true; // destroyed
    }

    this.shakeTimer = 0.1;
    return false; // damaged but not destroyed
  }

  /** Tick per-frame timers. */
  update(dt) {
    if (this.shakeTimer > 0) this.shakeTimer -= dt;
  }
}
