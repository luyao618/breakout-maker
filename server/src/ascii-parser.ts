import type { Brick } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_GRID_W = 30;
const DEFAULT_GRID_H = 15;

// ---------------------------------------------------------------------------
// parseAsciiGrid
// ---------------------------------------------------------------------------

/**
 * Parse a text grid into an array of bricks.
 *
 * Each row is a line, each character is a cell.
 * - `#` = filled brick (hp 1)
 * - `.` or any other character = empty
 *
 * Lines are stripped of leading/trailing whitespace and blank lines are
 * skipped.  If a line is shorter than `gridW` it is padded with `.`;
 * if longer it is truncated.  Extra rows beyond `gridH` are ignored and
 * missing rows are treated as empty.
 *
 * @param ascii - The raw text grid.
 * @param gridW - Grid width in columns (default 20).
 * @param gridH - Grid height in rows (default 10).
 * @returns An array of {@link Brick} objects (all with `hp = 1`).
 */
export function parseAsciiGrid(
  ascii: string,
  gridW: number = DEFAULT_GRID_W,
  gridH: number = DEFAULT_GRID_H,
): Brick[] {
  const bricks: Brick[] = [];

  const lines = ascii
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows = lines.slice(0, gridH);

  for (let row = 0; row < rows.length; row++) {
    // Pad or truncate to gridW
    const line = rows[row].padEnd(gridW, ".").slice(0, gridW);

    for (let col = 0; col < gridW; col++) {
      if (line[col] === "#") {
        bricks.push({ row, col, hp: 1 });
      }
    }
  }

  return bricks;
}

// ---------------------------------------------------------------------------
// assignHP
// ---------------------------------------------------------------------------

/**
 * Assign hit-points to bricks based on their neighbourhood.
 *
 * Uses a 4-directional border-detection heuristic:
 *
 * 1. **Structural base** (`row >= gridH - 2`): `hp = 10` (iron).
 *    This rule takes priority over the ones below.
 * 2. **Edge / corner** (≥ 2 empty neighbours): `hp = 3` (brass highlight).
 * 3. **Near-edge** (1 empty neighbour): `hp = 2` (copper).
 * 4. **Interior** (0 empty neighbours): `hp = 1` (bronze fill).
 *
 * Grid edges are treated as empty when counting neighbours.
 *
 * @param bricks - Input bricks (not mutated).
 * @param gridW  - Grid width in columns.
 * @param gridH  - Grid height in rows.
 * @returns A new array of bricks with updated `hp` values.
 */
export function assignHP(
  bricks: Brick[],
  gridW: number,
  gridH: number,
): Brick[] {
  // Build occupancy grid
  const occupied: boolean[][] = Array.from({ length: gridH }, () =>
    Array<boolean>(gridW).fill(false),
  );

  for (const b of bricks) {
    if (b.row >= 0 && b.row < gridH && b.col >= 0 && b.col < gridW) {
      occupied[b.row][b.col] = true;
    }
  }

  const directions: [number, number][] = [
    [-1, 0], // up
    [1, 0],  // down
    [0, -1], // left
    [0, 1],  // right
  ];

  return bricks.map((b) => {
    // Structural base override
    if (b.row >= gridH - 2) {
      return { ...b, hp: 10 };
    }

    let emptyNeighbors = 0;
    for (const [dr, dc] of directions) {
      const nr = b.row + dr;
      const nc = b.col + dc;

      // Out-of-bounds counts as empty
      if (nr < 0 || nr >= gridH || nc < 0 || nc >= gridW) {
        emptyNeighbors++;
      } else if (!occupied[nr][nc]) {
        emptyNeighbors++;
      }
    }

    let hp: number;
    if (emptyNeighbors >= 2) {
      hp = 3;
    } else if (emptyNeighbors === 1) {
      hp = 2;
    } else {
      hp = 1;
    }

    return { ...b, hp };
  });
}

// ---------------------------------------------------------------------------
// enforceSymmetry
// ---------------------------------------------------------------------------

