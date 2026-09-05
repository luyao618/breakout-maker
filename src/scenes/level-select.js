// src/scenes/level-select.js
// Provides: LevelSelectScene
// Depends: C, Theme, getPresetLevel, getTotalLevels

class LevelSelectScene {
  constructor(game) {
    this._game = game;
    this._page = 0;
    this._buttons = [];
    this._levelCards = [];
    this._pageText = '';
    this._unlockedLevels = 1;
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._enterTime = 0;
  }

  enter() {
    this._unlockedLevels = this._game.unlockedLevels || 1;
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._enterTime = 0;
    this._buildPage();
  }

  exit() {}

  _buildPage() {
    const perPage    = 6;
    const total      = getTotalLevels();
    const totalPages = Math.ceil(total / perPage);
    const start      = this._page * perPage;

    this._levelCards = [];
    this._buttons    = [];

    // Level cards: 3 columns x 2 rows
    const cardW = 100, cardH = 125, gapX = 14, gapY = 16;
    const gridStartX = (C.SCREEN_W - 3 * cardW - 2 * gapX) / 2;
    const gridStartY = 110;

    for (let i = 0; i < perPage; i++) {
      const levelIdx = start + i;
      if (levelIdx >= total) break;

      const col = i % 3;
      const row = Math.floor(i / 3);
      const x   = gridStartX + col * (cardW + gapX);
      const y   = gridStartY + row * (cardH + gapY);
      const level    = getPresetLevel(levelIdx);
      const unlocked = true;

      this._levelCards.push({ x, y, w: cardW, h: cardH, levelIdx, level, unlocked, animDelay: i * 0.05 });
    }

    // Pagination
    const btnY = 390;
    if (this._page > 0) {
      this._buttons.push({
        x: 20, y: btnY, w: 100, h: 48,
        text: '\u2190 \u4e0a\u4e00\u9875', action: 'prevPage',
      });
    }
    if (this._page < totalPages - 1) {
      this._buttons.push({
        x: C.SCREEN_W - 120, y: btnY, w: 100, h: 48,
        text: '\u4e0b\u4e00\u9875 \u2192', action: 'nextPage',
      });
    }

    this._pageText = `${this._page + 1} / ${totalPages}`;

    this._buttons.push({
      x: C.SCREEN_W / 2 - 70, y: 530, w: 140, h: 48,
      text: '\u8fd4\u56de', action: 'back',
    });
  }

  update(dt) {
    this._enterTime += dt;
    if (this._pressTimer > 0) {
      this._pressTimer -= dt;
      if (this._pressTimer <= 0) this._pressedBtn = null;
    }
  }

