/**
 * Pre-designed ASCII shape templates for breakout game creative mode.
 *
 * Templates are authored on a 30×15 grid (15 strings of 30 chars each).
 *   '.' = empty cell
 *   '#' = filled brick
 *
 * Templates are upscaled to the exported GRID_W×GRID_H (56×40) at runtime.
 * HP assignment is handled separately by assignHP().
 * Row 14 (bottom) is kept empty for gameplay space.
 */

/** Internal template authoring dimensions (30×15). */
const TEMPLATE_W = 30;
const TEMPLATE_H = 15;

/** Exported grid dimensions for creative-mode levels (56×40). */
export const GRID_W = 56;
export const GRID_H = 40;

// ---------------------------------------------------------------------------
// Row-building helpers — guarantee exact TEMPLATE_W-char width & easy symmetry
// ---------------------------------------------------------------------------

/** Build a TEMPLATE_W-char row by specifying filled column ranges [start, end] (inclusive). */
function row(...ranges: [number, number][]): string {
  const chars = Array.from({ length: TEMPLATE_W }, () => ".");
  for (const [start, end] of ranges) {
    for (let c = start; c <= end; c++) chars[c] = "#";
  }
  return chars.join("");
}

/**
 * Build a mirror-symmetric TEMPLATE_W-char row.
 * Specify ranges on the left side; they are auto-mirrored to the right.
 * Symmetry axis is between col 14 and col 15: col c ↔ col (TEMPLATE_W - 1 - c).
 */
function sym(...leftRanges: [number, number][]): string {
  const chars = Array.from({ length: TEMPLATE_W }, () => ".");
  for (const [start, end] of leftRanges) {
    for (let c = start; c <= end; c++) {
      chars[c] = "#";
      chars[TEMPLATE_W - 1 - c] = "#";
    }
  }
  return chars.join("");
}

/** Punch holes (set to '.') at specific columns in a row string. */
function poke(rowStr: string, ...cols: number[]): string {
  const chars = rowStr.split("");
  for (const c of cols) chars[c] = ".";
  return chars.join("");
}

const EMPTY = ".".repeat(TEMPLATE_W);

// ---------------------------------------------------------------------------
// Template data
// ---------------------------------------------------------------------------
// Column reference:  0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 | 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29
// sym() mirrors:     col c  ↔  col (29-c)
//   sym([14,14]) → cols 14,15                (center pair)
//   sym([0,14])  → cols 0-29                 (full row)
//   sym([3,6])   → cols 3-6 and 23-26        (two blocks with gap)

