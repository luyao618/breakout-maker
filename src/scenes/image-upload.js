// src/scenes/image-upload.js
// Provides: ImageUploadScene
// Depends: C, Theme, BrickMapper

class ImageUploadScene {

  constructor(game) {
    this._game = game;
    this._buttons = [];
    this._imageData = null;
    this._previewLevel = null;
    this._status = 'idle';
    this._statusText = '\u9009\u62e9\u4e00\u5f20\u56fe\u7247\u6765\u751f\u6210\u50cf\u7d20\u5173\u5361';
    this._fileInput = null;
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._processingDots = 0;
    this._processingTimer = 0;
    this._enterTime = 0;
  }

  enter() {
    this._imageData = null;
    this._previewLevel = null;
    this._status = 'idle';
    this._statusText = '\u9009\u62e9\u4e00\u5f20\u56fe\u7247\u6765\u751f\u6210\u50cf\u7d20\u5173\u5361';
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._processingDots = 0;
    this._processingTimer = 0;
    this._enterTime = 0;
    this._buildButtons();
    this._ensureFileInput();
  }

  exit() {}

  _buildButtons() {
    const cx = C.SCREEN_W / 2;
    if (this._status === 'ready') {
      this._buttons = [
        { x: cx - 110, y: 250, w: 220, h: 50, text: '\u6362\u4e00\u5f20',   action: 'pick' },
        { x: cx - 110, y: 440, w: 220, h: 50, text: '\u5f00\u59cb\u6e38\u620f', action: 'play' },
        { x: cx - 110, y: 510, w: 220, h: 50, text: '\u8fd4\u56de',     action: 'back' },
      ];
    } else {
      this._buttons = [
        { x: cx - 110, y: 280, w: 220, h: 50, text: '\u9009\u62e9\u56fe\u7247', action: 'pick' },
        { x: cx - 110, y: 510, w: 220, h: 50, text: '\u8fd4\u56de',     action: 'back' },
      ];
    }
  }

  _ensureFileInput() {
    if (this._fileInput) return;
    this._fileInput = document.createElement('input');
    this._fileInput.type = 'file';
    this._fileInput.accept = 'image/*';
    this._fileInput.style.display = 'none';
    document.body.appendChild(this._fileInput);
    this._fileInput.addEventListener('change', (e) => this._handleFile(e));
  }

  _handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    this._status = 'processing';
    this._statusText = '\u6b63\u5728\u5904\u7406\u56fe\u7247';
    this._processingDots = 0;
    this._processingTimer = 0;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        const gridW = 56, gridH = 40;
        const aspect = img.width / img.height;
        const targetAspect = gridW / gridH;
        let sw, sh, sx, sy;
        if (aspect > targetAspect) {
          sh = img.height; sw = sh * targetAspect;
          sx = (img.width - sw) / 2; sy = 0;
        } else {
          sw = img.width; sh = sw / targetAspect;
          sx = 0; sy = (img.height - sh) / 2;
        }
        const oc = document.createElement('canvas');
        oc.width = gridW * 4; oc.height = gridH * 4;
        const octx = oc.getContext('2d');
        octx.drawImage(img, sx, sy, sw, sh, 0, 0, oc.width, oc.height);
        const imageData = octx.getImageData(0, 0, oc.width, oc.height);
        this._previewLevel = BrickMapper.imageToLevel(imageData, gridW, gridH);
        this._status = 'ready';
        this._statusText = '\u5df2\u751f\u6210\u5173\u5361: ' + this._previewLevel.bricks.length + ' \u4e2a\u7816\u5757';
        this._buildButtons();
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  update(dt) {
    this._enterTime += dt;
    if (this._pressTimer > 0) {
      this._pressTimer -= dt;
      if (this._pressTimer <= 0) this._pressedBtn = null;
    }
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
    r.drawTitle('\u56fe\u7247\u5173\u5361', 58, 26);
    r.drawOrnament(78, 140);

    // Status text
    ctx.textAlign = 'center';
    ctx.font = '13px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textSecondary;

    if (this._status === 'processing') {
      const dots = '.'.repeat(this._processingDots);
      const alpha = Math.sin(Date.now() / 300) * 0.2 + 0.8;
      ctx.globalAlpha = alpha;
      ctx.fillText(this._statusText + dots, C.SCREEN_W / 2, 200);
      ctx.globalAlpha = 1;

      // Animated processing indicator
      this._drawLoadingSpinner(ctx, C.SCREEN_W / 2, 240);
    } else if (this._status === 'idle') {
      // Icon for upload prompt
      ctx.font = '40px sans-serif';
      ctx.fillStyle = Theme.textSecondary;
      ctx.globalAlpha = 0.4;
      ctx.fillText('\ud83d\uddbc\ufe0f', C.SCREEN_W / 2, 210);
      ctx.globalAlpha = 1;

      ctx.font = '13px "Avenir Next", "Segoe UI", sans-serif';
      ctx.fillStyle = Theme.textSecondary;
      ctx.fillText(this._statusText, C.SCREEN_W / 2, 250);
    } else {
      ctx.fillText(this._statusText, C.SCREEN_W / 2, 200);
    }

    if (this._previewLevel) {
      this._renderPreview(ctx);
    }

    for (const btn of this._buttons) {
      const isPressed = this._pressedBtn === btn;
      r.drawButton(btn.x, btn.y, btn.w, btn.h, btn.text, { highlighted: isPressed });
    }
  }

  _drawLoadingSpinner(ctx, x, y) {
    const t = Date.now() / 1000;
    ctx.save();
    ctx.translate(x, y);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + t * 3;
      const alpha = ((i + Math.floor(t * 8)) % 8) / 8;
      ctx.globalAlpha = 0.2 + alpha * 0.6;
      ctx.fillStyle = Theme.accent;
      const dx = Math.cos(angle) * 12;
      const dy = Math.sin(angle) * 12;
      ctx.beginPath();
      ctx.arc(dx, dy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _renderPreview(ctx) {
    const level = this._previewLevel;
    const previewW = C.SCREEN_W - 40;
    const previewH = Math.round(previewW * (level.gridHeight / level.gridWidth));
    const previewX = 20;
    const previewY = 310;

    // Label
    ctx.textAlign = 'center';
    ctx.font = '10px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText('PREVIEW', C.SCREEN_W / 2, previewY - 10);

    // Border with corner brackets
    const r = this._game.renderer;
    r.drawCornerBrackets(previewX - 2, previewY - 2, previewW + 4, previewH + 4, 8);

    // Dark background
    ctx.fillStyle = Theme.bg;
    ctx.fillRect(previewX, previewY, previewW, previewH);

    // Bricks
    const bw = previewW / level.gridWidth;
    const bh = previewH / level.gridHeight;
    for (const b of level.bricks) {
      ctx.fillStyle = b.color || Theme.accent;
      ctx.fillRect(previewX + b.col * bw + 0.5, previewY + b.row * bh + 0.5, bw - 1, bh - 1);
    }

    // Mini paddle
    const pw = 30, ph = 4;
    ctx.fillStyle = Theme.accent;
    ctx.beginPath();
    ctx.roundRect(previewX + previewW / 2 - pw / 2, previewY + previewH - ph - 3, pw, ph, 2);
    ctx.fill();
  }

  onTap(x, y) {
    for (const btn of this._buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this._pressedBtn = btn;
        this._pressTimer = 0.12;
        switch (btn.action) {
          case 'pick':
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
        return;
      }
    }
  }

  onMove() {}
}
