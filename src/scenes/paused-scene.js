// src/scenes/paused-scene.js
// Provides: PausedScene
// Depends: C, STATES, getPresetLevel, Renderer

class PausedScene {
  constructor(game) {
    this._game = game;
    this._buttons = [];
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._enterTime = 0;
  }

  enter() {
    const cx = C.SCREEN_W / 2;
    this._buttons = [
      { x: cx - 110, y: 270, w: 220, h: 48, text: '\u7ee7\u7eed\u6e38\u620f',    action: 'resume',      delay: 0 },
      { x: cx - 110, y: 330, w: 220, h: 48, text: '\u91cd\u65b0\u5f00\u59cb',   action: 'restart',     delay: 0.06 },
      { x: cx - 110, y: 390, w: 220, h: 48, text: '\u9009\u62e9\u5173\u5361',   action: 'levelSelect', delay: 0.12 },
      { x: cx - 110, y: 450, w: 220, h: 48, text: '\u8fd4\u56de\u4e3b\u83dc\u5355', action: 'menu',    delay: 0.18 },
    ];
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._enterTime = 0;
  }

  exit() {}

  update(dt) {
    this._enterTime += dt;
    if (this._pressTimer > 0) {
      this._pressTimer -= dt;
      if (this._pressTimer <= 0) this._pressedBtn = null;
    }
  }

  render() {
    // Draw frozen game underneath
    const gameScene = this._game.stateMachine._scenes[STATES.PLAYING];
    if (gameScene && gameScene.brickField) gameScene.render();

    const r = this._game.renderer;
    const ctx = r.ctx;

    // Overlay with blur effect (simulated with multiple transparent layers)
    r.drawOverlay(0.8);

    // Title with glow
    const titleAlpha = Math.min(1, this._enterTime / 0.3);
    ctx.globalAlpha = titleAlpha;
    r.drawTitle('\u6682\u505c', 210, 30);
    r.drawOrnament(235, 120);
    ctx.globalAlpha = 1;

    // Buttons with staggered entrance
    for (const btn of this._buttons) {
      const btnAge = this._enterTime - (btn.delay || 0);
      if (btnAge < 0) continue;

      const progress = Math.min(1, btnAge / 0.2);
      const ease = 1 - Math.pow(1 - progress, 3);
      const offsetX = (1 - ease) * 40;

      ctx.globalAlpha = ease;
      const isPressed = this._pressedBtn === btn;
      r.drawButton(btn.x + offsetX, btn.y, btn.w, btn.h, btn.text, { highlighted: isPressed });
    }
    ctx.globalAlpha = 1;
  }

  onTap(x, y) {
    for (const btn of this._buttons) {
      if (x >= btn.x && x <= btn.x + btn.w &&
          y >= btn.y && y <= btn.y + btn.h) {
        this._pressedBtn = btn;
        this._pressTimer = 0.12;

        switch (btn.action) {
          case 'resume':
            this._game.stateMachine.transition('PLAYING');
            break;
          case 'restart': {
            const gameScene = this._game.stateMachine._scenes[STATES.PLAYING];
            this._game.stateMachine.transition('PLAYING');
            if (gameScene) {
              const idx = gameScene.levelIndex;
              const lvl = idx >= 0 ? getPresetLevel(idx) : gameScene.level;
              gameScene.exit(false);
              gameScene.enter({ level: lvl, levelIndex: idx });
            }
            break;
          }
          case 'levelSelect':
            this._game.stateMachine.transition('LEVEL_SELECT');
            break;
          case 'menu':
            this._game.stateMachine.transition('MENU');
            break;
        }
      }
    }
  }

  onMove() {}
}
