# NOCTURNE arcade experience

The play page fills the viewport with a centered lunar court. A compact header carries navigation, score, lives and live status; controls below the court expose Supernova, audio, quality and help. The lobby presents campaign, local image conversion and AI creation. See the [visual contract](design-notes.md) for materials and camera behavior.

## Aim, return, choose

The core loop is to read the next return, place the paddle for an angle and open a route through the bricks. Armor blocks fireball penetration, reactor weak points damage their eight neighboring cells when directly destroyed, and accelerator bricks increase the striking ball's speed up to 130% of base speed. Reactor splash does not cascade.

All 13 stages are selectable. The first twelve introduce tactical layouts; stage 13 preserves the original Lu Yuan dedication. Briefings explain useful routes before launch without covering active play. Layout and editing rules live in [levels/README.md](../levels/README.md).

## Supernova and supplies

Natural brick kills add four energy; nonlethal armor hits add one. At 100 energy, the player can press E or use the bottom skill button. Supernova anchors to an exposed brick near the paddle's horizontal position and deals one damage to at most five exposed bricks within its local radius. A directly destroyed reactor can splash nearby cells. Pulse and splash damage do not recharge the skill or create drops, and activating it does not grant fireball.

Natural kills have a 7% drop chance. The pity threshold is 18 natural kills without a drop; both random and pity drops respect a five-second cooldown and a two-drop field limit. Pickups require paddle contact.

- Split and multishot each add two ordinary balls, capped at four total.
- Fire strengthens one ball for four seconds or six brick contacts; armor reflects it.
- Wide paddle adds 25% width for seven seconds.
- Life repair restores one lost life per run, capped at the starting count.
- Natural kills extend combos up to a 4× score multiplier; collateral destruction awards base points.

Shared values live in [src/power-ups.js](../src/power-ups.js); charge, drop eligibility and collateral scoring are implemented in [web/game/engine.ts](game/engine.ts). The [balance calibration](../tools/balance-calibration.md) contains dated simulation results, not current human difficulty measurements.

## Feedback and comfort

Simulation events drive spatial impact audio, pitched brick hits, restrained fragments and localized skill effects. The recessed paddle core indicates charged and wide states. Pickup messages, combo text and active-power timers occupy the header at all viewport sizes; collection never adds a text card or a pickup burst over the ball path.

The play camera stays fixed. Pointer smoothing runs in the simulation so the paddle model, attached ball and collision body agree. Preserve direct keyboard takeover and pointer-capture cleanup.

Music is off until enabled. Muting, pausing and leaving the active window stop audio; pause freezes simulation, power and skill timers. Support reduced motion and low quality without changing rules. Keep the Canvas fallback playable when WebGL is unavailable.
