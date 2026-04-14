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
    this._unlockedLevels = 1; // level 1 unlocked by default
    this._pressedBtn = null;  // track pressed button for tap feedback
    this._pressTimer = 0;
  }

  enter() {
    this._unlockedLevels = this._game.unlockedLevels || 1;
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._buildPage();
  }

  exit() {}

  /** Rebuild card list & navigation for the current page. */
  _buildPage() {
    const perPage    = 6;
    const total      = getTotalLevels();
    const totalPages = Math.ceil(total / perPage);
    const start      = this._page * perPage;

    this._levelCards = [];
    this._buttons    = [];

    // --- Level cards in a 3-column × 2-row grid ---
    const cardW = 105, cardH = 120, gapX = 15, gapY = 15;
    const gridStartX = (C.SCREEN_W - 3 * cardW - 2 * gapX) / 2;
    const gridStartY = 100;

    for (let i = 0; i < perPage; i++) {
      const levelIdx = start + i;
      if (levelIdx >= total) break;

      const col = i % 3;
      const row = Math.floor(i / 3);
      const x   = gridStartX + col * (cardW + gapX);
      const y   = gridStartY + row * (cardH + gapY);
      const level    = getPresetLevel(levelIdx);
      const unlocked = true;  // All levels accessible

      this._levelCards.push({ x, y, w: cardW, h: cardH, levelIdx, level, unlocked });
    }

    // --- Pagination buttons (fixed: meet 44pt minimum) ---
    const btnY = 380;
    if (this._page > 0) {
      this._buttons.push({
        x: 20, y: btnY, w: 100, h: 48,
        text: '上一页', action: 'prevPage',
      });
    }
    if (this._page < totalPages - 1) {
      this._buttons.push({
        x: C.SCREEN_W - 120, y: btnY, w: 100, h: 48,
        text: '下一页', action: 'nextPage',
      });
    }

    // Page indicator text
    this._pageText = `${this._page + 1} / ${totalPages}`;

    // --- Bottom action button ---
    this._buttons.push({
      x: C.SCREEN_W / 2 - 70, y: 520, w: 140, h: 48,
      text: '返回', action: 'back',
    });
  }

  update(dt) {
    // Tick tap-feedback timer
    if (this._pressTimer > 0) {
      this._pressTimer -= dt;
      if (this._pressTimer <= 0) this._pressedBtn = null;
    }
  }

  render() {
    const r   = this._game.renderer;
    const ctx = r.ctx;

    r.drawBackground();
    r.drawTitle('选择关卡', 60, 28);

    // --- Level cards ---
    for (const card of this._levelCards) {
      const isLocked = !card.unlocked;

      // Card background — warm tones from Theme
      ctx.fillStyle   = isLocked ? Theme.card.bgLocked : Theme.card.bg;
      ctx.strokeStyle = isLocked ? Theme.card.borderLocked : Theme.button.border;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.roundRect(card.x, card.y, card.w, card.h, 8);
      ctx.fill();
      ctx.stroke();

      // Level number
      ctx.font      = 'bold 22px "Courier New", monospace';
      ctx.fillStyle = isLocked ? Theme.card.textLocked : Theme.accent;
      ctx.textAlign = 'center';
      ctx.fillText(card.levelIdx + 1, card.x + card.w / 2, card.y + 30);

      // Level name (part after the dash, if any)
      ctx.font      = '10px sans-serif';
      ctx.fillStyle = isLocked ? Theme.card.textLocked : Theme.textSecondary;
      ctx.fillText(
        card.level.name.split(' - ')[1] || '',
        card.x + card.w / 2,
        card.y + 50,
      );

      if (!isLocked) {
        // Mini brick preview — using Theme brick colors
        const previewW = card.w - 20;
        const previewH = 40;
        const previewX = card.x + 10;
        const previewY = card.y + 60;
        const dotW = previewW / card.level.gridWidth;
        const dotH = previewH / card.level.gridHeight;

        const hpColors = [
          Theme.brick.hp1[0],
          Theme.brick.hp2[0],
          Theme.brick.hp3[0],
        ];
        for (const b of card.level.bricks) {
          const bx = previewX + b.col * dotW;
          const by = previewY + b.row * dotH;
          ctx.fillStyle = (b.hp >= C.IRONCLAD_HP || b.hp >= 999)
            ? Theme.brick.iron[0]
            : (hpColors[Math.min(b.hp - 1, 2)] || hpColors[0]);
          ctx.fillRect(bx, by, Math.max(1, dotW - 0.5), Math.max(1, dotH - 0.5));
        }
      } else {
        // Lock icon for locked levels
        ctx.font      = '30px sans-serif';
        ctx.fillStyle = Theme.card.textLocked;
        ctx.fillText('🔒', card.x + card.w / 2, card.y + 85);
      }
    }

    // Page indicator
    r.drawSubtitle(this._pageText, 420, 14);

    // Navigation & action buttons — with tap feedback
    for (const btn of this._buttons) {
      const isPressed = this._pressedBtn === btn;
      r.drawButton(btn.x, btn.y, btn.w, btn.h, btn.text, { highlighted: isPressed });
    }
  }

  onTap(x, y) {
    // Check level cards first
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

    // Then check buttons — with tap feedback
    for (const btn of this._buttons) {
      if (x >= btn.x && x <= btn.x + btn.w &&
          y >= btn.y && y <= btn.y + btn.h) {
        this._pressedBtn = btn;
        this._pressTimer = 0.12;
        switch (btn.action) {
          case 'prevPage':
            this._page--;
            this._buildPage();
            break;
          case 'nextPage':
            this._page++;
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
