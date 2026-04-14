/**
 * Evaluation metrics for creative-mode brick layouts.
 *
 * Compares generated brick arrays against ground-truth reference masks and
 * produces numeric scores + a composite rating.
 *
 * Brick format expected: Array of { row, col } where row ∈ [0, gridH) and col ∈ [0, gridW).
 */

const { GROUND_TRUTH } = require('./ground-truth');

// ───────────────────────── helpers ──────────────────────────

/**
 * Convert a brick array into a gridH×gridW binary matrix.
 */
function bricksToGrid(bricks, gridW = 30, gridH = 15) {
  const grid = Array.from({ length: gridH }, () => new Array(gridW).fill(0));
  for (const b of bricks) {
    const row = Math.round(b.row);
    const col = Math.round(b.col);
    if (row >= 0 && row < gridH && col >= 0 && col < gridW) {
      grid[row][col] = 1;
    }
  }
  return grid;
}

// ───────────────────── primary metrics ──────────────────────

/**
 * Intersection-over-Union between a brick layout and a reference mask.
 */
function computeIoU(bricks, mask, gridW = 30, gridH = 15) {
  const grid = bricksToGrid(bricks, gridW, gridH);
  let intersection = 0;
  let union = 0;
  for (let r = 0; r < gridH; r++) {
    for (let c = 0; c < gridW; c++) {
      const g = grid[r][c];
      const m = mask[r][c];
      if (g && m) intersection++;
      if (g || m) union++;
    }
  }
  return union === 0 ? 1 : intersection / union;
}

/**
 * Try all x/y offsets in [-maxShiftX, maxShiftX] × [-maxShiftY, maxShiftY]
 * and return the best IoU.  Handles slight centering variations.
 */
function bestAlignedIoU(bricks, mask, maxShiftX = 2, maxShiftY = 1) {
  const gridW = mask[0].length;
  const gridH = mask.length;
  let best = 0;
  for (let dy = -maxShiftY; dy <= maxShiftY; dy++) {
    for (let dx = -maxShiftX; dx <= maxShiftX; dx++) {
      const shifted = bricks.map((b) => ({ row: b.row + dy, col: b.col + dx }));
      const score = computeIoU(shifted, mask, gridW, gridH);
      if (score > best) best = score;
    }
  }
  return best;
}

/**
 * Horizontal (left-right) symmetry score.
 * For every brick at col c, check whether a brick also exists at col (gridW-1-c)
 * on the same row. Returns the ratio of matched pairs.
 */
function horizontalSymmetryScore(bricks, gridW = 30) {
  const set = new Set();
  for (const b of bricks) {
    set.add(`${Math.round(b.row)},${Math.round(b.col)}`);
  }
  let matched = 0;
  let total = bricks.length;
  for (const b of bricks) {
    const mirrorCol = gridW - 1 - Math.round(b.col);
    if (set.has(`${Math.round(b.row)},${mirrorCol}`)) {
      matched++;
    }
  }
  return total === 0 ? 1 : matched / total;
}

/**
 * Centering score – how close the centroid is to the grid centre.
 * Returns 1.0 when perfectly centred, approaches 0 near corners.
 */
function centeringScore(bricks, gridW = 30, gridH = 15) {
  if (bricks.length === 0) return 0;
  let cx = 0;
  let cy = 0;
  for (const b of bricks) {
    cx += b.col;
    cy += b.row;
  }
  cx /= bricks.length;
  cy /= bricks.length;
  const midX = (gridW - 1) / 2;
  const midY = (gridH - 1) / 2;
  // Max possible distance (corner to centre)
  const maxDist = Math.sqrt(midX * midX + midY * midY);
  const dist = Math.sqrt((cx - midX) ** 2 + (cy - midY) ** 2);
  return 1 - dist / maxDist;
}

/**
 * Coverage ratio – peaks at 1.0 when brick count matches the mask count.
 * Decreases linearly as counts diverge.
 */
function coverageRatio(bricks, mask) {
  let expected = 0;
  for (const row of mask) {
    for (const v of row) {
      if (v) expected++;
    }
  }
  if (expected === 0) return bricks.length === 0 ? 1 : 0;
  const actual = bricks.length;
  const ratio = actual / expected;
  // Score peaks at ratio=1 and decreases symmetrically
  return Math.max(0, 1 - Math.abs(1 - ratio));
}

// ──────────────────── feature checks ────────────────────────

/**
 * Heart: top row should have two separated filled regions.
 */
function hasTwoBumps(bricks, gridW) {
  const grid = bricksToGrid(bricks, gridW);
  // Inspect the top two rows
  for (let r = 0; r < Math.min(2, grid.length); r++) {
    const row = grid[r];
    let regions = 0;
    let inRegion = false;
    for (let c = 0; c < gridW; c++) {
      if (row[c] && !inRegion) {
        regions++;
        inRegion = true;
      } else if (!row[c]) {
        inRegion = false;
      }
    }
    if (regions >= 2) return true;
  }
  return false;
}

/**
 * Heart: bottom should taper to a point (fewer bricks in bottom rows).
 */
