// src/rendering/renderer.js
// Provides: Starfield, Renderer
// Depends: C, Theme, PowerUpType

// ---- Background Atmosphere: "Brass Dust" ----
// Warm-toned floating particles like metal dust in lamplight,
// plus a radial vignette for depth framing.
class Starfield {
  constructor(screenW, screenH) {
    this.w = screenW;
    this.h = screenH;

    // Particle pool — warm motes drifting upward
    const colors = ['#ff6622', '#ff4400', '#ffaa00', '#d4a24e', '#ff8833'];
    this._particles = [];
    for (let i = 0; i < 80; i++) {
      this._particles.push(this._spawnParticle(colors, true));
    }

    // Pre-render vignette to an offscreen canvas (drawn once)
    this._vignette = document.createElement('canvas');
    this._vignette.width = screenW;
    this._vignette.height = screenH;
    const vCtx = this._vignette.getContext('2d');
    const cx = screenW / 2;
    const cy = screenH / 2;
    const outerR = Math.sqrt(cx * cx + cy * cy);
    const grad = vCtx.createRadialGradient(cx, cy, screenW * 0.3, cx, cy, outerR);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    vCtx.fillStyle = grad;
    vCtx.fillRect(0, 0, screenW, screenH);
  }

  /** Create a single particle with randomized properties. */
  _spawnParticle(colors, randomY) {
    return {
      x: Math.random() * this.w,
      y: randomY ? Math.random() * this.h : this.h + Math.random() * 20,
      vy: 6 + Math.random() * 12,          // upward speed (px/s)
      sineAmp: 10 + Math.random() * 20,    // horizontal sway amplitude
      sineSpeed: 0.4 + Math.random() * 1.2, // sway frequency
      sineOffset: Math.random() * Math.PI * 2,
      size: 1 + Math.random() * 1.5,       // small sparks (1-2.5px)
      alpha: 0.4 + Math.random() * 0.5,    // bright like embers (0.4-0.9)
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  }

  /**
   * Render particles + vignette.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} time — accumulated time in seconds
   * @param {number} intensity — visibility multiplier (0-1)
   */
  render(ctx, time, intensity = 1) {
    const colors = ['#ff6622', '#ff4400', '#ffaa00', '#d4a24e', '#ff8833'];

    // Update and draw particles
    for (const p of this._particles) {
      // Drift upward
      p.y -= p.vy * 0.016; // approximate dt for smooth look
      // Horizontal sway
      const swayX = Math.sin(time * p.sineSpeed + p.sineOffset) * p.sineAmp;

      // Recycle particles that drift off the top
      if (p.y < -10) {
        Object.assign(p, this._spawnParticle(colors, false));
      }

      // Draw tiny square mote — alpha scaled by intensity
      ctx.globalAlpha = p.alpha * intensity;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x + swayX - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Vignette overlay — also scaled by intensity
    ctx.globalAlpha = intensity;
    ctx.drawImage(this._vignette, 0, 0);
    ctx.globalAlpha = 1;
  }
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
    this.starfield = new Starfield(screenW, screenH);
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

  /**
   * Draw the background gradient + atmospheric particles.
   * @param {number} intensity — particle visibility multiplier (0-1).
   *   1.0 = full effect (menu), 0.3 = subtle (gameplay). Default 0.3.
   */
  drawBackground(intensity = 0.3) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, Theme.bgGradTop);
    grad.addColorStop(1, Theme.bgGradBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    // Render atmospheric particles with intensity control
    this.starfield.render(ctx, this._time, intensity);
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

    // ---- Lives as "❤️ × N" (right-aligned) ----
    ctx.textAlign = 'right';
    ctx.fillStyle = Theme.accent2;
    ctx.font = '16px sans-serif';
    ctx.fillText(`❤️ × ${lives}`, this.w - 10, 30);

    // ---- Level name (centered) ----
    ctx.textAlign = 'center';
    ctx.font = '13px sans-serif';
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText(levelName || '', this.w / 2, 30);

    // ---- Pause hint ----
    ctx.font = '11px sans-serif';
    ctx.fillStyle = Theme.textMuted;
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
    ctx.fillStyle = Theme.paddleGrad[1];
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
      ctx.shadowColor = ball.isFireball ? Theme.powerUp.fireballGlow : Theme.ballGlow;
      ctx.shadowBlur = ball.isFireball ? 20 : 10;

      if (ball.isFireball) {
        // Fireball: radial gradient white → orange → red → transparent
        const grad = ctx.createRadialGradient(
          ball.x, ball.y, 0,
          ball.x, ball.y, ball.radius * 2
        );
        grad.addColorStop(0,   '#ffffff');
        grad.addColorStop(0.3, Theme.powerUp.fireballCore);
        grad.addColorStop(0.7, Theme.powerUp.fireballGlow);
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
        } else if (brick.maxHp >= C.IRONCLAD_HP) {
          colors = Theme.brick.iron;
        } else {
          const hpKey = `hp${Math.min(brick.hp, 3)}`;
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

        // Iron brick indicator: industrial bolts in corners (no cracks)
        if (brick.maxHp >= C.IRONCLAD_HP) {
          ctx.fillStyle = 'rgba(200,180,140,0.4)';
          const boltR = 1.5;
          const margin = 3;
          ctx.beginPath(); ctx.arc(x + margin, y + margin, boltR, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + rect.w - margin, y + margin, boltR, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + margin, y + rect.h - margin, boltR, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + rect.w - margin, y + rect.h - margin, boltR, 0, Math.PI*2); ctx.fill();
        }

        // Crack lines on damaged multi-hp bricks (not iron bricks)
        if (brick.maxHp >= 2 && brick.maxHp < C.IRONCLAD_HP && brick.hp < brick.maxHp) {
          const damage = brick.maxHp - brick.hp; // how many hits taken
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 1;

          // First crack: diagonal from top-center area
          if (damage >= 1) {
            ctx.beginPath();
            ctx.moveTo(x + rect.w * 0.4, y + 1);
            ctx.lineTo(x + rect.w * 0.5, y + rect.h * 0.4);
            ctx.lineTo(x + rect.w * 0.35, y + rect.h * 0.6);
            ctx.stroke();
          }

          // Second crack: from right side
          if (damage >= 2) {
            ctx.beginPath();
            ctx.moveTo(x + rect.w - 1, y + rect.h * 0.3);
            ctx.lineTo(x + rect.w * 0.6, y + rect.h * 0.5);
            ctx.lineTo(x + rect.w * 0.7, y + rect.h * 0.8);
            ctx.stroke();
          }
        }
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
   * Draw a pulsing subtitle (opacity oscillates gently).
   * Useful for drawing attention to action hints like "点击发射".
   * @param {string} text
   * @param {number} y
   * @param {number} size
   */
  drawPulseSubtitle(text, y, size = 14) {
    const ctx = this.ctx;
    const alpha = Math.sin(this._time * 3) * 0.25 + 0.75;
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `${size}px sans-serif`;
    ctx.fillStyle = Theme.textSecondary;
    ctx.fillText(text, this.w / 2, y);
    ctx.globalAlpha = 1;
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
