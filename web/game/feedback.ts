import type { GameFeedback, PowerUpKind } from "./types";

export type { GameFeedback } from "./types";

export const POWER_COLORS: Record<PowerUpKind, string> = {
  split: "#71f9ff",
  multiShot: "#b791ff",
  fireball: "#ff8955",
  widePaddle: "#8fffc5",
  extraLife: "#ff86b5",
};

/** Each renderer/audio consumer tracks its own last id; neither drains the feed. */
export class FeedbackStream {
  private nextId = 0;
  private readonly events: GameFeedback[] = [];

  get recent(): readonly GameFeedback[] {
    return this.events;
  }

  emit(time: number, event: Omit<GameFeedback, "id" | "time">): GameFeedback {
    const entry = { ...event, id: ++this.nextId, time };
    this.events.push(entry);
    if (this.events.length > 64) this.events.splice(0, this.events.length - 64);
    return entry;
  }

  clear(): void {
    this.events.length = 0;
    // Keep ids monotonic when restarting the same engine, so consumers recover.
  }
}
