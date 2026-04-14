/**
 * creative.test.js — Evaluation tests for creative mode shape quality.
 *
 * These tests evaluate template-generated shapes against ground truth masks.
 * They verify that the template + ascii-parser pipeline produces recognizable shapes.
 *
 * No LLM dependency — these are deterministic.
 */

const { TestRunner, assert, assertEqual } = require('../testutils');
const { GROUND_TRUTH } = require('./ground-truth');
const { evaluateLevel, renderComparison, computeIoU, bestAlignedIoU,
        horizontalSymmetryScore, centeringScore, coverageRatio } = require('./metrics');

const suite = new TestRunner('Creative Mode — Shape Quality');

// ---------------------------------------------------------------------------
// Helper: load templates and generate bricks via the ascii-parser pipeline
// ---------------------------------------------------------------------------

let parseAsciiGrid, assignHP, enforceSymmetry;
let SHAPE_TEMPLATES, matchTemplate;

try {
  const parser = require('../../server/src/ascii-parser.ts');
  parseAsciiGrid = parser.parseAsciiGrid;
  assignHP = parser.assignHP;
  enforceSymmetry = parser.enforceSymmetry;
  const templates = require('../../server/src/templates.ts');
  SHAPE_TEMPLATES = templates.SHAPE_TEMPLATES;
  matchTemplate = templates.matchTemplate;
} catch {
  // Fallback inline implementations (same as ascii-parser.test.js)
  parseAsciiGrid = function(ascii, gridW = 30, gridH = 15) {
    const bricks = [];
    const lines = ascii.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const rows = lines.slice(0, gridH);
    for (let row = 0; row < rows.length; row++) {
      const line = rows[row].padEnd(gridW, '.').slice(0, gridW);
      for (let col = 0; col < gridW; col++) {
        if (line[col] === '#') bricks.push({ row, col, hp: 1 });
      }
    }
    return bricks;
  };
  assignHP = function(bricks, gridW, gridH) {
    const occupied = Array.from({ length: gridH }, () => Array(gridW).fill(false));
    for (const b of bricks) {
      if (b.row >= 0 && b.row < gridH && b.col >= 0 && b.col < gridW) occupied[b.row][b.col] = true;
    }
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    return bricks.map(b => {
      if (b.row >= gridH - 2) return { ...b, hp: 10 };
      let empty = 0;
      for (const [dr, dc] of dirs) {
        const nr = b.row + dr, nc = b.col + dc;
        if (nr < 0 || nr >= gridH || nc < 0 || nc >= gridW) empty++;
        else if (!occupied[nr][nc]) empty++;
      }
      return { ...b, hp: empty >= 2 ? 3 : empty === 1 ? 2 : 1 };
    });
  };
  enforceSymmetry = function(bricks, gridW) {
    if (!bricks.length) return [];
    const centroid = bricks.reduce((s, b) => s + b.col, 0) / bricks.length;
    const shift = Math.round((gridW - 1) / 2 - centroid);
    const shifted = bricks.map(b => ({ ...b, col: b.col + shift }));
    const mirrored = [];
    for (const b of shifted) { mirrored.push(b); mirrored.push({ ...b, col: gridW - 1 - b.col }); }
    const seen = new Set();
    return mirrored.filter(b => {
      if (b.col < 0 || b.col >= gridW) return false;
      const k = `${b.row},${b.col}`; if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  };
  // Minimal template data for testing without tsx
  SHAPE_TEMPLATES = null;
  matchTemplate = null;
}

// ---------------------------------------------------------------------------
// Generate bricks from template for a given prompt
// ---------------------------------------------------------------------------
function generateFromTemplate(prompt) {
  if (!matchTemplate) return null;
  const grid = matchTemplate(prompt);
  if (!grid) return null;
  let bricks = parseAsciiGrid(grid.join('\n'), 30, 15);
  bricks = assignHP(bricks, 30, 15);
  bricks = enforceSymmetry(bricks, 30);
  bricks = assignHP(bricks, 30, 15);
  return bricks;
}

// =============================================================================
// Ground truth self-consistency tests
// =============================================================================

suite.test('ground truth: all masks are 15×30', () => {
  for (const [name, gt] of Object.entries(GROUND_TRUTH)) {
    assertEqual(gt.mask.length, 15, `${name} should have 15 rows`);
    for (let r = 0; r < gt.mask.length; r++) {
      assertEqual(gt.mask[r].length, 30, `${name} row ${r} should have 30 cols`);
    }
  }
});

suite.test('ground truth: masks contain only 0 and 1', () => {
  for (const [name, gt] of Object.entries(GROUND_TRUTH)) {
    for (let r = 0; r < gt.mask.length; r++) {
      for (let c = 0; c < gt.mask[r].length; c++) {
        assert(gt.mask[r][c] === 0 || gt.mask[r][c] === 1,
          `${name}[${r}][${c}] = ${gt.mask[r][c]}, expected 0 or 1`);
      }
    }
  }
});

suite.test('ground truth: row 14 is empty for all shapes', () => {
  for (const [name, gt] of Object.entries(GROUND_TRUTH)) {
    const sum = gt.mask[14].reduce((a, b) => a + b, 0);
    assertEqual(sum, 0, `${name} row 14 should be empty`);
  }
});

suite.test('ground truth: brick counts in expected ranges', () => {
  for (const [name, gt] of Object.entries(GROUND_TRUTH)) {
    const count = gt.mask.flat().filter(v => v === 1).length;
    assert(count >= gt.features.minBricks,
      `${name}: ${count} bricks < min ${gt.features.minBricks}`);
    assert(count <= gt.features.maxBricks,
      `${name}: ${count} bricks > max ${gt.features.maxBricks}`);
  }
});

// =============================================================================
// Metrics self-tests
// =============================================================================

suite.test('computeIoU: identical grids = 1.0', () => {
  // Create bricks matching the diamond mask
  const gt = GROUND_TRUTH['钻石'];
  const bricks = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 30; c++) {
      if (gt.mask[r][c]) bricks.push({ row: r, col: c, hp: 1 });
    }
  }
  const iou = computeIoU(bricks, gt.mask);
  assert(Math.abs(iou - 1.0) < 0.001, `Perfect match should give IoU=1.0, got ${iou}`);
});

