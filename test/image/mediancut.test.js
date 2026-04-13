/**
 * mediancut.test.js — Color quantization tests
 */

const { TestRunner, assert, assertClose, assertEqual, loadGameContext } = require('../testutils');
const ctx = loadGameContext();
const { MedianCut } = ctx;

const suite = new TestRunner('MedianCut Color Quantization');

// =============================================================================
// Basic Quantization
// =============================================================================

suite.test('quantize: single color returns that color', () => {
  const pixels = [];
  for (let i = 0; i < 100; i++) {
    pixels.push([255, 0, 0]);
  }
  const palette = MedianCut.quantize(pixels, 4);
  assertEqual(palette.length, 1, 'Single color should produce 1 palette entry');
  assertClose(palette[0][0], 255, 1, 'Red channel');
  assertClose(palette[0][1], 0, 1, 'Green channel');
  assertClose(palette[0][2], 0, 1, 'Blue channel');
});

suite.test('quantize: two distinct colors with maxColors=2', () => {
  const pixels = [];
  for (let i = 0; i < 50; i++) pixels.push([255, 0, 0]);
  for (let i = 0; i < 50; i++) pixels.push([0, 0, 255]);
  const palette = MedianCut.quantize(pixels, 2);
  assertEqual(palette.length, 2, 'Should produce 2 colors');

  // Sort by red channel to ensure consistent order
  palette.sort((a, b) => a[0] - b[0]);
  assertClose(palette[0][0], 0, 5, 'Blue-ish color red');
  assertClose(palette[0][2], 255, 5, 'Blue-ish color blue');
  assertClose(palette[1][0], 255, 5, 'Red-ish color red');
  assertClose(palette[1][2], 0, 5, 'Red-ish color blue');
});

suite.test('quantize: three colors quantized to 2', () => {
  const pixels = [];
  for (let i = 0; i < 100; i++) pixels.push([255, 0, 0]);
  for (let i = 0; i < 100; i++) pixels.push([0, 255, 0]);
  for (let i = 0; i < 100; i++) pixels.push([0, 0, 255]);
  const palette = MedianCut.quantize(pixels, 2);
  assertEqual(palette.length, 2, 'Should produce 2 colors when maxColors=2');
});

suite.test('quantize: respects maxColors limit', () => {
  const pixels = [];
  for (let r = 0; r < 8; r++) {
    for (let g = 0; g < 8; g++) {
      for (let b = 0; b < 8; b++) {
        pixels.push([r * 32, g * 32, b * 32]);
      }
    }
  }
  const palette = MedianCut.quantize(pixels, 16);
  assert(palette.length <= 16, 'Should not exceed maxColors=16');
});

suite.test('quantize: 32 colors from gradient', () => {
  const pixels = [];
  for (let i = 0; i < 256; i++) {
    pixels.push([i, 128, 255 - i]);
  }
  const palette = MedianCut.quantize(pixels, 32);
  assert(palette.length <= 32, 'Should not exceed maxColors');
  assert(palette.length >= 2, 'Should have at least 2 colors from gradient');
});

// =============================================================================
// Edge Cases
// =============================================================================

suite.test('quantize: empty pixels returns empty', () => {
  const palette = MedianCut.quantize([], 32);
  assertEqual(palette.length, 0, 'Empty input = empty output');
});

suite.test('quantize: identical pixels produce single entry', () => {
  const pixels = [];
  for (let i = 0; i < 200; i++) {
    pixels.push([128, 128, 128]);
  }
  const palette = MedianCut.quantize(pixels, 8);
  assertEqual(palette.length, 1, 'Identical pixels should produce 1 entry');
  assertClose(palette[0][0], 128, 1);
  assertClose(palette[0][1], 128, 1);
  assertClose(palette[0][2], 128, 1);
});

suite.test('quantize: maxColors=1 returns single averaged color', () => {
  const pixels = [];
  for (let i = 0; i < 50; i++) pixels.push([200, 0, 0]);
  for (let i = 0; i < 50; i++) pixels.push([0, 200, 0]);
  const palette = MedianCut.quantize(pixels, 1);
  assertEqual(palette.length, 1, 'Should return 1 color');
  // The averaged color should be roughly in between
  assert(palette[0][0] > 50 && palette[0][0] < 200, 'Red should be averaged');
});

// =============================================================================
// closestColor
// =============================================================================

suite.test('closestColor: finds exact match', () => {
  const palette = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
  const c1 = MedianCut.closestColor([255, 0, 0], palette);
  assertEqual(c1[0], 255, 'Should find red');
  assertEqual(c1[1], 0);
  assertEqual(c1[2], 0);

  const c2 = MedianCut.closestColor([0, 255, 0], palette);
  assertEqual(c2[1], 255, 'Should find green');

  const c3 = MedianCut.closestColor([0, 0, 255], palette);
  assertEqual(c3[2], 255, 'Should find blue');
});

suite.test('closestColor: finds nearest match', () => {
  const palette = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
  // Reddish color should map to red
  const c = MedianCut.closestColor([200, 10, 10], palette);
  assertEqual(c[0], 255, 'Should map to red');

  // Greenish color should map to green
  const c2 = MedianCut.closestColor([10, 200, 10], palette);
  assertEqual(c2[1], 255, 'Should map to green');
});

suite.test('closestColor: single palette entry always matches', () => {
  const palette = [[128, 128, 128]];
  const c1 = MedianCut.closestColor([0, 0, 0], palette);
  assertEqual(c1[0], 128);
  const c2 = MedianCut.closestColor([255, 255, 255], palette);
  assertEqual(c2[0], 128);
});

suite.test('closestColor: yellowish maps to red or green', () => {
  const palette = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
  const c = MedianCut.closestColor([200, 200, 0], palette);
  // Yellow is equidistant between red and green in RGB space, either is acceptable
  assert(c[0] === 255 || c[1] === 255, 'Should map to red or green');
});

// =============================================================================
// Quantization Quality
// =============================================================================

suite.test('quality: quantized colors approximate original distribution', () => {
  const pixels = [];
  for (let i = 0; i < 100; i++) {
    pixels.push([200 + Math.floor(Math.random() * 55), Math.floor(Math.random() * 30), Math.floor(Math.random() * 30)]);
  }
  for (let i = 0; i < 100; i++) {
    pixels.push([Math.floor(Math.random() * 30), Math.floor(Math.random() * 30), 200 + Math.floor(Math.random() * 55)]);
  }

  const palette = MedianCut.quantize(pixels, 4);
  assert(palette.length >= 2, 'Should have at least 2 palette entries');

  let hasRed = false, hasBlue = false;
  for (const c of palette) {
    if (c[0] > 150 && c[2] < 100) hasRed = true;
    if (c[2] > 150 && c[0] < 100) hasBlue = true;
  }
  assert(hasRed, 'Should have a red-ish palette entry');
  assert(hasBlue, 'Should have a blue-ish palette entry');
});

suite.test('quality: 32-color palette from diverse image', () => {
  const pixels = [];
  for (let r = 0; r < 16; r++) {
    for (let g = 0; g < 16; g++) {
      for (let b = 0; b < 4; b++) {
        pixels.push([r * 17, g * 17, b * 85]);
      }
    }
  }
  const palette = MedianCut.quantize(pixels, 32);
  assert(palette.length <= 32, 'Should not exceed 32');
  assert(palette.length >= 16, 'Diverse input should produce many palette entries');
});

// Run
suite.run().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
});
