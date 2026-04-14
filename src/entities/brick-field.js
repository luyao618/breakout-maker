// src/entities/brick-field.js
// Provides: BrickField
// Depends: C, Brick

class BrickField {
  /**
   * @param {object} level    - level descriptor { gridWidth, gridHeight, bricks[] }
   * @param {number} screenW  - canvas width
   */
  constructor(level, screenW) {
    this.gridW = level.gridWidth;
    this.gridH = level.gridHeight;
    this.bricks = [];           // 2-D array [row][col], null = empty slot
    this.totalDestructible = 0; // how many bricks can be destroyed
    this.destroyed = 0;         // how many have been destroyed so far

    // ---------- Calculate brick dimensions ----------
    const playW = screenW - 20; // 10 px padding each side
    this.brickW = (playW - (this.gridW - 1) * C.BRICK_GAP) / this.gridW;
    this.brickH = this.brickW;  // Square bricks!
    this.offsetX = 10;
    this.offsetY = C.PLAY_TOP + 10;

    // ---------- Initialise empty grid ----------
    for (let r = 0; r < this.gridH; r++) {
      this.bricks[r] = new Array(this.gridW).fill(null);
    }

    // ---------- Place bricks from level data ----------
    for (const b of level.bricks) {
      const brick = new Brick(b.row, b.col, b.hp, b.color || null);
      this.bricks[b.row][b.col] = brick;
      // All bricks are now destructible (iron bricks take 10 hits)
      this.totalDestructible++;
    }
  }

  /**
   * Return the pixel rectangle for a brick at (row, col).
   * @returns {{ x: number, y: number, w: number, h: number }}
   */
  getBrickRect(row, col) {
    return {
      x: this.offsetX + col * (this.brickW + C.BRICK_GAP),
      y: this.offsetY + row * (this.brickH + C.BRICK_GAP),
      w: this.brickW,
      h: this.brickH,
    };
  }

  /** True when every destructible brick has been destroyed. */
  isCleared() {
    return this.destroyed >= this.totalDestructible;
  }

  /** Tick all bricks (shake timers, etc.). */
  update(dt) {
    for (let r = 0; r < this.gridH; r++) {
      for (let c = 0; c < this.gridW; c++) {
        if (this.bricks[r][c]) this.bricks[r][c].update(dt);
      }
    }
  }
}
