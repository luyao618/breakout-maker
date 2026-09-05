import type { GameFeedback, PowerUpKind } from "../game/types";

type Bus = "sfx" | "music";
type Priority = "normal" | "important";

interface Voice {
  source: AudioScheduledSourceNode;
  envelope: GainNode;
  nodes: AudioNode[];
  bus: Bus;
}

interface Note {
  frequency: number;
  endFrequency?: number;
  type?: OscillatorType;
  duration?: number;
  attack?: number;
  gain?: number;
  pan?: number;
  delay?: number;
  detune?: number;
  cutoff?: number;
  endCutoff?: number;
  bus?: Bus;
  priority?: Priority;
  at?: number;
}

interface Noise extends Omit<Note, "frequency" | "endFrequency" | "type"> {
  filter?: BiquadFilterType;
  resonance?: number;
}

const MAX_VOICES = 48;
const MAX_MUSIC_VOICES = 16;
const MAX_ORDINARY_EFFECTS = 26;
const BPM = 108;
const STEP_SECONDS = 60 / BPM / 4;
const EPSILON = 0.0001;
const BOARD_WIDTH = 375;
const PENTATONIC = [0, 3, 5, 7, 10];
const POWER_ROOT: Record<PowerUpKind, number> = {
  split: 72,
  multiShot: 74,
  fireball: 60,
  widePaddle: 67,
  extraLife: 79,
};
const RATE_LIMIT: Record<GameFeedback["kind"], number> = {
  brick: 0.028,
  paddle: 0.055,
  wall: 0.065,
  launch: 0.08,
  lifeLost: 0.3,
  powerSpawn: 0.08,
  powerCollect: 0.06,
  pulse: 0.3,
  win: 0.5,
  lose: 0.5,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * The game has no downloaded audio or permanent oscillators. Every sound is a
 * short, spatially placed voice; a shared noise buffer and bounded polyphony
 * keep image levels and twenty-four-ball rallies cheap.
 */
export class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private music: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private voices = new Set<Voice>();
  private lastEvents = new Map<string, number>();
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private musicStep = 0;
  private intensity = 0;
  private muted = false;
  private musicEnabled = false;
  private paused = false;
  private playedEvents = 0;
  private droppedEvents = 0;

  /** Safe to call from every pointer/key gesture, including after iOS resumes. */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.context) {
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      try {
        const context = new AudioContextClass({ latencyHint: "interactive" });
        this.context = context;
        this.master = context.createGain();
        this.effects = context.createGain();
        this.music = context.createGain();
        this.compressor = context.createDynamicsCompressor();
        this.master.gain.value = this.muted || this.paused ? 0 : 0.8;
        this.effects.gain.value = 0.85;
        this.music.gain.value = 0.5;
        this.compressor.threshold.value = -15;
        this.compressor.knee.value = 12;
        this.compressor.ratio.value = 7;
        this.compressor.attack.value = 0.004;
        this.compressor.release.value = 0.16;
        this.effects.connect(this.master);
        this.music.connect(this.master);
        this.master.connect(this.compressor);
        this.compressor.connect(context.destination);

        // Allocate once; every impact/hat/whoosh reuses this immutable buffer.
        this.noiseBuffer = context.createBuffer(
          1,
          context.sampleRate,
          context.sampleRate,
        );
        const channel = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < channel.length; i++) {
          channel[i] = Math.random() * 2 - 1;
        }
        context.onstatechange = () => {
          if (context !== this.context) return;
          if (context.state !== "running") this.stopMusic();
          else this.syncMusic();
        };
      } catch {
        // A missing/denied device must never prevent playing the game.
        this.dispose();
        return;
      }
    }

    const context = this.context;
    if (context.state === "suspended") {
      void context.resume().then(
        () => {
          if (context === this.context) this.syncMusic();
        },
        () => {},
      );
    }
    this.syncMusic();
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    this.syncOutput();
  }

  /** Music is opt-in. Turning it off also cancels already scheduled notes. */
  setMusic(enabled: boolean): void {
    this.musicEnabled = enabled;
    this.syncMusic();
  }

  setIntensity(intensity: number): void {
    this.intensity = clamp(intensity, 0, 1);
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.syncOutput();
  }

  play(event: GameFeedback): void {
    const context = this.context;
    if (!context || context.state !== "running" || this.muted || this.paused)
      return;

    const key =
      event.kind === "powerCollect" || event.kind === "powerSpawn"
        ? `${event.kind}:${event.power}`
        : event.kind;
    const previous = this.lastEvents.get(key) ?? -Infinity;
    if (context.currentTime - previous < RATE_LIMIT[event.kind]) {
      this.droppedEvents++;
      return;
    }
    this.lastEvents.set(key, context.currentTime);
    this.playedEvents++;
    const pan = clamp((event.x / BOARD_WIDTH) * 2 - 1, -0.85, 0.85);
    const strength = clamp(event.strength, 0.15, 1.5);

    switch (event.kind) {
      case "brick": {
        const destroyed = (event.points ?? 0) > 0 || event.strength >= 0.8;
        if (!destroyed) {
          this.tone({
            frequency: 180,
            endFrequency: 85,
            type: "triangle",
            duration: 0.095,
            gain: 0.075,
            pan,
          });
          this.noise({ duration: 0.038, gain: 0.027, cutoff: 1700, pan });
          break;
        }
        const combo = Math.max(0, Math.floor(event.combo ?? 1) - 1);
        const degree = Math.min(14, combo);
        const pitch = hz(
          72 + PENTATONIC[degree % 5] + Math.floor(degree / 5) * 12,
        );
        // Tuned glass plus a low body: musical combos retain tactile weight.
        this.tone({
          frequency: pitch,
          endFrequency: pitch * 0.985,
          duration: 0.2,
          gain: 0.082,
          pan,
        });
        this.tone({
          frequency: pitch * 2.003,
          duration: 0.09,
          gain: 0.018,
          pan,
        });
        this.tone({
          frequency: 115 + strength * 30,
          endFrequency: 52,
          type: "triangle",
          duration: 0.11,
          gain: 0.08,
          pan,
        });
        this.noise({
          duration: 0.09,
          cutoff: 4400,
          endCutoff: 1800,
          gain: 0.045 * Math.min(strength, 1),
          pan,
        });
        break;
      }
      case "paddle":
        this.tone({
          frequency: 230,
          endFrequency: 65,
          type: "triangle",
          duration: 0.15,
          gain: 0.15,
          pan,
        });
        this.tone({
          frequency: 1180,
          endFrequency: 690,
          duration: 0.055,
          gain: 0.04,
          pan,
        });
        this.noise({ duration: 0.024, gain: 0.042, cutoff: 2600, pan });
        break;
      case "wall":
        this.tone({
          frequency: 780,
          endFrequency: 620,
          duration: 0.045,
          gain: 0.034,
          pan,
        });
        break;
      case "launch":
        this.tone({
          frequency: 120,
          endFrequency: 520,
          type: "triangle",
          duration: 0.2,
          gain: 0.1,
          pan,
        });
        this.arpeggio([72, 79, 84], pan, 0.045, 0.045);
        this.noise({
          duration: 0.16,
          cutoff: 500,
          endCutoff: 4500,
          gain: 0.035,
          pan,
        });
        break;
      case "powerSpawn": {
        const root = POWER_ROOT[event.power ?? "split"];
        this.arpeggio([root + 12, root + 19], pan, 0.07, 0.032);
        break;
      }
      case "powerCollect":
        this.collect(event.power ?? "split", pan);
        break;
      case "pulse":
        this.pulse(pan);
        break;
      case "lifeLost":
        this.arpeggio([67, 63, 60], pan, 0.11, 0.075);
        this.tone({
          frequency: 150,
          endFrequency: 42,
          type: "triangle",
          duration: 0.5,
          gain: 0.12,
          pan,
          priority: "important",
        });
        break;
      case "win":
        this.arpeggio([60, 67, 72, 75, 79, 84], 0, 0.105, 0.09);
        for (const [i, pitch] of [60, 63, 67, 72].entries()) {
          this.tone({
            frequency: hz(pitch),
            type: "triangle",
            duration: 1.4,
            attack: 0.055,
            delay: 0.62,
            gain: 0.04,
            pan: (i - 1.5) * 0.35,
            priority: "important",
          });
        }
        break;
      case "lose":
        this.arpeggio([67, 63, 60, 55, 48], 0, 0.17, 0.08);
        break;
    }
  }

  get diagnostics() {
    return Object.freeze({
      initialized: this.context !== null,
      contextState: this.context?.state ?? "unavailable",
      activeVoices: this.voices.size,
      maxVoices: MAX_VOICES,
      musicScheduled: this.scheduler !== null,
      musicEnabled: this.musicEnabled,
      muted: this.muted,
      paused: this.paused,
      intensity: this.intensity,
      playedEvents: this.playedEvents,
      droppedEvents: this.droppedEvents,
    });
  }

  dispose(): void {
    this.stopMusic();
    this.stopVoices();
    // A closed context need not dispatch pending ended callbacks.
    for (const voice of this.voices) this.releaseVoice(voice);
    const context = this.context;
    this.context = null;
    if (context) {
      context.onstatechange = null;
      if (context.state !== "closed") void context.close().catch(() => {});
    }
    for (const node of [
      this.effects,
      this.music,
      this.master,
      this.compressor,
    ]) {
      node?.disconnect();
    }
    this.effects = null;
    this.music = null;
    this.master = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.lastEvents.clear();
  }

  private collect(power: PowerUpKind, pan: number): void {
    const important = "important" as const;
    switch (power) {
      case "split":
        for (const [i, pitch] of [72, 75, 79].entries()) {
          this.tone({
            frequency: hz(pitch),
            type: "triangle",
            detune: (i - 1) * 9,
            duration: 0.55,
            gain: 0.065,
            pan: clamp(pan + (i - 1) * 0.6, -0.9, 0.9),
            priority: important,
          });
        }
        this.arpeggio([84, 91], pan, 0.1, 0.047, 0.12);
        break;
      case "multiShot":
        for (let i = 0; i < 3; i++) {
          this.tone({
            frequency: 880 * 1.33 ** i,
            endFrequency: 330 * 1.33 ** i,
            type: "sawtooth",
            cutoff: 2400,
            duration: 0.15,
            delay: i * 0.07,
            gain: 0.048,
            pan: clamp(pan + (i - 1) * 0.35, -0.9, 0.9),
            priority: important,
          });
        }
        this.arpeggio([79, 86, 91], pan, 0.08, 0.05, 0.2);
        break;
      case "fireball":
        this.noise({
          duration: 0.72,
          attack: 0.08,
          cutoff: 220,
          endCutoff: 4500,
          resonance: 0.7,
          gain: 0.16,
          pan,
          priority: important,
        });
        this.tone({
          frequency: 145,
          endFrequency: 40,
          duration: 0.6,
          gain: 0.18,
          pan,
          priority: important,
        });
        this.arpeggio([60, 67, 72], pan, 0.07, 0.065, 0.14);
        break;
      case "widePaddle":
        for (const direction of [-1, 1]) {
          this.tone({
            frequency: 180 + direction * 6,
            endFrequency: 392 + direction * 4,
            type: "triangle",
            duration: 0.48,
            attack: 0.04,
            gain: 0.075,
            pan: direction * 0.7,
            priority: important,
          });
        }
        this.arpeggio([67, 79, 86], pan, 0.07, 0.05, 0.18);
        break;
      case "extraLife":
        this.arpeggio([72, 76, 79, 84, 91], pan, 0.09, 0.073);
        this.tone({
          frequency: hz(72),
          duration: 0.9,
          delay: 0.29,
          gain: 0.038,
          pan: -pan,
          priority: important,
        });
        break;
    }
  }

  private pulse(pan: number): void {
    this.tone({
      frequency: 135,
      endFrequency: 32,
      duration: 0.85,
      gain: 0.23,
      priority: "important",
    });
    this.tone({
      frequency: 55,
      endFrequency: 110,
      type: "sawtooth",
      cutoff: 240,
      endCutoff: 1400,
      duration: 0.65,
      gain: 0.085,
      priority: "important",
    });
    this.noise({
      duration: 0.95,
      attack: 0.035,
      cutoff: 3600,
      endCutoff: 450,
      gain: 0.15,
      pan,
      priority: "important",
    });
    this.arpeggio([60, 72, 79, 84, 91], -0.4, 0.052, 0.065);
    this.arpeggio([84, 79, 72], 0.5, 0.09, 0.027, 0.31);
  }

  private arpeggio(
    notes: number[],
    pan: number,
    gap: number,
    gain: number,
    delay = 0,
  ): void {
    notes.forEach((pitch, index) => {
      this.tone({
        frequency: hz(pitch),
        type: "sine",
        duration: 0.36,
        attack: 0.005,
        gain,
        pan,
        delay: delay + index * gap,
        priority: "important",
      });
    });
  }

  private canCreate(bus: Bus, priority: Priority): boolean {
    if (!this.context || this.voices.size >= MAX_VOICES) return false;
    let musicCount = 0;
    for (const voice of this.voices) {
      if (voice.bus === "music") musicCount++;
    }
    return bus === "music"
      ? musicCount < MAX_MUSIC_VOICES
      : priority === "important" ||
          this.voices.size - musicCount < MAX_ORDINARY_EFFECTS;
  }

  private tone(note: Note): void {
    const context = this.context;
    const bus = note.bus ?? "sfx";
    if (!context || !this.canCreate(bus, note.priority ?? "normal")) return;
    const source = context.createOscillator();
    source.type = note.type ?? "sine";
    const at = (note.at ?? context.currentTime) + (note.delay ?? 0);
    const duration = note.duration ?? 0.25;
    source.frequency.setValueAtTime(note.frequency, at);
    if (note.endFrequency !== undefined) {
      source.frequency.exponentialRampToValueAtTime(
        Math.max(10, note.endFrequency),
        at + duration,
      );
    }
    source.detune.value = note.detune ?? 0;
    this.connectVoice(source, note, at, duration, bus);
  }

  private noise(options: Noise): void {
    const context = this.context;
    const bus = options.bus ?? "sfx";
    if (
      !context ||
      !this.noiseBuffer ||
      !this.canCreate(bus, options.priority ?? "normal")
    )
      return;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    this.connectVoice(
      source,
      { cutoff: 2600, ...options },
      (options.at ?? context.currentTime) + (options.delay ?? 0),
      options.duration ?? 0.12,
      bus,
      options.filter ?? "bandpass",
      options.resonance ?? 0.7,
    );
  }

  private connectVoice(
    source: AudioScheduledSourceNode,
    note: Omit<Note, "frequency">,
    at: number,
    duration: number,
    bus: Bus,
    filterType: BiquadFilterType = "lowpass",
    resonance = 0.6,
  ): void {
    const context = this.context!;
    const envelope = context.createGain();
    const nodes: AudioNode[] = [source, envelope];
    let tail: AudioNode = source;
    if (note.cutoff !== undefined) {
      const filter = context.createBiquadFilter();
      filter.type = filterType;
      filter.Q.value = resonance;
      filter.frequency.setValueAtTime(note.cutoff, at);
      if (note.endCutoff !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(
          note.endCutoff,
          at + duration,
        );
      }
      tail.connect(filter);
      tail = filter;
      nodes.push(filter);
    }
    tail.connect(envelope);
    const attack = Math.min(note.attack ?? 0.003, duration * 0.4);
    envelope.gain.setValueAtTime(EPSILON, at);
    envelope.gain.linearRampToValueAtTime(note.gain ?? 0.08, at + attack);
    envelope.gain.exponentialRampToValueAtTime(EPSILON, at + duration);
    if (typeof context.createStereoPanner === "function") {
      const panner = context.createStereoPanner();
      panner.pan.value = clamp(note.pan ?? 0, -1, 1);
      envelope.connect(panner);
      panner.connect(bus === "music" ? this.music! : this.effects!);
      nodes.push(panner);
    } else {
      envelope.connect(bus === "music" ? this.music! : this.effects!);
    }
    const voice = { source, envelope, nodes, bus };
    this.voices.add(voice);
    source.onended = () => this.releaseVoice(voice);
    source.start(at);
    source.stop(at + duration + 0.012);
  }

  private releaseVoice(voice: Voice): void {
    this.voices.delete(voice);
    voice.source.onended = null;
    for (const node of voice.nodes) node.disconnect();
  }

  private stopVoices(bus?: Bus): void {
    const at = this.context?.currentTime ?? 0;
    for (const voice of this.voices) {
      if (bus && voice.bus !== bus) continue;
      const gain = voice.envelope.gain;
      if (typeof gain.cancelAndHoldAtTime === "function")
        gain.cancelAndHoldAtTime(at);
      else gain.cancelScheduledValues(at);
      gain.setTargetAtTime(EPSILON, at, 0.004);
      try {
        voice.source.stop(at + 0.016);
      } catch {
        this.releaseVoice(voice);
      }
    }
  }

  private syncOutput(): void {
    if (this.context && this.master) {
      const silent = this.muted || this.paused;
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(
        silent ? 0 : 0.8,
        this.context.currentTime,
        0.004,
      );
      if (silent) this.stopVoices();
    }
    this.syncMusic();
  }

  private syncMusic(): void {
    const context = this.context;
    if (
      !context ||
      context.state !== "running" ||
      !this.musicEnabled ||
      this.muted ||
      this.paused
    ) {
      this.stopMusic();
      return;
    }
    if (this.scheduler !== null) return;
    this.musicStep = 0;
    this.nextStepTime = context.currentTime + 0.04;
    this.scheduleMusic();
    this.scheduler = setInterval(() => this.scheduleMusic(), 40);
  }

  private stopMusic(): void {
    if (this.scheduler !== null) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
    this.stopVoices("music");
  }

  private scheduleMusic(): void {
    const context = this.context;
    if (!context || context.state !== "running") return;
    // After a background-tab stall, start on the next beat; never replay a
    // backlog of missed notes in one burst when the browser wakes up.
    if (this.nextStepTime < context.currentTime - 0.1) {
      this.nextStepTime = context.currentTime + 0.04;
      this.musicStep = Math.ceil(this.musicStep / 16) * 16;
    }
    while (this.nextStepTime < context.currentTime + 0.16) {
      this.musicBeat(this.nextStepTime, this.musicStep++);
      this.nextStepTime += STEP_SECONDS;
    }
  }

  private musicBeat(at: number, step: number): void {
    const beat = step % 16;
    const chord = Math.floor(step / 16) % 4;
    const root = [48, 44, 51, 46][chord];
    const third = chord === 0 ? 3 : 4; // Cm → A♭ → E♭ → B♭.
    const bus = "music" as const;
    if (beat === 0) {
      for (const [index, interval] of [0, third, 7].entries()) {
        this.tone({
          frequency: hz(root + interval + 12),
          type: "triangle",
          cutoff: 800 + this.intensity * 1000,
          duration: STEP_SECONDS * 15,
          attack: 0.18,
          gain: 0.024,
          pan: (index - 1) * 0.6,
          bus,
          at,
        });
      }
    }
    if (beat % 4 === 0) {
      this.tone({
        frequency: hz(root - 12 + (beat === 12 ? 7 : 0)),
        type: "triangle",
        duration: 0.32,
        cutoff: 320,
        gain: 0.105,
        bus,
        at,
      });
      this.tone({
        frequency: 120,
        endFrequency: 40,
        duration: 0.17,
        gain: 0.1 + this.intensity * 0.045,
        bus,
        at,
      });
    }
    if (beat % 2 === 0 || this.intensity > 0.62) {
      const interval = [0, 7, 12, 12 + third, 19, 12, 7, third][beat % 8];
      this.tone({
        frequency: hz(root + 12 + interval),
        type: "triangle",
        duration: 0.22,
        gain: 0.033 + this.intensity * 0.021,
        cutoff: 1400 + this.intensity * 2200,
        pan: Math.sin(step * 0.7) * 0.65,
        bus,
        at,
      });
    }
    if (beat % 2 === 0 && this.intensity > 0.12) {
      this.noise({
        duration: beat % 4 === 2 ? 0.09 : 0.035,
        filter: "highpass",
        cutoff: 6800,
        gain: 0.015 + this.intensity * 0.012,
        pan: beat % 4 === 2 ? 0.5 : -0.4,
        bus,
        at,
      });
    }
    if ((beat === 4 || beat === 12) && this.intensity > 0.35) {
      this.noise({
        duration: 0.1,
        cutoff: 1800,
        gain: 0.04,
        bus,
        at,
      });
    }
  }
}

export const sound = new SoundEngine();
