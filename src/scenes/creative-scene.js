// src/scenes/creative-scene.js
// Provides: CreativeScene
// Depends: C, Theme, _applyColors, audio

const API_BASE = (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3001'
  : '';

class CreativeScene {

  constructor(game) {
    this._game = game;
    this._buttons = [];
    this._status = 'idle';
    this._statusText = '';
    this._promptText = '';
    this._previewLevel = null;
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._processingDots = 0;
    this._processingTimer = 0;
    this._generateStartTime = 0;
    this._textarea = null;
    this._confirmBtn = null;
    this._tagRects = [];
    this._tags = ['\u57ce\u5821', '\u5fc3\u5f62', '\u661f\u7a7a', '\u7b11\u8138', '\u8ff7\u5bab', '\u94bb\u77f3', '\u968f\u673a'];
    this._randomPool = [
      '\u57ce\u5821', '\u5fc3\u5f62', '\u661f\u7a7a', '\u7b11\u8138', '\u8ff7\u5bab', '\u94bb\u77f3',
      '\u5f69\u8679', '\u706b\u7bad', '\u5c0f\u732b', '\u673a\u5668\u4eba', '\u96ea\u82b1', '\u97f3\u7b26', '\u7687\u51a0', '\u95ea\u7535',
    ];
    this._enterTime = 0;
  }

  enter() {
    this._status = 'idle';
    this._statusText = '';
    this._promptText = '';
    this._previewLevel = null;
    this._pressedBtn = null;
    this._pressTimer = 0;
    this._processingDots = 0;
    this._processingTimer = 0;
    this._generateStartTime = 0;
    this._tagRects = [];
    this._enterTime = 0;
    this._buildButtons();
    this._ensureDOMElements();
    this._hideDOMElements();
  }

  exit() {
    this._hideDOMElements();
  }

  _buildButtons() {
    const cx = C.SCREEN_W / 2;
    switch (this._status) {
      case 'idle':
        this._buttons = [
          { x: cx - 110, y: 440, w: 220, h: 50, text: '\u2726  \u8f93\u5165\u63cf\u8ff0', action: 'input' },
          { x: cx - 110, y: 510, w: 220, h: 50, text: '\u8fd4\u56de', action: 'back' },
        ];
        break;
      case 'inputting':
      case 'generating':
        this._buttons = [];
        break;
      case 'ready':
        this._buttons = [
          { x: cx - 110, y: 490, w: 220, h: 50, text: '\u5f00\u59cb\u6e38\u620f', action: 'play' },
          { x: cx - 110, y: 550, w: 220, h: 44, text: '\u518d\u9020\u4e00\u6b21', action: 'regenerate' },
          { x: cx - 110, y: 602, w: 106, h: 40, text: '\u4fee\u6539\u63cf\u8ff0', action: 'edit' },
          { x: cx + 4,   y: 602, w: 106, h: 40, text: '\u8fd4\u56de', action: 'back' },
        ];
        break;
      case 'error':
        this._buttons = [
          { x: cx - 110, y: 440, w: 220, h: 50, text: '\u91cd\u8bd5', action: 'retry' },
          { x: cx - 110, y: 510, w: 220, h: 50, text: '\u8fd4\u56de', action: 'back' },
        ];
        break;
    }
  }

  _ensureDOMElements() {
    if (this._textarea) return;

    const ta = document.createElement('textarea');
    ta.maxLength = 140;
    ta.placeholder = '\u4f8b\u5982: \u4e00\u5ea7\u57ce\u5821';
    Object.assign(ta.style, {
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      width: '280px', height: '80px',
      background: '#161225', color: '#f2e8d0',
      border: '2px solid #e8b84a', borderRadius: '10px',
      padding: '12px', fontSize: '16px', fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
      resize: 'none', outline: 'none', display: 'none',
      zIndex: '1000', boxSizing: 'border-box',
    });
    document.body.appendChild(ta);
    this._textarea = ta;

    const btn = document.createElement('button');
    btn.textContent = '\u786e\u5b9a';
    Object.assign(btn.style, {
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      width: '280px', height: '44px',
      background: '#1e1a30', color: '#f2e8d0',
      border: '2px solid #e8b84a', borderRadius: '10px',
      fontSize: '16px', fontFamily: '"Avenir Next", "Segoe UI", sans-serif', cursor: 'pointer',
      display: 'none', zIndex: '1000', boxSizing: 'border-box',
    });
    btn.addEventListener('click', () => this._onConfirmInput());
    document.body.appendChild(btn);
    this._confirmBtn = btn;
  }

  _showDOMElements() {
    if (!this._textarea) return;
    const rect = this._game.canvas.getBoundingClientRect();
    const scale = rect.width / C.SCREEN_W;
    const taTop = rect.top + 160 * scale;
    this._textarea.style.top = taTop + 'px';
    this._textarea.style.display = 'block';
    this._textarea.value = this._promptText;
    this._textarea.focus();
    this._confirmBtn.style.top = (taTop + 90 * scale) + 'px';
    this._confirmBtn.style.display = 'block';
  }

  _hideDOMElements() {
    if (this._textarea) { this._textarea.style.display = 'none'; this._textarea.blur(); }
    if (this._confirmBtn) this._confirmBtn.style.display = 'none';
  }

  _onConfirmInput() {
    const text = (this._textarea.value || '').trim();
    if (!text) {
      this._textarea.style.borderColor = '#e04050';
      setTimeout(() => { if (this._textarea) this._textarea.style.borderColor = '#e8b84a'; }, 500);
      return;
    }
    this._promptText = text;
    this._hideDOMElements();
    this._handleGenerate();
  }

  async _handleGenerate() {
    if (this._status === 'generating') return;
    this._status = 'generating';
    this._tagRects = [];
    this._generateStartTime = Date.now();
    this._processingDots = 0;
    this._processingTimer = 0;
    this._buildButtons();

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);
        const response = await fetch(API_BASE + '/api/generate-level', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: this._promptText }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || 'HTTP ' + response.status);
        }
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (!data.gridWidth || !data.gridHeight || !Array.isArray(data.bricks) || data.bricks.length === 0) {
          throw new Error('\u670d\u52a1\u5668\u8fd4\u56de\u4e86\u65e0\u6548\u7684\u5173\u5361\u6570\u636e');
        }
        this._previewLevel = _applyColors(data);
        this._status = 'ready';
        this._statusText = '\u5df2\u94f8\u9020: ' + data.bricks.length + ' \u4e2a\u7816\u5757';
        this._buildButtons();
        return;
      } catch (err) {
        if (attempt === 0) {
          this._generateStartTime = Date.now();
          continue;
        }
        this._status = 'error';
        this._statusText = err.name === 'AbortError'
          ? '\u94f8\u9020\u8d85\u65f6\uff0c\u8bf7\u91cd\u8bd5'
          : '\u94f8\u9020\u5931\u8d25: ' + (err.message || '\u8bf7\u91cd\u8bd5');
      }
    }
    this._buildButtons();
  }

  update(dt) {
    this._enterTime += dt;
    if (this._pressTimer > 0) {
      this._pressTimer -= dt;
      if (this._pressTimer <= 0) this._pressedBtn = null;
    }
    if (this._status === 'generating') {
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
    r.drawTitle('\u521b\u9020\u6a21\u5f0f', 58, 26);
    r.drawOrnament(78, 140);

    switch (this._status) {
      case 'idle':       this._renderIdle(r, ctx);       break;
      case 'inputting':  this._renderInputting(r, ctx);  break;
      case 'generating': this._renderGenerating(r, ctx); break;
      case 'ready':      this._renderReady(r, ctx);      break;
      case 'error':      this._renderError(r, ctx);      break;
    }

    for (const btn of this._buttons) {
      r.drawButton(btn.x, btn.y, btn.w, btn.h, btn.text, {
        highlighted: this._pressedBtn === btn,
      });
    }
  }

  _renderIdle(r, ctx) {
    // Large decorative icon
    ctx.textAlign = 'center';
    ctx.font = '44px sans-serif';
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = Theme.accent;
    ctx.fillText('\u2728', C.SCREEN_W / 2, 160);
    ctx.globalAlpha = 1;

    r.drawPulseSubtitle('\u63cf\u8ff0\u4f60\u60f3\u8981\u7684\u7816\u5757\u56fe\u6848', 200, 14);

    // Subtitle
    ctx.font = '11px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textMuted;
    ctx.fillText('\u70b9\u51fb\u6807\u7b7e\u5feb\u901f\u5f00\u59cb\uff0c\u6216\u8f93\u5165\u81ea\u5b9a\u4e49\u63cf\u8ff0', C.SCREEN_W / 2, 225);

    this._renderTags(r, ctx);
  }

  _renderInputting(r, ctx) {
    ctx.textAlign = 'center';
    ctx.font = '14px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText('\u8f93\u5165\u4f60\u7684\u521b\u610f\u63cf\u8ff0', C.SCREEN_W / 2, 110);
    const remaining = 140 - (this._textarea ? this._textarea.value.length : 0);
    ctx.font = '11px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textMuted;
    ctx.fillText('\u5269\u4f59 ' + remaining + ' \u5b57', C.SCREEN_W / 2, 290);
  }

  _renderGenerating(r, ctx) {
    const elapsed = (Date.now() - this._generateStartTime) / 1000;
    const dots = '.'.repeat(this._processingDots);

    // Animated forge/forge spinner
    this._drawForgeAnimation(ctx, C.SCREEN_W / 2, 180, elapsed);

    ctx.textAlign = 'center';
    ctx.font = '15px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textPrimary;
    ctx.globalAlpha = Math.sin(Date.now() / 300) * 0.2 + 0.8;
    ctx.fillText('\u6b63\u5728\u94f8\u9020\u4f60\u7684\u5173\u5361' + dots, C.SCREEN_W / 2, 240);
    ctx.globalAlpha = 1;

    let phase = elapsed < 1.5 ? '\u89e3\u8bfb\u63cf\u8ff0...' : elapsed < 3 ? '\u8bbe\u8ba1\u5e03\u5c40...' : '\u94f8\u9020\u7816\u5757...';
    ctx.font = '12px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText(phase, C.SCREEN_W / 2, 270);

    // Progress bar
    const barW = 200, barH = 3;
    const barX = (C.SCREEN_W - barW) / 2;
    const barY = 290;
    ctx.fillStyle = 'rgba(232,184,74,0.15)';
    ctx.fillRect(barX, barY, barW, barH);
    const progress = Math.min(1, elapsed / 10);
    ctx.fillStyle = Theme.accent;
    ctx.fillRect(barX, barY, barW * progress, barH);

    ctx.font = '12px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.accent;
    ctx.fillText('\u300c' + this._promptText + '\u300d', C.SCREEN_W / 2, 330);
  }

  _drawForgeAnimation(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);

    // Rotating ring of dots
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 - t * 2;
      const alpha = ((i + Math.floor(t * 12)) % 12) / 12;
      ctx.globalAlpha = 0.15 + alpha * 0.6;
      ctx.fillStyle = Theme.accent;
      const dx = Math.cos(angle) * 20;
      const dy = Math.sin(angle) * 20;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-1.5, -1.5, 3, 3);
      ctx.restore();
    }

    // Center pulsing diamond
    const pulse = Math.sin(t * 4) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = Theme.accent;
    ctx.save();
    ctx.rotate(Math.PI / 4 + t * 0.5);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _renderReady(r, ctx) {
    ctx.textAlign = 'center';
    ctx.font = '13px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.accent;
    ctx.fillText('\u300c' + this._promptText + '\u300d', C.SCREEN_W / 2, 100);

    ctx.font = '10px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText('\u9884\u89c8', C.SCREEN_W / 2, 125);

    if (this._previewLevel) this._renderPreview(ctx, 140);

    ctx.textAlign = 'center';
    ctx.font = '12px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText(this._statusText, C.SCREEN_W / 2, 470);
  }

  _renderError(r, ctx) {
    // Error icon
    ctx.textAlign = 'center';
    ctx.font = '36px sans-serif';
    ctx.globalAlpha = 0.4;
    ctx.fillText('\u26a0\ufe0f', C.SCREEN_W / 2, 260);
    ctx.globalAlpha = 1;

    ctx.font = '13px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.accent2;
    ctx.fillText(this._statusText, C.SCREEN_W / 2, 310);
    if (this._promptText) {
      ctx.font = '12px "Avenir Next", "Segoe UI", sans-serif';
      ctx.fillStyle = Theme.textSecondary;
      ctx.fillText('\u300c' + this._promptText + '\u300d', C.SCREEN_W / 2, 345);
    }
  }

  _renderTags(r, ctx) {
    const tagY = 290, tagH = 36, gapX = 8, gapY = 8;
    ctx.font = '12px "Avenir Next", "Segoe UI", sans-serif';

    // Calculate widths first
    const widths = this._tags.map(t => ctx.measureText(t).width + 28);

    // Flow layout: wrap tags into multiple rows
    const maxRowW = C.SCREEN_W - 40;
    const rows = [];
    let currentRow = [];
    let currentRowW = 0;

    for (let i = 0; i < this._tags.length; i++) {
      const tw = widths[i];
      if (currentRowW + tw + (currentRow.length > 0 ? gapX : 0) > maxRowW && currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [];
        currentRowW = 0;
      }
      currentRow.push({ tag: this._tags[i], width: tw, index: i });
      currentRowW += tw + (currentRow.length > 1 ? gapX : 0);
    }
    if (currentRow.length > 0) rows.push(currentRow);

    this._tagRects = [];
    let y = tagY;

    for (const row of rows) {
      const totalRowW = row.reduce((s, r) => s + r.width, 0) + (row.length - 1) * gapX;
      let x = (C.SCREEN_W - totalRowW) / 2;

      for (const item of row) {
        const tw = item.width;

        // Tag pill with gradient
        const tagGrad = ctx.createLinearGradient(x, y, x, y + tagH);
        tagGrad.addColorStop(0, 'rgba(30,26,48,0.9)');
        tagGrad.addColorStop(1, 'rgba(18,16,30,0.9)');
        ctx.fillStyle = tagGrad;
        ctx.beginPath();
        ctx.roundRect(x, y, tw, tagH, tagH / 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(232,184,74,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = Theme.button.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.tag, x + tw / 2, y + tagH / 2);

        this._tagRects[item.index] = { x, y, w: tw, h: tagH };
        x += tw + gapX;
      }
      y += tagH + gapY;
    }
    ctx.textBaseline = 'alphabetic';
  }

  _renderPreview(ctx, startY) {
    const level = this._previewLevel;
    const previewW = C.SCREEN_W - 40;
    const maxPreviewH = 300;
    const rawH = Math.round(previewW * (level.gridHeight / level.gridWidth));
    const previewH = Math.min(rawH, maxPreviewH);
    const previewX = 20;

    // Corner brackets
    const r = this._game.renderer;
    r.drawCornerBrackets(previewX - 2, startY - 2, previewW + 4, previewH + 4, 8);

    ctx.fillStyle = Theme.bg;
    ctx.fillRect(previewX, startY, previewW, previewH);

    const bw = previewW / level.gridWidth;
    const bh = previewH / level.gridHeight;
    for (const b of level.bricks) {
      ctx.fillStyle = b.color ? (Array.isArray(b.color) ? b.color[0] : b.color) : Theme.accent;
      ctx.fillRect(previewX + b.col * bw + 0.5, startY + b.row * bh + 0.5, bw - 1, bh - 1);
    }

    const pw = 30, ph = 4;
    ctx.fillStyle = Theme.accent;
    ctx.beginPath();
    ctx.roundRect(previewX + previewW / 2 - pw / 2, startY + previewH - ph - 3, pw, ph, 2);
    ctx.fill();
  }

  onTap(x, y) {
    if (this._status === 'idle' && this._tagRects.length) {
      for (let i = 0; i < this._tagRects.length; i++) {
        const tr = this._tagRects[i];
        if (tr && x >= tr.x && x <= tr.x + tr.w && y >= tr.y && y <= tr.y + tr.h) {
          if (typeof audio !== 'undefined') { audio.init(); audio.playClick(); }
          let chosen = this._tags[i];
          if (chosen === '\u968f\u673a') {
            chosen = this._randomPool[Math.floor(Math.random() * this._randomPool.length)];
          }
          this._promptText = chosen;
          if (this._textarea) this._textarea.value = chosen;
          this._handleGenerate();
          return;
        }
      }
    }

    for (const btn of this._buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this._pressedBtn = btn;
        this._pressTimer = 0.12;
        if (typeof audio !== 'undefined') { audio.init(); audio.playClick(); }
        switch (btn.action) {
          case 'input':
          case 'edit':
            this._status = 'inputting';
            this._buildButtons();
            this._showDOMElements();
            break;
          case 'back':
            this._game.stateMachine.transition('MENU');
            break;
          case 'play':
            if (this._previewLevel) {
              this._game.stateMachine.transition('PLAYING', {
                level: this._previewLevel, levelIndex: -1,
              });
            }
            break;
          case 'regenerate':
          case 'retry':
            this._handleGenerate();
            break;
        }
        return;
      }
    }
  }

  onMove() {}
}
