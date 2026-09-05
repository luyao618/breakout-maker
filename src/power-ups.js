// src/power-ups.js
// Provides: BALANCE, PowerUpType, POWER_UP_WEIGHTS, POWER_UP_DROP_CHANCE

/** Shared tactical limits for the original simulation and modern presentation. */
const BALANCE = Object.freeze({
  maxBalls: 4,
  fireballDuration: 4,
  fireballContacts: 6,
  wideDuration: 7,
  wideMultiplier: 1.25,
  maxLifeRepairs: 1,
  dropChance: 0.07,
  dropCooldown: 5,
  maxDrops: 2,
  dropPity: 18,
  pulseEnergyPerBrick: 4,
  pulseEnergyPerArmorHit: 1,
  pulseRadius: 80,
  pulseTargets: 5,
  pulseDuration: 0.8,
  acceleratorMultiplier: 1.12,
  maxSpeedMultiplier: 1.3,
  maxScoreMultiplier: 4,
});

const PowerUpType = {
  SPLIT: 'split',             // Add two ordinary copies of one ball, up to four.
  MULTI_SHOT: 'multiShot',    // Paddle fires two ordinary balls, up to four.
  FIREBALL: 'fireball',       // One ball: four seconds or six brick contacts.
  WIDE_PADDLE: 'widePaddle', // Paddle 1.25× wider for seven seconds.
  EXTRA_LIFE: 'extraLife',    // Repair one lost life, once per run.
};

/** Life repairs are rare and ineligible while at full starting lives. */
const POWER_UP_WEIGHTS = [
  { type: PowerUpType.SPLIT,       weight: 23 },
  { type: PowerUpType.MULTI_SHOT,  weight: 19 },
  { type: PowerUpType.FIREBALL,    weight: 26 },
  { type: PowerUpType.WIDE_PADDLE, weight: 29 },
  { type: PowerUpType.EXTRA_LIFE,  weight: 3 },
];

const POWER_UP_DROP_CHANCE = BALANCE.dropChance;
