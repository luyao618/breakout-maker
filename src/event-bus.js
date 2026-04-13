// src/event-bus.js
// Provides: EventBus
// Depends: (none)

class EventBus {
  constructor() {
    this._listeners = {};
  }

  /** Subscribe to an event. */
  on(evt, fn) {
    (this._listeners[evt] ||= []).push(fn);
  }

  /** Unsubscribe from an event. */
  off(evt, fn) {
    const a = this._listeners[evt];
    if (a) this._listeners[evt] = a.filter(f => f !== fn);
  }

  /** Emit an event with optional arguments. */
  emit(evt, ...args) {
    (this._listeners[evt] || []).forEach(fn => fn(...args));
  }
}
