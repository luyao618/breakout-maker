// src/scenes/result-scene.js
// Provides: ResultScene
// Depends: C, Theme, getPresetLevel, audio

/**
 * Reusable result scene. Instantiate once for 'WIN' and once for 'LOSE'.
 * On WIN it also unlocks the next level.
 */
class ResultScene {
  /**
   * @param {object} game  – game controller reference
   * @param {'WIN'|'LOSE'} type – which result variant to display
   */
  constructor(game, type) {
    this._game = game;
    this._type = type;
    this._data = null;
    this._buttons = [];
  }

  enter(data) {
    this._data = data || {};
    const cx = C.SCREEN_W / 2;

    // Play win/lose sound
    if (typeof audio !== 'undefined') {
      if (this._type === 'WIN') audio.playWin();
      else audio.playGameOver();
    }

    if (this._type === 'WIN') {
      // Unlock the next level (if not already)
      const nextIdx = (this._data.levelIndex || 0) + 1;
      if (nextIdx + 1 > (this._game.unlockedLevels || 1)) {
        this._game.unlockedLevels = nextIdx + 1;
      }

      this._buttons = [
        { x: cx - 100, y: 380, w: 200, h: 48, text: '下一关',    action: 'next' },
        { x: cx - 100, y: 440, w: 200, h: 48, text: '选择关卡', action: 'levelSelect' },
        { x: cx - 100, y: 500, w: 200, h: 48, text: '主菜单',   action: 'menu' },
      ];
    } else {
      this._buttons = [
        { x: cx - 100, y: 380, w: 200, h: 48, text: '重试',     action: 'retry' },
        { x: cx - 100, y: 440, w: 200, h: 48, text: '选择关卡', action: 'levelSelect' },
        { x: cx - 100, y: 500, w: 200, h: 48, text: '主菜单',   action: 'menu' },
      ];
    }
  }

  exit() {}

  update(dt) {}

  render() {
    const r   = this._game.renderer;
    const ctx = r.ctx;

    r.drawBackground();

    // Result title
    if (this._type === 'WIN') {
      r.drawTitle('🎉 恭喜通关！', 200, 30);
    } else {
      r.drawTitle('💀 游戏结束', 200, 30);
    }

    // Score display
    ctx.textAlign = 'center';
    ctx.font      = 'bold 24px "Courier New", monospace';
    ctx.fillStyle = Theme.accent;
    ctx.fillText(`得分: ${this._data.score || 0}`, C.SCREEN_W / 2, 280);

    // Level name
    ctx.font      = '14px sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText(this._data.level?.name || '', C.SCREEN_W / 2, 320);

    // Action buttons
    for (const btn of this._buttons) {
      r.drawButton(btn.x, btn.y, btn.w, btn.h, btn.text);
    }
  }

  onTap(x, y) {
    for (const btn of this._buttons) {
      if (x >= btn.x && x <= btn.x + btn.w &&
          y >= btn.y && y <= btn.y + btn.h) {
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
              // No more levels — go back to selection
              this._game.stateMachine.transition('LEVEL_SELECT');
            }
            break;
          }

          case 'retry': {
            const idx = this._data.levelIndex || 0;
            this._game.stateMachine.transition('PLAYING', {
              level: getPresetLevel(idx),
              levelIndex: idx,
            });
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
