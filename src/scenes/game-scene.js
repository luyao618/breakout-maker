// src/scenes/game-scene.js
// Provides: GameScene
// Depends: C, Theme, PowerUpType, Ball, Paddle, BrickField, PhysicsWorld,
//          ScoreSystem, Particle, rollPowerUpDrop, audio, Renderer

/**
 * Core gameplay scene managing multi-ball, power-ups, particles,
 * physics, scoring, and deferred state transitions.
 */
class GameScene {
  constructor(game) {
    this._game = game;

    // Runtime game objects
    this.balls        = [];
    this.paddle       = null;
    this.brickField   = null;
    this.physics      = null;
    this.scoreSystem  = null;
    this.powerUpDrops = [];
    this.activePowerUps = [];
    this.particles    = [];

    // Level metadata
    this.level      = null;
    this.levelIndex = 0;
    this.lives      = C.DEFAULT_LIVES;

    // Internal flags
    this._pendingTransition = null;
    this._launched = false;
  }

  // ---- Lifecycle ----

  enter(data) {
    if (!data || !data.level) return;

    this.level      = data.level;
    this.levelIndex = data.levelIndex || 0;
    this.lives      = data.level.lives || C.DEFAULT_LIVES;

    this._pendingTransition = null;
    this._launched          = false;
    this.powerUpDrops       = [];
    this.activePowerUps     = [];
    this.particles          = [];

    // Paddle
    const pw   = data.level.paddleWidth || 120;
    this.paddle = new Paddle(
      C.SCREEN_W / 2,
      C.SCREEN_H - C.PLAY_BOTTOM_MARGIN,
      pw,
    );

    // Brick field
    this.brickField = new BrickField(data.level, C.SCREEN_W);

    // Initial ball sitting on the paddle
    this.balls = [];
    this._spawnBallOnPaddle();

    // Score tracking
    this.scoreSystem = new ScoreSystem();

    // Physics engine
    this.physics = new PhysicsWorld(
      this.brickField, this.paddle,
      C.SCREEN_W, C.SCREEN_H,
    );

    // --- Physics callbacks ---

    this.physics.onBrickHit = (row, col, destroyed, brick) => {
      this.scoreSystem.onBrickHit(destroyed);

      // Sound effects
      if (typeof audio !== 'undefined') {
        if (destroyed) audio.playBrickDestroy();
        else audio.playBrickHit();
      }

      if (destroyed) {
        // Burst particles at the brick center
        const rect  = this.brickField.getBrickRect(row, col);
        const rawColor = brick.color
          || Theme.brick[`hp${Math.min(brick.maxHp, 4)}`]
          || ['#fff', '#ccc'];
        const color = Array.isArray(rawColor) ? rawColor[0] : rawColor;
        for (let i = 0; i < 8; i++) {
          this.particles.push(
            new Particle(rect.x + rect.w / 2, rect.y + rect.h / 2, color),
          );
        }

        // Maybe drop a power-up
        const drop = rollPowerUpDrop(rect.x + rect.w / 2, rect.y + rect.h / 2);
        if (drop) this.powerUpDrops.push(drop);
      }

      // Invalidate the cached brick layer so Renderer redraws
      this._game.renderer.invalidateBrickCache();

      // Check win condition
      if (this.brickField.isCleared() && !this._pendingTransition) {
        this._pendingTransition = {
          state: 'WIN',
          data: {
            score: this.scoreSystem.score,
            level: this.level,
            levelIndex: this.levelIndex,
          },
        };
      }
    };

    this.physics.onBallLost = (ball) => {
      ball._dead = true;
    };

    this.physics.onPaddleHit = (_ball) => {
      if (typeof audio !== 'undefined') audio.playPaddleHit();
    };
  }

  /** Place a new ball on top of the paddle (pre-launch). */
  _spawnBallOnPaddle() {
    const ball = new Ball(
      this.paddle.x,
      this.paddle.y - this.paddle.height / 2 - C.BALL_RADIUS - 2,
    );
    ball.speed = this.level.ballSpeed || C.BALL_SPEED;
    this.balls.push(ball);
    this._launched = false;
  }

  exit(preserveState) {
    if (!preserveState) {
      this.balls        = [];
      this.paddle       = null;
      this.brickField   = null;
      this.physics      = null;
      this.powerUpDrops = [];
      this.activePowerUps = [];
      this.particles    = [];
    }
  }

  // ---- Frame update ----

