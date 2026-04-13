// src/scenes/paused-scene.js
// Provides: PausedScene
// Depends: C, STATES, getPresetLevel, Renderer

class PausedScene {
  constructor(game) {
    this._game = game;
    this._buttons = [];
  }

  enter() {
    const cx = C.SCREEN_W / 2;
    this._buttons = [
      { x: cx - 100, y: 280, w: 200, h: 48, text: '继续游戏',    action: 'resume' },
      { x: cx - 100, y: 340, w: 200, h: 48, text: '重新开始',   action: 'restart' },
      { x: cx - 100, y: 400, w: 200, h: 48, text: '选择关卡',   action: 'levelSelect' },
      { x: cx - 100, y: 460, w: 200, h: 48, text: '返回主菜单', action: 'menu' },
    ];
  }

  exit() {}

  update(dt) {}

  render() {
    // Draw the game scene underneath (frozen snapshot)
    const gameScene = this._game.stateMachine._scenes[STATES.PLAYING];
    if (gameScene && gameScene.brickField) gameScene.render();

    const r = this._game.renderer;

    // Semi-transparent dark overlay
    r.drawOverlay(0.75);

    // Title
    r.drawTitle('暂停', 220, 32);

    // Buttons
    for (const btn of this._buttons) {
      r.drawButton(btn.x, btn.y, btn.w, btn.h, btn.text);
    }
  }

  onTap(x, y) {
    for (const btn of this._buttons) {
      if (x >= btn.x && x <= btn.x + btn.w &&
          y >= btn.y && y <= btn.y + btn.h) {
        switch (btn.action) {

          case 'resume':
            this._game.stateMachine.transition('PLAYING');
            break;

          case 'restart': {
            // Transition back to PLAYING, then re-enter with same level
            const gameScene = this._game.stateMachine._scenes[STATES.PLAYING];
            this._game.stateMachine.transition('PLAYING');
            if (gameScene) {
              const idx = gameScene.levelIndex;
              gameScene.exit(false);
              gameScene.enter({ level: getPresetLevel(idx), levelIndex: idx });
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
