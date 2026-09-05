# Campaign balance calibration

Run `node tools/balance-sim.cjs --out /tmp/balance.json --seeds 3`. The tool runs all 13 stages with real gameplay and controls only. `--tiers ideal --stages 1,7,13` selects a smaller feasibility pass. `--source /absolute/path/engine.ts` runs a preserved module and its relative dependencies.

These are synthetic control sensitivity models, **not measured human players or predicted player win rates**. All models predict wall reflections; delayed observations become stale after brick bounces. They use independently seeded control errors, finite hand movement, and automatic skill activation. Casual models do not deliberately aim toward bricks. The ideal model has no latency/error/travel limit and is a separate feasibility check.

| Model | Reaction | Observation interval | Paddle travel | Landing error | Velocity error |
| --- | ---: | ---: | ---: | ---: | ---: |
| casual | 240 ms | 120 ms | 520 px/s | ±36 px, triangular | ±5% |
| skilled | 140 ms | 80 ms | 800 px/s | ±16 px, triangular | ±2% |
| expert | 75 ms | 50 ms | 1200 px/s | ±6 px, triangular | ±0.5% |
| ideal | 0 ms | 0 ms | unlimited px/s | ±0 px, triangular | ±0% |

## Before redesign

Baseline: commit `cc136d6`; 3 seeded attempts per stage per model; 600 simulated seconds maximum. All **156/156** attempts cleared. Every attempt reached **24 simultaneous balls**; every model reached **9 lives**. Only one life was lost across all attempts. This confirms that automatic power escalation overwhelms the differences between control models.

| Stage | Casual mean clear | Skilled mean clear | Expert mean clear | Ideal mean clear |
| --- | ---: | ---: | ---: | ---: |
| 1 | 15.6 s | 13.9 s | 12.5 s | 12.2 s |
| 2 | 16.9 s | 20.1 s | 20.2 s | 16.9 s |
| 3 | 17.8 s | 16.0 s | 15.8 s | 15.5 s |
| 4 | 21.8 s | 18.1 s | 21.4 s | 22.0 s |
| 5 | 20.8 s | 15.9 s | 15.7 s | 14.4 s |
| 6 | 14.1 s | 13.9 s | 14.3 s | 12.1 s |
| 7 | 17.8 s | 16.6 s | 15.9 s | 15.1 s |
| 8 | 17.3 s | 14.4 s | 11.2 s | 11.1 s |
| 9 | 11.6 s | 10.4 s | 10.4 s | 9.6 s |
| 10 | 13.9 s | 17.5 s | 13.6 s | 13.2 s |
| 11 | 13.6 s | 13.3 s | 14.2 s | 11.6 s |
| 12 | 16.1 s | 16.9 s | 14.2 s | 13.9 s |
| 13 | 15.7 s | 13.9 s | 19.0 s | 16.1 s |

Overall mean clear times: casual 16.4 s, skilled 15.5 s, expert 15.3 s, ideal 14.1 s. Example: stage 1 casual seed 4917 cleared in 14.5 s, collecting 28 drops (6 split, 9 wide, 3 multishot, 5 life, 5 fire) with active powers during 85.8% of play.

## After tactical redesign

The same four controller profiles and three seeds per stage were replayed against the new campaign and mechanics. All 39 ideal-controller runs won without physics correction. The casual controller now loses lives and fails some later stages; higher precision improves clear time. Skilled/expert controllers are still strong synthetic predictors, so their perfect completion should not be read as real player difficulty.

| Model | Cleared | Mean successful clear | Total lives lost | Peak balls | Peak lives |
| --- | ---: | ---: | ---: | ---: | ---: |
| casual | 28 / 39 | 170.9 s | 59 | 4 | 3 |
| skilled | 39 / 39 | 150.2 s | 3 | 4 | 3 |
| expert | 39 / 39 | 116.2 s | 0 | 4 | 3 |
| ideal | 39 / 39 | 78.9 s | 0 | 4 | 3 |

| Stage | Casual clears | Casual successful time | Ideal successful time |
| --- | ---: | ---: | ---: |
| 1 | 3 / 3 | 198.5 s | 116.7 s |
| 2 | 3 / 3 | 145.2 s | 71.2 s |
| 3 | 3 / 3 | 171.1 s | 67.3 s |
| 4 | 3 / 3 | 164.2 s | 99.5 s |
| 5 | 2 / 3 | 149.0 s | 83.5 s |
| 6 | 2 / 3 | 141.3 s | 64.0 s |
| 7 | 3 / 3 | 136.4 s | 98.2 s |
| 8 | 3 / 3 | 185.1 s | 74.5 s |
| 9 | 1 / 3 | 145.6 s | 47.4 s |
| 10 | 2 / 3 | 172.6 s | 80.1 s |
| 11 | 1 / 3 | 165.9 s | 54.0 s |
| 12 | 1 / 3 | 204.7 s | 82.2 s |
| 13 | 1 / 3 | 341.3 s | 87.0 s |

Interpretation: the runaway loop is removed; no run exceeds four balls or starting lives. The early stages leave room to practice angles, and later stages combine smaller paddles, armor gates and speed hazards. Successful synthetic clears commonly take one to three minutes, rather than around fifteen seconds. Some cleanup runs are longer; this is a first calibrated release, with human feedback still needed for fine tuning.

Physics was also corrected: brick sweep tests now use the movement actually advanced, and departing balls do not re-hit the same armor face. This correction is included in the comparison alongside changed campaign geometry and powers, so the comparison does not isolate a single balance parameter.
