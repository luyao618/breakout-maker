// src/scenes/image-upload.js
// Provides: ImageUploadScene
// Depends: C, Theme, BrickMapper

class ImageUploadScene {

  constructor(game) {
    this._game = game;
    this._buttons = [];
    this._imageData = null;
    this._previewLevel = null;
    this._status = 'idle';            // 'idle' | 'processing' | 'ready'
    this._statusText = '选择一张图片来生成像素关卡';
    this._fileInput = null;
    this._pressedBtn = null;          // tap feedback tracking
    this._pressTimer = 0;
    this._processingDots = 0;         // animated dots counter
    this._processingTimer = 0;
  }

  // --- Lifecycle ---

  enter() {
    this._imageData = null;
    this._previewLevel = null;
    this._status = 'idle';
    this._statusText = '选择一张图片来生成像素关卡';
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._processingDots = 0;
    this._processingTimer = 0;
    this._buildButtons();
    this._ensureFileInput();
  }

  exit() {
    // Nothing to tear down — the hidden input persists for reuse
  }

  // --- Private helpers ---

  /** Create the initial button layout for the idle state. */
  _buildButtons() {
    const cx = C.SCREEN_W / 2;

    if (this._status === 'ready') {
      this._buttons = [
        { x: cx - 100, y: 250, w: 200, h: 50, text: '换一张',   action: 'pick' },
        { x: cx - 100, y: 440, w: 200, h: 50, text: '开始游戏', action: 'play' },
        { x: cx - 100, y: 510, w: 200, h: 50, text: '返回',     action: 'back' },
      ];
    } else {
      this._buttons = [
        { x: cx - 100, y: 250, w: 200, h: 50, text: '选择图片', action: 'pick' },
        { x: cx - 100, y: 500, w: 200, h: 50, text: '返回',     action: 'back' },
      ];
    }
  }

  /** Lazily create a hidden <input type="file"> element for image selection. */
  _ensureFileInput() {
    if (this._fileInput) return;

    this._fileInput = document.createElement('input');
    this._fileInput.type = 'file';
    this._fileInput.accept = 'image/*';
    this._fileInput.style.display = 'none';
    document.body.appendChild(this._fileInput);
    this._fileInput.addEventListener('change', (e) => this._handleFile(e));
  }

  /**
   * Process the selected file:
   *   1. Read as data-URL
   *   2. Draw to an offscreen canvas (cropped to grid aspect ratio)
   *   3. Extract ImageData and run BrickMapper
   */
  _handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    this._status = 'processing';
    this._statusText = '正在处理图片';
    this._processingDots = 0;
    this._processingTimer = 0;

    const reader = new FileReader();

    reader.onload = (evt) => {
      const img = new Image();

      img.onload = () => {
        const gridW = 56;
        const gridH = 40;

        // Crop the source image to match the grid's aspect ratio
        const aspect = img.width / img.height;
        const targetAspect = gridW / gridH;
        let sw, sh, sx, sy;

        if (aspect > targetAspect) {
          // Image is wider → crop sides
          sh = img.height;
          sw = sh * targetAspect;
          sx = (img.width - sw) / 2;
          sy = 0;
        } else {
          // Image is taller → crop top/bottom
          sw = img.width;
          sh = sw / targetAspect;
          sx = 0;
          sy = (img.height - sh) / 2;
        }

        // Draw to a small offscreen canvas (low-res is intentional)
        const oc = document.createElement('canvas');
        oc.width = gridW * 4;   // 224 px
        oc.height = gridH * 4;  // 160 px
        const octx = oc.getContext('2d');
        octx.drawImage(img, sx, sy, sw, sh, 0, 0, oc.width, oc.height);

        const imageData = octx.getImageData(0, 0, oc.width, oc.height);
        this._previewLevel = BrickMapper.imageToLevel(imageData, gridW, gridH);

        this._status = 'ready';
        this._statusText =
          '已生成关卡: ' + this._previewLevel.bricks.length + ' 个砖块';
        this._buildButtons();
      };

      img.src = evt.target.result;
    };

