// src/scenes/menu-scene.js
// Provides: MenuScene
// Depends: C, Theme, audio

class MenuScene {
  constructor(game) {
    this._game = game;
    this._buttons = [];
    this._floatingBalls = [];
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._enterTime = 0; // for staggered entrance animation
  }

  enter() {
    const cx = C.SCREEN_W / 2;
    this._buttons = [
      { x: cx - 110, y: 340, w: 220, h: 52, text: '\u2699  \u5173\u5361\u6a21\u5f0f', action: 'levels', delay: 0 },
      { x: cx - 110, y: 408, w: 220, h: 52, text: '\u25a3  \u56fe\u7247\u6a21\u5f0f', action: 'image', delay: 0.08 },
      { x: cx - 110, y: 476, w: 220, h: 52, text: '\u2726  \u521b\u9020\u6a21\u5f0f', action: 'creative', delay: 0.16 },
    ];

    this._sfxOn = (typeof audio !== 'undefined') ? audio.sfxEnabled : true;
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._enterTime = 0;

    this._floatingBalls = [];
    for (let i = 0; i < 6; i++) {
      this._floatingBalls.push({
        x: Math.random() * C.SCREEN_W,
        y: 130 + Math.random() * 140,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        radius: 2 + Math.random() * 3,
        alpha: 0.3 + Math.random() * 0.4,
      });
    }
  }

  exit() {}

  update(dt) {
    this._enterTime += dt;

    for (const b of this._floatingBalls) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 0 || b.x > C.SCREEN_W) b.vx *= -1;
      if (b.y < 100 || b.y > 300) b.vy *= -1;
    }

    if (this._pressTimer > 0) {
      this._pressTimer -= dt;
      if (this._pressTimer <= 0) this._pressedBtn = null;
    }
  }

  render() {
    const r = this._game.renderer;
    const ctx = r.ctx;

    r.drawBackground(1.0);

    // Decorative floating balls with glow
    for (const b of this._floatingBalls) {
      ctx.globalAlpha = b.alpha * Math.min(1, this._enterTime / 1.0);
      ctx.fillStyle = Theme.accent;
      ctx.shadowColor = Theme.accent;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // Title area with fade-in
    const titleAlpha = Math.min(1, this._enterTime / 0.6);
    ctx.globalAlpha = titleAlpha;

    // Main title
    r.drawTitle('\u9020\u7816\u5382', 200, 46);

    // Ornamental divider
    r.drawOrnament(230, 180);

    // Subtitle with letter spacing
    ctx.textAlign = 'center';
    ctx.font = '11px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText('B R E A K O U T   M A K E R', C.SCREEN_W / 2, 255);

    ctx.globalAlpha = 1;

    // Buttons with staggered entrance
    for (const btn of this._buttons) {
      const btnAge = this._enterTime - (btn.delay || 0);
      if (btnAge < 0) continue;

      const slideProgress = Math.min(1, btnAge / 0.3);
      const ease = 1 - Math.pow(1 - slideProgress, 3); // ease-out cubic
      const offsetY = (1 - ease) * 30;
      const alpha = ease;

      ctx.globalAlpha = alpha;
      const isPressed = this._pressedBtn === btn;
      r.drawButton(btn.x, btn.y + offsetY, btn.w, btn.h, btn.text, { highlighted: isPressed });
    }
    ctx.globalAlpha = 1;

    // Sound toggle (top-right, refined)
    const sfxBtnX = C.SCREEN_W - 52;
    const sfxBtnY = 10;
    const sfxBtnSize = 40;

    ctx.fillStyle = Theme.button.bg;
    ctx.beginPath();
    ctx.roundRect(sfxBtnX, sfxBtnY, sfxBtnSize, sfxBtnSize, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,184,74,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this._sfxOn ? Theme.accent : Theme.textSecondary;
    ctx.fillText(this._sfxOn ? '\ud83d\udd0a' : '\ud83d\udd07', sfxBtnX + sfxBtnSize / 2, sfxBtnY + sfxBtnSize / 2);
    ctx.textBaseline = 'alphabetic';

    // Version/credit at very bottom
    ctx.textAlign = 'center';
    ctx.font = '9px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textMuted;
    ctx.fillText('v1.0 \u00b7 Powered by AI', C.SCREEN_W / 2, C.SCREEN_H - 20);
  }

  onTap(x, y) {
    const sfxBtnX = C.SCREEN_W - 52;
    const sfxBtnY = 10;
    const sfxBtnSize = 40;
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
        } else if (btn.action === 'creative') {
          this._game.stateMachine.transition('CREATIVE');
        }
      }
    }
  }

  onMove() {}
}
