// src/audio/audio-manager.js
// Provides: AudioManager, audio (global instance)
// Depends: (none)

class AudioManager {
  constructor() {
    this.ctx = null;              // AudioContext, created on first user interaction
    this.musicGain = null;        // GainNode for background music volume
    this.sfxGain = null;          // GainNode for sound effects volume
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this._musicOscillators = [];  // Track active music oscillators for cleanup
    this._musicTimer = null;      // setInterval ID for music scheduling loop
    this._initialized = false;
  }

  // --------------------------------------------------------------------------
  // Initialization — must be called from a user gesture (click/tap/keypress)
  // to satisfy browser autoplay policies and unlock the AudioContext.
  // --------------------------------------------------------------------------
  init() {
    if (this._initialized) {
      // On iOS, AudioContext may get suspended when the page loses focus.
      // Resume it on every user interaction to ensure audio keeps working.
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // iOS Safari: AudioContext starts in 'suspended' state.
    // Must be resumed from a user gesture.
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    // Master gain for background music — kept low so it doesn't overpower SFX
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.15;
    this.musicGain.connect(this.ctx.destination);

    // Master gain for sound effects
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.3;
    this.sfxGain.connect(this.ctx.destination);

    this._initialized = true;
  }

  // --------------------------------------------------------------------------
  // Toggle helpers — flip on/off and update gain immediately
  // --------------------------------------------------------------------------
  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicEnabled ? 0.15 : 0;
    }
  }

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.sfxEnabled ? 0.3 : 0;
    }
  }

  // ==========================================================================
  //  SOUND EFFECTS — short procedural sounds for game events
  // ==========================================================================

  // --------------------------------------------------------------------------
  // Paddle hit — short metallic ping, triangle wave sweeping 800 → 400 Hz
  // --------------------------------------------------------------------------
  playPaddleHit() {
    if (!this._initialized || !this.sfxEnabled) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.1);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // --------------------------------------------------------------------------
  // Brick hit (not destroyed) — low thud, square wave 200 → 100 Hz
  // --------------------------------------------------------------------------
  playBrickHit() {
    if (!this._initialized || !this.sfxEnabled) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.08);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  // --------------------------------------------------------------------------
  // Brick destroyed — satisfying crunch/pop: white noise burst + descending tone
  // --------------------------------------------------------------------------
  playBrickDestroy() {
    if (!this._initialized || !this.sfxEnabled) return;

    const t = this.ctx.currentTime;

    // --- White noise burst with amplitude decay envelope ---
    const bufferSize = this.ctx.sampleRate * 0.1; // 100ms of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Random noise shaped by a quadratic decay curve
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.15;
    noise.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);

    // --- Descending sine tone 600 → 200 Hz ---
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // --------------------------------------------------------------------------
  // Power-up collected — rising major chord arpeggio (C5 → E5 → G5)
  // --------------------------------------------------------------------------
  playPowerUp() {
    if (!this._initialized || !this.sfxEnabled) return;

    const t = this.ctx.currentTime;
    const notes = [523, 659, 784]; // C5, E5, G5

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteStart = t + i * 0.08;

      osc.type = 'sine';
      osc.frequency.value = freq;

      // Quick attack, then decay
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.2, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(noteStart);
      osc.stop(noteStart + 0.15);
    });
  }

  // --------------------------------------------------------------------------
  // Life lost — sawtooth wave descending 400 → 100 Hz over half a second
  // --------------------------------------------------------------------------
  playLifeLost() {
    if (!this._initialized || !this.sfxEnabled) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.5);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  // --------------------------------------------------------------------------
  // Win level — triumphant ascending fanfare (C5 → E5 → G5 → C6)
  // --------------------------------------------------------------------------
  playWin() {
    if (!this._initialized || !this.sfxEnabled) return;

    const t = this.ctx.currentTime;
    const melody = [523, 659, 784, 1047]; // C5, E5, G5, C6

    melody.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteStart = t + i * 0.12;

      osc.type = 'triangle';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.25, noteStart + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(noteStart);
      osc.stop(noteStart + 0.3);
    });
  }

  // --------------------------------------------------------------------------
  // Game over — sad descending sequence (G4 → F4 → E4 → C4)
  // --------------------------------------------------------------------------
  playGameOver() {
    if (!this._initialized || !this.sfxEnabled) return;

    const t = this.ctx.currentTime;
    const melody = [392, 349, 330, 262]; // G4, F4, E4, C4

    melody.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteStart = t + i * 0.2;

      osc.type = 'triangle';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.2, noteStart + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(noteStart);
      osc.stop(noteStart + 0.4);
    });
  }

  // --------------------------------------------------------------------------
  // Button click — short high-frequency tick
  // --------------------------------------------------------------------------
  playClick() {
    if (!this._initialized || !this.sfxEnabled) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 1000;

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // ==========================================================================
  //  BACKGROUND MUSIC — Procedural steampunk-mechanical loop
  // ==========================================================================
  //
  //  Structure: A repeating 2-bar pattern at 100 BPM consisting of:
  //    - Bass line:  sawtooth oscillators through a lowpass filter for a
  //                  warm, mechanical rumble (A2–D3–C3 progression)
  //    - Melody:     triangle-wave pentatonic phrases for a mysterious,
  //                  atmospheric feel
  //
  //  The scheduler pre-schedules notes in batches and uses setInterval
  //  to continuously feed the Web Audio timeline ahead of real time.
  // ==========================================================================

  startMusic() {
    // Background music removed by user preference — only SFX used
  }

  stopMusic() {
    // No-op — no background music
  }
}

// ============================================================================
// Global audio manager instance — referenced by Game class and scene code
// ============================================================================
const audio = new AudioManager();
