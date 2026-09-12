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
  // ---- game cues, named to match the shared Cue type ----
  intro: [
    { freq: 523, start: 0, dur: 0.1 },
    { freq: 659, start: 0.1, dur: 0.1 },
    { freq: 784, start: 0.2, dur: 0.1 },
    { freq: 1047, start: 0.3, dur: 0.22 },
    { freq: 131, start: 0, dur: 0.5, type: 'triangle', gain: 0.5 },
  ],
  countdown: [
    { freq: 784, start: 0, dur: 0.12 },
    { freq: 784, start: 1, dur: 0.12 },
    { freq: 784, start: 2, dur: 0.12 },
  ],
  go: [
    { freq: 1047, start: 0, dur: 0.1 },
    { freq: 1568, start: 0.1, dur: 0.3 },
    { freq: 262, start: 0, dur: 0.3, type: 'triangle', gain: 0.6 },
  ],
  'power-up': [
    { freq: 220, start: 0, dur: 0.35, to: 1320, gain: 0.9 },
    { freq: 660, start: 0.3, dur: 0.1 },
    { freq: 880, start: 0.4, dur: 0.18 },
  ],
  'power-end': [
    { freq: 880, start: 0, dur: 0.3, to: 220, gain: 0.8 },
  ],
  'ghost-tag': [
    { freq: 1200, start: 0, dur: 0.08, to: 400 },
    { freq: 400, start: 0.08, dur: 0.14, to: 1200 },
  ],
  fruit: [
    { freq: 784, start: 0, dur: 0.07 },
    { freq: 1047, start: 0.07, dur: 0.07 },
    { freq: 1319, start: 0.14, dur: 0.16 },
  ],
  'pac-dot': [{ freq: 988, start: 0, dur: 0.05, gain: 0.8 }],
  finish: [
    { freq: 1047, start: 0, dur: 0.12 },
    { freq: 784, start: 0.12, dur: 0.12 },
    { freq: 659, start: 0.24, dur: 0.12 },
    { freq: 523, start: 0.36, dur: 0.4 },
    { freq: 131, start: 0.36, dur: 0.4, type: 'triangle', gain: 0.55 },
  ],
  stop: [{ freq: 300, start: 0, dur: 0.12, to: 120, gain: 0.7 }],

  // Entry panel opening.
  panelOpen: [
    { freq: 880, start: 0, dur: 0.045, gain: 0.7 },
    { freq: 1320, start: 0.045, dur: 0.07, gain: 0.7 },
  ],
};

// The high-score cue and the leaderboard fanfare are the same jingle.
SFX['high-score'] = SFX.highScore;

/** Sixteen-step background loops. `null` = a rest. Original patterns, one note per step. */
export const LOOPS = {
  // Bouncy minor ostinato for normal play.
  gameplay: {
    stepSeconds: 0.125,
    lead: [440, null, 523, null, 659, null, 523, null, 587, null, 494, null, 440, null, 392, null],
    bass: [110, null, null, null, 131, null, null, null, 98, null, null, null, 110, null, 123, null],
  },
  // Faster and tenser while the power pellet is active.
  power: {
    stepSeconds: 0.09,
    lead: [659, 622, 587, 554, 523, 554, 587, 622, 659, 698, 740, 784, 740, 698, 659, 622],
    bass: [165, null, 165, null, 147, null, 147, null, 131, null, 131, null, 147, null, 165, null],
  },
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
let volume = 80;
const loop = { name: 'none', timer: null, step: 0, nextTime: 0 };

// ---------- Your own sound files (assets/audio) ----------

/** cue/loop name → decoded AudioBuffer, for files supplied in assets/audio. */
const files = new Map();
let wakaIntervalMs = 200;
const waka = { timer: null };

/**
 * Load the event's own sounds. Anything that loads replaces the built-in blip for that cue;
 * anything missing or unreadable keeps the built-in one, so the show always has sound.
 */
export async function loadAudioFiles(manifest, { wakaMs = 200 } = {}) {
  wakaIntervalMs = wakaMs;
  const ctx = ensureContext();
  if (!ctx || !manifest) return files;
  const entries = [...Object.entries(manifest.cues ?? {}), ...Object.entries(manifest.loops ?? {})];
  await Promise.all(
    entries.map(async ([name, url]) => {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        files.set(name, await ctx.decodeAudioData(await response.arrayBuffer()));
      } catch (err) {
        console.warn(`Could not load ${url}; using the built-in sound instead.`, err);
      }
    }),
  );
  return files;
}

