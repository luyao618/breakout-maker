import { afterEach, describe, expect, it, vi } from "vitest";
import { GameEngine, levels, C } from "../../web/game/engine";

afterEach(() => vi.restoreAllMocks());

describe("authored campaign playability", () => {
  it.each(levels.map((level, index) => ({ level, index })))(
    "clears $level.name with legal controls and finite physics",
    ({ level, index }) => {
      let seed = 4917 + index;
      vi.spyOn(Math, "random").mockImplementation(() => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      });
      const e = new GameEngine(level, index);
      let pulses = 0;
      let finite = true;
      let frames = 0;
      // The preserved dedication has 778 multi-HP text pixels; keep the normal
      // campaign's 10-minute bound but allow 20 simulated minutes for this bitmap.
      const maxFrames = index === 12 ? 72000 : 36000;
      while (frames < maxFrames && e.status !== "won" && e.status !== "lost") {
        if (e.status === "ready") e.launch();
        if (e.getSnapshot().pulseReady && e.activatePulse()) pulses++;
        if (e.status !== "playing") break;
        const p = e.scene.paddle;
        const falling = e.scene.balls
          .filter((b) => b.vy > 0 && b.y <= p.y)
          .sort((a, b) => (p.y - a.y) / a.vy - (p.y - b.y) / b.vy);
        if (falling.length) {
          const b = falling[0],
            t = Math.max(0, (p.y - p.height / 2 - b.radius - b.y) / b.vy),
            w = C.SCREEN_W - 2 * b.radius;
          let projected =
            (((b.x - b.radius + b.vx * t) % (2 * w)) + 2 * w) % (2 * w);
          if (projected > w) projected = 2 * w - projected;
          const landing = b.radius + projected;
          const targets = e.scene.brickField.bricks
            .flat()
            .filter((b) => b?.alive);
          const target =
            targets[Math.floor(e.elapsed * 0.41 + index * 17) % targets.length];
          let offset = Math.sin(e.elapsed * 0.73) * p.width * 0.25;
          if (target) {
            const r = e.scene.brickField.getBrickRect(target.row, target.col);
            const angle = Math.atan2(
              r.x + r.w / 2 - landing,
              p.y - r.y - r.h / 2,
            );
            offset = ((angle / C.MAX_REFLECT_ANGLE) * p.width) / 2;
          }
          e.move(
            landing - Math.max(-p.width * 0.4, Math.min(p.width * 0.4, offset)),
          );
        } else {
          const drop = e.scene.powerUpDrops
            .filter((d) => d.alive)
            .sort((a, b) => b.y - a.y)[0];
          if (drop) e.move(drop.x);
        }
        e.update(C.FIXED_DT);
        frames++;
        if (
          e.scene.balls.some(
            (b) => ![b.x, b.y, b.vx, b.vy].every(Number.isFinite),
          )
        ) {
          finite = false;
          break;
        }
      }
      const result = e.getSnapshot();
      expect(finite).toBe(true);
      expect(result.status).toBe("won");
      expect(result.destroyed).toBe(level.bricks.length);
      expect(pulses).toBeGreaterThan(0);
      e.dispose();
    },
  );
});
