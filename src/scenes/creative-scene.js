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
    this._status = 'idle';           // 'idle' | 'inputting' | 'generating' | 'ready' | 'error'
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
    this._tags = ['城堡', '心形', '星空', '笑脸', '迷宫', '钻石', '随机'];
    this._randomPool = [
      '城堡', '心形', '星空', '笑脸', '迷宫', '钻石',
      '彩虹', '火箭', '小猫', '机器人', '雪花', '音符', '皇冠', '闪电',
    ];
  }

  // --- Lifecycle ---

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
    this._buildButtons();
    this._ensureDOMElements();
    this._hideDOMElements();
  }

  exit() {
    this._hideDOMElements();
  }

  // --- Private helpers ---

  _buildButtons() {
    const cx = C.SCREEN_W / 2;
    switch (this._status) {
      case 'idle':
        this._buttons = [
          { x: cx - 100, y: 440, w: 200, h: 50, text: '输入描述', action: 'input' },
          { x: cx - 100, y: 510, w: 200, h: 50, text: '返回',     action: 'back' },
        ];
        break;
      case 'inputting': // fall-through
      case 'generating':
        this._buttons = [];
        break;
      case 'ready':
        this._buttons = [
          { x: cx - 100, y: 490, w: 200, h: 50, text: '开始游戏', action: 'play' },
          { x: cx - 100, y: 550, w: 200, h: 44, text: '再造一次', action: 'regenerate' },
          { x: cx - 100, y: 602, w: 100, h: 40, text: '修改描述', action: 'edit' },
          { x: cx + 10,  y: 602, w: 90,  h: 40, text: '返回',     action: 'back' },
        ];
        break;
      case 'error':
        this._buttons = [
          { x: cx - 100, y: 440, w: 200, h: 50, text: '重试', action: 'retry' },
          { x: cx - 100, y: 510, w: 200, h: 50, text: '返回', action: 'back' },
        ];
        break;
    }
  }

  _ensureDOMElements() {
    if (this._textarea) return;

    const ta = document.createElement('textarea');
    ta.maxLength = 140;
    ta.placeholder = '例如: 一座城堡';
    Object.assign(ta.style, {
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      width: '280px', height: '80px',
      background: '#2a1a0e', color: '#f0e0c0',
      border: '2px solid #d4a24e', borderRadius: '8px',
      padding: '10px', fontSize: '16px', fontFamily: 'sans-serif',
      resize: 'none', outline: 'none', display: 'none',
      zIndex: '1000', boxSizing: 'border-box',
    });
    document.body.appendChild(ta);
    this._textarea = ta;

    const btn = document.createElement('button');
    btn.textContent = '确定';
    Object.assign(btn.style, {
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      width: '280px', height: '44px',
      background: '#3a2a18', color: '#f0e0c0',
      border: '2px solid #d4a24e', borderRadius: '8px',
      fontSize: '16px', fontFamily: 'sans-serif', cursor: 'pointer',
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
      this._textarea.style.borderColor = '#ff4444';
      setTimeout(() => { if (this._textarea) this._textarea.style.borderColor = '#d4a24e'; }, 500);
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
          throw new Error('服务器返回了无效的关卡数据');
        }
        this._previewLevel = _applyColors(data);
        this._status = 'ready';
        this._statusText = '已铸造: ' + data.bricks.length + ' 个砖块';
        this._buildButtons();
        return; // success — exit loop
      } catch (err) {
        if (attempt === 0) {
          // First failure — retry silently
          this._generateStartTime = Date.now();
          continue;
        }
        // Second failure — show error
        this._status = 'error';
        this._statusText = err.name === 'AbortError'
          ? '铸造超时，请重试'
          : '铸造失败: ' + (err.message || '请重试');
      }
    }
    this._buildButtons();
  }

  // --- Scene interface ---

  update(dt) {
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
    r.drawTitle('创造模式', 60, 28);

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
    r.drawPulseSubtitle('描述你想要的砖块图案', 110, 14);
    this._renderTags(r, ctx);
  }

  _renderInputting(r, ctx) {
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText('输入你的创意描述', C.SCREEN_W / 2, 110);
    const remaining = 140 - (this._textarea ? this._textarea.value.length : 0);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = Theme.textMuted;
    ctx.fillText('剩余 ' + remaining + ' 字', C.SCREEN_W / 2, 290);
  }

  _renderGenerating(r, ctx) {
    const elapsed = (Date.now() - this._generateStartTime) / 1000;
    const dots = '.'.repeat(this._processingDots);

    ctx.textAlign = 'center';
    ctx.font = '16px sans-serif';
    ctx.fillStyle = Theme.textPrimary;
    ctx.globalAlpha = Math.sin(Date.now() / 300) * 0.2 + 0.8;
    ctx.fillText('正在铸造你的关卡' + dots, C.SCREEN_W / 2, 200);
    ctx.globalAlpha = 1;

    let phase = elapsed < 1.5 ? '解读描述...' : elapsed < 3 ? '设计布局...' : '铸造砖块...';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText(phase, C.SCREEN_W / 2, 240);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = Theme.accent;
    ctx.fillText('「' + this._promptText + '」', C.SCREEN_W / 2, 300);
  }

  _renderReady(r, ctx) {
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = Theme.accent;
    ctx.fillText('「' + this._promptText + '」', C.SCREEN_W / 2, 100);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText('关卡预览', C.SCREEN_W / 2, 130);

    if (this._previewLevel) this._renderPreview(ctx, 140);

    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText(this._statusText, C.SCREEN_W / 2, 470);
  }

  _renderError(r, ctx) {
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = Theme.accent2;
    ctx.fillText(this._statusText, C.SCREEN_W / 2, 300);
    if (this._promptText) {
      ctx.font = '13px sans-serif';
      ctx.fillStyle = Theme.textSecondary;
      ctx.fillText('「' + this._promptText + '」', C.SCREEN_W / 2, 340);
    }
  }

  _renderTags(r, ctx) {
    const tagY = 320, tagH = 34, gap = 8;
    ctx.font = '13px sans-serif';
    const widths = this._tags.map(t => ctx.measureText(t).width + 24);
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (this._tags.length - 1);
    let x = (C.SCREEN_W - totalW) / 2;

    this._tagRects = [];
    for (let i = 0; i < this._tags.length; i++) {
      const tw = widths[i];
      ctx.fillStyle = Theme.button.bg;
      ctx.beginPath();
      ctx.roundRect(x, tagY, tw, tagH, tagH / 2);
      ctx.fill();
      ctx.strokeStyle = Theme.button.border;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = Theme.button.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this._tags[i], x + tw / 2, tagY + tagH / 2);
      this._tagRects[i] = { x, y: tagY, w: tw, h: tagH };
      x += tw + gap;
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

    ctx.strokeStyle = Theme.button.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(previewX - 1, startY - 1, previewW + 2, previewH + 2);
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

  // --- Input ---

  onTap(x, y) {
    // Tag taps (only in idle state)
    if (this._status === 'idle' && this._tagRects.length) {
      for (let i = 0; i < this._tagRects.length; i++) {
        const tr = this._tagRects[i];
        if (x >= tr.x && x <= tr.x + tr.w && y >= tr.y && y <= tr.y + tr.h) {
          if (typeof audio !== 'undefined') { audio.init(); audio.playClick(); }
          let chosen = this._tags[i];
          if (chosen === '随机') {
            chosen = this._randomPool[Math.floor(Math.random() * this._randomPool.length)];
          }
          this._promptText = chosen;
          if (this._textarea) this._textarea.value = chosen;
          this._handleGenerate();
          return;
        }
      }
    }

    // Button taps
    for (const btn of this._buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this._pressedBtn = btn;
        this._pressTimer = 0.12;
        if (typeof audio !== 'undefined') { audio.init(); audio.playClick(); }

        switch (btn.action) {
          case 'input': // fall-through
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
          case 'regenerate': // fall-through
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
