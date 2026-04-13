// src/rendering/renderer.js
// Provides: Starfield, Renderer
// Depends: C, Theme, PowerUpType

// ---- Background (clean, no animated elements) ----
class Starfield {
  constructor() {}
  render() {}
}

// ---- Renderer --------------------------------------------
// The main rendering engine. Every visual element in the game
// — background, HUD, paddle, balls, bricks, power-ups,
//   particles, combo text, UI overlays — is drawn here.
// -----------------------------------------------------------
class Renderer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} screenW
   * @param {number} screenH
   */
  constructor(ctx, screenW, screenH) {
    this.ctx = ctx;
    this.w = screenW;
    this.h = screenH;
    this.starfield = new Starfield();
    this._brickCache = null;       // OffscreenCanvas for brick field
    this._brickCacheDirty = true;  // flag to rebuild cache
    this._time = 0;                // accumulated time (seconds)
  }

  /** Mark the brick cache as needing a redraw (e.g. after a brick breaks). */
  invalidateBrickCache() {
    this._brickCacheDirty = true;
  }

  /**
   * Called every frame to advance internal timers (used for
   * twinkle / glow animations).
   * @param {number} dt – delta time in seconds
   */
  update(dt) {
    this._time += dt;
  }

  // ==========================================================
  //  Background
  // ==========================================================

  /** Draw a clean dark background. */
  drawBackground() {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, '#12100e');
    grad.addColorStop(1, '#1e1a16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  // ==========================================================
  //  HUD  (score · lives · level name · active power-ups)
  // ==========================================================

  /**
   * Draw the heads-up display bar at the top of the screen.
   * @param {number}   score
   * @param {number}   lives
   * @param {string}   levelName
   * @param {Array}    activePowerUps – [{type, timer}, ...]
   */
  drawHUD(score, lives, levelName, activePowerUps) {
    const ctx = this.ctx;

    // Semi-transparent backdrop for the HUD strip
    ctx.fillStyle = 'rgba(20, 12, 6, 0.7)';  // warm dark overlay
    ctx.fillRect(0, 0, this.w, C.PLAY_TOP);

    // ---- Score (left-aligned) ----
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = Theme.accent;
    ctx.textAlign = 'left';
    ctx.fillText(`⚡ ${score}`, 10, 30);

    // ---- Lives as hearts (right-aligned) ----
    ctx.textAlign = 'right';
    ctx.fillStyle = Theme.accent2;
    ctx.font = '16px sans-serif';
    let heartsStr = '';
    for (let i = 0; i < lives; i++) heartsStr += '❤️ ';
    ctx.fillText(heartsStr.trim(), this.w - 10, 30);

    // ---- Level name (centered) ----
    ctx.textAlign = 'center';
    ctx.font = '13px sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText(levelName || '', this.w / 2, 30);

    // ---- Pause hint ----
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('⏸ 点击此处暂停', this.w / 2, 55);

    // ---- Active power-up indicators (bottom of HUD) ----
    if (activePowerUps && activePowerUps.length > 0) {
      let px = 10;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      for (const pu of activePowerUps) {
        const color = Theme.powerUp[pu.type] || '#fff';
        ctx.fillStyle = color;
        const label = this._powerUpLabel(pu.type);
        ctx.fillText(`${label} ${Math.ceil(pu.timer)}s`, px, 70);
        px += 80;
      }
    }
  }

  /**
   * Map a power-up type string to its emoji label.
   * @param {string} type
   * @returns {string}
   */
  _powerUpLabel(type) {
    switch (type) {
      case 'fireball':    return '🔥';
      case 'widePaddle':  return '📏';
      case 'split':       return '✦';
      case 'multiShot':   return '🎯';
      default:            return '⭐';
    }
  }

  // ==========================================================
  //  Paddle
  // ==========================================================

  /**
   * Draw the paddle with a gradient, glow, and shine highlight.
   * @param {Paddle} paddle
   */
  drawPaddle(paddle) {
    const ctx = this.ctx;
    const b = paddle.getBounds();

    // Horizontal gradient across the paddle
    const grad = ctx.createLinearGradient(b.left, b.top, b.right, b.top);
    grad.addColorStop(0, Theme.paddleGrad[0]);
    grad.addColorStop(1, Theme.paddleGrad[1]);

    // Neon glow (wider when power-up "wide" is active)
    ctx.shadowColor = Theme.accent;
    ctx.shadowBlur = paddle.isWide ? 15 : 8;

    // Rounded rectangle body
    const r = paddle.height / 2;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(b.left, b.top, paddle.width, paddle.height, r);
    ctx.fill();

    // Reset shadow so it doesn't bleed onto other elements
    ctx.shadowBlur = 0;

    // Thin white shine line along the top edge
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.left + r, b.top + 2);
    ctx.lineTo(b.right - r, b.top + 2);
    ctx.stroke();

    // Rivets
    ctx.fillStyle = '#8b6914';
    const rivetR = 2;
    ctx.beginPath(); ctx.arc(b.left + 8, b.top + paddle.height/2, rivetR, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(b.right - 8, b.top + paddle.height/2, rivetR, 0, Math.PI*2); ctx.fill();
  }

  // ==========================================================
  //  Balls
  // ==========================================================

  /**
   * Draw every ball, including its trail and fireball effects.
   * @param {Ball[]} balls
   */
  drawBalls(balls) {
    const ctx = this.ctx;

    for (const ball of balls) {
      // ---- Fading trail ----
      if (ball.trail.length > 1) {
        for (let i = 0; i < ball.trail.length; i++) {
          const t = ball.trail[i];
          const alpha = (i / ball.trail.length) * 0.3;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = ball.isFireball
            ? Theme.powerUp.fireball
            : Theme.ballGlow;
          ctx.beginPath();
          ctx.arc(
            t.x,
            t.y,
            ball.radius * (0.3 + 0.7 * (i / ball.trail.length)),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // ---- Main ball body ----
      ctx.shadowColor = ball.isFireball ? '#ff4400' : Theme.ballGlow;
      ctx.shadowBlur = ball.isFireball ? 20 : 10;

      if (ball.isFireball) {
        // Fireball: radial gradient white → orange → red → transparent
        const grad = ctx.createRadialGradient(
          ball.x, ball.y, 0,
          ball.x, ball.y, ball.radius * 2
        );
        grad.addColorStop(0,   '#ffffff');
        grad.addColorStop(0.3, '#ffaa00');
        grad.addColorStop(0.7, '#ff4400');
        grad.addColorStop(1,   'rgba(255,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius * 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Normal ball: warm brass glow
        const grad = ctx.createRadialGradient(
          ball.x, ball.y, 0,
          ball.x, ball.y, ball.radius
        );
        grad.addColorStop(0, '#ffe0a0');    // warm center
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

  /**
   * Draw the entire brick field. Each brick gets a gradient,
   * shine highlight, optional HP label, and shake animation.
   * @param {BrickField} brickField
   */
  drawBricks(brickField) {
    const ctx = this.ctx;

    for (let r = 0; r < brickField.gridH; r++) {
      for (let c = 0; c < brickField.gridW; c++) {
        const brick = brickField.bricks[r][c];
        if (!brick || !brick.alive) continue;

        const rect = brickField.getBrickRect(r, c);

        // Shake offset when the brick was recently hit
        let shakeX = 0;
        let shakeY = 0;
        if (brick.shakeTimer > 0) {
          shakeX = (Math.random() - 0.5) * 4;
          shakeY = (Math.random() - 0.5) * 4;
        }

        const x = rect.x + shakeX;
        const y = rect.y + shakeY;

        // Determine the two-colour gradient pair for this brick
        let colors;
        if (brick.color) {
          // color can be a [light, dark] array (from Theme) or a hex string (from image upload)
          if (Array.isArray(brick.color)) {
            colors = brick.color;
          } else {
            colors = [brick.color, this._darken(brick.color, 30)];
          }
        } else if (brick.hp >= C.INDESTRUCTIBLE_HP) {
          colors = Theme.brick.indestructible;
        } else {
          const hpKey = `hp${Math.min(brick.hp, 4)}`;
          colors = Theme.brick[hpKey] || Theme.brick.hp1;
        }

        // Top-to-bottom gradient fill
        const grad = ctx.createLinearGradient(x, y, x, y + rect.h);
        grad.addColorStop(0, colors[0]);
        grad.addColorStop(1, colors[1]);

        // Rounded brick body
        const br = Math.min(3, rect.h / 3);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, rect.w, rect.h, br);
        ctx.fill();

        // Gloss / shine strip along the top 35 %
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + 1, y + 1, rect.w - 2, rect.h * 0.35);

        // Bottom shadow (bevel effect)
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x + 1, y + rect.h * 0.7, rect.w - 2, rect.h * 0.3);

        // Indestructible indicator: industrial bolts in corners
        if (brick.hp >= C.INDESTRUCTIBLE_HP) {
          ctx.fillStyle = 'rgba(200,180,140,0.4)';
          const boltR = 1.5;
          const margin = 3;
          ctx.beginPath(); ctx.arc(x + margin, y + margin, boltR, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + rect.w - margin, y + margin, boltR, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + margin, y + rect.h - margin, boltR, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + rect.w - margin, y + rect.h - margin, boltR, 0, Math.PI*2); ctx.fill();
        }

        // HP numbers removed — visual style alone indicates brick type
      }
    }
  }

  /**
   * Darken a hex colour by subtracting `amount` from each channel.
   * Returns an rgb() string.
   * @param {string} hex – e.g. "#ff8800"
   * @param {number} amount
   * @returns {string}
   */
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

  /**
   * Draw falling power-up capsules with glow and icon.
   * @param {PowerUpDrop[]} drops
   */
  drawPowerUps(drops) {
    const ctx = this.ctx;

    for (const drop of drops) {
      if (!drop.alive) continue;

      ctx.save();
      ctx.translate(drop.x, drop.y);
      ctx.rotate(drop.rotation);

      const color = Theme.powerUp[drop.type] || '#fff';

      // Outer glow circle
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, drop.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner icon
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#000';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = this._powerUpIcon(drop.type);
      ctx.fillText(icon, 0, 1);

      ctx.restore();
    }
  }

  /**
   * Map a power-up type to a single-character icon.
   * @param {string} type
   * @returns {string}
   */
  _powerUpIcon(type) {
    switch (type) {
      case 'split':       return '÷';
      case 'multiShot':   return '⇑';
      case 'fireball':    return '★';
      case 'widePaddle':  return '↔';
      case 'extraLife':   return '+';
      default:            return '?';
    }
  }

  // ==========================================================
  //  Particles
  // ==========================================================

  /**
   * Draw all active particles (small coloured squares that
   * fade out over their lifetime).
   * @param {Particle[]} particles
   */
  drawParticles(particles) {
    const ctx = this.ctx;

    for (const p of particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(
        p.x - p.size / 2,
        p.y - p.size / 2,
        p.size,
        p.size
      );
    }

    ctx.globalAlpha = 1;
  }

  // ==========================================================
  //  Combo Text
  // ==========================================================

  /**
   * Draw floating combo / streak text that drifts upward and
   * fades out.
   * @param {Array} texts – [{text, timer}, ...]
   */
  drawComboTexts(texts) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';

    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      const alpha = Math.min(1, t.timer * 2);
      const yOffset = (1 - t.timer) * 30;

      ctx.globalAlpha = alpha;
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.fillStyle = Theme.accent;
      ctx.fillText(
        t.text,
        this.w / 2,
        this.h / 2 - 40 - yOffset - i * 25
      );
    }

    ctx.globalAlpha = 1;
  }

  // ==========================================================
  //  UI Helpers
  // ==========================================================

  /**
   * Draw a rounded, gradient-filled button and return its
   * bounding rectangle (for pointer hit-testing).
   *
   * @param {number}  x
   * @param {number}  y
   * @param {number}  w
   * @param {number}  h
   * @param {string}  text
   * @param {Object}  options
   * @param {boolean} options.highlighted – hover / active state
   * @param {string}  options.color       – base background colour
   * @param {string}  options.textColor   – label colour
   * @returns {{x:number, y:number, w:number, h:number}}
   */
  drawButton(x, y, w, h, text, options = {}) {
    const ctx = this.ctx;
    const {
      highlighted = false,
      color = Theme.button.bg,
      textColor = Theme.button.text,
    } = options;

    // Vertical gradient (lighter → darker)
    const baseColor = highlighted ? Theme.button.hover : color;
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, baseColor);
    grad.addColorStop(1, this._darken(baseColor, 20));

    // Rounded body
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();

    // Thin border
    ctx.strokeStyle = Theme.button.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner glow line (top)
    ctx.strokeStyle = 'rgba(240,224,192,0.15)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 6);
    ctx.stroke();

    // Centred label
    ctx.fillStyle = textColor;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);

    return { x, y, w, h };
  }

  /**
   * Draw a large glowing title string.
   * @param {string} text
   * @param {number} y    – vertical position
   * @param {number} size – font size in px
   */
  drawTitle(text, y, size = 36) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.font = `bold ${size}px "Courier New", monospace`;

    // Neon glow behind the text
    ctx.shadowColor = Theme.accent;
    ctx.shadowBlur = 20;
    ctx.fillStyle = Theme.accent;
    ctx.fillText(text, this.w / 2, y);

    ctx.shadowBlur = 0;
  }

  /**
   * Draw a smaller, muted subtitle string.
   * @param {string} text
   * @param {number} y
   * @param {number} size
   */
  drawSubtitle(text, y, size = 14) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.font = `${size}px sans-serif`;
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText(text, this.w / 2, y);
  }

  /**
   * Fill the entire screen with a semi-transparent dark overlay
   * (used for pause / game-over / menu screens).
   * @param {number} alpha – opacity 0-1
   */
  drawOverlay(alpha = 0.7) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(14, 8, 4, ${alpha})`;
    ctx.fillRect(0, 0, this.w, this.h);
  }
}