export const SHAPE_TEMPLATES: Record<string, { keywords: string[]; grid: string[] }> = {

  // ---- 心形 (Heart) ----
  // Two rounded bumps at top merging into a wide body that tapers to a V-point.
  heart: {
    keywords: ["心形", "心", "爱心", "love", "heart", "❤"],
    grid: [
      sym([4, 8]),                              //  0: two bumps
      sym([3, 10]),                             //  1: bumps widen
      sym([2, 11]),                             //  2: bumps wider
      sym([1, 12]),                             //  3: almost merge
      sym([0, 14]),                             //  4: fully merged, widest
      sym([0, 14]),                             //  5: full body
      sym([1, 14]),                             //  6: start taper
      sym([2, 14]),                             //  7: tapering
      sym([3, 14]),                             //  8: narrowing
      sym([5, 14]),                             //  9: narrowing
      sym([7, 14]),                             // 10: narrowing
      sym([9, 14]),                             // 11: narrow
      sym([11, 14]),                            // 12: near tip
      sym([13, 14]),                            // 13: bottom tip
      EMPTY,                                    // 14
    ],
  },

  // ---- 城堡 (Castle) ----
  // Two tall towers with battlements, connecting wall, gate opening at bottom center.
  castle: {
    keywords: ["城堡", "castle", "堡垒"],
    grid: [
      sym([2, 2], [4, 4], [6, 6]),              //  0: battlement teeth
      sym([1, 7]),                               //  1: tower top
      sym([1, 7]),                               //  2: tower body
      sym([1, 7]),                               //  3: tower body
      sym([1, 7], [12, 14]),                     //  4: towers + central turret
      sym([0, 14]),                              //  5: full wall
      sym([0, 14]),                              //  6: full wall
      sym([0, 14]),                              //  7: full wall
      sym([0, 14]),                              //  8: full wall
      sym([0, 14]),                              //  9: full wall
      sym([0, 14]),                              // 10: full wall
      row([0, 11], [18, 29]),                    // 11: gate opening starts
      row([0, 11], [18, 29]),                    // 12: gate opening
      row([0, 11], [18, 29]),                    // 13: gate opening
      EMPTY,                                     // 14
    ],
  },

  // ---- 星形 (Star, 5-pointed) ----
  // Top point, horizontal arms extending wide, narrow waist, two bottom legs.
  star: {
    keywords: ["星形", "星星", "star", "五角星", "⭐"],
    grid: [
      sym([13, 14]),                             //  0: top point
      sym([12, 14]),                             //  1: point widens
      sym([11, 14]),                             //  2: point widens
      sym([9, 14]),                              //  3: broadening
      sym([0, 14]),                              //  4: full width arms
      sym([0, 14]),                              //  5: full width arms
      sym([3, 14]),                              //  6: upper body
      sym([5, 14]),                              //  7: narrow waist
      sym([4, 14]),                              //  8: legs start widening
      sym([3, 12]),                              //  9: two legs separate
      sym([2, 10]),                              // 10: legs spread
      sym([1, 8]),                               // 11: legs widen
      sym([0, 7]),                               // 12: leg tips wide
      EMPTY,                                     // 13
      EMPTY,                                     // 14
    ],
  },

  // ---- 钻石 (Diamond) ----
  // Perfect rhombus, grows 2 cols wider each row from top to middle, then shrinks.
  diamond: {
    keywords: ["钻石", "diamond", "菱形", "◆"],
    grid: [
      sym([14, 14]),                             //  0: top point
      sym([13, 14]),                             //  1
      sym([12, 14]),                             //  2
      sym([11, 14]),                             //  3
      sym([10, 14]),                             //  4
      sym([9, 14]),                              //  5
      sym([8, 14]),                              //  6: widest
      sym([7, 14]),                              //  7: widest
      sym([8, 14]),                              //  8
      sym([9, 14]),                              //  9
      sym([10, 14]),                             // 10
      sym([11, 14]),                             // 11
      sym([12, 14]),                             // 12
      sym([13, 14]),                             // 13: bottom point
      EMPTY,                                     // 14
    ],
  },

  // ---- 箭头 (Arrow, upward) ----
  // Triangular arrowhead tapering from wide base to point, then narrow shaft below.
  arrow: {
    keywords: ["箭头", "arrow", "箭", "↑"],
    grid: [
      sym([14, 14]),                             //  0: tip
      sym([13, 14]),                             //  1
      sym([12, 14]),                             //  2
      sym([11, 14]),                             //  3
      sym([9, 14]),                              //  4: widening faster
      sym([7, 14]),                              //  5
      sym([5, 14]),                              //  6
      sym([3, 14]),                              //  7: arrowhead base
      sym([11, 14]),                             //  8: shaft
      sym([11, 14]),                             //  9: shaft
      sym([11, 14]),                             // 10: shaft
      sym([11, 14]),                             // 11: shaft
      sym([11, 14]),                             // 12: shaft
      sym([11, 14]),                             // 13: shaft
      EMPTY,                                     // 14
    ],
  },

  // ---- 笑脸 (Smiley) ----
  // Large circle with two eye holes and a smile curve.
  smiley: {
    keywords: ["笑脸", "smiley", "smile", "😊", "表情"],
    grid: [
      sym([8, 14]),                                                     //  0: top arc
      sym([5, 14]),                                                     //  1
      sym([4, 14]),                                                     //  2
      sym([3, 14]),                                                     //  3
      poke(sym([2, 14]), 7, 8, 21, 22),                                //  4: eyes
      poke(sym([2, 14]), 7, 8, 21, 22),                                //  5: eyes
      sym([2, 14]),                                                     //  6: solid
      sym([2, 14]),                                                     //  7: solid
      sym([2, 14]),                                                     //  8: solid
      poke(sym([3, 14]), 7, 8, 21, 22),                                //  9: smile corners
      poke(sym([4, 14]), 8, 9, 10, 11, 18, 19, 20, 21),               // 10: smile bottom arc
      sym([5, 14]),                                                     // 11: lower face
      sym([8, 14]),                                                     // 12: bottom arc
      EMPTY,                                                            // 13
      EMPTY,                                                            // 14
    ],
  },

  // ---- 彩虹 (Rainbow) ----
  // Thick arc at top, hollow interior, two pillars on sides.
  rainbow: {
    keywords: ["彩虹", "rainbow", "虹", "拱", "🌈"],
    grid: [
      sym([7, 14]),                              //  0: top of arc
      sym([5, 14]),                              //  1: arc widens
      sym([4, 14]),                              //  2
      sym([3, 14]),                              //  3
      sym([2, 5]),                               //  4: sides only
      sym([1, 4]),                               //  5: pillars
      sym([1, 4]),                               //  6: pillars
      sym([0, 3]),                               //  7: pillars
      sym([0, 3]),                               //  8: pillars
      sym([0, 3]),                               //  9: pillars
      sym([0, 3]),                               // 10: pillars
      sym([0, 3]),                               // 11: pillar base
      sym([0, 3]),                               // 12: pillar base
      EMPTY,                                     // 13
      EMPTY,                                     // 14
    ],
  },

  // ---- 火箭 (Rocket) ----
  // Pointed nose cone, cylindrical body, side fins, exhaust nozzle.
  rocket: {
    keywords: ["火箭", "rocket", "🚀"],
    grid: [
      sym([14, 14]),                             //  0: nose tip
      sym([13, 14]),                             //  1: nose
      sym([12, 14]),                             //  2: nose widens
      sym([11, 14]),                             //  3: body top
      sym([11, 14]),                             //  4: body
      sym([11, 14]),                             //  5: body
      sym([10, 14]),                             //  6: wider body
      sym([10, 14]),                             //  7: wider body
      sym([9, 14]),                              //  8: widest body
      sym([7, 14]),                              //  9: fins start
      sym([5, 7], [10, 14]),                     // 10: fins + body gap
      sym([4, 6], [11, 14]),                     // 11: fin tips + nozzle
      sym([5, 5], [12, 14]),                     // 12: exhaust tips
      sym([13, 14]),                             // 13: exhaust stream
      EMPTY,                                     // 14
    ],
  },

  // ---- 小猫 (Cat) ----
  // Cat face: pointed ears, round head, eye holes, nose/mouth detail.
  cat: {
    keywords: ["小猫", "猫", "cat", "kitty", "🐱", "猫咪"],
    grid: [
      sym([2, 3]),                                                     //  0: ear tips
      sym([2, 4]),                                                     //  1: ears widen
      sym([2, 5]),                                                     //  2: ears wider
      sym([2, 6]),                                                     //  3: ears meet head
      sym([3, 14]),                                                    //  4: head top
      sym([2, 14]),                                                    //  5: head wide
      sym([2, 14]),                                                    //  6: head wide
      poke(sym([2, 14]), 7, 8, 21, 22),                               //  7: eyes
      poke(sym([2, 14]), 7, 8, 21, 22),                               //  8: eyes
      sym([2, 14]),                                                    //  9: solid face
      poke(sym([3, 14]), 14, 15),                                     // 10: nose
      poke(sym([4, 14]), 12, 13, 14, 15, 16, 17),                    // 11: mouth
      sym([5, 14]),                                                    // 12: chin
      sym([7, 14]),                                                    // 13: chin bottom
      EMPTY,                                                           // 14
    ],
  },

  // ---- 雪花 (Snowflake) ----
  // 6-fold branching pattern: center cross with diagonal branches.
  snowflake: {
    keywords: ["雪花", "snowflake", "snow", "❄"],
    grid: [
      sym([2, 3], [7, 7], [14, 14]),             //  0: branch tips
      sym([3, 4], [8, 8], [14, 14]),             //  1: converging
      sym([4, 5], [9, 9], [14, 14]),             //  2: converging
      sym([5, 14]),                              //  3: horizontal bar
      sym([3, 14]),                              //  4: thick center
      sym([5, 14]),                              //  5: horizontal bar
      sym([8, 14]),                              //  6: vertical core
      sym([3, 14]),                              //  7: thick center (mid)
      sym([8, 14]),                              //  8: vertical core
      sym([5, 14]),                              //  9: horizontal bar
      sym([3, 14]),                              // 10: thick center
      sym([5, 14]),                              // 11: horizontal bar
      sym([4, 5], [9, 9], [14, 14]),             // 12: diverging
      sym([3, 4], [8, 8], [14, 14]),             // 13: branch tips
      EMPTY,                                     // 14
    ],
  },

  // ---- 皇冠 (Crown) ----
  // Five points at top, wide band body, broad base.
  crown: {
    keywords: ["皇冠", "crown", "王冠", "👑"],
    grid: [
      sym([3, 3], [8, 8], [14, 14]),             //  0: five point tips
      sym([3, 4], [8, 9], [13, 14]),             //  1: points grow
      sym([2, 5], [7, 10], [12, 14]),            //  2: points wider
      sym([2, 6], [7, 14]),                      //  3: points merging
      sym([2, 14]),                              //  4: merged band
      sym([2, 14]),                              //  5: band
      sym([2, 14]),                              //  6: band
      sym([2, 14]),                              //  7: band
      sym([2, 14]),                              //  8: band
      sym([2, 14]),                              //  9: band
      sym([1, 14]),                              // 10: wide base
      sym([1, 14]),                              // 11: wide base
      sym([0, 14]),                              // 12: broadest base
      sym([0, 14]),                              // 13: broadest base
      EMPTY,                                     // 14
    ],
  },

  // ---- 闪电 (Lightning) ----
  // Zigzag bolt from upper-right to lower-left, intentionally asymmetric.
  lightning: {
    keywords: ["闪电", "lightning", "bolt", "⚡", "雷电"],
    grid: [
      row([12, 22]),                             //  0: top bar
      row([11, 21]),                             //  1: shift left
      row([10, 20]),                             //  2
      row([9, 19]),                              //  3
      row([7, 23]),                              //  4: wide horizontal jog
      row([13, 23]),                             //  5: jump right
      row([12, 22]),                             //  6: shift left
      row([11, 21]),                             //  7
      row([10, 20]),                             //  8
      row([9, 19]),                              //  9
      row([5, 19]),                              // 10: wide horizontal jog
      row([5, 15]),                              // 11: shift left
      row([6, 14]),                              // 12
      row([7, 13]),                              // 13: bottom
      EMPTY,                                     // 14
    ],
  },
};

