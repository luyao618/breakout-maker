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
      ball.update(dt);
      this._wallCollision(ball);
      this._paddleCollision(ball, dt);
      this._brickCollisions(ball, dt);
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
  _brickCollisions(ball, dt) {
    let nearest  = null;
    let nearestT = Infinity;
    let nearestR = -1;
    let nearestC = -1;

    // AABB early-out: only check bricks near the ball's swept path
    const cellW = this.bf.brickW + C.BRICK_GAP;
    const cellH = this.bf.brickH + C.BRICK_GAP;
    const futureX = ball.x + ball.vx * dt;
    const futureY = ball.y + ball.vy * dt;
    const bx0 = Math.min(ball.x, futureX) - ball.radius;
    const bx1 = Math.max(ball.x, futureX) + ball.radius;
    const by0 = Math.min(ball.y, futureY) - ball.radius;
    const by1 = Math.max(ball.y, futureY) + ball.radius;

    const rMin = Math.max(0, Math.floor((by0 - this.bf.offsetY) / cellH) - 1);
    const rMax = Math.min(this.bf.gridH - 1, Math.ceil((by1 - this.bf.offsetY) / cellH) + 1);
    const cMin = Math.max(0, Math.floor((bx0 - this.bf.offsetX) / cellW) - 1);
    const cMax = Math.min(this.bf.gridW - 1, Math.ceil((bx1 - this.bf.offsetX) / cellW) + 1);

    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        const brick = this.bf.bricks[r][c];
        if (!brick || !brick.alive) continue;

        const rect = this.bf.getBrickRect(r, c);
        const hit  = CollisionDetector.sweepBallVsRect(ball, rect, dt);
        if (hit && hit.t < nearestT) {
          nearest  = hit;
          nearestT = hit.t;
          nearestR = r;
          nearestC = c;
        }
      }
    }

    if (nearest) {
      // Move ball to the collision point
      ball.x += ball.vx * dt * nearest.t;
      ball.y += ball.vy * dt * nearest.t;
      // Remove the remaining movement (already applied in ball.update)
      ball.x -= ball.vx * dt;
      ball.y -= ball.vy * dt;

      const brick = this.bf.bricks[nearestR][nearestC];
      const destroyed = brick.hit(ball.isFireball);
      if (destroyed) this.bf.destroyed++;

      // Reflect velocity (fireball punches through without reflecting)
      if (!ball.isFireball) {
        if (nearest.nx !== 0) ball.vx *= -1;
        if (nearest.ny !== 0) ball.vy *= -1;
      }

      if (this.onBrickHit) this.onBrickHit(nearestR, nearestC, destroyed, brick);
    }
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