export function hasFile(name) {
  return files.has(name);
}

/** Play a loaded file. Returns false when there isn't one, so the caller can fall back. */
function playFile(name, { loopForever = false } = {}) {
  const buffer = files.get(name);
  const ctx = ensureContext();
  if (!buffer || !ctx) return null;
  if (ctx.state === 'suspended') void ctx.resume();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = loopForever;
  source.connect(master);
  source.start();
  return source;
}

function ensureContext() {
  if (audio) return audio;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;
  audio = new Ctor();
  master = audio.createGain();
  master.gain.value = masterGain();
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

function masterGain() {
  return enabled ? (MASTER_VOLUME * volume) / 100 : 0;
}

export function setSoundEnabled(on) {
  enabled = Boolean(on);
  if (master) master.gain.value = masterGain();
  if (enabled) primeAudio();
  else {
    setLoop('none');
    stopLoop();
  }
}

/** TV master volume, 0–100 (the Stream Deck's VOL +/− keys). */
export function setVolume(next) {
  volume = Math.max(0, Math.min(100, Number(next) || 0));
  if (master) master.gain.value = masterGain();
}

export function getVolume() {
  return volume;
}

export function isSoundEnabled() {
  return enabled;
}

/** Schedule one note at an absolute context time. */
function scheduleNote(ctx, { freq, at, dur, type = 'square', to = null, gain = 1 }) {
  const osc = ctx.createOscillator();
  const envelope = ctx.createGain();
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

/** Play one of the SFX above. Silently does nothing when sound is off or unavailable. */
export function play(name, { delay = 0 } = {}) {
  if (!enabled) return;
  if (delay === 0 && playFile(name)) return; // the event's own recording wins
  const notes = SFX[name];
  if (!notes) return;
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const t0 = ctx.currentTime + delay + 0.01;
  for (const note of notes) scheduleNote(ctx, { ...note, at: t0 + note.start });
}

// ---------- Background music ----------

const LOOKAHEAD_SECONDS = 0.25;

function scheduleLoopSteps() {
  const ctx = ensureContext();
  const pattern = LOOPS[loop.name];
  if (!ctx || !pattern) return;
  while (loop.nextTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
    const at = Math.max(loop.nextTime, ctx.currentTime + 0.02);
    const lead = pattern.lead[loop.step];
    const bass = pattern.bass[loop.step];
    if (lead) scheduleNote(ctx, { freq: lead, at, dur: pattern.stepSeconds * 0.85, gain: 0.32 });
    if (bass) scheduleNote(ctx, { freq: bass, at, dur: pattern.stepSeconds * 0.9, type: 'triangle', gain: 0.4 });
    loop.nextTime += pattern.stepSeconds;
    loop.step = (loop.step + 1) % pattern.lead.length;
  }
}

/** Stops whatever is currently looping: synth pattern, background track, or the waka. */
function stopLoop() {
  clearInterval(loop.timer);
  clearInterval(waka.timer);
  loop.timer = null;
  waka.timer = null;
  loop.track?.stop();
  loop.track = null;
}

/**
 * Start/stop the background sound: 'gameplay', 'power', or 'none'.
 *
 * Preference order for a run: the event's own `gameplay-loop` file, else the eating-a-dot sound
 * repeated over and over (the classic waka), else the built-in synth pattern.
 */
export function setLoop(name) {
  const next = enabled && (LOOPS[name] || name === 'gameplay' || name === 'power') ? name : 'none';
  if (next === loop.name) return;
  stopLoop();
  loop.name = next;
  if (next === 'none') return;
  const ctx = ensureContext();
  if (!ctx) {
    loop.name = 'none';
    return;
  }
  if (ctx.state === 'suspended') void ctx.resume();

  const trackName = next === 'gameplay' ? 'gameplay-loop' : 'power-loop';
  if (files.has(trackName)) {
    loop.track = playFile(trackName, { loopForever: true });
    return;
  }
  if (next === 'gameplay' && files.has('pac-dot')) {
    const chomp = () => playFile('pac-dot');
    chomp();
    waka.timer = setInterval(chomp, wakaIntervalMs);
    return;
  }

  loop.step = 0;
  loop.nextTime = ctx.currentTime + 0.05;
  scheduleLoopSteps();
  loop.timer = setInterval(scheduleLoopSteps, 60);
}

export function currentLoop() {
  return loop.name;
}
