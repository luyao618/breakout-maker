// src/entities/power-up-drop.js
// Provides: PowerUpDrop, rollPowerUpDrop
// Depends: C, PowerUpType, POWER_UP_WEIGHTS, POWER_UP_DROP_CHANCE

class PowerUpDrop {
  /**
   * @param {number} x
   * @param {number} y
   * @param {string} type - one of PowerUpType.*
   */
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = 10;
    this.vy = 100;          // constant fall speed (px/s)
    this.alive = true;
    this.rotation = 0;      // visual spin angle
  }

  /** Advance the drop by dt seconds. */
  update(dt) {
    this.y += this.vy * dt;
    this.rotation += dt * 3;
    // Remove if it falls off-screen
    if (this.y > C.SCREEN_H + 20) this.alive = false;
  }
}

/**
 * Possibly spawn a PowerUpDrop at (x, y) using weighted random selection.
 * @param {number} x
 * @param {number} y
 * @returns {PowerUpDrop|null}
 */
function rollPowerUpDrop(x, y) {
  if (Math.random() > POWER_UP_DROP_CHANCE) return null;

  // Weighted random selection from POWER_UP_WEIGHTS
  const totalWeight = POWER_UP_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const pw of POWER_UP_WEIGHTS) {
    roll -= pw.weight;
    if (roll <= 0) return new PowerUpDrop(x, y, pw.type);
  }

  // Fallback (should not normally be reached)
  return new PowerUpDrop(x, y, PowerUpType.SPLIT);
}