/**
 * Mirror bricks so the pattern is left–right symmetric.
 *
 * 1. Compute the centroid column and shift all bricks to centre them within
 *    `gridW`.
 * 2. For every brick, ensure its horizontal mirror (`gridW - 1 - col`) is
 *    also present.
 * 3. Deduplicate by `(row, col)`.
 *
 * @param bricks - Input bricks (not mutated).
 * @param gridW  - Grid width in columns.
 * @returns A new, deduplicated array of bricks.
 */
export function enforceSymmetry(bricks: Brick[], gridW: number): Brick[] {
  if (bricks.length === 0) return [];

  // --- 1. Compute centroid and shift to centre ---
  const centroid =
    bricks.reduce((sum, b) => sum + b.col, 0) / bricks.length;
  const idealCentre = (gridW - 1) / 2;
  const shift = Math.round(idealCentre - centroid);

  const shifted: Brick[] = bricks.map((b) => ({
    ...b,
    col: b.col + shift,
  }));

  // --- 2. Mirror each brick ---
  const mirrored: Brick[] = [];
  for (const b of shifted) {
    mirrored.push(b);
    const mirrorCol = gridW - 1 - b.col;
    mirrored.push({ ...b, col: mirrorCol });
  }

  // --- 3. Deduplicate by (row, col) ---
  const seen = new Set<string>();
  const result: Brick[] = [];
  for (const b of mirrored) {
    // Skip out-of-bounds bricks
    if (b.col < 0 || b.col >= gridW) continue;

    const key = `${b.row},${b.col}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(b);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// extractAsciiGrid
// ---------------------------------------------------------------------------

/**
 * Extract a clean ASCII grid from potentially messy LLM output.
 *
 * Processing steps:
 * 1. Strip markdown code fences (` ```…``` `).
 * 2. Strip `<think>…</think>` blocks.
 * 3. Remove lines that look like explanatory text (Chinese characters,
 *    common English prefixes such as "row", "here", "output", etc.).
 * 4. Find the longest run of consecutive lines that are 15–25 characters
 *    wide and consist mostly of `#`, `.`, and whitespace.
 * 5. Return that block as a trimmed string.
 *
 * @param rawOutput - The raw LLM response string.
 * @returns A cleaned ASCII grid string.
 */
export function extractAsciiGrid(rawOutput: string): string {
  let text = rawOutput;

  // --- 1. Strip <think>...</think> blocks ---
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");

  // --- 2. Strip markdown code fences ---
  // Replace ```<optional lang>\n...\n``` with just the inner content
  text = text.replace(/```[a-z]*\n?([\s\S]*?)```/gi, "$1");

  // --- 3. Split into lines and filter ---
  const lines = text.split("\n");

  // Regex for lines that look like explanatory prose
  const chineseRe = /[\u4e00-\u9fff]/;
  const prefixRe = /^(row|here|output|note|the |this |each |below|above|grid|level|explanation)/i;

  const filtered: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    if (chineseRe.test(trimmed)) continue;
    if (prefixRe.test(trimmed)) continue;
    filtered.push(trimmed);
  }

  // --- 4. Find the best consecutive block of grid-like lines ---
  // A "grid-like" line is 15–25 chars and mostly consists of #, ., and spaces
  const gridLineRe = /^[.#\s]+$/;

  function isGridLine(line: string): boolean {
    return line.length >= 15 && line.length <= 35 && gridLineRe.test(line);
  }

  let bestStart = 0;
  let bestLen = 0;
  let curStart = 0;
  let curLen = 0;

  for (let i = 0; i < filtered.length; i++) {
    if (isGridLine(filtered[i])) {
      if (curLen === 0) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestStart = curStart;
        bestLen = curLen;
      }
    } else {
      curLen = 0;
    }
  }

  if (bestLen === 0) {
    // Fallback: return all filtered lines joined (best effort)
    return filtered.join("\n");
  }

  return filtered.slice(bestStart, bestStart + bestLen).join("\n");
}
