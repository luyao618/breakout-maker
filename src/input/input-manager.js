// src/input/input-manager.js
// Provides: InputManager
// Depends: C

class InputManager {

  constructor(canvas, game) {
    this._game = game;
    this._canvas = canvas;
    this._firstFingerId = null;   // track only one finger at a time

    // --- Mouse events ---
    canvas.addEventListener('mousedown', (e) => {
      this._onDown(e.clientX, e.clientY);
    });
    canvas.addEventListener('mousemove', (e) => {
      this._onMove(e.clientX, e.clientY);
    });

    // --- Touch events ---
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this._firstFingerId = t.identifier;
      this._onDown(t.clientX, t.clientY);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this._firstFingerId) {
          this._onMove(t.clientX, t.clientY);
          break;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._firstFingerId) {
          this._firstFingerId = null;
          break;
        }
      }
    });
  }

  // --- Coordinate conversion ---

  /**
   * Map a viewport-space (client) coordinate pair to game-space coordinates,
   * accounting for any CSS scaling applied to the canvas element.
   */
  _toGame(clientX, clientY) {
    const rect = this._canvas.getBoundingClientRect();
    const scaleX = C.SCREEN_W / rect.width;
    const scaleY = C.SCREEN_H / rect.height;
    return [
      (clientX - rect.left) * scaleX,
      (clientY - rect.top)  * scaleY,
    ];
  }

  // --- Event dispatch ---

  _onDown(clientX, clientY) {
    const [x, y] = this._toGame(clientX, clientY);
    const scene = this._game.stateMachine.getActiveScene();
    if (scene && scene.onTap) scene.onTap(x, y);
  }

  _onMove(clientX, clientY) {
    const [x, y] = this._toGame(clientX, clientY);
    const scene = this._game.stateMachine.getActiveScene();
    if (scene && scene.onMove) scene.onMove(x, y);
  }
}
