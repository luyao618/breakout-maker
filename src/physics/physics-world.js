// src/physics/physics-world.js
// Provides: PhysicsWorld
// Depends: C, CollisionDetector

class PhysicsWorld {
  /**
   * @param {BrickField} brickField
   * @param {Paddle}     paddle
   * @param {number}     screenW
   * @param {number}     screenH
   */
  constructor(brickField, paddle, screenW, screenH) {
    this.bf = brickField;
    this.paddle = paddle;
    this.screenW = screenW;
    this.screenH = screenH;

    // External callbacks
    this.onBrickHit  = null; // (row, col, destroyed, brick)
    this.onBallLost  = null; // (ball)
    this.onPaddleHit = null; // (ball)
  }

  /**
   * Step the simulation for all balls.
   * @param {Ball[]} balls
   * @param {number} dt - seconds
   */
  tick(balls, dt) {
    for (const ball of balls) {
      const previous = { x: ball.x, y: ball.y };
      ball.update(dt);
      this._brickCollisions(ball, dt, previous);
      this._wallCollision(ball);
      this._paddleCollision(ball, dt);
      this._enforceMinVy(ball);

      // Check if ball fell off the bottom edge
      if (ball.y - ball.radius > this.screenH) {
        if (this.onBallLost) this.onBallLost(ball);
      }
    }
  }

