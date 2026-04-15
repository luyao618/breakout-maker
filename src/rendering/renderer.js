// src/rendering/renderer.js
// Provides: Starfield, Renderer
// Depends: C, Theme, PowerUpType

// ---- Background Atmosphere: "Astral Dust" ----
// Celestial motes of gold and violet drifting through the void,
// layered with a vignette and subtle grid lines for depth.
class Starfield {
  constructor(screenW, screenH) {
    this.w = screenW;
    this.h = screenH;

    // Particle pool -- gold and violet celestial motes
    const colors = ['#e8b84a', '#d4623a', '#ffaa00', '#9070c0', '#ff8833', '#7a6830'];
    this._particles = [];
    for (let i = 0; i < 100; i++) {
      this._particles.push(this._spawnParticle(colors, true));
    }

    // Pre-render vignette
    this._vignette = document.createElement('canvas');
    this._vignette.width = screenW;
    this._vignette.height = screenH;
    const vCtx = this._vignette.getContext('2d');
    const cx = screenW / 2;
    const cy = screenH / 2;
    const outerR = Math.sqrt(cx * cx + cy * cy);
    const grad = vCtx.createRadialGradient(cx, cy, screenW * 0.25, cx, cy, outerR);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.2)');
    grad.addColorStop(1, 'rgba(0,0,0,0.7)');
    vCtx.fillStyle = grad;
    vCtx.fillRect(0, 0, screenW, screenH);

