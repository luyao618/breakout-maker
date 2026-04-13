/**
 * Minimal test runner — no npm dependencies
 * Outputs TAP-like format
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

class TestRunner {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log(`\n# ${this.suiteName}`);
    console.log(`1..${this.tests.length}`);

    for (let i = 0; i < this.tests.length; i++) {
      const { name, fn } = this.tests[i];
      try {
        await fn();
        this.passed++;
        console.log(`ok ${i + 1} - ${name}`);
      } catch (e) {
        this.failed++;
        this.errors.push({ name, error: e });
        console.log(`not ok ${i + 1} - ${name}`);
        console.log(`  ---`);
        console.log(`  message: ${e.message}`);
        if (e.stack) {
          const stackLines = e.stack.split('\n').slice(1, 4);
          stackLines.forEach(l => console.log(`  ${l.trim()}`));
        }
        console.log(`  ...`);
      }
    }

    console.log(`\n# ${this.suiteName}: ${this.passed}/${this.tests.length} passed`);
    if (this.failed > 0) {
      console.log(`# FAILED: ${this.failed} test(s)`);
    }

    return { passed: this.passed, failed: this.failed, total: this.tests.length };
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertClose(actual, expected, epsilon, message) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(
      (message || 'assertClose') + `: expected ${expected} ± ${epsilon}, got ${actual}`
    );
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      (message || 'assertEqual') + `: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      (message || 'assertDeepEqual') + `: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

/**
 * Load the game source files into a sandboxed context.
 * Returns the context object with all global classes/functions.
 */