    reader.readAsDataURL(file);
  }

  // --- Scene interface ---

  update(dt) {
    // Tick tap-feedback timer
    if (this._pressTimer > 0) {
      this._pressTimer -= dt;
      if (this._pressTimer <= 0) this._pressedBtn = null;
    }

    // Animate processing dots
    if (this._status === 'processing') {
      this._processingTimer += dt;
      if (this._processingTimer >= 0.4) {
        this._processingTimer = 0;
        this._processingDots = (this._processingDots + 1) % 4;
      }
    }
  }

  render() {
    const r = this._game.renderer;
    const ctx = r.ctx;

    r.drawBackground();
    r.drawTitle('图片关卡', 60, 28);

    // Status / instruction text
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = Theme.textSecondary;

    if (this._status === 'processing') {
      // Animated processing text with pulsing dots
      const dots = '.'.repeat(this._processingDots);
      const alpha = Math.sin(Date.now() / 300) * 0.2 + 0.8;
      ctx.globalAlpha = alpha;
      ctx.fillText(this._statusText + dots, C.SCREEN_W / 2, 200);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillText(this._statusText, C.SCREEN_W / 2, 200);
    }

    // Mini brick preview (only when a level has been generated)
    if (this._previewLevel) {
      this._renderPreview(ctx);
    }

    // Buttons with tap feedback
    for (const btn of this._buttons) {
      const isPressed = this._pressedBtn === btn;
      r.drawButton(btn.x, btn.y, btn.w, btn.h, btn.text, { highlighted: isPressed });
    }
  }

  /** Draw a miniature representation of the generated brick layout. */
  _renderPreview(ctx) {
    const level = this._previewLevel;
    const previewW = C.SCREEN_W - 40;
    // Maintain grid aspect ratio in the preview
    const previewH = Math.round(previewW * (level.gridHeight / level.gridWidth));
    const previewX = 20;
    const previewY = 300;

    // Preview label
    ctx.textAlign = 'center';
    ctx.font = '12px sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText('关卡预览', C.SCREEN_W / 2, previewY - 8);

    // Border
    ctx.strokeStyle = Theme.button.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(previewX - 1, previewY - 1, previewW + 2, previewH + 2);

    // Dark background
    ctx.fillStyle = Theme.bg;
    ctx.fillRect(previewX, previewY, previewW, previewH);

    // Individual bricks
    const bw = previewW / level.gridWidth;
    const bh = previewH / level.gridHeight;

    for (const b of level.bricks) {
      ctx.fillStyle = b.color || Theme.accent;
      ctx.fillRect(
        previewX + b.col * bw + 0.5,
        previewY + b.row * bh + 0.5,
        bw - 1,
        bh - 1
      );
    }

    // Mini paddle at the bottom of the preview
    const paddleW = 30;
    const paddleH = 4;
    const paddleX = previewX + previewW / 2 - paddleW / 2;
    const paddleY = previewY + previewH - paddleH - 3;
    ctx.fillStyle = Theme.accent;
    ctx.beginPath();
    ctx.roundRect(paddleX, paddleY, paddleW, paddleH, 2);
    ctx.fill();
  }

  // --- Input ---

  onTap(x, y) {
    for (const btn of this._buttons) {
      if (
        x >= btn.x && x <= btn.x + btn.w &&
        y >= btn.y && y <= btn.y + btn.h
      ) {
        this._pressedBtn = btn;
        this._pressTimer = 0.12;

        switch (btn.action) {
          case 'pick':
            // Reset value so re-selecting the same file still fires 'change'
            this._fileInput.value = '';
            this._fileInput.click();
            break;

          case 'play':
            if (this._previewLevel) {
              this._game.stateMachine.transition('PLAYING', {
                level: this._previewLevel,
                levelIndex: -1,
              });
            }
            break;

          case 'back':
            this._game.stateMachine.transition('MENU');
            break;
        }
        return; // only process the first matching button
      }
    }
  }

  onMove(/* x, y */) {
    // No hover behaviour in this scene
  }
}
