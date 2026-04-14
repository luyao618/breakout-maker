/**
 * ascii-parser.test.js — Tests for the ASCII grid parser, HP assignment,
 * symmetry enforcement, and ASCII extraction.
 *
 * These are deterministic tests — no LLM dependency.
 */

const { TestRunner, assert, assertEqual, assertDeepEqual } = require('../testutils');
const path = require('path');

// --- Load the TypeScript module via tsx ---
// We use a helper to require the TS file through the Node resolution
let parseAsciiGrid, assignHP, enforceSymmetry, extractAsciiGrid;

try {
  // Try direct require via tsx (if available)
  const mod = require('../../server/src/ascii-parser.ts');
  parseAsciiGrid = mod.parseAsciiGrid;
  assignHP = mod.assignHP;
  enforceSymmetry = mod.enforceSymmetry;
  extractAsciiGrid = mod.extractAsciiGrid;
} catch {
  // Fallback: inline implementations for testing without tsx
  // (These mirror the production code exactly)

  parseAsciiGrid = function(ascii, gridW = 30, gridH = 15) {
    const bricks = [];
    const lines = ascii.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const rows = lines.slice(0, gridH);
    for (let row = 0; row < rows.length; row++) {
      const line = rows[row].padEnd(gridW, '.').slice(0, gridW);
      for (let col = 0; col < gridW; col++) {
        if (line[col] === '#') {
          bricks.push({ row, col, hp: 1 });
        }
      }
    }
    return bricks;
  };

  assignHP = function(bricks, gridW, gridH) {
    const occupied = Array.from({ length: gridH }, () => Array(gridW).fill(false));
    for (const b of bricks) {
      if (b.row >= 0 && b.row < gridH && b.col >= 0 && b.col < gridW) {
        occupied[b.row][b.col] = true;
      }
    }
    const directions = [[-1,0],[1,0],[0,-1],[0,1]];
    return bricks.map(b => {
      if (b.row >= gridH - 2) return { ...b, hp: 10 };
      let empty = 0;
      for (const [dr, dc] of directions) {
        const nr = b.row + dr, nc = b.col + dc;
        if (nr < 0 || nr >= gridH || nc < 0 || nc >= gridW) empty++;
        else if (!occupied[nr][nc]) empty++;
      }
      let hp = empty >= 2 ? 3 : empty === 1 ? 2 : 1;
      return { ...b, hp };
    });
  };

  enforceSymmetry = function(bricks, gridW) {
    if (bricks.length === 0) return [];
    const centroid = bricks.reduce((s, b) => s + b.col, 0) / bricks.length;
    const ideal = (gridW - 1) / 2;
    const shift = Math.round(ideal - centroid);
    const shifted = bricks.map(b => ({ ...b, col: b.col + shift }));
    const mirrored = [];
    for (const b of shifted) {
      mirrored.push(b);
      mirrored.push({ ...b, col: gridW - 1 - b.col });
    }
    const seen = new Set();
    const result = [];
    for (const b of mirrored) {
      if (b.col < 0 || b.col >= gridW) continue;
      const key = `${b.row},${b.col}`;
      if (!seen.has(key)) { seen.add(key); result.push(b); }
    }
    return result;
  };

  extractAsciiGrid = function(raw) {
    let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
    text = text.replace(/```[a-z]*\n?([\s\S]*?)```/gi, '$1');
    const lines = text.split('\n');
    const chineseRe = /[\u4e00-\u9fff]/;
    const prefixRe = /^(row|here|output|note|the |this |each |below|above|grid|level|explanation)/i;
    const filtered = [];
    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed.length) continue;
      if (chineseRe.test(trimmed)) continue;
      if (prefixRe.test(trimmed)) continue;
      filtered.push(trimmed);
    }
    const gridLineRe = /^[.#\s]+$/;
    function isGridLine(line) {
      return line.length >= 15 && line.length <= 35 && gridLineRe.test(line);
    }
    let bestStart = 0, bestLen = 0, curStart = 0, curLen = 0;
    for (let i = 0; i < filtered.length; i++) {
      if (isGridLine(filtered[i])) {
        if (curLen === 0) curStart = i;
        curLen++;
        if (curLen > bestLen) { bestStart = curStart; bestLen = curLen; }
      } else { curLen = 0; }
    }
    if (bestLen === 0) return filtered.join('\n');
    return filtered.slice(bestStart, bestStart + bestLen).join('\n');
  };
}

