/**
 * levels.test.js — Level loading and validation tests
 */

const { TestRunner, assert, assertEqual, loadGameContext } = require('../testutils');
const ctx = loadGameContext();
const { getPresetLevel, getTotalLevels, _applyColors, LEVEL_DATA, C } = ctx;

const suite = new TestRunner('Level Loading');

// =============================================================================
// getTotalLevels
// =============================================================================

suite.test('getTotalLevels: returns 12', () => {
  assertEqual(getTotalLevels(), 12, 'Should have 12 levels');
});

// =============================================================================
// getPresetLevel — Valid Indices
// =============================================================================

suite.test('getPresetLevel(0): returns first level with correct name', () => {
  const level = getPresetLevel(0);
  assert(level !== null, 'Should return a level');
  assert(typeof level.name === 'string' && level.name.length > 0, 'Should have a name');
});

suite.test('getPresetLevel(11): returns last level (level 12)', () => {
  const level = getPresetLevel(11);
  assert(level !== null, 'Should return a level');
  assert(typeof level.name === 'string' && level.name.length > 0, 'Should have a name');
});

// =============================================================================
// getPresetLevel — Invalid Indices
// =============================================================================

suite.test('getPresetLevel(-1): returns null', () => {
  const level = getPresetLevel(-1);
  assertEqual(level, null, 'Negative index should return null');
});

suite.test('getPresetLevel(99): returns null', () => {
  const level = getPresetLevel(99);
  assertEqual(level, null, 'Out-of-range index should return null');
});

suite.test('getPresetLevel(12): returns null (one past last)', () => {
  const level = getPresetLevel(12);
  assertEqual(level, null, 'Index 12 should return null');
});

// =============================================================================
// Level Required Fields
// =============================================================================

suite.test('all levels have required fields', () => {
  for (let i = 0; i < getTotalLevels(); i++) {
    const level = getPresetLevel(i);
    assert(level !== null, `Level ${i} should not be null`);
    assert(typeof level.name === 'string', `Level ${i} should have name`);
    assert(typeof level.gridWidth === 'number' && level.gridWidth > 0, `Level ${i} should have gridWidth`);
    assert(typeof level.gridHeight === 'number' && level.gridHeight > 0, `Level ${i} should have gridHeight`);
    assert(typeof level.ballSpeed === 'number' && level.ballSpeed > 0, `Level ${i} should have ballSpeed`);
    assert(typeof level.paddleWidth === 'number' && level.paddleWidth > 0, `Level ${i} should have paddleWidth`);
    assert(Array.isArray(level.bricks), `Level ${i} should have bricks array`);
    assert(level.bricks.length > 0, `Level ${i} should have at least 1 brick`);
  }
});

// =============================================================================
// Bricks Have Color Applied (from _applyColors)
// =============================================================================

suite.test('bricks have color applied by _applyColors', () => {
  for (let i = 0; i < getTotalLevels(); i++) {
    const level = getPresetLevel(i);
    for (const brick of level.bricks) {
      assert(brick.color !== undefined && brick.color !== null, `Level ${i} brick should have color`);
      assert(Array.isArray(brick.color), `Level ${i} brick color should be an array (gradient pair)`);
      assertEqual(brick.color.length, 2, `Level ${i} brick color should have 2 entries (gradient pair)`);
    }
  }
});

suite.test('_applyColors does not modify the original LEVEL_DATA', () => {
  const originalBrick = LEVEL_DATA[0].bricks[0];
  const level = getPresetLevel(0);
  // Original should not have color (colors are applied at runtime)
  assert(originalBrick.color === undefined || originalBrick.color === null || originalBrick.color === undefined,
    'Original LEVEL_DATA brick should not have color mutated');
});

// =============================================================================
// Brick Count
// =============================================================================

suite.test('level 1 has expected brick count', () => {
  const level = getPresetLevel(0);
  assert(level.bricks.length > 0, 'Level 1 should have bricks');
  // Level 1 (关卡1) has 84 bricks based on the JSON
  assertEqual(level.bricks.length, LEVEL_DATA[0].bricks.length, 'Brick count should match LEVEL_DATA');
});

suite.test('each level has correct brick count matching LEVEL_DATA', () => {
  for (let i = 0; i < getTotalLevels(); i++) {
    const level = getPresetLevel(i);
    assertEqual(level.bricks.length, LEVEL_DATA[i].bricks.length,
      `Level ${i} brick count should match LEVEL_DATA`);
  }
});

// =============================================================================
// Brick Properties
// =============================================================================

suite.test('all bricks have valid row, col, and hp', () => {
  for (let i = 0; i < getTotalLevels(); i++) {
    const level = getPresetLevel(i);
    for (const brick of level.bricks) {
      assert(typeof brick.row === 'number' && brick.row >= 0, `Level ${i} brick should have valid row`);
      assert(typeof brick.col === 'number' && brick.col >= 0, `Level ${i} brick should have valid col`);
      assert(typeof brick.hp === 'number' && brick.hp >= 1, `Level ${i} brick should have valid hp`);
      assert(brick.row < level.gridHeight, `Level ${i} brick row should be within gridHeight`);
      assert(brick.col < level.gridWidth, `Level ${i} brick col should be within gridWidth`);
    }
  }
});

// =============================================================================
// Deep Copy
// =============================================================================

suite.test('getPresetLevel returns a deep copy', () => {
  const level1 = getPresetLevel(0);
  const level2 = getPresetLevel(0);

  // Mutate one
  level1.name = 'MUTATED';
  level1.bricks[0].hp = 999;

  // The other should be unaffected
  assert(level2.name !== 'MUTATED', 'Deep copy — name should not be shared');
  assert(level2.bricks[0].hp !== 999, 'Deep copy — bricks should not be shared');
});

// Run
suite.run().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
});
