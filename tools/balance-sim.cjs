#!/usr/bin/env node
/**
 * Seeded control-only campaign calibration. No physics state is corrected and
 * no rewards are injected. These are sensitivity models, not measured players.
 *
 * node tools/balance-sim.cjs --out /tmp/balance.json --seeds 3
 * node tools/balance-sim.cjs --tiers ideal --stages 1,7,13 --seconds 600
 * Use --source /absolute/path/engine.ts to compare an archived implementation.
 */
const { writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { execFileSync } = require("node:child_process");

const profiles = {
  casual: {
    reaction: 0.24,
    observation: 0.12,
    paddleSpeed: 520,
    landingError: 18,
    velocityError: 0.05,
    aimsAtBricks: false,
  },
  skilled: {
    reaction: 0.14,
    observation: 0.08,
    paddleSpeed: 800,
    landingError: 8,
    velocityError: 0.02,
    aimsAtBricks: true,
  },
  expert: {
    reaction: 0.075,
    observation: 0.05,
    paddleSpeed: 1200,
    landingError: 3,
    velocityError: 0.005,
    aimsAtBricks: true,
  },
  // Feasibility oracle retained separately from human sensitivity models.
  ideal: {
    reaction: 0,
    observation: 0,
    paddleSpeed: Infinity,
    landingError: 0,
    velocityError: 0,
    aimsAtBricks: true,
  },
};

function randomStream(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const round = (n) => Math.round(n * 10) / 10;
const average = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

function observe(engine, C, profile, random, levelIndex) {
  const p = engine.scene.paddle;
  const falling = engine.scene.balls
    .filter((ball) => ball.vy > 0 && ball.y <= p.y)
    .sort((a, b) => (p.y - a.y) / a.vy - (p.y - b.y) / b.vy);
  if (!falling.length) {
    const drop = engine.scene.powerUpDrops
      .filter((d) => d.alive)
      .sort((a, b) => b.y - a.y)[0];
    return drop ? drop.x : p.x;
  }
  const ball = falling[0];
  const observedVx = ball.vx * (1 + (random() * 2 - 1) * profile.velocityError);
  const observedVy = ball.vy * (1 + (random() * 2 - 1) * profile.velocityError);
  const t = Math.max(
    0,
    (p.y - p.height / 2 - ball.radius - ball.y) / observedVy,
  );
  const width = C.SCREEN_W - 2 * ball.radius;
  let projected =
    (((ball.x - ball.radius + observedVx * t) % (2 * width)) + 2 * width) %
    (2 * width);
  if (projected > width) projected = 2 * width - projected;
  const landing = ball.radius + projected;
  let offset = Math.sin(engine.elapsed * 0.73) * p.width * 0.12;
  if (profile.aimsAtBricks) {
    const targets = engine.scene.brickField.bricks
      .flat()
      .filter((b) => b?.alive);
    const target =
      targets[
        Math.floor(engine.elapsed * 0.41 + levelIndex * 17) % targets.length
      ];
    if (target) {
      const rect = engine.scene.brickField.getBrickRect(target.row, target.col);
      const angle = Math.atan2(
        rect.x + rect.w / 2 - landing,
        p.y - rect.y - rect.h / 2,
      );
      offset = ((angle / C.MAX_REFLECT_ANGLE) * p.width) / 2;
    }
  }
  // A triangular distribution gives many small errors and bounded bad reads.
  const error = (random() + random() - 1) * profile.landingError * 2;
  return landing - clamp(offset, -p.width * 0.4, p.width * 0.4) + error;
}

function simulate({ GameEngine, C }, level, index, tier, seed, seconds) {
  const profile = profiles[tier];
  const controlRandom = randomStream(seed ^ 0xa7e192cd);
  const originalRandom = Math.random;
  Math.random = randomStream(seed);
  const engine = new GameEngine(level, index);
  const collected = {};
  const activate = engine.scene._activatePowerUp.bind(engine.scene);
  engine.scene._activatePowerUp = (type) => {
    collected[type] = (collected[type] || 0) + 1;
    activate(type);
  };
  let targetX = engine.scene.paddle.x;
  let nextObservation = 0;
  let lastFeedback = 0;
  let pulses = 0;
  let losses = 0;
  let maxBalls = 1;
  let maxLives = engine.scene.lives;
  let maxBallSpeed = level.ballSpeed;
  let poweredFrames = 0;
  let frames = 0;
  let finite = true;
  const pending = [];
  try {
    while (frames < Math.ceil(seconds / C.FIXED_DT)) {
      if (engine.status === "ready") {
        pending.length = 0;
        targetX = engine.scene.paddle.x;
        engine.launch();
      }
      if (engine.status !== "playing") break;
      const now = frames * C.FIXED_DT;
      if (now + 1e-8 >= nextObservation) {
        pending.push({
          due: now + profile.reaction,
          x: observe(engine, C, profile, controlRandom, index),
        });
        nextObservation = now + Math.max(C.FIXED_DT, profile.observation);
      }
      while (pending.length && pending[0].due <= now + 1e-8)
        targetX = pending.shift().x;
      const paddle = engine.scene.paddle;
      const bounded = clamp(
        targetX,
        paddle.width / 2,
        C.SCREEN_W - paddle.width / 2,
      );
      const travel = profile.paddleSpeed * C.FIXED_DT;
      engine.move(paddle.x + clamp(bounded - paddle.x, -travel, travel));
      if (engine.getSnapshot().pulseReady && engine.activatePulse()) pulses++;
      engine.update(C.FIXED_DT);
      frames++;
      maxBalls = Math.max(maxBalls, engine.scene.balls.length);
      maxLives = Math.max(maxLives, engine.scene.lives);
      if (engine.scene.activePowerUps.length) poweredFrames++;
      for (const ball of engine.scene.balls) {
        maxBallSpeed = Math.max(maxBallSpeed, Math.hypot(ball.vx, ball.vy));
        if (![ball.x, ball.y, ball.vx, ball.vy].every(Number.isFinite))
          finite = false;
      }
      for (const event of engine.feedback) {
        if (event.id <= lastFeedback) continue;
        if (event.kind === "lifeLost") losses++;
        lastFeedback = event.id;
      }
      if (!finite) break;
    }
    const snapshot = engine.getSnapshot();
    return {
      stage: index + 1,
      name: level.name,
      tier,
      seed,
      status: finite ? snapshot.status : "invalid",
      seconds: round(engine.elapsed),
      clearedPercent: round((snapshot.destroyed / snapshot.total) * 100),
      losses,
      lives: snapshot.lives,
      maxLives,
      maxBalls,
      maxBallSpeed: round(maxBallSpeed),
      pulses,
      collected,
      poweredPercent: round((poweredFrames / Math.max(1, frames)) * 100),
    };
  } finally {
    engine.dispose();
    Math.random = originalRandom;
  }
}

async function main() {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2)
    args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
  const root = resolve(__dirname, "..");
  if (!args.source)
    execFileSync(process.execPath, ["web/game/build-legacy.cjs"], {
      cwd: root,
    });
  const { createServer } = await import("vite");
  const server = await createServer({
    root,
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [], entries: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const api = await server.ssrLoadModule(
      args.source || "/web/game/engine.ts",
    );
    const tiers = (args.tiers || "casual,skilled,expert,ideal").split(",");
    for (const tier of tiers)
      if (!profiles[tier]) throw new Error(`Unknown tier: ${tier}`);
    const seeds = Number(args.seeds || 3);
    const seconds = Number(args.seconds || 600);
    const stages = args.stages
      ? args.stages.split(",").map(Number)
      : api.levels.map((_, i) => i + 1);
    const runs = [];
    for (const tier of tiers) {
      for (const stage of stages) {
        const level = api.levels[stage - 1];
        if (!level) throw new Error(`Unknown stage: ${stage}`);
        for (let attempt = 0; attempt < seeds; attempt++) {
          const run = simulate(
            api,
            level,
            stage - 1,
            tier,
            4917 + stage - 1 + attempt * 1009,
            seconds,
          );
          runs.push(run);
          console.error(
            `${tier.padEnd(7)} ${String(stage).padStart(2)} ${attempt + 1}/${seeds} ${run.status.padEnd(7)} ${String(run.seconds).padStart(5)}s ${String(run.clearedPercent).padStart(5)}% lost=${run.losses} balls=${run.maxBalls}`,
          );
        }
      }
    }
    const summary = Object.fromEntries(
      tiers.map((tier) => {
        const selected = runs.filter((run) => run.tier === tier);
        const wins = selected.filter((run) => run.status === "won");
        const winMean = average(wins.map((run) => run.seconds));
        return [
          tier,
          {
            runs: selected.length,
            wins: wins.length,
            clearRatePercent: round((wins.length / selected.length) * 100),
            meanWinSeconds: winMean === null ? null : round(winMean),
            meanClearedPercent: round(
              average(selected.map((run) => run.clearedPercent)),
            ),
            meanLosses: round(average(selected.map((run) => run.losses))),
            totalLosses: selected.reduce((sum, run) => sum + run.losses, 0),
            meanPickups: round(
              average(
                selected.map((run) =>
                  Object.values(run.collected).reduce(
                    (sum, count) => sum + count,
                    0,
                  ),
                ),
              ),
            ),
            meanPoweredPercent: round(
              average(selected.map((run) => run.poweredPercent)),
            ),
            maxBalls: Math.max(...selected.map((run) => run.maxBalls)),
            maxLives: Math.max(...selected.map((run) => run.maxLives)),
          },
        ];
      }),
    );
    const report = {
      methodology:
        "Deterministic synthetic control sensitivity; not a prediction of human success. Identical seeds per tier; independently seeded observation errors; real gameplay callbacks; no state correction. Ideal is a feasibility oracle.",
      simulationSecondsLimit: seconds,
      seedCountPerStage: seeds,
      profiles: Object.fromEntries(
        tiers.map((tier) => [
          tier,
          {
            ...profiles[tier],
            paddleSpeed: Number.isFinite(profiles[tier].paddleSpeed)
              ? profiles[tier].paddleSpeed
              : "unlimited",
          },
        ]),
      ),
      summary,
      runs,
    };
    if (args.out)
      writeFileSync(resolve(args.out), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await server.close();
  }
}

module.exports = { profiles, randomStream, observe, simulate };
if (require.main === module)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
