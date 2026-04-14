// src/scenes/state-machine.js
// Provides: STATES, TRANSITIONS, StateMachine
// Depends: (none)

const STATES = {
  MENU: 'MENU',
  LEVEL_SELECT: 'LEVEL_SELECT',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  WIN: 'WIN',
  LOSE: 'LOSE',
  IMAGE_UPLOAD: 'IMAGE_UPLOAD',
};

/** Allowed transitions from each state. */
const TRANSITIONS = {
  MENU:         ['LEVEL_SELECT', 'IMAGE_UPLOAD'],
  LEVEL_SELECT: ['MENU', 'PLAYING', 'IMAGE_UPLOAD'],
  IMAGE_UPLOAD: ['LEVEL_SELECT', 'PLAYING', 'MENU'],
  PLAYING:      ['PAUSED', 'WIN', 'LOSE'],
  PAUSED:       ['PLAYING', 'MENU', 'LEVEL_SELECT'],
  WIN:          ['LEVEL_SELECT', 'MENU', 'PLAYING'],
  LOSE:         ['LEVEL_SELECT', 'MENU', 'PLAYING'],
};

/**
 * Finite-state machine that governs scene transitions.
 * Only transitions listed in TRANSITIONS are permitted.
 */
class StateMachine {
  constructor() {
    this._state = STATES.MENU;
    this._scenes = {};
  }

  get state() { return this._state; }

  /** Register a scene handler for a given state. */
  registerScene(state, scene) {
    this._scenes[state] = scene;
  }

  /**
   * Attempt to transition to `newState`, optionally passing `data`
   * to the entering scene. Silently warns on invalid transitions.
   */
  transition(newState, data) {
    const allowed = TRANSITIONS[this._state];
    if (!allowed || !allowed.includes(newState)) {
      console.warn(`Invalid transition: ${this._state} → ${newState}`);
      return;
    }

    const oldState  = this._state;
    const oldScene  = this._scenes[oldState];
    const newScene  = this._scenes[newState];
    const isPause   = newState === STATES.PAUSED;
    const isResume  = oldState === STATES.PAUSED && newState === STATES.PLAYING;

    // Exit old scene (tell it whether we're just pausing)
    if (oldScene && typeof oldScene.exit === 'function') {
      oldScene.exit(isPause);
    }

    this._state = newState;

    // Enter new scene — skip re-enter when resuming from pause
    if (!isResume && newScene && typeof newScene.enter === 'function') {
      newScene.enter(data);
    }
  }

  /** Return the scene object for the current state. */
  getActiveScene() {
    return this._scenes[this._state] || null;
  }
}