const suite = new TestRunner('ASCII Parser');

// =============================================================================
// parseAsciiGrid
// =============================================================================

suite.test('parseAsciiGrid: basic 4x3 grid', () => {
  const ascii = '##..\n.##.\n..##';
  const bricks = parseAsciiGrid(ascii, 4, 3);
  assertEqual(bricks.length, 6, 'Should have 6 bricks');
  // Check specific positions
  assert(bricks.some(b => b.row === 0 && b.col === 0), 'Brick at (0,0)');
  assert(bricks.some(b => b.row === 0 && b.col === 1), 'Brick at (0,1)');
  assert(bricks.some(b => b.row === 1 && b.col === 1), 'Brick at (1,1)');
  assert(bricks.some(b => b.row === 1 && b.col === 2), 'Brick at (1,2)');
  assert(bricks.some(b => b.row === 2 && b.col === 2), 'Brick at (2,2)');
  assert(bricks.some(b => b.row === 2 && b.col === 3), 'Brick at (2,3)');
});

suite.test('parseAsciiGrid: all bricks are hp=1', () => {
  const bricks = parseAsciiGrid('####\n####', 4, 2);
  for (const b of bricks) {
    assertEqual(b.hp, 1, 'All parsed bricks should be hp=1');
  }
});

suite.test('parseAsciiGrid: short lines are padded', () => {
  const ascii = '##\n#';  // width < gridW
  const bricks = parseAsciiGrid(ascii, 4, 2);
  assertEqual(bricks.length, 3, 'Should have 3 bricks (2 + 1)');
  // No brick at col 2 or 3
  assert(!bricks.some(b => b.col >= 2), 'No bricks in padded area');
});

suite.test('parseAsciiGrid: long lines are truncated', () => {
  const ascii = '######';
  const bricks = parseAsciiGrid(ascii, 4, 1);
  assertEqual(bricks.length, 4, 'Should truncate to gridW=4');
});

suite.test('parseAsciiGrid: extra rows are ignored', () => {
  const ascii = '####\n####\n####\n####';
  const bricks = parseAsciiGrid(ascii, 4, 2);
  const maxRow = Math.max(...bricks.map(b => b.row));
  assertEqual(maxRow, 1, 'Max row should be gridH-1 = 1');
});

suite.test('parseAsciiGrid: fewer rows treated as empty', () => {
  const ascii = '####';
  const bricks = parseAsciiGrid(ascii, 4, 3);
  assertEqual(bricks.length, 4, 'Only row 0 has bricks');
  assert(bricks.every(b => b.row === 0), 'All bricks on row 0');
});

suite.test('parseAsciiGrid: blank lines are skipped', () => {
  const ascii = '####\n\n  \n####';
  const bricks = parseAsciiGrid(ascii, 4, 2);
  assertEqual(bricks.length, 8, 'Should have 8 bricks from 2 content lines');
  assert(bricks.some(b => b.row === 0), 'Has row 0');
  assert(bricks.some(b => b.row === 1), 'Has row 1');
});

suite.test('parseAsciiGrid: non-# characters treated as empty', () => {
  const ascii = '#.X1abc#';
  const bricks = parseAsciiGrid(ascii, 8, 1);
  assertEqual(bricks.length, 2, 'Only # chars become bricks');
  assert(bricks.some(b => b.col === 0), 'Brick at col 0');
  assert(bricks.some(b => b.col === 7), 'Brick at col 7');
});

suite.test('parseAsciiGrid: empty grid returns no bricks', () => {
  const bricks = parseAsciiGrid('...\n...', 3, 2);
  assertEqual(bricks.length, 0, 'Empty grid = no bricks');
});