function loadGameContext() {
  const root = path.resolve(__dirname, '..');

  // Same order as build.js (excluding game.js which boots the app)
  const srcFiles = [
    'src/constants.js',
    'src/power-ups.js',
    'src/event-bus.js',
    'src/entities/ball.js',
    'src/entities/paddle.js',
    'src/entities/brick.js',
    'src/entities/brick-field.js',
    'src/entities/power-up-drop.js',
    'src/entities/particle.js',
    'src/physics/collision.js',
    'src/physics/physics-world.js',
    'src/systems/score-system.js',
    'src/audio/audio-manager.js',
    'src/rendering/renderer.js',
    'src/scenes/state-machine.js',
    'src/scenes/menu-scene.js',
    'src/scenes/level-select.js',
    'src/scenes/game-scene.js',
    'src/scenes/paused-scene.js',
    'src/scenes/result-scene.js',
    'src/scenes/image-upload.js',
    'src/image/median-cut.js',
    'src/image/brick-mapper.js',
    'src/input/input-manager.js',
    // NOTE: Do NOT include src/game.js — it calls `new Game(...)` on load
  ];

  // Read and concatenate
  let code = '';
  for (const f of srcFiles) {
    code += fs.readFileSync(path.join(root, f), 'utf-8') + '\n';
  }

  // Inject LEVEL_DATA from level JSON files
  const levelsDir = path.join(root, 'levels');
  const levelFiles = fs.readdirSync(levelsDir)
    .filter(f => /^level-\d+\.json$/.test(f))
    .sort();
  const levels = levelFiles.map(f => {
    return JSON.parse(fs.readFileSync(path.join(levelsDir, f), 'utf-8'));
  });
  const levelDataJS = 'const LEVEL_DATA = ' + JSON.stringify(levels) + ';\n';

  // Replace placeholder in constants.js
  code = code.replace('// __LEVEL_DATA_PLACEHOLDER__', levelDataJS);

  // Append exports: make const/class declarations accessible on globalThis.
  // In vm contexts, only function/var declarations become sandbox properties,
  // so we explicitly assign all needed classes/constants to globalThis.
  code += `
    globalThis.C = C;
    globalThis.Theme = Theme;
    globalThis.LEVEL_DATA = LEVEL_DATA;
    globalThis.PowerUpType = PowerUpType;
    globalThis.POWER_UP_WEIGHTS = POWER_UP_WEIGHTS;
    globalThis.POWER_UP_DROP_CHANCE = POWER_UP_DROP_CHANCE;
    globalThis.EventBus = EventBus;
    globalThis.Ball = Ball;
    globalThis.Paddle = Paddle;
    globalThis.Brick = Brick;
    globalThis.BrickField = BrickField;
    globalThis.PowerUpDrop = PowerUpDrop;
    globalThis.Particle = Particle;
    globalThis.CollisionDetector = CollisionDetector;
    globalThis.PhysicsWorld = PhysicsWorld;
    globalThis.ScoreSystem = ScoreSystem;
    globalThis.MedianCut = MedianCut;
    globalThis.BrickMapper = BrickMapper;
  `;

  // Create sandbox with stubbed browser APIs
  const sandbox = {
    console,
    Math,
    performance: { now: () => Date.now() },
    setTimeout,
    setInterval,
    clearInterval,
    Infinity,
    NaN,
    isNaN,
    parseInt,
    parseFloat,
    JSON,
    Array,
    Object,
    Set,
    Map,
    Error,
    // Stub DOM/Canvas APIs
    document: {
      createElement: (tag) => {
        if (tag === 'canvas') {
          return {
            width: 0, height: 0,
            getContext: () => ({
              fillRect: () => {},
              strokeRect: () => {},
              clearRect: () => {},
              fillText: () => {},
              strokeText: () => {},
              measureText: () => ({ width: 0 }),
              beginPath: () => {},
              closePath: () => {},
              moveTo: () => {},
              lineTo: () => {},
              arc: () => {},
              fill: () => {},
              stroke: () => {},
              roundRect: () => {},
              save: () => {},
              restore: () => {},
              translate: () => {},
              rotate: () => {},
              scale: () => {},
              drawImage: () => {},
              getImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
              putImageData: () => {},
              createLinearGradient: () => ({ addColorStop: () => {} }),
              createRadialGradient: () => ({ addColorStop: () => {} }),
              createBuffer: () => ({ getChannelData: () => new Float32Array(0) }),
              createOscillator: () => ({ connect: () => {}, start: () => {}, stop: () => {}, frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, value: 0 } }),
              createGain: () => ({ connect: () => {}, gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, value: 0 } }),
              createBufferSource: () => ({ connect: () => {}, start: () => {}, buffer: null }),
              canvas: { width: 375, height: 667 },
            }),
            style: {},
          };
        }
        if (tag === 'input') {
          return {
            type: '', accept: '', style: { display: '' },
            addEventListener: () => {},
            click: () => {},
            value: '',
          };
        }
        return { style: {}, addEventListener: () => {} };
      },
      getElementById: () => ({
        width: 375, height: 667,
        getContext: () => ({
          fillRect: () => {},
          strokeRect: () => {},
          clearRect: () => {},
          fillText: () => {},
          strokeText: () => {},
          measureText: () => ({ width: 0 }),
          beginPath: () => {},
          closePath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
          roundRect: () => {},
          save: () => {},
          restore: () => {},
          translate: () => {},
          rotate: () => {},
          scale: () => {},
          drawImage: () => {},
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createRadialGradient: () => ({ addColorStop: () => {} }),
          canvas: { width: 375, height: 667 },
        }),
        style: {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }),
        addEventListener: () => {},
      }),
      body: { appendChild: () => {} },
    },
    window: {
      AudioContext: function() {
        return {
          currentTime: 0,
          sampleRate: 44100,
          destination: {},
          createGain: () => ({ connect: () => {}, gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }),
          createOscillator: () => ({ connect: () => {}, start: () => {}, stop: () => {}, type: '', frequency: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }),
          createBuffer: (channels, length, sampleRate) => ({ getChannelData: () => new Float32Array(length) }),
          createBufferSource: () => ({ connect: () => {}, start: () => {}, buffer: null }),
        };
      },
      devicePixelRatio: 1,
      innerWidth: 375,
      innerHeight: 667,
      addEventListener: () => {},
    },
    requestAnimationFrame: () => {},
    FileReader: function() {
      this.onload = null;
      this.readAsDataURL = () => {};
    },
    Image: function() {
      this.onload = null;
      this.src = '';
    },
    Uint8ClampedArray,
    Float32Array,
    Number,
    String,
    Boolean,
    RegExp,
    Date,
    Promise,
    Symbol,
  };

  vm.createContext(sandbox);

  try {
    const script = new vm.Script(code, { filename: 'game-bundle.js' });
    script.runInContext(sandbox);
  } catch (e) {
    console.error('Failed to load game context:', e.message);
    throw e;
  }

  return sandbox;
}

module.exports = { TestRunner, assert, assertClose, assertEqual, assertDeepEqual, loadGameContext };