  render() {
    const r   = this._game.renderer;
    const ctx = r.ctx;

    r.drawBackground();

    // Title
    r.drawTitle('\u9009\u62e9\u5173\u5361', 58, 26);
    r.drawOrnament(75, 140);

    // Level cards with staggered entrance
    for (const card of this._levelCards) {
      const cardAge = this._enterTime - (card.animDelay || 0);
      if (cardAge < 0) continue;

      const slideProgress = Math.min(1, cardAge / 0.25);
      const ease = 1 - Math.pow(1 - slideProgress, 3);
      const scale = 0.9 + ease * 0.1;
      const alpha = ease;

      ctx.globalAlpha = alpha;
      ctx.save();

      const isLocked = !card.unlocked;

      // Card background with subtle inner glow
      const cardGrad = ctx.createLinearGradient(card.x, card.y, card.x, card.y + card.h);
      if (isLocked) {
        cardGrad.addColorStop(0, 'rgba(12,10,20,0.5)');
        cardGrad.addColorStop(1, 'rgba(12,10,20,0.7)');
      } else {
        cardGrad.addColorStop(0, 'rgba(30,26,48,0.8)');
        cardGrad.addColorStop(1, 'rgba(18,16,30,0.9)');
      }
      ctx.fillStyle = cardGrad;
      ctx.beginPath();
      ctx.roundRect(card.x, card.y, card.w, card.h, 10);
      ctx.fill();

      // Border
      ctx.strokeStyle = isLocked ? Theme.card.borderLocked : 'rgba(232,184,74,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Corner brackets on unlocked cards
      if (!isLocked) {
        r.drawCornerBrackets(card.x + 3, card.y + 3, card.w - 6, card.h - 6, 6);
      }

      // Level number
      ctx.font = 'bold 24px "Avenir Next", "Georgia", serif';
      ctx.fillStyle = isLocked ? Theme.card.textLocked : Theme.accent;
      ctx.textAlign = 'center';
      ctx.shadowColor = isLocked ? 'transparent' : Theme.accent;
      ctx.shadowBlur = isLocked ? 0 : 6;
      ctx.fillText(card.levelIdx + 1, card.x + card.w / 2, card.y + 32);
      ctx.shadowBlur = 0;

      // Level name
      ctx.font = '9px "Avenir Next", "Segoe UI", sans-serif';
      ctx.fillStyle = isLocked ? Theme.card.textLocked : Theme.textSecondary;
      ctx.fillText(
        card.level.name.split(' - ')[1] || '',
        card.x + card.w / 2,
        card.y + 48,
      );

      if (!isLocked) {
        // Mini brick preview
        const previewW = card.w - 16;
        const previewH = 44;
        const previewX = card.x + 8;
        const previewY = card.y + 58;

        // Preview border
        ctx.strokeStyle = 'rgba(232,184,74,0.1)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(previewX, previewY, previewW, previewH);

        const dotW = previewW / card.level.gridWidth;
        const dotH = previewH / card.level.gridHeight;

        for (const b of card.level.bricks) {
          const bx = previewX + b.col * dotW;
          const by = previewY + b.row * dotH;

          let bColor;
          if (b.hp >= C.IRONCLAD_HP || b.hp >= 999) {
            bColor = Theme.brick.iron[0];
          } else if (b.color && Array.isArray(b.color)) {
            bColor = b.color[0];
          } else {
            const hpColors = [Theme.brick.hp1[0], Theme.brick.hp2[0], Theme.brick.hp3[0]];
            bColor = hpColors[Math.min(b.hp - 1, 2)] || hpColors[0];
          }
          ctx.fillStyle = bColor;
          ctx.fillRect(bx, by, Math.max(1, dotW - 0.5), Math.max(1, dotH - 0.5));
        }

        // Brick count badge
        ctx.font = '8px "Avenir Next", "Segoe UI", sans-serif';
        ctx.fillStyle = Theme.textMuted;
        ctx.fillText(card.level.bricks.length + '\u2009\u7816', card.x + card.w / 2, card.y + card.h - 10);
      } else {
        ctx.font = '28px sans-serif';
        ctx.fillStyle = Theme.card.textLocked;
        ctx.fillText('\ud83d\udd12', card.x + card.w / 2, card.y + 90);
      }

      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Page indicator with decorative dots
    ctx.textAlign = 'center';
    ctx.font = '13px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText(this._pageText, C.SCREEN_W / 2, 430);

    // Buttons
    for (const btn of this._buttons) {
      const isPressed = this._pressedBtn === btn;
      r.drawButton(btn.x, btn.y, btn.w, btn.h, btn.text, { highlighted: isPressed });
    }
  }

  onTap(x, y) {
    for (const card of this._levelCards) {
      if (card.unlocked &&
          x >= card.x && x <= card.x + card.w &&
          y >= card.y && y <= card.y + card.h) {
        this._game.stateMachine.transition('PLAYING', {
          level: card.level,
          levelIndex: card.levelIdx,
        });
        return;
      }
    }

    for (const btn of this._buttons) {
      if (x >= btn.x && x <= btn.x + btn.w &&
          y >= btn.y && y <= btn.y + btn.h) {
        this._pressedBtn = btn;
        this._pressTimer = 0.12;
        switch (btn.action) {
          case 'prevPage':
            this._page--;
            this._enterTime = 0;
            this._buildPage();
            break;
          case 'nextPage':
            this._page++;
            this._enterTime = 0;
            this._buildPage();
            break;
          case 'back':
            this._game.stateMachine.transition('MENU');
            break;
        }
      }
    }
  }

  onMove() {}
}
