import { afterEach, describe, expect, it, vi } from "vitest";
import { SoundEngine } from "../../web/audio/sound-engine";
import type { GameFeedback, PowerUpKind } from "../../web/game/types";

function param() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    cancelAndHoldAtTime: vi.fn(),
  };
}

function node() {
  return { connect: vi.fn(), disconnect: vi.fn() };
}

function source() {
  return {
    ...node(),
    frequency: param(),
    detune: param(),
    type: "sine",
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
}

function fakeAudio() {
  const sources: ReturnType<typeof source>[] = [];
  const panners: (ReturnType<typeof node> & {
    pan: ReturnType<typeof param>;
  })[] = [];
  const gains: (ReturnType<typeof node> & {
    gain: ReturnType<typeof param>;
  })[] = [];
  class Context {
    currentTime = 0;
    sampleRate = 48000;
    state = "running";
    destination = node();
    onstatechange: (() => void) | null = null;
    resume = vi.fn(async () => {
      this.state = "running";
    });
    close = vi.fn(async () => {
      this.state = "closed";
    });
    createGain = vi.fn(() => {
      const gain = { ...node(), gain: param() };
      gains.push(gain);
      return gain;
    });
    createDynamicsCompressor = vi.fn(() => ({
      ...node(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
    }));
    createBuffer = vi.fn((_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }));
    createOscillator = vi.fn(() => {
      const oscillator = source();
      sources.push(oscillator);
      return oscillator;
    });
    createBufferSource = vi.fn(() => {
      const buffer = source();
      sources.push(buffer);
      return buffer;
    });
    createBiquadFilter = vi.fn(() => ({
      ...node(),
      frequency: param(),
      Q: param(),
      type: "lowpass",
    }));
    createStereoPanner = vi.fn(() => {
      const panner = { ...node(), pan: param() };
      panners.push(panner);
      return panner;
    });
  }
  const context = new Context();
  const constructor = vi.fn(function AudioContext() {
    return context;
  });
  vi.stubGlobal("window", { AudioContext: constructor });
  return {
    context,
    sources,
    gains,
    panners,
    constructor,
    finishSources() {
      for (const voice of sources) voice.onended?.();
    },
  };
}

function event(
  kind: GameFeedback["kind"],
  overrides: Partial<GameFeedback> = {},
): GameFeedback {
  return {
    id: 1,
    time: 0,
    kind,
    x: 187.5,
    y: 200,
    color: "#fff",
    strength: 1,
    combo: 1,
    points: 10,
    ...overrides,
  };
}

const engines: SoundEngine[] = [];
function engine() {
  const sound = new SoundEngine();
  engines.push(sound);
  return sound;
}

afterEach(() => {
  for (const sound of engines.splice(0)) sound.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("procedural audio lifecycle", () => {
  it("is lazy, leaves music off, and safely handles missing or denied devices", () => {
    const unavailable = engine();
    expect(() => unavailable.unlock()).not.toThrow();
    expect(() => unavailable.play(event("pulse"))).not.toThrow();
    vi.stubGlobal("window", {
      AudioContext: function () {
        throw new Error("denied");
      },
    });
    expect(() => unavailable.unlock()).not.toThrow();
    expect(unavailable.diagnostics.initialized).toBe(false);

    const audio = fakeAudio();
    const sound = engine();
    expect(audio.constructor).not.toHaveBeenCalled();
    sound.unlock();
    sound.unlock();
    expect(audio.constructor).toHaveBeenCalledTimes(1);
    expect(audio.context.createBuffer).toHaveBeenCalledTimes(1);
    expect(sound.diagnostics).toMatchObject({
      initialized: true,
      activeVoices: 0,
      musicEnabled: false,
      musicScheduled: false,
    });
  });

  it("keeps dense multiball audio bounded and releases every ended source", () => {
    const audio = fakeAudio();
    const sound = engine();
    sound.unlock();
    for (let i = 0; i < 300; i++) {
      audio.context.currentTime = i * 0.031;
      sound.play(event("brick", { combo: i, x: i % 375 }));
      if (i % 11 === 0) sound.play(event("pulse"));
      expect(sound.diagnostics.activeVoices).toBeLessThanOrEqual(48);
    }
    expect(audio.context.createBuffer).toHaveBeenCalledTimes(1);
    expect(sound.diagnostics.activeVoices).toBeGreaterThan(0);
    audio.finishSources();
    expect(sound.diagnostics.activeVoices).toBe(0);
    expect(
      audio.sources.every((voice) => voice.disconnect.mock.calls.length === 1),
    ).toBe(true);
  });

  it("limits same-instant impacts while preserving distinct power pickups and spatial positions", () => {
    const audio = fakeAudio();
    const sound = engine();
    sound.unlock();
    sound.play(event("paddle", { x: 0 }));
    const count = audio.sources.length;
    sound.play(event("paddle", { id: 2, x: 375 }));
    expect(audio.sources).toHaveLength(count);
    expect(audio.panners[0].pan.value).toBe(-0.85);
    audio.context.currentTime = 0.1;
    sound.play(event("wall", { x: 375 }));
    expect(audio.panners.at(-1)!.pan.value).toBe(0.85);
    const before = sound.diagnostics.playedEvents;
    for (const power of [
      "split",
      "multiShot",
      "fireball",
      "widePaddle",
      "extraLife",
    ] as PowerUpKind[]) {
      sound.play(event("powerCollect", { power }));
    }
    expect(sound.diagnostics.playedEvents - before).toBe(5);
    expect(sound.diagnostics.droppedEvents).toBe(1);
  });

  it("cancels all voices and music on mute/pause, then restarts without a note backlog", () => {
    vi.useFakeTimers();
    const audio = fakeAudio();
    const sound = engine();
    sound.setMusic(true);
    sound.unlock();
    sound.setIntensity(1);
    expect(sound.diagnostics.musicScheduled).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    sound.play(event("pulse"));
    const before = audio.sources.length;
    sound.setPaused(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(
      audio.sources.every((voice) => voice.stop.mock.calls.length >= 2),
    ).toBe(true);
    sound.play(event("powerCollect"));
    expect(audio.sources).toHaveLength(before);
    audio.finishSources();
    audio.context.currentTime = 50;
    sound.setPaused(false);
    expect(vi.getTimerCount()).toBe(1);
    const newSources = audio.sources.slice(before);
    expect(newSources.length).toBeGreaterThan(0);
    expect(
      newSources.every((voice) => voice.start.mock.calls[0][0] >= 50),
    ).toBe(true);
    sound.setMuted(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(sound.diagnostics.musicScheduled).toBe(false);
    sound.setMusic(false);
    sound.setMuted(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("disposes scheduled resources even when a closed context never sends ended events", () => {
    vi.useFakeTimers();
    const audio = fakeAudio();
    const sound = engine();
    sound.setMusic(true);
    sound.unlock();
    sound.play(event("win"));
    expect(sound.diagnostics.activeVoices).toBeGreaterThan(0);
    sound.dispose();
    sound.dispose();
    expect(sound.diagnostics).toMatchObject({
      initialized: false,
      activeVoices: 0,
      musicScheduled: false,
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(audio.context.close).toHaveBeenCalledTimes(1);
    expect(audio.context.onstatechange).toBeNull();
    expect(audio.sources.every((voice) => voice.onended === null)).toBe(true);
  });
});
