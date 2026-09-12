// Original arcade-style sound effects, synthesised in the browser with the Web Audio API.
// No audio files and nothing sampled: every jingle is square/triangle waves written here.

const MASTER_VOLUME = 0.22;

/** @typedef {{ freq: number, start: number, dur: number, type?: OscillatorType, to?: number, gain?: number }} Note */

/** @type {Record<string, Note[]>} */
export const SFX = {
  // Short blip for a run that lands outside the visible top ranks.
  addScore: [
    { freq: 660, start: 0, dur: 0.07 },
    { freq: 880, start: 0.07, dur: 0.1 },
  ],
  // Made the pinned top column.
  topTen: [
    { freq: 659, start: 0, dur: 0.06 },
    { freq: 880, start: 0.06, dur: 0.06 },
    { freq: 1175, start: 0.12, dur: 0.16 },
  ],
  // Podium: 2nd or 3rd place (and 1st when it only ties the leader).
  topThree: [
    { freq: 523, start: 0, dur: 0.08 },
    { freq: 659, start: 0.08, dur: 0.08 },
    { freq: 784, start: 0.16, dur: 0.08 },
    { freq: 1047, start: 0.24, dur: 0.26 },
    { freq: 262, start: 0, dur: 0.3, type: 'triangle', gain: 0.5 },
  ],
  // New outright #1: a proper little fanfare, timed to the celebration overlay.
  highScore: [
    { freq: 523, start: 0, dur: 0.11 },
    { freq: 659, start: 0.11, dur: 0.11 },
    { freq: 784, start: 0.22, dur: 0.11 },
    { freq: 1047, start: 0.33, dur: 0.2 },
    { freq: 880, start: 0.55, dur: 0.1 },
    { freq: 1047, start: 0.65, dur: 0.1 },
    { freq: 1319, start: 0.75, dur: 0.28 },
    { freq: 1568, start: 1.05, dur: 0.45 },
    { freq: 1047, start: 1.05, dur: 0.45, gain: 0.5 },
    // Bass pulse underneath.
    { freq: 131, start: 0, dur: 0.5, type: 'triangle', gain: 0.55 },
    { freq: 196, start: 0.55, dur: 0.5, type: 'triangle', gain: 0.55 },
    { freq: 262, start: 1.05, dur: 0.5, type: 'triangle', gain: 0.55 },
  ],
  // Rising sparkle when a player is put in the spotlight (also used by "Show on TV").
  spotlight: [
    { freq: 988, start: 0, dur: 0.06 },
    { freq: 1319, start: 0.06, dur: 0.16 },
  ],
  // Two chomps, for Pac-Man eating a page of ranks away.
  chomp: [
    { freq: 440, start: 0, dur: 0.09, to: 180, gain: 0.8 },
    { freq: 200, start: 0.12, dur: 0.09, to: 460, gain: 0.8 },
  ],
  // Entry panel opening.
  panelOpen: [
    { freq: 880, start: 0, dur: 0.045, gain: 0.7 },
    { freq: 1320, start: 0.045, dur: 0.07, gain: 0.7 },
  ],
};

/** Which effect fits a newly added run. Pure, so it's covered by the tests. */
export function soundForEntry({ isNewHighScore, rank, position, rowsPerColumn = 10 }) {
  if (isNewHighScore) return 'highScore';
  if (rank <= 3) return 'topThree';
  if (position <= rowsPerColumn) return 'topTen';
  return 'addScore';
}

/** Seconds from the first note to the end of the last one. */
export function totalDuration(notes) {
  return notes.reduce((end, note) => Math.max(end, note.start + note.dur), 0);
}

let audio = null;
let master = null;
let enabled = true;

function ensureContext() {
  if (audio) return audio;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;
  audio = new Ctor();
  master = audio.createGain();
  master.gain.value = MASTER_VOLUME;
  master.connect(audio.destination);
  return audio;
}

/**
 * Browsers keep audio suspended until someone interacts with the page. Call this from a click or
 * keypress (the kiosk script also launches Chrome with autoplay allowed, for an untouched TV).
 */
export function primeAudio() {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

export function setSoundEnabled(on) {
  enabled = Boolean(on);
  if (enabled) primeAudio();
}

export function isSoundEnabled() {
  return enabled;
}

/** Play one of the SFX above. Silently does nothing when sound is off or unavailable. */
export function play(name, { delay = 0 } = {}) {
  if (!enabled) return;
  const notes = SFX[name];
  if (!notes) return;
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const t0 = ctx.currentTime + delay + 0.01;
  for (const { freq, start, dur, type = 'square', to = null, gain = 1 } of notes) {
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    const at = t0 + start;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (to !== null) osc.frequency.linearRampToValueAtTime(to, at + dur);
    // Fade in and out so the square waves don't click.
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(gain, at + 0.008);
    envelope.gain.setValueAtTime(gain, at + dur * 0.7);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(envelope).connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.03);
  }
}
