// src/game.js
// Provides: Game, game (global instance)
// Depends: C, STATES, Renderer, StateMachine, InputManager,
//          MenuScene, LevelSelectScene, GameScene, PausedScene,
//          ResultScene, ImageUploadScene, CreativeScene

class Game {

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Player progress — number of levels accessible (first 6 unlocked by default)
    this.unlockedLevels = 6;
    this._loadProgress();

    // Responsive canvas sizing
    this._setupCanvas();
    window.addEventListener('resize', () => this._setupCanvas());

    // --- Sub-systems ---
    this.renderer = new Renderer(this.ctx, C.SCREEN_W, C.SCREEN_H);
    this.stateMachine = new StateMachine();

    // --- Register all scenes ---
    const menuScene        = new MenuScene(this);
    const levelSelectScene = new LevelSelectScene(this);
    const gameScene        = new GameScene(this);
    const pausedScene      = new PausedScene(this);
    const winScene         = new ResultScene(this, 'WIN');
    const loseScene        = new ResultScene(this, 'LOSE');
    const imageUploadScene = new ImageUploadScene(this);
    const creativeScene = new CreativeScene(this);

    this.stateMachine.registerScene(STATES.MENU,         menuScene);
    this.stateMachine.registerScene(STATES.LEVEL_SELECT,  levelSelectScene);
    this.stateMachine.registerScene(STATES.PLAYING,       gameScene);
    this.stateMachine.registerScene(STATES.PAUSED,        pausedScene);
    this.stateMachine.registerScene(STATES.WIN,           winScene);
    this.stateMachine.registerScene(STATES.LOSE,          loseScene);
    this.stateMachine.registerScene(STATES.IMAGE_UPLOAD,  imageUploadScene);
    this.stateMachine.registerScene(STATES.CREATIVE,     creativeScene);

    // --- Input ---
    this.input = new InputManager(canvas, this);

    // --- Enter the initial scene ---
    menuScene.enter();

    // --- Start the game loop ---
    this._lastTime = performance.now();
    this._accumulator = 0;
    this._loop();
  }

  // --- Canvas setup ---

  /**
   * Size the canvas element to fill the viewport while preserving the
   * game's logical aspect ratio.  Uses devicePixelRatio for crisp rendering.
   */
  _setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const maxW = window.innerWidth;
    const maxH = window.innerHeight;
    const aspect = C.SCREEN_W / C.SCREEN_H;

    let w, h;
    if (maxW / maxH < aspect) {
      // Viewport is narrower than game — fit to width
      w = maxW;
      h = maxW / aspect;
    } else {
      // Viewport is taller than game — fit to height
      h = maxH;
      w = maxH * aspect;
    }

    // CSS size (logical pixels)
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';

    // Backing-store size (physical pixels)
    this.canvas.width  = C.SCREEN_W * dpr;
    this.canvas.height = C.SCREEN_H * dpr;

    // Re-acquire context and apply DPR scaling
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);

    // Keep the renderer in sync with the (potentially new) context
    if (this.renderer) {
      this.renderer.ctx = this.ctx;
    }
  }

  // --- Persistence ---

  _loadProgress() {
    try {
      const saved = localStorage.getItem('breakout-maker-progress');
      if (saved) {
        const data = JSON.parse(saved);
        // Reset progress if level data version changed (levels were redesigned)
        if (data.levelVersion !== 3) {
          localStorage.removeItem('breakout-maker-progress');
          this.unlockedLevels = 6;
          return;
        }
        this.unlockedLevels = data.unlockedLevels || 6;
      } else {
        this.unlockedLevels = 6;
      }
    } catch (e) {
      // localStorage may be unavailable in some contexts — ignore
    }
  }

  _saveProgress() {
    try {
      localStorage.setItem(
        'breakout-maker-progress',
        JSON.stringify({ unlockedLevels: this.unlockedLevels, levelVersion: 3 })
      );
    } catch (e) {
      // Silently ignore write failures
    }
  }

  // --- Game loop ---

  /**
   * The main frame loop.
   *
   * - For the PLAYING state a **fixed timestep** is used so that physics
   *   behaves identically regardless of display refresh rate.
   * - All other states (menus, paused, results) use a simple variable
   *   timestep which is fine for UI animations.
   * - The accumulator is capped to C.MAX_ACCUMULATOR to prevent a
   *   "spiral of death" after long pauses (e.g. switching browser tabs).
   */
  _loop() {
    const now = performance.now();
    let dt = (now - this._lastTime) / 1000;   // seconds
    this._lastTime = now;

    // Clamp to avoid huge jumps after tab-switch / debugger pause
    if (dt > C.MAX_ACCUMULATOR) dt = C.MAX_ACCUMULATOR;

    // Let the renderer update its own timer (used for animated effects)
    this.renderer.update(dt);

    // Dispatch to the active scene
    const scene = this.stateMachine.getActiveScene();

    if (scene) {
      if (this.stateMachine.state === STATES.PLAYING) {
        // ---- Fixed-timestep physics ----
        this._accumulator += dt;
        let steps = 0;

        while (this._accumulator >= C.FIXED_DT && steps < C.MAX_STEPS) {
          scene.update(C.FIXED_DT);
          this._accumulator -= C.FIXED_DT;
          steps++;

          // If the scene triggered a state transition mid-step, stop
          if (this.stateMachine.state !== STATES.PLAYING) break;
        }

        // Safety valve: discard leftover time if it grew too large
        if (this._accumulator > C.MAX_ACCUMULATOR) {
          this._accumulator = 0;
        }
      } else {
        // ---- Variable timestep for UI scenes ----
        scene.update(dt);
      }

      scene.render();
    }

    // Persist player progress (cheap JSON write, OK every frame)
    this._saveProgress();

    // Schedule next frame
    requestAnimationFrame(() => this._loop());
  }
}


// ============================================================================
// Boot — create the Game instance once the DOM is ready
// ============================================================================
const game = new Game(document.getElementById('gameCanvas'));