  // ---- Wall bounces (left, right, top) ----
  _wallCollision(ball) {
    // Left wall
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
    }
    // Right wall
    if (ball.x + ball.radius > this.screenW) {
      ball.x = this.screenW - ball.radius;
      ball.vx = -Math.abs(ball.vx);
    }
    // Top wall (below HUD area)
    if (ball.y - ball.radius < C.PLAY_TOP) {
      ball.y = C.PLAY_TOP + ball.radius;
      ball.vy = Math.abs(ball.vy);
    }
  }

  // ---- Paddle reflection ----
  _paddleCollision(ball, dt) {
    const pb = this.paddle.getBounds();

    // Quick x-range check (with ball radius margin)
    const withinX = ball.x >= pb.left - ball.radius && ball.x <= pb.right + ball.radius;
    if (!withinX || ball.vy <= 0) return; // only collide when ball is moving downward

    const ballBottom = ball.y + ball.radius;
    const prevBottom = ballBottom - ball.vy * dt;

    const overlap = ballBottom >= pb.top && ball.y - ball.radius < pb.bottom;
    const swept   = prevBottom <= pb.top && ballBottom >= pb.top;

    if (overlap || swept) {
      // Place ball on top of paddle
      ball.y = pb.top - ball.radius;

      // Reflect based on where the ball hit the paddle (-1 = left edge, +1 = right edge)
      const hitPos = (ball.x - this.paddle.x) / (this.paddle.width / 2);
      const angle  = hitPos * C.MAX_REFLECT_ANGLE;
      ball.vx =  ball.speed * Math.sin(angle);
      ball.vy = -ball.speed * Math.cos(angle);

      if (this.onPaddleHit) this.onPaddleHit(ball);
    }
  }

  // ---- Brick collisions (find nearest swept hit) ----
  _brickCollisions(ball, dt, previous) {
    const start = previous || { x: ball.x - ball.vx * dt, y: ball.y - ball.vy * dt };
    const sweep = { ...start, vx: ball.vx, vy: ball.vy, radius: ball.radius };
    let nearest  = null;
    let nearestT = Infinity;
    let nearestR = -1;
    let nearestC = -1;

    // AABB early-out: only check bricks near the ball's swept path
    const cellW = this.bf.brickW + C.BRICK_GAP;
    const cellH = this.bf.brickH + C.BRICK_GAP;
    const futureX = start.x + ball.vx * dt;
    const futureY = start.y + ball.vy * dt;
    const bx0 = Math.min(start.x, futureX) - ball.radius;
    const bx1 = Math.max(start.x, futureX) + ball.radius;
    const by0 = Math.min(start.y, futureY) - ball.radius;
    const by1 = Math.max(start.y, futureY) + ball.radius;

    const rMin = Math.max(0, Math.floor((by0 - this.bf.offsetY) / cellH) - 1);
    const rMax = Math.min(this.bf.gridH - 1, Math.ceil((by1 - this.bf.offsetY) / cellH) + 1);
    const cMin = Math.max(0, Math.floor((bx0 - this.bf.offsetX) / cellW) - 1);
    const cMax = Math.min(this.bf.gridW - 1, Math.ceil((bx1 - this.bf.offsetX) / cellW) + 1);

    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        const brick = this.bf.bricks[r][c];
        if (!brick || !brick.alive) continue;

        const rect = this.bf.getBrickRect(r, c);
        const hit  = CollisionDetector.sweepBallVsRect(sweep, rect, dt);
        if (hit && hit.t < nearestT) {
          nearest  = hit;
          nearestT = hit.t;
          nearestR = r;
          nearestC = c;
        }
      }
    }

    if (nearest) {
      // Sweep the movement that was actually advanced, not the next frame.
      ball.x = start.x + ball.vx * dt * nearest.t;
      ball.y = start.y + ball.vy * dt * nearest.t;
      const brick = this.bf.bricks[nearestR][nearestC];
      const piercing = ball.isFireball;
      const reflective = !piercing || brick.kind === 'armor' || brick.maxHp >= C.IRONCLAD_HP;
      if (reflective) {
        if (nearest.nx !== 0) ball.vx *= -1;
        if (nearest.ny !== 0) ball.vy *= -1;
        // Keep the next sweep outside the contacted face.
        ball.x += nearest.nx * 0.001;
        ball.y += nearest.ny * 0.001;
      }
      this.damageBrick(nearestR, nearestC, 'ball', ball);
      if (piercing) {
        ball.fireballContacts = Math.max(0, ball.fireballContacts - 1);
        if (ball.fireballContacts === 0) {
          ball.isFireball = false;
          ball.fireballTimer = 0;
        }
      }
    }
  }

  /** Resolve one damage source centrally so collateral cannot farm resources. */
  damageBrick(row, col, source = 'ball', ball = null) {
    const brick = this.bf.bricks[row]?.[col];
    if (!brick?.alive) return false;
    const destroyed = brick.hit(source === 'ball' && !!ball?.isFireball);
    if (destroyed) this.bf.destroyed++;
    if (source === 'ball' && brick.kind === 'accelerator' && ball) {
      const baseSpeed = this.levelBallSpeed || C.BALL_SPEED;
      ball.speed = Math.min(baseSpeed * BALANCE.maxSpeedMultiplier, ball.speed * BALANCE.acceleratorMultiplier);
      ball.normalizeSpeed();
    }
    if (this.onBrickHit) this.onBrickHit(row, col, destroyed, brick, source, ball);
    // A directly hit reactor splashes adjacent cells once, never another chain.
    if (destroyed && brick.kind === 'reactor' && source !== 'reactor') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr !== 0 || dc !== 0) this.damageBrick(row + dr, col + dc, 'reactor');
        }
      }
    }
    return destroyed;
  }

  // ---- Prevent near-horizontal ball (enforce minimum vy) ----
  _enforceMinVy(ball) {
    const minVy = ball.speed * C.MIN_VY_RATIO;
    if (Math.abs(ball.vy) < minVy) {
      ball.vy = (ball.vy < 0 ? -1 : ball.vy > 0 ? 1 : -1) * minVy;
      // Adjust vx to keep overall speed consistent
      const vxSq = ball.speed * ball.speed - ball.vy * ball.vy;
      if (vxSq > 0) {
        ball.vx = Math.sign(ball.vx || 1) * Math.sqrt(vxSq);
      }
    }
  }
}
