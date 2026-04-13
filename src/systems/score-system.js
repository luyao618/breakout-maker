// src/systems/score-system.js
// Provides: ScoreSystem
// Depends: C

class ScoreSystem {
  constructor() {
    this.score = 0;
    this._combo = 0;
    this._lastHit = -Infinity;
    this.comboTexts = [];  // floating combo text entries
  }

  /**
   * Called when a brick is hit.
   * @param {boolean} destroyed - true if the brick was destroyed
   */
  onBrickHit(destroyed) {
    if (!destroyed) return;

    const now = performance.now();

    // Combo: consecutive hits within the timeout window
    if (now - this._lastHit < C.COMBO_TIMEOUT) {
      this._combo++;
    } else {
      this._combo = 1;
    }
    this._lastHit = now;

    // Score with combo multiplier
    const mult = 1 + (this._combo - 1) * C.COMBO_MULT;
    const pts  = Math.round(C.BASE_SCORE * mult);
    this.score += pts;

    // Show floating combo text for combos >= 2
    if (this._combo >= 2) {
      this.comboTexts.push({
        text: `${this._combo}x Combo! +${pts}`,
        timer: 1.0,
      });
    }
  }

  /** Tick combo text timers and prune expired entries. */
  update(dt) {
    this.comboTexts = this.comboTexts.filter(t => {
      t.timer -= dt;
      return t.timer > 0;
    });
  }
}