function hasVBottom(bricks, gridW, gridH) {
  const grid = bricksToGrid(bricks, gridW, gridH);
  // Count bricks in the bottom three non-empty rows
  const counts = [];
  for (let r = gridH - 1; r >= 0; r--) {
    const cnt = grid[r].reduce((s, v) => s + v, 0);
    if (cnt > 0 || counts.length > 0) counts.push(cnt);
    if (counts.length >= 3) break;
  }
  counts.reverse();
  // Should be decreasing (wider → narrower)
  if (counts.length < 2) return false;
  return counts[counts.length - 1] < counts[0];
}

/**
 * Castle: should have elevated structures on the sides (towers higher than centre).
 */
function hasTowers(bricks, gridW, gridH) {
  const grid = bricksToGrid(bricks, gridW, gridH);
  // Find topmost filled row in left quarter and right quarter vs centre
  function topRow(startCol, endCol) {
    for (let r = 0; r < gridH; r++) {
      for (let c = startCol; c < endCol; c++) {
        if (grid[r][c]) return r;
      }
    }
    return gridH;
  }
  const leftQuarter = Math.floor(gridW / 4);
  const rightQuarterStart = gridW - leftQuarter;
  const centreStart = Math.floor(gridW * 0.35);
  const centreEnd = Math.ceil(gridW * 0.65);

  const leftTop = topRow(0, leftQuarter);
  const rightTop = topRow(rightQuarterStart, gridW);
  const centreTop = topRow(centreStart, centreEnd);

  // Towers should start at the same row or higher than the centre
  return leftTop <= centreTop && rightTop <= centreTop;
}

/**
 * Castle: bottom-centre should have empty space (gate opening).
 */
function hasGate(bricks, gridW, gridH) {
  const grid = bricksToGrid(bricks, gridW, gridH);
  const midStart = Math.floor(gridW / 2) - 2;
  const midEnd = Math.ceil(gridW / 2) + 2;
  // Check bottom two rows (before row 9) for an empty run in the centre
  for (let r = gridH - 3; r < gridH - 1; r++) {
    if (r < 0 || r >= gridH) continue;
    let emptyCount = 0;
    for (let c = midStart; c < midEnd; c++) {
      if (!grid[r][c]) emptyCount++;
    }
    if (emptyCount >= 2) return true;
  }
  return false;
}

/**
 * Smiley: should have two empty holes (eyes) in the upper region.
 */
function hasEyes(bricks, gridW, gridH) {
  const grid = bricksToGrid(bricks, gridW, gridH);
  // Scan rows 1-4 for two separated empty regions that are surrounded by filled cells
  for (let r = 1; r < Math.min(5, gridH); r++) {
    const row = grid[r];
    // Find empty stretches within the filled area
    let firstFilled = -1;
    let lastFilled = -1;
    for (let c = 0; c < gridW; c++) {
      if (row[c]) {
        if (firstFilled < 0) firstFilled = c;
        lastFilled = c;
      }
    }
    if (firstFilled < 0) continue;
    // Count empty gaps inside the filled range
    let gaps = 0;
    let inGap = false;
    for (let c = firstFilled; c <= lastFilled; c++) {
      if (!row[c] && !inGap) {
        gaps++;
        inGap = true;
      } else if (row[c]) {
        inGap = false;
      }
    }
    if (gaps >= 2) return true;
  }
  return false;
}

/**
 * Arrow: the top portion should widen like a triangle (each row wider than the one above).
 */
function hasArrowhead(bricks, gridW, gridH) {
  const grid = bricksToGrid(bricks, gridW, gridH);
  // Look at the first 5 rows
  let prevCount = 0;
  let increasing = 0;
  for (let r = 0; r < Math.min(5, gridH); r++) {
    const cnt = grid[r].reduce((s, v) => s + v, 0);
    if (cnt === 0) continue;
    if (cnt >= prevCount) {
      increasing++;
    }
    prevCount = cnt;
  }
  return increasing >= 3;
}

/**
 * Arrow: should have a narrow rectangular shaft below the arrowhead.
 */
function hasShaft(bricks, gridW, gridH) {
  const grid = bricksToGrid(bricks, gridW, gridH);
  // Lower half rows should have a consistent, narrow width
  let shaftRows = 0;
  let prevWidth = -1;
  for (let r = Math.floor(gridH / 2); r < gridH; r++) {
    const cnt = grid[r].reduce((s, v) => s + v, 0);
    if (cnt === 0) continue;
    if (cnt <= gridW / 3) {
      // Narrow enough
      if (prevWidth < 0 || Math.abs(cnt - prevWidth) <= 1) {
        shaftRows++;
      }
      prevWidth = cnt;
    }
  }
  return shaftRows >= 2;
}

// Map feature name → checker function
const FEATURE_CHECKERS = {
  hasTwoBumps,
  hasVBottom,
  hasTowers,
  hasGate,
  hasEyes,
  hasArrowhead,
  hasShaft,
};

// ─────────────────── composite evaluation ───────────────────

