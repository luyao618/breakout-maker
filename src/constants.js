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
  LAUNCH_ANGLE: Math.PI / 4,  // 45 default launch angle

  PADDLE_HEIGHT: 10,
  MAX_PADDLE_SPEED: 1200,     // Max paddle movement speed (px/s)
  PADDLE_SMOOTHING: 1.0,      // Smoothing factor (1.0 = instant)
  MAX_REFLECT_ANGLE: Math.PI / 3, // 60 max reflect off paddle

  BRICK_GAP: 2,               // Gap between bricks (px)

  INDESTRUCTIBLE_HP: 999,     // Sentinel value -- no longer used in levels
  IRONCLAD_HP: 10,            // Iron bricks: tough but breakable (10 hits)

  DEFAULT_LIVES: 3,

  COMBO_TIMEOUT: 2000,        // ms before combo resets
  COMBO_MULT: 0.5,            // Multiplier increment per combo
  BASE_SCORE: 10,             // Base score per brick

  PLAY_TOP: 80,               // Top of play area (px from canvas top)
  PLAY_BOTTOM_MARGIN: 100,     // Bottom margin for paddle area

  SCREEN_W: 375,              // Reference screen width
  SCREEN_H: 667,              // Reference screen height
};

// ---------------------------------------------------------------------------
// 2. Theme Colors — Astral Foundry (星界熔铸)
// ---------------------------------------------------------------------------
// A celestial steampunk palette: deep indigo-blacks meet molten gold and
// tarnished copper. The feeling is a clockwork observatory at midnight —
// warm metallics glow against the cold cosmic dark.
// ---------------------------------------------------------------------------
const Theme = {
  bg: '#0c0a14',                // Deep midnight indigo
  panelBg: '#161225',           // Dark amethyst panel
  accent: '#e8b84a',            // Molten gold
  accent2: '#d4623a',           // Furnace copper
  accent3: '#7a6830',           // Tarnished bronze
  textPrimary: '#f2e8d0',       // Warm ivory
  textSecondary: '#9088a8',     // Muted lavender

  paddleGrad: ['#e8b84a', '#a07820'],   // Gold gradient
  ballGlow: '#e8b84a',

  brick: {
    hp1: ['#6a5e88', '#4a4068'],            // Amethyst stone
    hp2: ['#d4623a', '#9a3a1e'],            // Copper ore
    hp3: ['#e8b84a', '#b08a2a'],            // Molten gold
    iron: ['#3e3e50', '#24242e'],           // Dark iron
  },

  bgGradTop: '#080614',            // Near-black indigo
  bgGradBottom: '#12101e',         // Dark violet undertone

  textMuted: 'rgba(144,136,168,0.45)', // Muted lavender hint

  starfield: '#e8b84a',          // Gold motes

  powerUp: {
    split: '#e8b84a',            // Gold
    multiShot: '#d4623a',        // Copper
    fireball: '#ff6622',         // Furnace orange
    fireballGlow: '#ff4400',     // Fireball shadow/glow
    fireballCore: '#ffaa00',     // Fireball gradient mid-tone
    widePaddle: '#7a6830',       // Bronze
    extraLife: '#e04050',        // Ruby red
  },

  card: {
    bg: 'rgba(22,18,37,0.85)',        // Dark amethyst card
    bgLocked: 'rgba(12,10,20,0.6)',   // Dim locked card
    borderLocked: '#3a3450',          // Muted purple border
    textLocked: '#4a4460',            // Dim locked text
  },

  button: {
    bg: '#1e1a30',               // Dark indigo
    hover: '#2a2440',            // Highlighted indigo
    text: '#f2e8d0',             // Warm ivory
    border: '#e8b84a',           // Gold trim
  },

  // Extended palette for new UI elements
  glow: {
    gold: 'rgba(232,184,74,0.3)',
    copper: 'rgba(212,98,58,0.3)',
    purple: 'rgba(120,90,180,0.15)',
  },

  ornament: {
    line: 'rgba(232,184,74,0.2)',     // Decorative line
    lineBright: 'rgba(232,184,74,0.5)', // Brighter decorative line
    dot: 'rgba(232,184,74,0.6)',      // Ornamental dot/rivet
  },
};

// ---------------------------------------------------------------------------
// 3. Level Loading
// ---------------------------------------------------------------------------

function _brickColor(hp) {
  if (hp >= C.IRONCLAD_HP) return Theme.brick.iron;
  if (hp >= 3) return Theme.brick.hp3;
  if (hp >= 2) return Theme.brick.hp2;
  return Theme.brick.hp1;
}

// __LEVEL_DATA_PLACEHOLDER__

function _applyColors(level) {
  const copy = JSON.parse(JSON.stringify(level));
  for (const brick of copy.bricks) {
    // Preserve colours from image-generated levels; only apply HP-based
    // theme colours when no colour was provided by the server.
    if (!brick.color) {
      brick.color = _brickColor(brick.hp);
    }
  }
  return copy;
}

function getPresetLevel(index) {
  if (index < 0 || index >= LEVEL_DATA.length) return null;
  return _applyColors(LEVEL_DATA[index]);
}

function getTotalLevels() {
  return LEVEL_DATA.length;
}
