// src/power-ups.js
// Provides: PowerUpType, POWER_UP_WEIGHTS, POWER_UP_DROP_CHANCE
// Depends: (none)

const PowerUpType = {
  SPLIT: 'split',             // 1 ball → 3
  MULTI_SHOT: 'multiShot',   // Paddle fires 3 new balls
  FIREBALL: 'fireball',      // Ball burns through bricks for 8 seconds
  WIDE_PADDLE: 'widePaddle', // Paddle 1.5× wider for 10 seconds
  EXTRA_LIFE: 'extraLife',   // +1 life
};

/** Weighted probability table for power-up drops. */
const POWER_UP_WEIGHTS = [
  { type: PowerUpType.SPLIT,       weight: 25 },
  { type: PowerUpType.MULTI_SHOT,  weight: 20 },
  { type: PowerUpType.FIREBALL,    weight: 15 },
  { type: PowerUpType.WIDE_PADDLE, weight: 25 },
  { type: PowerUpType.EXTRA_LIFE,  weight: 15 },
];

/** Chance (0–1) that a destroyed brick drops a power-up. */
const POWER_UP_DROP_CHANCE = 0.15;
