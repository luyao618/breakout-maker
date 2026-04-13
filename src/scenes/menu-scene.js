// src/scenes/menu-scene.js
// Provides: MenuScene
// Depends: C, Theme, audio

class MenuScene {
  constructor(game) {
    this._game = game;
    this._buttons = [];
    this._floatingBalls = []; // decorative animated balls
  }

  enter() {
    // Buttons
    this._buttons = [
      {
        x: C.SCREEN_W / 2 - 100, y: 380,
        w: 200, h: 50,
        text: '开始游戏',
        action: 'start',
      },
    ];
    // Sound toggle icon (top-right corner)
    this._sfxOn = (typeof audio !== 'undefined') ? audio.sfxEnabled : true;

    // Spawn decorative floating balls for the background
    this._floatingBalls = [];
    for (let i = 0; i < 5; i++) {
      this._floatingBalls.push({
        x: Math.random() * C.SCREEN_W,
        y: 150 + Math.random() * 150,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        radius: 3 + Math.random() * 4,
      });
    }
  }

  exit() {}

  update(dt) {
    // Animate floating balls — simple bounce off invisible edges
    for (const b of this._floatingBalls) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 0 || b.x > C.SCREEN_W) b.vx *= -1;
      if (b.y < 100 || b.y > 320) b.vy *= -1;
    }
  }

  render() {
    const r   = this._game.renderer;
    const ctx = r.ctx;

    r.drawBackground();

    // --- Title ---
    r.drawTitle('BREAKOUT', 200, 40);
    r.drawTitle('MAKER', 250, 40);
    r.drawSubtitle('打砖块创造者', 290, 16);

    // --- Buttons ---
    for (const btn of this._buttons) {
      r.drawButton(btn.x, btn.y, btn.w, btn.h, btn.text);
    }

    // --- Sound toggle icon (top-right corner) ---
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText(this._sfxOn ? '🔊' : '🔇', C.SCREEN_W - 15, 30);

  }

  onTap(x, y) {
    // Check sound icon (top-right corner, ~40x40 area)
    if (x >= C.SCREEN_W - 50 && y <= 45) {
      if (typeof audio !== 'undefined') {
        audio.init();
        audio.toggleSfx();
        this._sfxOn = audio.sfxEnabled;
      }
      return;
    }

    for (const btn of this._buttons) {
      if (x >= btn.x && x <= btn.x + btn.w &&
          y >= btn.y && y <= btn.y + btn.h) {
        if (btn.action === 'start') {
          if (typeof audio !== 'undefined') { audio.init(); }
          if (typeof audio !== 'undefined') audio.playClick();
          this._game.stateMachine.transition('LEVEL_SELECT');
        }
      }
    }
  }

  onMove() {}
}
