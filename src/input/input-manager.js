// src/input/input-manager.js
// Provides: InputManager
// Depends: C

class InputManager {

  constructor(canvas, game) {
    this._game = game;
    this._canvas = canvas;
    this._firstFingerId = null;   // track only one finger at a time
    this._touchStartX = null;     // touch start position for tap detection
    this._touchStartY = null;

    // --- Mouse events ---
    canvas.addEventListener('mousedown', (e) => {
      this._onDown(e.clientX, e.clientY);
    });
    canvas.addEventListener('mousemove', (e) => {
      this._onMove(e.clientX, e.clientY);
    });

    // --- Touch events ---
    // touchstart: only track the finger and start move tracking.
    // Do NOT call onTap here — defer to touchend so that
    // programmatic clicks (file input) and AudioContext.resume()
    // are allowed by mobile Safari's security policy.
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this._firstFingerId = t.identifier;
      this._touchStartX = t.clientX;
      this._touchStartY = t.clientY;
      // Begin move tracking immediately (for paddle movement)
      this._onMove(t.clientX, t.clientY);
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

    // touchend: fire the tap action here so that iOS allows
    // programmatic input.click() and AudioContext operations.
    canvas.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._firstFingerId) {
          this._firstFingerId = null;
          // Only fire tap if the finger didn't move far (avoid triggering on drag)
          if (this._touchStartX !== null) {
            const dx = t.clientX - this._touchStartX;
            const dy = t.clientY - this._touchStartY;
            if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
              this._onDown(t.clientX, t.clientY);
            }
          }
          this._touchStartX = null;
          this._touchStartY = null;
          break;
        }
      }
    });

    // touchcancel: clean up tracked state
    canvas.addEventListener('touchcancel', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._firstFingerId) {
          this._firstFingerId = null;
          this._touchStartX = null;
          this._touchStartY = null;
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
