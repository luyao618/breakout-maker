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
  }

  // --- Lifecycle ---

  enter() {
    this._imageData = null;
    this._previewLevel = null;
    this._status = 'idle';
    this._statusText = '选择一张图片来生成像素关卡';
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
    this._statusText = '正在处理图片...';

    const reader = new FileReader();

    reader.onload = (evt) => {
      const img = new Image();

      img.onload = () => {
        const gridW = 40;
        const gridH = 28;

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
        oc.width = gridW * 4;   // 160 px
        oc.height = gridH * 4;  // 112 px
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

  update(/* dt */) {
    // No per-frame logic needed — processing is async via FileReader
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
    ctx.fillText(this._statusText, C.SCREEN_W / 2, 200);

    // Mini brick preview (only when a level has been generated)
    if (this._previewLevel) {
      this._renderPreview(ctx);
    }

    // Buttons
    for (const btn of this._buttons) {
      r.drawButton(btn.x, btn.y, btn.w, btn.h, btn.text);
    }
  }

  /** Draw a miniature representation of the generated brick layout. */
  _renderPreview(ctx) {
    const previewW = C.SCREEN_W - 40;
    const previewH = 140;
    const previewX = 20;
    const previewY = 310;

    // Border
    ctx.strokeStyle = Theme.button.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(previewX - 1, previewY - 1, previewW + 2, previewH + 2);

    // Dark background
    ctx.fillStyle = Theme.bg;
    ctx.fillRect(previewX, previewY, previewW, previewH);

    // Individual bricks
    const level = this._previewLevel;
    const bw = previewW / level.gridWidth;
    const bh = previewH / level.gridHeight;

    for (const b of level.bricks) {
      ctx.fillStyle = b.color || '#44dd88';
      ctx.fillRect(
        previewX + b.col * bw + 0.5,
        previewY + b.row * bh + 0.5,
        bw - 1,
        bh - 1
      );
    }
  }

  // --- Input ---

  onTap(x, y) {
    for (const btn of this._buttons) {
      if (
        x >= btn.x && x <= btn.x + btn.w &&
        y >= btn.y && y <= btn.y + btn.h
      ) {
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
            this._game.stateMachine.transition('LEVEL_SELECT');
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