  update(dt) {
    // Guard: nothing to update if not entered
    if (!this.paddle || !this.brickField) return;

    // Pre-launch: ball tracks paddle position
    if (!this._launched) {
      if (this.balls.length > 0) {
        this.balls[0].x = this.paddle.x;
        this.balls[0].y = this.paddle.y - this.paddle.height / 2 - C.BALL_RADIUS - 2;
      }
      this.paddle.update(dt);
      return;
    }

    this.paddle.update(dt);
    this.brickField.update(dt);
    this.scoreSystem.update(dt);

    // Run physics tick (handles ball-wall, ball-paddle, ball-brick)
    this.physics.tick(this.balls, dt);

    // Remove dead balls (fell off bottom)
    this.balls = this.balls.filter(b => !b._dead);

    // If every ball is gone, lose a life
    if (this.balls.length === 0) {
      this.lives--;
      if (typeof audio !== 'undefined') audio.playLifeLost();
      if (this.lives <= 0 && !this._pendingTransition) {
        this._pendingTransition = {
          state: 'LOSE',
          data: {
            score: this.scoreSystem.score,
            level: this.level,
            levelIndex: this.levelIndex,
          },
        };
      } else if (this.lives > 0) {
        this._spawnBallOnPaddle();
      }
    }

    // --- Power-up drops: fall & check paddle catch ---
    for (const drop of this.powerUpDrops) {
      drop.update(dt);
      if (drop.alive) {
        const pb = this.paddle.getBounds();
        if (drop.x >= pb.left && drop.x <= pb.right &&
            drop.y + drop.radius >= pb.top &&
            drop.y - drop.radius <= pb.bottom) {
          drop.alive = false;
          this._activatePowerUp(drop.type);
          if (typeof audio !== 'undefined') audio.playPowerUp();
        }
      }
    }
    this.powerUpDrops = this.powerUpDrops.filter(d => d.alive);

    // --- Tick active timed power-ups ---
    this.activePowerUps = this.activePowerUps.filter(pu => {
      pu.timer -= dt;
      return pu.timer > 0;
    });

    // --- Particles ---
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => !p.dead);

    // --- Deferred state transition (win / lose) ---
    if (this._pendingTransition) {
      const { state, data } = this._pendingTransition;
      this._pendingTransition = null;
      this._game.stateMachine.transition(state, data);
    }
  }

  // ---- Power-up activation ----

  _activatePowerUp(type) {
    switch (type) {

      case PowerUpType.SPLIT: {
        // Every existing ball spawns two extra at ±0.4 rad offset
        const newBalls = [];
        for (const ball of this.balls) {
          const baseAngle = Math.atan2(ball.vy, ball.vx);

          for (const offset of [-0.4, 0.4]) {
            const angle = baseAngle + offset;
            const b = new Ball(ball.x, ball.y, ball.radius);
            b.speed = ball.speed;
            b.vx    = ball.speed * Math.cos(angle);
            b.vy    = ball.speed * Math.sin(angle);
            b.isFireball   = ball.isFireball;
            b.fireballTimer = ball.fireballTimer;
            newBalls.push(b);
          }
        }
        this.balls.push(...newBalls);
        break;
      }

      case PowerUpType.MULTI_SHOT: {
        // Fire 3 new balls from the paddle in a fan
        for (let i = -1; i <= 1; i++) {
          const b = new Ball(
            this.paddle.x + i * 15,
            this.paddle.y - this.paddle.height / 2 - C.BALL_RADIUS - 2,
          );
          b.speed = this.level.ballSpeed || C.BALL_SPEED;
          b.launch(C.LAUNCH_ANGLE + i * 0.3);
          this.balls.push(b);
        }
        break;
      }

      case PowerUpType.FIREBALL: {
        // All current balls become fireballs for 8 s
        for (const ball of this.balls) {
          ball.isFireball   = true;
          ball.fireballTimer = 8;
        }
        this.activePowerUps.push({ type: PowerUpType.FIREBALL, timer: 8 });
        break;
      }

      case PowerUpType.WIDE_PADDLE: {
        this.paddle.setWide(10);
        this.activePowerUps.push({ type: PowerUpType.WIDE_PADDLE, timer: 10 });
        break;
      }

      case PowerUpType.EXTRA_LIFE: {
        this.lives = Math.min(this.lives + 1, 9);
        break;
      }
    }
  }

  // ---- Rendering ----

  render() {
    const r = this._game.renderer;
    r.drawBackground();

    // Guard: render nothing if scene hasn't been entered yet (or was exited)
    if (!this.brickField || !this.paddle) return;

    r.drawBricks(this.brickField);
    r.drawPaddle(this.paddle);
    r.drawBalls(this.balls);
    r.drawPowerUps(this.powerUpDrops);
    r.drawParticles(this.particles);
    r.drawComboTexts(this.scoreSystem.comboTexts);
    r.drawHUD(
      this.scoreSystem.score,
      this.lives,
      this.level.name,
      this.activePowerUps,
    );

    // Show launch hint when waiting for first tap (with pulse animation)
    if (!this._launched) {
      r.drawPulseSubtitle('点击发射', C.SCREEN_H - 120, 16);
    }
  }

  // ---- Input ----

  onTap(x, y) {
    // Tap on HUD area → pause
    if (y < C.PLAY_TOP) {
      this._game.stateMachine.transition('PAUSED');
      return;
    }

    // First tap launches the ball
    if (!this._launched) {
      this._launched = true;
      for (const ball of this.balls) {
        ball.speed = this.level.ballSpeed || C.BALL_SPEED;
        ball.launch();
      }
    }
  }

  onMove(x, _y) {
    if (this.paddle) this.paddle.moveTo(x, C.SCREEN_W);
  }
}
