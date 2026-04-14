// src/constants.js
// Provides: C, Theme, _brickColor, LEVEL_DATA (via placeholder), _applyColors, getPresetLevel, getTotalLevels
// Depends: (none)

// ---------------------------------------------------------------------------
// 1. Game Constants
// ---------------------------------------------------------------------------
const C = {
  FIXED_DT: 1 / 60,           // Fixed timestep for physics (60 Hz)
  MAX_STEPS: 3,                // Max physics steps per frame (prevents spiral of death)
  MAX_ACCUMULATOR: 0.1,        // Cap accumulator to avoid huge catch-up

  BALL_RADIUS: 4,
  BALL_SPEED: 300,             // Default ball speed (px/s)
  MIN_VY_RATIO: 0.3,          // Min vertical component ratio to prevent horizontal stalling
  LAUNCH_ANGLE: Math.PI / 4,  // 45° default launch angle

  PADDLE_HEIGHT: 10,
  MAX_PADDLE_SPEED: 1200,     // Max paddle movement speed (px/s)
  PADDLE_SMOOTHING: 1.0,      // Smoothing factor (1.0 = instant)
  MAX_REFLECT_ANGLE: Math.PI / 3, // 60° max reflect off paddle

  BRICK_GAP: 2,               // Gap between bricks (px)

  INDESTRUCTIBLE_HP: 999,     // Sentinel value — no longer used in levels
  IRONCLAD_HP: 10,            // Iron bricks: tough but breakable (10 hits)

  DEFAULT_LIVES: 3,

  COMBO_TIMEOUT: 2000,        // ms before combo resets
  COMBO_MULT: 0.5,            // Multiplier increment per combo
  BASE_SCORE: 10,             // Base score per brick

  PLAY_TOP: 80,               // Top of play area (px from canvas top)
  PLAY_BOTTOM_MARGIN: 60,     // Bottom margin for paddle area

  SCREEN_W: 375,              // Reference screen width
  SCREEN_H: 667,              // Reference screen height
};

// ---------------------------------------------------------------------------
// 2. Theme Colors — Steampunk (蒸汽朋克)
// ---------------------------------------------------------------------------
const Theme = {
  bg: '#1a1008',                // Dark walnut wood
  panelBg: '#2a1a0e',           // Dark leather
  accent: '#d4a24e',            // Polished brass
  accent2: '#c45e3a',           // Copper/rust
  accent3: '#8b6d2e',           // Aged bronze
  textPrimary: '#f0e0c0',       // Warm parchment
  textSecondary: '#a08860',      // Faded ink

  paddleGrad: ['#c4973a', '#8b6914'],   // Brass gradient
  ballGlow: '#d4a24e',

  brick: {
    hp1: ['#7a6840', '#5a4830'],            // Weathered bronze
    hp2: ['#c45e3a', '#8a3a22'],            // Copper
    hp3: ['#d4a24e', '#9a7a2e'],            // Brass
    iron: ['#4a4a4a', '#2e2e2e'],           // Cast iron (10 hits)
  },

  bgGradTop: '#12100e',            // Background gradient top (derived from bg)
  bgGradBottom: '#1e1a16',         // Background gradient bottom (derived from bg)
  textMuted: 'rgba(160,136,96,0.45)', // Muted hint text (warm, derived from textSecondary)

  starfield: '#d4a24e',          // Floating gear particles instead of stars

  powerUp: {
    split: '#d4a24e',            // Brass
    multiShot: '#c45e3a',        // Copper
    fireball: '#ff6622',         // Furnace orange
    fireballGlow: '#ff4400',     // Fireball shadow/glow
    fireballCore: '#ffaa00',     // Fireball gradient mid-tone
    widePaddle: '#8b6d2e',       // Bronze
    extraLife: '#cc3333',        // Steam valve red
  },

  card: {
    bg: 'rgba(42,26,14,0.8)',        // Warm card background (from panelBg)
    bgLocked: 'rgba(26,16,8,0.5)',   // Dimmed card background
    borderLocked: '#5a4830',         // Warm muted border for locked cards
    textLocked: '#6a5a40',           // Warm muted text for locked elements
  },

  button: {
    bg: '#3a2a18',               // Dark wood
    hover: '#4a3a28',            // Highlighted wood
    text: '#f0e0c0',             // Parchment
    border: '#d4a24e',           // Brass trim
  },
};

// ---------------------------------------------------------------------------
// 3. Level Loading — Levels are defined in external JSON files
// ---------------------------------------------------------------------------
// The LEVEL_DATA array is injected at build time by the build script.
// Each entry is a plain object: { name, gridWidth, gridHeight, ballSpeed,
//   paddleWidth, lives, bricks: [{ row, col, hp }, ...] }
//
// At runtime, _brickColor(hp) maps hp values to Theme colors, and
// getPresetLevel() returns a deep copy with colors applied.
// ---------------------------------------------------------------------------

/**
 * Map hp value to Theme brick color pair.
 * Applied at runtime when loading a level — NOT stored in level JSON.
 */
function _brickColor(hp) {
  if (hp >= C.IRONCLAD_HP) return Theme.brick.iron;
  if (hp >= 3) return Theme.brick.hp3;
  if (hp >= 2) return Theme.brick.hp2;
  return Theme.brick.hp1;
}

/**
 * LEVEL_DATA — injected at build time.
 * In the assembled preview.html, this will be replaced with the actual
 * array of level objects loaded from levels/*.json files.
 *
 * Format: const LEVEL_DATA = [ {level1}, {level2}, ... ];
 */
// __LEVEL_DATA_PLACEHOLDER__

/**
 * Apply runtime color to a raw level descriptor.
 * Takes a level from LEVEL_DATA and adds color to each brick based on hp.
 */
function _applyColors(level) {
  const copy = JSON.parse(JSON.stringify(level));
  for (const brick of copy.bricks) {
    brick.color = _brickColor(brick.hp);
  }
  return copy;
}

/** Get a deep copy of a preset level by index (0-based), with colors applied. */
function getPresetLevel(index) {
  if (index < 0 || index >= LEVEL_DATA.length) return null;
  return _applyColors(LEVEL_DATA[index]);
}

/** Total number of preset levels. */
function getTotalLevels() {
  return LEVEL_DATA.length;
}