/**
 * Composite evaluation of a generated level.
 *
 * @param {string}  prompt  The shape prompt (e.g. '心形')
 * @param {Array}   bricks  Array of { x, y }
 * @param {number}  gridW
 * @param {number}  gridH
 * @returns {object} Full evaluation result
 */
function evaluateLevel(prompt, bricks, gridW = 30, gridH = 15) {
  const truth = GROUND_TRUTH[prompt];

  // Default scores when no ground truth is available
  const result = {
    prompt,
    brickCount: bricks.length,
    scores: {
      iou: 0,
      symmetry: 0,
      centering: 0,
      coverage: 0,
      featureScore: 0,
    },
    featureResults: {},
    composite: 0,
    rating: 'FAIL',
  };

  if (!truth) {
    // No reference – only compute generic metrics
    result.scores.symmetry = horizontalSymmetryScore(bricks, gridW);
    result.scores.centering = centeringScore(bricks, gridW, gridH);
    result.composite = result.scores.symmetry * 0.5 + result.scores.centering * 0.5;
    result.rating = ratingFromComposite(result.composite);
    return result;
  }

  const { mask, features } = truth;

  // IoU (with alignment)
  result.scores.iou = bestAlignedIoU(bricks, mask);

  // Symmetry
  result.scores.symmetry = horizontalSymmetryScore(bricks, gridW);

  // Centering
  result.scores.centering = centeringScore(bricks, gridW, gridH);

  // Coverage
  result.scores.coverage = coverageRatio(bricks, mask);

  // Feature checks
  let featuresPassed = 0;
  let featuresTotal = 0;
  for (const [key, expected] of Object.entries(features)) {
    // Skip numeric bounds – they aren't boolean feature checks
    if (key === 'symmetry' || key === 'minBricks' || key === 'maxBricks') continue;
    if (typeof expected !== 'boolean') continue;

    const checker = FEATURE_CHECKERS[key];
    if (!checker) continue;

    featuresTotal++;
    const passed = checker(bricks, gridW, gridH);
    result.featureResults[key] = passed;
    if (passed === expected) featuresPassed++;
  }

  // Brick count within bounds as an additional feature
  if (features.minBricks != null && features.maxBricks != null) {
    featuresTotal++;
    const inRange =
      bricks.length >= features.minBricks && bricks.length <= features.maxBricks;
    result.featureResults.brickCountInRange = inRange;
    if (inRange) featuresPassed++;
  }

  result.scores.featureScore =
    featuresTotal === 0 ? 1 : featuresPassed / featuresTotal;

  // Composite: IoU 40%, featureScore 20%, symmetry 15%, coverage 15%, centering 10%
  result.composite =
    result.scores.iou * 0.4 +
    result.scores.featureScore * 0.2 +
    result.scores.symmetry * 0.15 +
    result.scores.coverage * 0.15 +
    result.scores.centering * 0.1;

  result.rating = ratingFromComposite(result.composite);

  return result;
}

function ratingFromComposite(composite) {
  if (composite >= 0.55) return 'GOOD';
  if (composite >= 0.40) return 'MARGINAL';
  if (composite >= 0.30) return 'POOR';
  return 'FAIL';
}

// ─────────────────── ASCII diff renderer ────────────────────

/**
 * Render a side-by-side comparison: Generated | Expected | Diff.
 *
 * Legend:
 *   = : both filled (match)
 *   + : extra (generated but not expected)
 *   - : missing (expected but not generated)
 *   . : both empty
 */
function renderComparison(bricks, mask, gridW = 30, gridH = 15) {
  const grid = bricksToGrid(bricks, gridW, gridH);
  const lines = [];

  // Header
  const colHeader = Array.from({ length: gridW }, (_, i) => (i % 10).toString()).join('');
  lines.push(
    `  Generated${' '.repeat(gridW - 8)}  ` +
    `Expected${' '.repeat(gridW - 6)}  ` +
    `Diff`
  );
  lines.push(`  ${colHeader}  ${colHeader}  ${colHeader}`);

  for (let r = 0; r < gridH; r++) {
    let genStr = '';
    let expStr = '';
    let difStr = '';
    for (let c = 0; c < gridW; c++) {
      const g = grid[r][c];
      const m = mask[r][c];
      genStr += g ? '#' : '.';
      expStr += m ? '#' : '.';
      if (g && m) difStr += '=';
      else if (g && !m) difStr += '+';
      else if (!g && m) difStr += '-';
      else difStr += '.';
    }
    lines.push(`${r} ${genStr}  ${expStr}  ${difStr}`);
  }

  const output = lines.join('\n');
  console.log(output);
  return output;
}

// ───────────────────────── exports ──────────────────────────

module.exports = {
  bricksToGrid,
  computeIoU,
  bestAlignedIoU,
  horizontalSymmetryScore,
  centeringScore,
  coverageRatio,
  evaluateLevel,
  renderComparison,
  // Feature checkers (exported for direct testing)
  hasTwoBumps,
  hasVBottom,
  hasTowers,
  hasGate,
  hasEyes,
  hasArrowhead,
  hasShaft,
};