suite.test('computeIoU: empty vs filled = 0.0', () => {
  const gt = GROUND_TRUTH['钻石'];
  const iou = computeIoU([], gt.mask);
  assertEqual(iou, 0, 'No bricks vs filled mask = 0');
});

suite.test('bestAlignedIoU: shifted shape still scores well', () => {
  const gt = GROUND_TRUTH['钻石'];
  // Create bricks shifted 2 cols right
  const bricks = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 30; c++) {
      if (gt.mask[r][c]) bricks.push({ row: r, col: c + 2, hp: 1 });
    }
  }
  const rawIoU = computeIoU(bricks, gt.mask);
  const alignedIoU = bestAlignedIoU(bricks, gt.mask);
  assert(alignedIoU > rawIoU, `Aligned IoU (${alignedIoU}) should be > raw (${rawIoU})`);
  assert(alignedIoU > 0.8, `Shifted by 2 should still score >0.8 aligned, got ${alignedIoU}`);
});

suite.test('horizontalSymmetryScore: symmetric shape = 1.0', () => {
  const bricks = [
    { row: 0, col: 5, hp: 1 },
    { row: 0, col: 24, hp: 1 },  // mirror of 5 in 30-wide grid (29-5=24)
    { row: 1, col: 8, hp: 1 },
    { row: 1, col: 21, hp: 1 },  // 29-8=21
  ];
  const score = horizontalSymmetryScore(bricks);
  assert(Math.abs(score - 1.0) < 0.001, `Perfect symmetry should = 1.0, got ${score}`);
});

suite.test('centeringScore: centered shape near 1.0', () => {
  const bricks = [
    { row: 6, col: 14, hp: 1 },
    { row: 6, col: 15, hp: 1 },
    { row: 7, col: 14, hp: 1 },
    { row: 7, col: 15, hp: 1 },
  ];
  const score = centeringScore(bricks);
  assert(score > 0.9, `Centered 2x2 block should score >0.9, got ${score}`);
});

suite.test('coverageRatio: exact match = 1.0', () => {
  const gt = GROUND_TRUTH['箭头'];
  const expected = gt.mask.flat().filter(v => v).length;
  const bricks = Array(expected).fill(null).map((_, i) => ({ row: 0, col: i % 30, hp: 1 }));
  // Same count → ratio = 1.0
  const ratio = coverageRatio(bricks, gt.mask);
  assert(Math.abs(ratio - 1.0) < 0.001, `Same count should give 1.0, got ${ratio}`);
});

// =============================================================================
// Template quality evaluation (only if templates are available)
// =============================================================================

if (SHAPE_TEMPLATES) {
  // Test each shape that exists in both templates and ground truth
  const SHARED_SHAPES = ['心形', '钻石', '星形', '城堡', '箭头', '笑脸'];

  for (const prompt of SHARED_SHAPES) {
    const gt = GROUND_TRUTH[prompt];
    if (!gt) continue;

    suite.test(`${prompt}: template produces bricks`, () => {
      const bricks = generateFromTemplate(prompt);
      assert(bricks !== null, `Template should match "${prompt}"`);
      assert(bricks.length > 0, 'Should have bricks');
    });

    suite.test(`${prompt}: brick count in range`, () => {
      const bricks = generateFromTemplate(prompt);
      assert(bricks.length >= gt.features.minBricks,
        `${bricks.length} < min ${gt.features.minBricks}`);
      assert(bricks.length <= gt.features.maxBricks,
        `${bricks.length} > max ${gt.features.maxBricks}`);
    });

    suite.test(`${prompt}: composite score ≥ 0.40`, () => {
      const bricks = generateFromTemplate(prompt);
      const result = evaluateLevel(prompt, bricks);
      if (result.error) {
        assert(false, result.error);
        return;
      }
      assert(result.composite >= 0.40,
        `Composite ${result.composite.toFixed(3)} < 0.40. ` +
        `IoU=${result.scores.iou.toFixed(3)}, ` +
        `Sym=${result.scores.symmetry.toFixed(3)}, ` +
        `Center=${result.scores.centering.toFixed(3)}`
      );
    });

    if (gt.features.symmetry) {
      suite.test(`${prompt}: symmetry ≥ 0.75`, () => {
        const bricks = generateFromTemplate(prompt);
        const result = evaluateLevel(prompt, bricks);
        if (result.error) { assert(false, result.error); return; }
        assert(result.scores.symmetry >= 0.75,
          `Symmetry ${result.scores.symmetry.toFixed(3)} < 0.75`);
      });
    }
  }
}

// Run
suite.run().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
});