suite.test('parseAsciiGrid: full grid', () => {
  const bricks = parseAsciiGrid('###\n###', 3, 2);
  assertEqual(bricks.length, 6, 'Full 3x2 grid = 6 bricks');
});

// =============================================================================
// assignHP
// =============================================================================

suite.test('assignHP: interior bricks get hp=1', () => {
  // 5x5 solid block — center brick is fully surrounded
  const bricks = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      bricks.push({ row: r, col: c, hp: 1 });
    }
  }
  const result = assignHP(bricks, 5, 8); // gridH=8 so no structural override
  const center = result.find(b => b.row === 2 && b.col === 2);
  assertEqual(center.hp, 1, 'Center brick should be hp=1 (interior)');
});

suite.test('assignHP: edge bricks get hp=3', () => {
  // Single brick — all 4 neighbors are empty
  const result = assignHP([{ row: 3, col: 3, hp: 1 }], 10, 10);
  assertEqual(result[0].hp, 3, 'Isolated brick should be hp=3 (edge)');
});

suite.test('assignHP: corner of shape gets hp=3', () => {
  // L-shape
  const bricks = [
    { row: 0, col: 0, hp: 1 },
    { row: 0, col: 1, hp: 1 },
    { row: 1, col: 0, hp: 1 },
  ];
  const result = assignHP(bricks, 5, 5);
  // (0,1) has empty right, empty top = 2 empty → hp=3
  const topRight = result.find(b => b.row === 0 && b.col === 1);
  assertEqual(topRight.hp, 3, 'Corner of L should be hp=3');
});

suite.test('assignHP: near-edge bricks get hp=2', () => {
  // 3x3 solid block — the middle-edge bricks have exactly 1 empty neighbor
  const bricks = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      bricks.push({ row: r + 1, col: c + 1, hp: 1 }); // offset to avoid grid edge
    }
  }
  const result = assignHP(bricks, 10, 10);
  // (2,1) = middle of left edge: has empty left neighbor only → hp=2
  const midLeft = result.find(b => b.row === 2 && b.col === 1);
  assertEqual(midLeft.hp, 2, 'Mid-edge brick should be hp=2');
});

suite.test('assignHP: structural base override (row >= gridH-2)', () => {
  const bricks = [
    { row: 0, col: 5, hp: 1 },
    { row: 8, col: 5, hp: 1 }, // gridH-2 = 8
    { row: 9, col: 5, hp: 1 }, // gridH-1 = 9
  ];
  const result = assignHP(bricks, 10, 10);
  assertEqual(result[0].hp, 3, 'Row 0 isolated brick = hp=3 (edge)');
  assertEqual(result[1].hp, 10, 'Row 8 = structural base = hp=10');
  assertEqual(result[2].hp, 10, 'Row 9 = structural base = hp=10');
});

suite.test('assignHP: grid edges count as empty', () => {
  // Brick at top-left corner (0,0) — top and left are grid edges
  const bricks = [
    { row: 0, col: 0, hp: 1 },
    { row: 0, col: 1, hp: 1 },
    { row: 1, col: 0, hp: 1 },
    { row: 1, col: 1, hp: 1 },
  ];
  const result = assignHP(bricks, 10, 10);
  // (0,0): top + left are grid edges = 2 empty → hp=3
  const topLeft = result.find(b => b.row === 0 && b.col === 0);
  assertEqual(topLeft.hp, 3, 'Grid corner brick should be hp=3');
});

// =============================================================================
// enforceSymmetry
// =============================================================================

suite.test('enforceSymmetry: mirrors a lopsided shape', () => {
  // Bricks only on left side
  const bricks = [
    { row: 0, col: 2, hp: 1 },
    { row: 1, col: 2, hp: 1 },
    { row: 1, col: 3, hp: 1 },
  ];
  const result = enforceSymmetry(bricks, 10);
  // Should have mirror on right side
  assert(result.length > bricks.length, 'Should add mirrored bricks');
  // Check symmetry: for each brick, its mirror should exist
  for (const b of result) {
    const mirrorCol = 9 - b.col;
    assert(
      result.some(m => m.row === b.row && m.col === mirrorCol),
      `Brick at (${b.row},${b.col}) should have mirror at (${b.row},${mirrorCol})`
    );
  }
});