    // Pre-render subtle grid pattern
    this._gridOverlay = document.createElement('canvas');
    this._gridOverlay.width = screenW;
    this._gridOverlay.height = screenH;
    const gCtx = this._gridOverlay.getContext('2d');
    gCtx.strokeStyle = 'rgba(232,184,74,0.03)';
    gCtx.lineWidth = 0.5;
    const gridSize = 30;
    for (let x = 0; x < screenW; x += gridSize) {
      gCtx.beginPath();
      gCtx.moveTo(x, 0);
      gCtx.lineTo(x, screenH);
      gCtx.stroke();
    }
    for (let y = 0; y < screenH; y += gridSize) {
      gCtx.beginPath();
      gCtx.moveTo(0, y);
      gCtx.lineTo(screenW, y);
      gCtx.stroke();
    }
  }

  _spawnParticle(colors, randomY) {
    const isLarge = Math.random() < 0.15; // 15% chance of larger, slower mote
    return {
      x: Math.random() * this.w,
      y: randomY ? Math.random() * this.h : this.h + Math.random() * 20,
      vy: isLarge ? (3 + Math.random() * 6) : (6 + Math.random() * 14),
      sineAmp: 8 + Math.random() * 18,
      sineSpeed: 0.3 + Math.random() * 1.0,
      sineOffset: Math.random() * Math.PI * 2,
      size: isLarge ? (2 + Math.random() * 2) : (0.8 + Math.random() * 1.5),
      alpha: isLarge ? (0.5 + Math.random() * 0.4) : (0.2 + Math.random() * 0.5),
      color: colors[Math.floor(Math.random() * colors.length)],
      twinkleSpeed: 1 + Math.random() * 3,
    };
  }

  render(ctx, time, intensity = 1) {
    const colors = ['#e8b84a', '#d4623a', '#ffaa00', '#9070c0', '#ff8833', '#7a6830'];

    // Grid overlay (very subtle)
    ctx.globalAlpha = intensity * 0.5;
    ctx.drawImage(this._gridOverlay, 0, 0);
    ctx.globalAlpha = 1;

    // Particles with twinkle effect
    for (const p of this._particles) {
      p.y -= p.vy * 0.016;
      const swayX = Math.sin(time * p.sineSpeed + p.sineOffset) * p.sineAmp;
      if (p.y < -10) {
        Object.assign(p, this._spawnParticle(colors, false));
      }
      // Twinkle: modulate alpha with a sine wave
      const twinkle = Math.sin(time * p.twinkleSpeed + p.sineOffset) * 0.3 + 0.7;
      ctx.globalAlpha = p.alpha * intensity * twinkle;
      ctx.fillStyle = p.color;

      // Draw as a tiny diamond shape for larger motes, square for small
      if (p.size > 2) {
        ctx.save();
        ctx.translate(p.x + swayX, p.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else {
        ctx.fillRect(p.x + swayX - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;

    // Vignette
    ctx.globalAlpha = intensity;
    ctx.drawImage(this._vignette, 0, 0);
    ctx.globalAlpha = 1;
  }
}

// ---- Renderer ----
class Renderer {
  constructor(ctx, screenW, screenH) {
    this.ctx = ctx;
    this.w = screenW;
    this.h = screenH;
    this.starfield = new Starfield(screenW, screenH);
    this._brickCache = null;
    this._brickCacheDirty = true;
    this._time = 0;
  }

  invalidateBrickCache() { this._brickCacheDirty = true; }
  update(dt) { this._time += dt; }

  // ==========================================================
  //  Background
  // ==========================================================
  drawBackground(intensity = 0.3) {
    const ctx = this.ctx;

    // Multi-stop gradient for richer depth
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, Theme.bgGradTop);
    grad.addColorStop(0.4, Theme.bgGradBottom);
    grad.addColorStop(0.7, '#0e0c18');
    grad.addColorStop(1, '#100e1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    // Subtle radial warm glow at center-top (like a distant furnace)
    const glowGrad = ctx.createRadialGradient(
      this.w / 2, -50, 10,
      this.w / 2, -50, this.h * 0.6
    );
    glowGrad.addColorStop(0, 'rgba(232,184,74,0.06)');
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, this.w, this.h);

    this.starfield.render(ctx, this._time, intensity);
  }

  // ==========================================================
  //  Decorative Ornaments
  // ==========================================================

  /**
   * Draw a horizontal ornamental divider line with a center diamond.
   */
  drawOrnament(y, width = 200) {
    const ctx = this.ctx;
    const cx = this.w / 2;
    const halfW = width / 2;

    // Gradient line
    ctx.save();
    const grad = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
    grad.addColorStop(0, 'rgba(232,184,74,0)');
    grad.addColorStop(0.3, Theme.ornament.line);
    grad.addColorStop(0.5, Theme.ornament.lineBright);
    grad.addColorStop(0.7, Theme.ornament.line);
    grad.addColorStop(1, 'rgba(232,184,74,0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, y);
    ctx.lineTo(cx + halfW, y);
    ctx.stroke();

    // Center diamond
    ctx.fillStyle = Theme.ornament.dot;
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();

    // Side dots
    ctx.beginPath();
    ctx.arc(cx - halfW * 0.5, y, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + halfW * 0.5, y, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw small decorative corner brackets around a rectangular area.
   */
  drawCornerBrackets(x, y, w, h, size = 8) {
    const ctx = this.ctx;
    ctx.strokeStyle = Theme.ornament.lineBright;
    ctx.lineWidth = 1;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + size); ctx.lineTo(x, y); ctx.lineTo(x + size, y);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w - size, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + size);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x, y + h - size); ctx.lineTo(x, y + h); ctx.lineTo(x + size, y + h);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - size, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - size);
    ctx.stroke();
  }

  // ==========================================================
  //  HUD
  // ==========================================================
  drawHUD(score, lives, levelName, activePowerUps) {
    const ctx = this.ctx;

    // Gradient HUD backdrop
    const hudGrad = ctx.createLinearGradient(0, 0, 0, C.PLAY_TOP);
    hudGrad.addColorStop(0, 'rgba(12, 10, 20, 0.85)');
    hudGrad.addColorStop(1, 'rgba(12, 10, 20, 0.5)');
    ctx.fillStyle = hudGrad;
    ctx.fillRect(0, 0, this.w, C.PLAY_TOP);

    // Thin gold line at the bottom of HUD
    ctx.strokeStyle = Theme.ornament.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, C.PLAY_TOP);
    ctx.lineTo(this.w, C.PLAY_TOP);
    ctx.stroke();

    // Score (left)
    ctx.font = '600 18px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.accent;
    ctx.textAlign = 'left';
    ctx.shadowColor = Theme.accent;
    ctx.shadowBlur = 6;
    ctx.fillText(score, 12, 30);
    ctx.shadowBlur = 0;

    // Score label
    ctx.font = '10px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText('SCORE', 12, 45);

    // Lives (right) - as dots instead of emoji
    ctx.textAlign = 'right';
    const dotRadius = 4;
    const dotGap = 12;
    const dotsStartX = this.w - 12;
    for (let i = 0; i < Math.min(lives, 9); i++) {
      const dx = dotsStartX - i * dotGap;
      ctx.fillStyle = Theme.powerUp.extraLife;
      ctx.shadowColor = Theme.powerUp.extraLife;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(dx, 28, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Lives label
    ctx.font = '10px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText('LIVES', this.w - 12, 45);

    // Level name (centered)
    ctx.textAlign = 'center';
    ctx.font = '12px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText(levelName || '', this.w / 2, 28);

    // Pause hint
    ctx.font = '10px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillStyle = Theme.textMuted;
    ctx.fillText('TAP TO PAUSE', this.w / 2, 45);

    // Active power-up indicators
    if (activePowerUps && activePowerUps.length > 0) {
      let px = 12;
      ctx.textAlign = 'left';
      for (const pu of activePowerUps) {
        const color = Theme.powerUp[pu.type] || '#fff';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.font = '10px "Avenir Next", "Segoe UI", sans-serif';
        const label = this._powerUpLabel(pu.type);
        // Small pill background
        const text = `${label} ${Math.ceil(pu.timer)}s`;
        const tw = ctx.measureText(text).width + 8;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.roundRect(px - 4, 58, tw, 16, 8);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillText(text, px, 70);
        px += tw + 6;
      }
      ctx.shadowBlur = 0;
    }
  }

  _powerUpLabel(type) {
    switch (type) {
      case 'fireball':    return '\u2022 FIRE';
      case 'widePaddle':  return '\u2022 WIDE';
      case 'split':       return '\u2022 SPLIT';
      case 'multiShot':   return '\u2022 BURST';
      default:            return '\u2022';
    }
  }

  // ==========================================================
  //  Paddle
  // ==========================================================
  drawPaddle(paddle) {
    const ctx = this.ctx;
    const b = paddle.getBounds();

    // Glow underneath
    ctx.shadowColor = Theme.accent;
    ctx.shadowBlur = paddle.isWide ? 20 : 12;

    // Multi-stop gradient
    const grad = ctx.createLinearGradient(b.left, b.top, b.right, b.top);
    grad.addColorStop(0, Theme.paddleGrad[1]);
    grad.addColorStop(0.3, Theme.paddleGrad[0]);
    grad.addColorStop(0.7, Theme.paddleGrad[0]);
    grad.addColorStop(1, Theme.paddleGrad[1]);

    const r = paddle.height / 2;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(b.left, b.top, paddle.width, paddle.height, r);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Shine highlight (top edge)
    const shineGrad = ctx.createLinearGradient(b.left, b.top, b.right, b.top);
    shineGrad.addColorStop(0, 'rgba(255,255,255,0)');
    shineGrad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    shineGrad.addColorStop(0.7, 'rgba(255,255,255,0.5)');
    shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = shineGrad;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(b.left + r, b.top + 1.5);
    ctx.lineTo(b.right - r, b.top + 1.5);
    ctx.stroke();

    // Center gem/indicator
    const gemX = paddle.x;
    const gemY = paddle.y;
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(gemX, gemY, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Side rivets
    ctx.fillStyle = Theme.paddleGrad[1];
    ctx.beginPath(); ctx.arc(b.left + 6, gemY, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(b.right - 6, gemY, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  // ==========================================================
  //  Balls
  // ==========================================================
  drawBalls(balls) {
    const ctx = this.ctx;

    for (const ball of balls) {
      // Trail
      if (ball.trail.length > 1) {
        for (let i = 0; i < ball.trail.length; i++) {
          const t = ball.trail[i];
          const alpha = (i / ball.trail.length) * 0.3;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = ball.isFireball ? Theme.powerUp.fireball : Theme.ballGlow;
          ctx.beginPath();
          ctx.arc(t.x, t.y, ball.radius * (0.3 + 0.7 * (i / ball.trail.length)), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Ball body
      ctx.shadowColor = ball.isFireball ? Theme.powerUp.fireballGlow : Theme.ballGlow;
      ctx.shadowBlur = ball.isFireball ? 22 : 12;

      if (ball.isFireball) {
        const grad = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.radius * 2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, Theme.powerUp.fireballCore);
        grad.addColorStop(0.7, Theme.powerUp.fireballGlow);
        grad.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius * 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const grad = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.radius);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.4, '#ffe8b0');
        grad.addColorStop(1, Theme.ballGlow);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
    }
  }

  // ==========================================================
  //  Bricks
  // ==========================================================
  drawBricks(brickField) {
    const ctx = this.ctx;

    // ---- Brick cache: render all static bricks to an offscreen canvas ----
    // Bricks with active shakeTimer are drawn live on top of the cache.
    const hasShaking = this._hasShakingBricks(brickField);

    // Fast path: cache valid, no shaking bricks — just blit
    if (!this._brickCacheDirty && this._brickCache && !hasShaking) {
      ctx.drawImage(this._brickCache, 0, 0);
      return;
    }

    // Semi-fast path: cache valid but some bricks are shaking —
    // reuse cached layer, draw only shaking bricks live on top
    if (!this._brickCacheDirty && this._brickCache && hasShaking) {
      ctx.drawImage(this._brickCache, 0, 0);
      for (let r = 0; r < brickField.gridH; r++) {
        for (let c = 0; c < brickField.gridW; c++) {
          const brick = brickField.bricks[r][c];
          if (!brick || !brick.alive || brick.shakeTimer <= 0) continue;
          const rect = brickField.getBrickRect(r, c);
          const shakeX = (Math.random() - 0.5) * 4;
          const shakeY = (Math.random() - 0.5) * 4;
          this._drawSingleBrick(ctx, brick, rect, shakeX, shakeY);
        }
      }
      return;
    }

    // Slow path: rebuild the offscreen cache
    // Use logical dimensions (same as main canvas coordinate space).
    // The main canvas already handles DPR scaling, so the offscreen
    // canvas just needs to match the logical coordinate system.
    if (!this._brickCache || this._brickCache.width !== this.w || this._brickCache.height !== this.h) {
      this._brickCache = document.createElement('canvas');
      this._brickCache.width = this.w;
      this._brickCache.height = this.h;
    }

    const offCtx = this._brickCache.getContext('2d');
    offCtx.clearRect(0, 0, this.w, this.h);

    const shakingBricks = [];

    for (let r = 0; r < brickField.gridH; r++) {
      for (let c = 0; c < brickField.gridW; c++) {
        const brick = brickField.bricks[r][c];
        if (!brick || !brick.alive) continue;

        const rect = brickField.getBrickRect(r, c);

        // Defer shaking bricks to draw live on top
        if (brick.shakeTimer > 0) {
          shakingBricks.push({ brick, rect });
          continue;
        }

        this._drawSingleBrick(offCtx, brick, rect, 0, 0);
      }
    }

    this._brickCacheDirty = false;

    // Blit cached layer, then overlay shaking bricks
    ctx.drawImage(this._brickCache, 0, 0);

    for (const { brick, rect } of shakingBricks) {
      const shakeX = (Math.random() - 0.5) * 4;
      const shakeY = (Math.random() - 0.5) * 4;
      this._drawSingleBrick(ctx, brick, rect, shakeX, shakeY);
    }
  }

  _hasShakingBricks(brickField) {
    for (let r = 0; r < brickField.gridH; r++) {
      for (let c = 0; c < brickField.gridW; c++) {
        const brick = brickField.bricks[r][c];
        if (brick && brick.alive && brick.shakeTimer > 0) return true;
      }
    }
    return false;
  }

  _drawSingleBrick(ctx, brick, rect, shakeX, shakeY) {
    const x = rect.x + shakeX;
    const y = rect.y + shakeY;

    let colors;
    if (brick.color) {
      if (Array.isArray(brick.color)) {
        colors = brick.color;
      } else {
        colors = [brick.color, this._darken(brick.color, 30)];
      }
    } else if (brick.maxHp >= C.IRONCLAD_HP) {
      colors = Theme.brick.iron;
    } else {
      const hpKey = `hp${Math.min(brick.hp, 3)}`;
      colors = Theme.brick[hpKey] || Theme.brick.hp1;
    }

    // Pixel-art mode: flat fill for small bricks (high-density grids)
    if (rect.w < 6) {
      ctx.fillStyle = Array.isArray(colors) ? colors[0] : colors;
      ctx.fillRect(x, y, rect.w, rect.h);
      return;
    }

    // Gradient fill
    const grad = ctx.createLinearGradient(x, y, x, y + rect.h);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1]);

    const br = Math.min(3, rect.h / 3);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, rect.w, rect.h, br);
    ctx.fill();

    // Top gloss
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 1, y + 1, rect.w - 2, rect.h * 0.3);

    // Bottom shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 1, y + rect.h * 0.7, rect.w - 2, rect.h * 0.3);

    // Iron brick bolts
    if (brick.maxHp >= C.IRONCLAD_HP) {
      ctx.fillStyle = 'rgba(160,140,180,0.3)';
      const boltR = 1.5, margin = 3;
      ctx.beginPath(); ctx.arc(x + margin, y + margin, boltR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + rect.w - margin, y + margin, boltR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + margin, y + rect.h - margin, boltR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + rect.w - margin, y + rect.h - margin, boltR, 0, Math.PI * 2); ctx.fill();
    }

    // Crack lines on damaged bricks
    if (brick.maxHp >= 2 && brick.maxHp < C.IRONCLAD_HP && brick.hp < brick.maxHp) {
      const damage = brick.maxHp - brick.hp;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      if (damage >= 1) {
        ctx.beginPath();
        ctx.moveTo(x + rect.w * 0.4, y + 1);
        ctx.lineTo(x + rect.w * 0.5, y + rect.h * 0.4);
        ctx.lineTo(x + rect.w * 0.35, y + rect.h * 0.6);
        ctx.stroke();
      }
      if (damage >= 2) {
        ctx.beginPath();
        ctx.moveTo(x + rect.w - 1, y + rect.h * 0.3);
        ctx.lineTo(x + rect.w * 0.6, y + rect.h * 0.5);
        ctx.lineTo(x + rect.w * 0.7, y + rect.h * 0.8);
        ctx.stroke();
      }
    }
  }

  _darken(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return `rgb(${r},${g},${b})`;
  }

  // ==========================================================
  //  Power-Up Drops
  // ==========================================================
  drawPowerUps(drops) {
    const ctx = this.ctx;

    for (const drop of drops) {
      if (!drop.alive) continue;

      ctx.save();
      ctx.translate(drop.x, drop.y);
      ctx.rotate(drop.rotation);

      const color = Theme.powerUp[drop.type] || '#fff';

      // Outer ring glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, drop.radius + 2, 0, Math.PI * 2);
      ctx.stroke();

      // Filled center
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, drop.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner icon
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#000';
      ctx.font = 'bold 11px "Avenir Next", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (drop.type === 'widePaddle') {
        // Draw a custom wide-paddle icon: ◀━━━━▶
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();
        // Left arrow head
        ctx.beginPath();
        ctx.moveTo(-3, -3);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-3, 3);
        ctx.stroke();
        // Right arrow head
        ctx.beginPath();
        ctx.moveTo(3, -3);
        ctx.lineTo(6, 0);
        ctx.lineTo(3, 3);
        ctx.stroke();
      } else {
        ctx.fillText(this._powerUpIcon(drop.type), 0, 1);
      }

      ctx.restore();
    }
  }

  _powerUpIcon(type) {
    switch (type) {
      case 'split':       return '\u00f7';
      case 'multiShot':   return '\u21d1';
      case 'fireball':    return '\u2605';
      case 'widePaddle':  return 'W';
      case 'extraLife':   return '+';
      default:            return '?';
    }
  }

  // ==========================================================
  //  Particles
  // ==========================================================
  drawParticles(particles) {
    const ctx = this.ctx;
    for (const p of particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      // Draw as rotated diamond for more visual interest
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ==========================================================
  //  Combo Text
  // ==========================================================
  drawComboTexts(texts) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';

    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      const alpha = Math.min(1, t.timer * 2);
      const yOffset = (1 - t.timer) * 30;
      const scale = 1 + (1 - t.timer) * 0.2; // slight scale-up as it fades

      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.translate(this.w / 2, this.h / 2 - 40 - yOffset - i * 25);
      ctx.scale(scale, scale);
      ctx.font = 'bold 16px "Avenir Next", "Segoe UI", sans-serif';
      ctx.shadowColor = Theme.accent;
      ctx.shadowBlur = 8;
      ctx.fillStyle = Theme.accent;
      ctx.fillText(t.text, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ==========================================================
  //  UI Helpers
  // ==========================================================
  drawButton(x, y, w, h, text, options = {}) {
    const ctx = this.ctx;
    const {
      highlighted = false,
      color = Theme.button.bg,
      textColor = Theme.button.text,
      small = false,
    } = options;

    const baseColor = highlighted ? Theme.button.hover : color;

    // Outer glow on hover
    if (highlighted) {
      ctx.shadowColor = Theme.accent;
      ctx.shadowBlur = 12;
    }

    // Gradient body (with slight transparency for depth)
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, this._lighten(baseColor, 15));
    grad.addColorStop(0.5, baseColor);
    grad.addColorStop(1, this._darken(baseColor, 15));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();

    if (highlighted) ctx.shadowBlur = 0;

    // Border with gold accent
    ctx.strokeStyle = highlighted ? Theme.button.border : 'rgba(232,184,74,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner highlight line (top edge, softer)
    const innerGrad = ctx.createLinearGradient(x + 10, 0, x + w - 10, 0);
    innerGrad.addColorStop(0, 'rgba(255,255,255,0)');
    innerGrad.addColorStop(0.3, 'rgba(255,255,255,0.08)');
    innerGrad.addColorStop(0.7, 'rgba(255,255,255,0.08)');
    innerGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = innerGrad;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + 14, y + 2);
    ctx.lineTo(x + w - 14, y + 2);
    ctx.stroke();

    // Label
    ctx.fillStyle = textColor;
    ctx.font = small
      ? '14px "Avenir Next", "Segoe UI", sans-serif'
      : '600 15px "Avenir Next", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Slight text shadow for readability
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 2;
    ctx.fillText(text, x + w / 2, y + h / 2);
    ctx.shadowBlur = 0;
    ctx.textBaseline = 'alphabetic';

    return { x, y, w, h };
  }

  _lighten(hex, amount) {
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
  }

  drawTitle(text, y, size = 36) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';

    // Title with layered glow
    ctx.font = `bold ${size}px "Avenir Next", "Georgia", serif`;

    // Outer glow
    ctx.shadowColor = Theme.accent;
    ctx.shadowBlur = 30;
    ctx.fillStyle = Theme.accent;
    ctx.fillText(text, this.w / 2, y);

    // Inner bright layer
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffe8b0';
    ctx.fillText(text, this.w / 2, y);

    ctx.shadowBlur = 0;
  }

  drawSubtitle(text, y, size = 14) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.font = `${size}px "Avenir Next", "Segoe UI", sans-serif`;
    ctx.fillStyle = Theme.textSecondary;
    ctx.letterSpacing = '2px';
    ctx.fillText(text, this.w / 2, y);
    ctx.letterSpacing = '0px';
  }

  drawPulseSubtitle(text, y, size = 14) {
    const ctx = this.ctx;
    const alpha = Math.sin(this._time * 2.5) * 0.3 + 0.7;
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `${size}px "Avenir Next", "Segoe UI", sans-serif`;
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText(text, this.w / 2, y);
    ctx.globalAlpha = 1;
  }

  drawOverlay(alpha = 0.7) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(8, 6, 16, ${alpha})`;
    ctx.fillRect(0, 0, this.w, this.h);
  }
}