// ---------------------------------------------------------------------------
// Validation — runs once at module load to catch grid dimension errors
// ---------------------------------------------------------------------------

(function validateTemplates(): void {
  for (const [name, { grid }] of Object.entries(SHAPE_TEMPLATES)) {
    if (grid.length !== TEMPLATE_H) {
      throw new Error(`Template "${name}" has ${grid.length} rows, expected ${TEMPLATE_H}`);
    }
    for (let r = 0; r < grid.length; r++) {
      if (grid[r].length !== TEMPLATE_W) {
        throw new Error(
          `Template "${name}" row ${r} has ${grid[r].length} chars, expected ${TEMPLATE_W}: "${grid[r]}"`,
        );
      }
    }
  }
})();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Match a user prompt against known shape templates.
 * Returns the ASCII grid if a keyword is found in the prompt, or null.
 * Matching is case-insensitive for English keywords.
 */
export function matchTemplate(prompt: string): string[] | null {
  const lower = prompt.toLowerCase();
  for (const { keywords, grid } of Object.values(SHAPE_TEMPLATES)) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return grid;
      }
    }
  }
  return null;
}

/**
 * Return a (potentially varied) version of a template grid, upscaled to
 * the exported GRID_W×GRID_H dimensions.
 * Currently returns the upscaled grid as-is — placeholder for future random
 * variation (e.g. randomly removing a few edge bricks for an organic feel).
 * HP variation is handled separately by assignHP().
 */
