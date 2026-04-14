// src/scenes/menu-scene.js
// Provides: MenuScene
// Depends: C, Theme, audio

class MenuScene {
  constructor(game) {
    this._game = game;
    this._buttons = [];
    this._floatingBalls = []; // decorative animated balls
    this._pressedBtn = null;  // tap feedback tracking
    this._pressTimer = 0;
  }

  enter() {
    // Buttons — two modes: 关卡模式 + 图片模式
    const cx = C.SCREEN_W / 2;
    this._buttons = [
      {
        x: cx - 100, y: 340,
        w: 200, h: 50,
        text: '关卡模式',
        action: 'levels',
      },
      {
        x: cx - 100, y: 410,
        w: 200, h: 50,
        text: '图片模式',
        action: 'image',
      },
    ];
    // Sound toggle icon (top-right corner)
    this._sfxOn = (typeof audio !== 'undefined') ? audio.sfxEnabled : true;
    this._pressedBtn = null;
    this._pressTimer = 0;

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

    // Tick tap-feedback timer
    if (this._pressTimer > 0) {
      this._pressTimer -= dt;
      if (this._pressTimer <= 0) this._pressedBtn = null;
    }
  }

  render() {
    const r   = this._game.renderer;
    const ctx = r.ctx;

    r.drawBackground(1.0);

    // --- Title ---
    r.drawTitle('造砖厂', 210, 42);
    r.drawSubtitle('BREAKOUT MAKER', 260, 14);

    // --- Buttons with tap feedback ---
    for (const btn of this._buttons) {
      const isPressed = this._pressedBtn === btn;
      r.drawButton(btn.x, btn.y, btn.w, btn.h, btn.text, { highlighted: isPressed });
    }

    // --- Sound toggle button (top-right corner, with visible container) ---
    const sfxBtnX = C.SCREEN_W - 52;
    const sfxBtnY = 8;
    const sfxBtnSize = 44;

    // Button container background
    ctx.fillStyle = Theme.button.bg;
    ctx.beginPath();
    ctx.roundRect(sfxBtnX, sfxBtnY, sfxBtnSize, sfxBtnSize, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = Theme.button.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Icon
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = Theme.textPrimary;
    ctx.fillText(this._sfxOn ? '🔊' : '🔇', sfxBtnX + sfxBtnSize / 2, sfxBtnY + sfxBtnSize / 2);
    ctx.textBaseline = 'alphabetic'; // reset

  }

  onTap(x, y) {
    // Check sound button (top-right 44x44 area)
    const sfxBtnX = C.SCREEN_W - 52;
    const sfxBtnY = 8;
    const sfxBtnSize = 44;
    if (x >= sfxBtnX && x <= sfxBtnX + sfxBtnSize &&
        y >= sfxBtnY && y <= sfxBtnY + sfxBtnSize) {
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
        this._pressedBtn = btn;
        this._pressTimer = 0.12;
        if (typeof audio !== 'undefined') { audio.init(); }
        if (typeof audio !== 'undefined') audio.playClick();

        if (btn.action === 'levels') {
          this._game.stateMachine.transition('LEVEL_SELECT');
        } else if (btn.action === 'image') {
          this._game.stateMachine.transition('IMAGE_UPLOAD');
        }
      }
    }
  }

  onMove() {}
}
