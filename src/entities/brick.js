// src/entities/brick.js
// Provides: Brick
// Depends: C

class Brick {
  /**
   * @param {number} row
   * @param {number} col
   * @param {number} hp     - hit points (10 = iron brick, tough but breakable)
   * @param {string|null} color - override colour, or null for hp-based
   */
  constructor(row, col, hp = 1, color = null) {
    this.row = row;
    this.col = col;
    // Convert legacy indestructible (999) to iron (10)
    this.hp = (hp >= C.INDESTRUCTIBLE_HP) ? C.IRONCLAD_HP : hp;
    this.maxHp = this.hp;
    this.color = color;     // explicit colour override
    this.alive = true;
    this.shakeTimer = 0;    // visual feedback on hit
  }

  /**
   * Register a hit on this brick.
   * @param {boolean} isFireball - if true, non-iron brick is destroyed instantly
   * @returns {boolean} true if the brick was destroyed by this hit
   */
  hit(isFireball = false) {
    // Iron bricks always take exactly 1 hp per hit (fireball doesn't one-shot them)
    if (this.maxHp >= C.IRONCLAD_HP) {
      this.hp--;
      if (this.hp <= 0) {
        this.alive = false;
        return true; // destroyed
      }
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