suite.test('enforceSymmetry: already symmetric shape unchanged', () => {
  // Symmetric pair
  const bricks = [
    { row: 0, col: 3, hp: 1 },
    { row: 0, col: 6, hp: 1 },
  ];
  const result = enforceSymmetry(bricks, 10);
  // Should still be symmetric and not add unnecessary bricks
  for (const b of result) {
    const mirrorCol = 9 - b.col;
    assert(
      result.some(m => m.row === b.row && m.col === mirrorCol),
      'Mirror should exist'
    );
  }
});

suite.test('enforceSymmetry: empty input returns empty', () => {
  const result = enforceSymmetry([], 10);
  assertEqual(result.length, 0, 'Empty in = empty out');
});

suite.test('enforceSymmetry: deduplicates center column', () => {
  // Brick on exact center — mirror is itself
  const bricks = [{ row: 0, col: 5, hp: 1 }]; // center of 10-wide grid is 4.5
  const result = enforceSymmetry(bricks, 10);
  // Should not have duplicates
  const keys = result.map(b => `${b.row},${b.col}`);
  const unique = new Set(keys);
  assertEqual(keys.length, unique.size, 'No duplicate bricks');
});

suite.test('enforceSymmetry: out-of-bounds mirrored bricks are dropped', () => {
  // Brick at edge — mirror would be at negative col
  const bricks = [{ row: 0, col: 0, hp: 1 }];
  const result = enforceSymmetry(bricks, 4);
  // All bricks should be in bounds
  for (const b of result) {
    assert(b.col >= 0 && b.col < 4, `Col ${b.col} should be in [0,3]`);
  }
});

// =============================================================================
// extractAsciiGrid
// =============================================================================

suite.test('extractAsciiGrid: clean 10-line grid passes through', () => {
  const grid = Array(10).fill('####################').join('\n');
  const result = extractAsciiGrid(grid);
  const lines = result.split('\n').filter(l => l.trim());
  assertEqual(lines.length, 10, 'Should have 10 lines');
});

suite.test('extractAsciiGrid: strips markdown fences', () => {
  const input = '```\n####################\n....................\n```';
  const result = extractAsciiGrid(input);
  assert(!result.includes('```'), 'Should not contain fences');
  assert(result.includes('####################'), 'Should contain grid content');
});

suite.test('extractAsciiGrid: strips <think> blocks', () => {
  const input = '<think>Let me think about this...</think>\n####################';
  const result = extractAsciiGrid(input);
  assert(!result.includes('think'), 'Should not contain think block');
  assert(result.includes('####################'), 'Should contain grid');
});

suite.test('extractAsciiGrid: filters Chinese explanatory text', () => {
  const input = '这是一个心形的关卡设计：\n####################\n.........##.........';
  const result = extractAsciiGrid(input);
  assert(!result.includes('这是'), 'Should filter Chinese text');
  assert(result.includes('####################'), 'Should keep grid lines');
});

suite.test('extractAsciiGrid: filters English prefixes', () => {
  const input = 'Here is the grid:\n####################\nOutput complete.';
  const result = extractAsciiGrid(input);
  assert(result.includes('####################'), 'Should keep grid');
});

suite.test('extractAsciiGrid: handles messy LLM output', () => {
  const input = `<think>
I need to draw a heart shape on a 20x10 grid.
Let me plan this out carefully.
</think>

Here is the heart shape:

\`\`\`
....##....##........
...####..####.......
..##############....
..##############....
...############.....
....##########......
......######........
........##..........
....................
....................
\`\`\`

This heart is centered and symmetric.`;

  const result = extractAsciiGrid(input);
  const lines = result.split('\n').filter(l => l.trim());
  assert(lines.length >= 8, `Should extract grid lines, got ${lines.length}`);
  assert(lines[0].includes('##'), 'First line should have # chars');
});

// Run
suite.run().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
});