export function getTemplateWithVariation(templateGrid: string[]): string[] {
  return upscaleGrid(templateGrid, TEMPLATE_W, TEMPLATE_H, GRID_W, GRID_H);
}

// ---------------------------------------------------------------------------
// Grid upscaling — letterbox 30×15 templates into 56×40 with aspect ratio
// ---------------------------------------------------------------------------

/**
 * Upscale a source grid to a larger destination grid, preserving aspect ratio
 * via letterboxing (empty rows at top/bottom if needed).
 *
 * Example: 30×15 (2:1) → 56×40 (1.4:1) becomes 56×28 centred in 56×40.
 */
function upscaleGrid(
  src: string[],
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): string[] {
  // Preserve aspect ratio: scale width to dstW, compute matching height
  const scaledH = Math.round((dstW * srcH) / srcW); // 56 * 15/30 = 28
  const padTop = Math.floor((dstH - scaledH) / 2);

  const result: string[] = [];

  // Top padding
  for (let i = 0; i < padTop; i++) {
    result.push(".".repeat(dstW));
  }

  // Upscaled content — nearest-neighbour sampling
  for (let r = 0; r < scaledH; r++) {
    const srcR = Math.min(Math.floor((r + 0.5) * srcH / scaledH), srcH - 1);
    let row = "";
    for (let c = 0; c < dstW; c++) {
      const srcC = Math.min(Math.floor((c + 0.5) * srcW / dstW), srcW - 1);
      row += src[srcR][srcC];
    }
    result.push(row);
  }

  // Bottom padding
  while (result.length < dstH) {
    result.push(".".repeat(dstW));
  }

  return result;
}
