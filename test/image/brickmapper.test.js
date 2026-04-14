/**
 * brickmapper.test.js — BrickMapper.imageToLevel tests
 */

const { TestRunner, assert, assertClose, assertEqual, loadGameContext } = require('../testutils');
const ctx = loadGameContext();
const { BrickMapper, MedianCut } = ctx;

const suite = new TestRunner('BrickMapper');

// Helper: create a simple ImageData-like object
function makeImageData(width, height, fillFn) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b, a] = fillFn(x, y);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  return { width, height, data };
}

// =============================================================================
// Basic Mapping
// =============================================================================

suite.test('imageToLevel: creates a level with bricks', () => {
  // 40x28 image, all dark red
  const imageData = makeImageData(40, 28, () => [100, 20, 20, 255]);
  const level = BrickMapper.imageToLevel(imageData, 4, 4);

  assert(level !== null, 'Should return a level');
  assertEqual(level.gridWidth, 4, 'Grid width');
  assertEqual(level.gridHeight, 4, 'Grid height');
  assert(level.bricks.length > 0, 'Should have bricks');
  assert(typeof level.name === 'string', 'Should have a name');
  assert(level.ballSpeed > 0, 'Should have ballSpeed');
  assert(level.paddleWidth > 0, 'Should have paddleWidth');
});

suite.test('imageToLevel: skips very bright (near-white) cells', () => {
  // Image that is mostly white with one dark cell
  const imageData = makeImageData(20, 10, (x, y) => {
    // Top-left quadrant is dark, rest is white
    if (x < 10 && y < 5) return [50, 30, 20, 255];
    return [255, 255, 255, 255];
  });
  const level = BrickMapper.imageToLevel(imageData, 2, 2);

  // Only the top-left cell should produce a brick
  assert(level.bricks.length < 4, 'Should skip white cells');
  assert(level.bricks.length >= 1, 'Should have at least 1 brick from dark area');
});

suite.test('imageToLevel: all bricks are hp=1', () => {
  const imageData = makeImageData(40, 28, () => [100, 50, 30, 255]);
  const level = BrickMapper.imageToLevel(imageData, 8, 7);

  for (const brick of level.bricks) {
    assertEqual(brick.hp, 1, 'All image bricks should be hp=1');
  }
});

suite.test('imageToLevel: returns proper level structure', () => {
  const imageData = makeImageData(20, 14, () => [80, 40, 120, 255]);
  const level = BrickMapper.imageToLevel(imageData, 10, 7);

  assert('name' in level, 'Should have name');
  assert('gridWidth' in level, 'Should have gridWidth');
  assert('gridHeight' in level, 'Should have gridHeight');
  assert('bricks' in level, 'Should have bricks');
  assert('ballSpeed' in level, 'Should have ballSpeed');
  assert('paddleWidth' in level, 'Should have paddleWidth');
  assert(Array.isArray(level.bricks), 'bricks should be an array');
});

// =============================================================================
// Brick Color
// =============================================================================

suite.test('imageToLevel: bricks have hex color strings', () => {
  const imageData = makeImageData(20, 10, () => [200, 100, 50, 255]);
  const level = BrickMapper.imageToLevel(imageData, 4, 2);

  for (const brick of level.bricks) {
    assert(brick.color.startsWith('#'), 'Color should be hex: ' + brick.color);
    assertEqual(brick.color.length, 7, 'Hex color should be 7 chars (#rrggbb)');
  }
});

suite.test('imageToLevel: similar colors get quantized to same palette color', () => {
  // Create image with slightly varying reds
  const imageData = makeImageData(20, 10, (x, y) => {
    const r = 180 + (x % 10);
    return [r, 20, 20, 255];
  });
  const level = BrickMapper.imageToLevel(imageData, 4, 2);

  // All bricks should have very similar colors since input is nearly uniform
  const colors = new Set(level.bricks.map(b => b.color));
  assert(colors.size <= 3, 'Similar colors should be quantized to few palette entries');
});

// =============================================================================
// Brick Row/Col
// =============================================================================

suite.test('imageToLevel: bricks have valid row and col', () => {
  const imageData = makeImageData(40, 28, () => [100, 50, 30, 255]);
  const level = BrickMapper.imageToLevel(imageData, 8, 7);

  for (const brick of level.bricks) {
    assert(brick.row >= 0 && brick.row < level.gridHeight, 'Row in bounds');
    assert(brick.col >= 0 && brick.col < level.gridWidth, 'Col in bounds');
  }
});

// =============================================================================
// All-white Image
// =============================================================================

suite.test('imageToLevel: all-white image produces no bricks', () => {
  const imageData = makeImageData(20, 10, () => [255, 255, 255, 255]);
  const level = BrickMapper.imageToLevel(imageData, 4, 2);
  assertEqual(level.bricks.length, 0, 'All-white image should produce 0 bricks');
});

// =============================================================================
// All-black Image
// =============================================================================

suite.test('imageToLevel: all-black image produces full grid of bricks', () => {
  const gw = 4, gh = 2;
  const imageData = makeImageData(20, 10, () => [0, 0, 0, 255]);
  const level = BrickMapper.imageToLevel(imageData, gw, gh);
  assertEqual(level.bricks.length, gw * gh, 'All-black image should produce full grid');
});

// =============================================================================
// Default Grid Size
// =============================================================================

suite.test('imageToLevel: default grid size is 56x40', () => {
  const imageData = makeImageData(112, 80, () => [100, 50, 30, 255]);
  const level = BrickMapper.imageToLevel(imageData);
  assertEqual(level.gridWidth, 56, 'Default gridWidth should be 56');
  assertEqual(level.gridHeight, 40, 'Default gridHeight should be 40');
});

// Run
suite.run().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
});
