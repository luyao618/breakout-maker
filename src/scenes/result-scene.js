// src/scenes/result-scene.js
// Provides: ResultScene
// Depends: C, Theme, getPresetLevel, audio

class ResultScene {
  constructor(game, type) {
    this._game = game;
    this._type = type;
    this._data = null;
    this._buttons = [];
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._enterTime = 0;
    this._particles = []; // celebration particles for win
  }

  enter(data) {
    this._data = data || {};
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._enterTime = 0;
    this._particles = [];
    const cx = C.SCREEN_W / 2;

    if (typeof audio !== 'undefined') {
      if (this._type === 'WIN') audio.playWin();
      else audio.playGameOver();
    }

    const idx = this._data.levelIndex != null ? this._data.levelIndex : 0;

    // Spawn celebration particles for win
    if (this._type === 'WIN') {
      const colors = [Theme.accent, Theme.accent2, '#fff', '#ffdd88', '#9070c0'];
      for (let i = 0; i < 40; i++) {
        this._particles.push({
          x: C.SCREEN_W / 2 + (Math.random() - 0.5) * 200,
          y: 160 + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 150,
          vy: -80 - Math.random() * 120,
          size: 2 + Math.random() * 3,
          life: 1.5 + Math.random() * 1,
          maxLife: 2.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 8,
        });
      }
    }

    if (this._type === 'WIN') {
      if (idx >= 0) {
        const nextIdx = idx + 1;
        if (nextIdx + 1 > (this._game.unlockedLevels || 1)) {
          this._game.unlockedLevels = nextIdx + 1;
        }
      }

      if (idx < 0) {
        this._buttons = [
          { x: cx - 110, y: 380, w: 220, h: 50, text: '\u518d\u73a9\u4e00\u6b21', action: 'retry',  delay: 0.3 },
          { x: cx - 110, y: 445, w: 220, h: 50, text: '\u4e3b\u83dc\u5355',       action: 'menu',   delay: 0.38 },
        ];
      } else {
        this._buttons = [
          { x: cx - 110, y: 380, w: 220, h: 50, text: '\u4e0b\u4e00\u5173',     action: 'next',        delay: 0.3 },
          { x: cx - 110, y: 445, w: 220, h: 50, text: '\u9009\u62e9\u5173\u5361', action: 'levelSelect', delay: 0.38 },
          { x: cx - 110, y: 510, w: 220, h: 50, text: '\u4e3b\u83dc\u5355',       action: 'menu',        delay: 0.46 },
        ];
      }
    } else {
      if (idx < 0) {
        this._buttons = [
          { x: cx - 110, y: 380, w: 220, h: 50, text: '\u91cd\u8bd5',   action: 'retry', delay: 0.3 },
          { x: cx - 110, y: 445, w: 220, h: 50, text: '\u4e3b\u83dc\u5355', action: 'menu', delay: 0.38 },
        ];
      } else {
        this._buttons = [
          { x: cx - 110, y: 380, w: 220, h: 50, text: '\u91cd\u8bd5',     action: 'retry',       delay: 0.3 },
          { x: cx - 110, y: 445, w: 220, h: 50, text: '\u9009\u62e9\u5173\u5361', action: 'levelSelect', delay: 0.38 },
          { x: cx - 110, y: 510, w: 220, h: 50, text: '\u4e3b\u83dc\u5355',       action: 'menu',        delay: 0.46 },
        ];
      }
    }
  }

  exit() {}

  update(dt) {
    this._enterTime += dt;

    if (this._pressTimer > 0) {
      this._pressTimer -= dt;
      if (this._pressTimer <= 0) this._pressedBtn = null;
    }

    // Update celebration particles
    for (const p of this._particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt; // gravity
      p.life -= dt;
      p.rotation += p.rotSpeed * dt;
    }
    this._particles = this._particles.filter(p => p.life > 0);
  }

  render() {
    const r   = this._game.renderer;
    const ctx = r.ctx;

    r.drawBackground();

    // Celebration particles (behind text)
    for (const p of this._particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Title entrance animation
    const titleProgress = Math.min(1, this._enterTime / 0.4);
    const titleScale = 0.8 + titleProgress * 0.2;
    ctx.globalAlpha = titleProgress;

    if (this._type === 'WIN') {
      r.drawTitle('\u606d\u559c\u901a\u5173\uff01', 190, 28);
    } else {
      r.drawTitle('\u6e38\u620f\u7ed3\u675f', 190, 28);
    }

    r.drawOrnament(215, 160);
    ctx.globalAlpha = 1;

    // Score display with count-up effect
    const scoreProgress = Math.min(1, (this._enterTime - 0.2) / 0.6);
    if (scoreProgress > 0) {
      const displayScore = Math.floor((this._data.score || 0) * Math.min(1, scoreProgress));
      ctx.textAlign = 'center';

      // Score label
      ctx.font = '11px "Avenir Next", "Segoe UI", sans-serif';
      ctx.fillStyle = Theme.textSecondary;
      ctx.fillText('SCORE', C.SCREEN_W / 2, 255);

      // Score value
      ctx.font = 'bold 32px "Avenir Next", "Georgia", serif';
      ctx.fillStyle = Theme.accent;
      ctx.shadowColor = Theme.accent;
      ctx.shadowBlur = 10;
      ctx.fillText(displayScore, C.SCREEN_W / 2, 290);
      ctx.shadowBlur = 0;

      // Level name
      ctx.font = '12px "Avenir Next", "Segoe UI", sans-serif';
      ctx.fillStyle = Theme.textSecondary;
      ctx.fillText(this._data.level?.name || '', C.SCREEN_W / 2, 325);
    }

    // Buttons with staggered entrance
    for (const btn of this._buttons) {
      const btnAge = this._enterTime - (btn.delay || 0);
      if (btnAge < 0) continue;

      const progress = Math.min(1, btnAge / 0.25);
      const ease = 1 - Math.pow(1 - progress, 3);
      const offsetY = (1 - ease) * 20;

      ctx.globalAlpha = ease;
      const isPressed = this._pressedBtn === btn;
      r.drawButton(btn.x, btn.y + offsetY, btn.w, btn.h, btn.text, { highlighted: isPressed });
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
          case 'next': {
            const nextIdx   = (this._data.levelIndex || 0) + 1;
            const nextLevel = getPresetLevel(nextIdx);
            if (nextLevel) {
              this._game.stateMachine.transition('PLAYING', {
                level: nextLevel,
                levelIndex: nextIdx,
              });
            } else {
              this._game.stateMachine.transition('LEVEL_SELECT');
            }
            break;
          }
          case 'retry': {
            const idx = this._data.levelIndex;
            const lvl = idx >= 0 ? getPresetLevel(idx) : this._data.level;
            if (lvl) {
              this._game.stateMachine.transition('PLAYING', {
                level: lvl,
                levelIndex: idx,
              });
            } else {
              this._game.stateMachine.transition('MENU');
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
