#!/usr/bin/env node
// ============================================================================
// build.js — Assemble preview.html from src/ files + level JSON files
// ============================================================================
// Usage: node build.js
//
// This script:
// 1. Reads all levels/level-*.json files (sorted by filename)
// 2. Reads all src/ files in dependency order
// 3. Injects the level data into constants.js (replacing the placeholder)
// 4. Wraps everything in an HTML template
// 5. Writes the result to preview.html
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const LEVELS_DIR = path.join(ROOT, 'levels');
const SRC_DIR = path.join(ROOT, 'src');
const OUTPUT = path.join(ROOT, 'preview.html');

// ---------------------------------------------------------------------------
// 1. Load and validate level files
// ---------------------------------------------------------------------------
const levelFiles = fs.readdirSync(LEVELS_DIR)
  .filter(f => /^level-\d+\.json$/.test(f))
  .sort();

console.log(`Found ${levelFiles.length} level files:`);

const levels = levelFiles.map(f => {
  const filePath = path.join(LEVELS_DIR, f);
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    const level = JSON.parse(raw);
    // Basic validation
    const required = ['name', 'gridWidth', 'gridHeight', 'ballSpeed', 'paddleWidth', 'lives', 'bricks'];
    for (const key of required) {
      if (!(key in level)) {
        throw new Error(`Missing required field "${key}" in ${f}`);
      }
    }
    if (!Array.isArray(level.bricks) || level.bricks.length === 0) {
      throw new Error(`"bricks" must be a non-empty array in ${f}`);
    }
    for (const brick of level.bricks) {
      if (typeof brick.row !== 'number' || typeof brick.col !== 'number' || typeof brick.hp !== 'number') {
        throw new Error(`Invalid brick data in ${f}: ${JSON.stringify(brick)}`);
      }
      if (brick.row < 0 || brick.row >= level.gridHeight) {
        throw new Error(`Brick row ${brick.row} out of bounds (gridHeight=${level.gridHeight}) in ${f}`);
      }
      if (brick.col < 0 || brick.col >= level.gridWidth) {
        throw new Error(`Brick col ${brick.col} out of bounds (gridWidth=${level.gridWidth}) in ${f}`);
      }
    }
    console.log(`  ${f}: "${level.name}" — ${level.bricks.length} bricks`);
    return level;
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error(`ERROR: Invalid JSON in ${f}: ${e.message}`);
    } else {
      console.error(`ERROR: ${e.message}`);
    }
    process.exit(1);
  }
});

// ---------------------------------------------------------------------------
// 2. Generate the LEVEL_DATA JavaScript declaration
// ---------------------------------------------------------------------------
// Compact format: one brick per line would be huge, so we minify the bricks
// array while keeping the top-level fields readable.
function levelToJS(level) {
  const bricksStr = level.bricks
    .map(b => `{row:${b.row},col:${b.col},hp:${b.hp}}`)
    .join(',');

  return [
    `  {`,
    `    name:${JSON.stringify(level.name)},`,
    `    gridWidth:${level.gridWidth},gridHeight:${level.gridHeight},`,
    `    ballSpeed:${level.ballSpeed},paddleWidth:${level.paddleWidth},lives:${level.lives},`,
    `    bricks:[${bricksStr}]`,
    `  }`,
  ].join('\n');
}

const levelDataJS = `const LEVEL_DATA = [\n${levels.map(levelToJS).join(',\n')}\n];`;

// ---------------------------------------------------------------------------
// 3. Source files in dependency order
// ---------------------------------------------------------------------------
const srcFiles = [
  'constants.js',
  'power-ups.js',
  'event-bus.js',
  'entities/ball.js',
  'entities/paddle.js',
  'entities/brick.js',
  'entities/brick-field.js',
  'entities/power-up-drop.js',
  'entities/particle.js',
  'physics/collision.js',
  'physics/physics-world.js',
  'systems/score-system.js',
  'audio/audio-manager.js',
  'rendering/renderer.js',
  'scenes/state-machine.js',
  'scenes/menu-scene.js',
  'scenes/level-select.js',
  'scenes/game-scene.js',
  'scenes/paused-scene.js',
  'scenes/result-scene.js',
  'scenes/image-upload.js',
  'scenes/creative-scene.js',
  'image/median-cut.js',
  'image/brick-mapper.js',
  'input/input-manager.js',
  'game.js',
];

console.log(`\nLoading ${srcFiles.length} source files:`);

const srcContents = srcFiles.map(f => {
  const filePath = path.join(SRC_DIR, f);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: Source file not found: ${filePath}`);
    process.exit(1);
  }
  console.log(`  src/${f}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  return { name: f, content };
});

// ---------------------------------------------------------------------------
// 4. Inject level data into constants.js
// ---------------------------------------------------------------------------
// Replace the placeholder comment with the actual LEVEL_DATA declaration
const constantsIdx = srcContents.findIndex(p => p.name === 'constants.js');
if (constantsIdx === -1) {
  console.error('ERROR: Could not find constants.js');
  process.exit(1);
}

srcContents[constantsIdx].content = srcContents[constantsIdx].content.replace(
  '// __LEVEL_DATA_PLACEHOLDER__',
  levelDataJS
);

// Verify the replacement happened
if (!srcContents[constantsIdx].content.includes('const LEVEL_DATA')) {
  console.error('ERROR: Failed to inject LEVEL_DATA into constants.js');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 5. Assemble HTML
// ---------------------------------------------------------------------------
const allJS = srcContents.map(p => p.content).join('\n\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <title>Breakout Maker - \u9020\u7816\u5382</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      overflow: hidden;
      background: #060410;
      display: flex;
      align-items: center;
      justify-content: center;
      touch-action: none;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    canvas {
      display: block;
      image-rendering: pixelated;
      border-radius: 4px;
    }
    /* Native textarea/button theming for creative mode */
    textarea::placeholder {
      color: rgba(144,136,168,0.5);
    }
    textarea:focus {
      border-color: #e8b84a !important;
      box-shadow: 0 0 12px rgba(232,184,74,0.2);
    }
    button:active {
      background: #2a2440 !important;
    }
  </style>
</head>
<body>
  <canvas id="gameCanvas"></canvas>
  <script>
${allJS}
  </script>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// 6. Write output
// ---------------------------------------------------------------------------
fs.writeFileSync(OUTPUT, html, 'utf-8');

const stats = fs.statSync(OUTPUT);
const sizeKB = (stats.size / 1024).toFixed(1);
console.log(`\n✅ Built preview.html (${sizeKB} KB)`);
console.log(`   ${levels.length} levels, ${srcContents.length} source files`);
