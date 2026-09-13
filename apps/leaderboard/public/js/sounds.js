// Original arcade-style sound effects, synthesised in the browser with the Web Audio API.
// No audio files and nothing sampled: every jingle is square/triangle waves written here.
// The background music between runs lives in music.js.
import { IDLE_TRACKS } from './music.js';

export { IDLE_TRACKS };

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
let idleEnabled = true;
let idleVolume = 35;
let idleGain = null;
/** Softens the built-in chiptune's square waves; recorded songs bypass it. */
let idleSynth = null;
const loop = { name: 'none', timer: null, step: 0, nextTime: 0 };
const album = { order: [], index: 0, step: 0, songs: false };

// ---------- Your own sound files (assets/audio) ----------

/** cue/loop name → decoded AudioBuffer, for files supplied in assets/audio. */
const files = new Map();
let wakaIntervalMs = 200;
const waka = { timer: null };

// ---------- Your own songs between runs (assets/audio/music) ----------

/** Songs supplied for between runs. When any exist they replace the written-out album. */
const songs = [];

/**
 * Songs play at their recorded level. Measured in the browser, a supplied master lands at about
 * the same loudness as the built-in pieces (-13.5 dB against -13), and anything above 1 pushes its
 * peaks past 0 dB and distorts. How far under the room they sit is the between-runs volume slider.
 */
export const SONG_TRIM = 1;

/** One <audio> element, streamed rather than decoded: a three-minute song is ~60 MB as samples. */
const songPlayer = { element: null, blocked: false };

function ensureSongPlayer(ctx) {
  if (songPlayer.element) return songPlayer.element;
  const element = new Audio();
  element.preload = 'auto';
  const trim = ctx.createGain();
  trim.gain.value = SONG_TRIM;
  // Straight into the between-runs volume: a recording must not go through the filter that
  // softens the built-in chiptune, or it loses its treble and sounds muffled and far away.
  ctx.createMediaElementSource(element).connect(trim).connect(idleGain);
  element.addEventListener('ended', () => {
    if (loop.name === 'idle' && album.songs) startSong(album.index + 1);
  });
  songPlayer.element = element;
  return element;
}

/**
 * An ordinary browser tab refuses to start an <audio> element until someone has clicked or pressed
 * a key on the page. Remember that it was refused, so the next click can start it (see primeAudio).
 */
function playSong(element) {
  void element
    .play()
    .then(() => {
      songPlayer.blocked = false;
    })
    .catch((err) => {
      songPlayer.blocked = true;
      console.warn('A background song is waiting for a click or key press on the page before it can play.', err?.name ?? err);
    });
}

function startSong(index, { resume = false } = {}) {
  const ctx = ensureContext();
  if (!ctx || !album.order.length) return;
  const element = ensureSongPlayer(ctx);
  album.index = (index + album.order.length) % album.order.length;
  const song = songs[album.order[album.index]];
  // Setting the source starts the song from the top; resuming keeps the position it paused at.
  if (!resume || element.src !== new URL(song.url, location.href).href) element.src = song.url;
  playSong(element);
}

/**
 * Load the event's own sounds. Anything that loads replaces the built-in blip for that cue;
 * anything missing or unreadable keeps the built-in one, so the show always has sound.
 */
export async function loadAudioFiles(manifest, { wakaMs = 200 } = {}) {
  wakaIntervalMs = wakaMs;
  const ctx = ensureContext();
  if (!ctx || !manifest) return files;
  const entries = [
    ...Object.entries(manifest.cues ?? {}),
    ...Object.entries(manifest.alternates ?? {}).map(([name, url]) => [`${name}-2`, url]),
    ...Object.entries(manifest.loops ?? {}),
  ];
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
  const supplied = manifest.music ?? [];
  if (supplied.length) {
    songs.splice(0, songs.length, ...supplied);
    // The built-in album may already be playing from before the list arrived: switch to the songs.
    if (loop.name === 'idle' && !album.songs) {
      stopLoop();
      loop.name = 'none';
      setLoop('idle');
    }
  }
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
  // The background music runs through its own gain so it can be softer than the effects,
  // or muted on its own, without touching anything else.
  idleGain = audio.createGain();
  idleGain.gain.value = idleMusicGain();
  idleGain.connect(master);
  idleSynth = audio.createBiquadFilter();
  idleSynth.type = 'lowpass';
  idleSynth.frequency.value = 2600;
  idleSynth.connect(idleGain);
  return audio;
}

/**
 * Browsers keep audio suspended until someone interacts with the page. Call this from a click or
 * keypress (the kiosk script also launches Chrome with autoplay allowed, for an untouched TV).
 */
export function primeAudio() {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
  // The first click or key press is also what lets a refused song start.
  const element = songPlayer.element;
  if (element && element.paused && loop.name === 'idle' && album.songs) playSong(element);
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

function idleMusicGain() {
  return idleEnabled ? idleVolume / 100 : 0;
}

/** The background music between runs: its own on/off and volume, under the TV volume. */
export function setIdleMusic({ enabled, volume: level }) {
  if (enabled !== undefined) idleEnabled = Boolean(enabled);
  if (level !== undefined) idleVolume = Math.max(0, Math.min(100, Number(level) || 0));
  if (idleGain) idleGain.gain.value = idleMusicGain();
  if (!idleEnabled && loop.name === 'idle') stopLoop();
}

export function getVolume() {
  return volume;
}

export function isSoundEnabled() {
  return enabled;
}

/** Schedule one note at an absolute context time. */
function scheduleNote(ctx, { freq, at, dur, type = 'square', to = null, gain = 1, destination = null }) {
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
  osc.connect(envelope).connect(destination ?? master);
  osc.start(at);
  osc.stop(at + dur + 0.03);
}

/** Dip the background music while a cue plays, so effects always cut through. */
function duckIdle(seconds) {
  if (!idleGain || loop.name !== 'idle') return;
  const ctx = ensureContext();
  const full = idleMusicGain();
  const now = ctx.currentTime;
  idleGain.gain.cancelScheduledValues(now);
  idleGain.gain.setValueAtTime(idleGain.gain.value, now);
  idleGain.gain.linearRampToValueAtTime(full * 0.25, now + 0.08);
  idleGain.gain.setValueAtTime(full * 0.25, now + Math.max(0.1, seconds));
  idleGain.gain.linearRampToValueAtTime(full, now + Math.max(0.1, seconds) + 0.5);
}

/** Play one of the SFX above. Silently does nothing when sound is off or unavailable. */
export function play(name, { delay = 0 } = {}) {
  if (!enabled) return;
  if (delay === 0) {
    const source = playFile(name);
    if (source) {
      duckIdle(source.buffer.duration);
      return; // the event's own recording wins
    }
  }
  const notes = SFX[name];
  if (!notes) return;
  duckIdle(totalDuration(notes));
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const t0 = ctx.currentTime + delay + 0.01;
  for (const note of notes) scheduleNote(ctx, { ...note, at: t0 + note.start });
}

// ---------- Background music ----------

const LOOKAHEAD_SECONDS = 0.25;

/** Schedules the idle album: each track plays through, then the next one starts. */
function scheduleAlbumSteps() {
  const ctx = ensureContext();
  if (!ctx) return;
  while (loop.nextTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
    const track = IDLE_TRACKS[album.order[album.index]];
    const { lead, leadSteps, bass, bassSteps, arp } = track.steps[album.step];
    const at = Math.max(loop.nextTime, ctx.currentTime + 0.02);
    // NES voicing: a pulse lead over a triangle bass. The lead is quiet because a square
    // wave carries much further than the triangle it replaced.
    if (lead) scheduleNote(ctx, { freq: lead, at, dur: track.stepSeconds * Math.max(1, leadSteps) * 0.92, type: 'square', gain: 0.15, destination: idleSynth });
    if (bass) scheduleNote(ctx, { freq: bass, at, dur: track.stepSeconds * (bassSteps ?? 2) * 0.95, type: 'triangle', gain: 0.42, destination: idleSynth });
    if (arp) scheduleNote(ctx, { freq: arp, at, dur: track.stepSeconds * 0.75, type: 'square', gain: 0.05, destination: idleSynth });
    loop.nextTime += track.stepSeconds;
    album.step++;
    if (album.step >= track.steps.length) {
      album.step = 0;
      album.index = (album.index + 1) % album.order.length;
      loop.nextTime += track.stepSeconds * 2; // a beat of silence between pieces
    }
  }
}

function scheduleLoopSteps() {
  const ctx = ensureContext();
  const pattern = LOOPS[loop.name];
  if (!ctx || !pattern) return;
  while (loop.nextTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
    const at = Math.max(loop.nextTime, ctx.currentTime + 0.02);
    const lead = pattern.lead[loop.step];
    const bass = pattern.bass[loop.step];
    const destination = loop.name === 'idle' ? idleGain : master;
    if (lead) {
      scheduleNote(ctx, { freq: lead, at, dur: pattern.stepSeconds * (loop.name === 'idle' ? 1.6 : 0.85), type: pattern.leadType ?? 'square', gain: pattern.leadGain ?? 0.32, destination });
    }
    if (bass) {
      scheduleNote(ctx, { freq: bass, at, dur: pattern.stepSeconds * (loop.name === 'idle' ? 2.4 : 0.9), type: pattern.bassType ?? 'triangle', gain: pattern.bassGain ?? 0.4, destination });
    }
    loop.nextTime += pattern.stepSeconds;
    loop.step = (loop.step + 1) % pattern.lead.length;
  }
}

/** Stops whatever is currently looping: synth pattern, background track, or the waka. */
function stopLoop() {
  clearInterval(loop.timer);
  clearInterval(waka.timer);
  songPlayer.element?.pause();
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
  const next = enabled && (LOOPS[name] || name === 'idle' || name === 'gameplay' || name === 'power') ? name : 'none';
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

  if (next === 'idle') {
    if (!idleEnabled) {
      loop.name = 'none';
      return;
    }
    idleGain.gain.value = idleMusicGain();
    if (songs.length) {
      // Your songs: shuffled once, then each round's break carries on from where the last one
      // was interrupted rather than restarting the same song every time.
      const resume = album.songs && album.order.length === songs.length;
      if (!resume) {
        album.order = songs.map((_, i) => i).sort(() => Math.random() - 0.5);
        album.index = 0;
      }
      album.songs = true;
      startSong(album.index, { resume });
      return;
    }
    album.songs = false;
    // Shuffle the running order, and start somewhere in it, so the night doesn't always open
    // with the same piece.
    album.order = IDLE_TRACKS.map((_, i) => i).sort(() => Math.random() - 0.5);
    album.index = Math.floor(Math.random() * album.order.length);
    album.step = 0;
    loop.nextTime = ctx.currentTime + 0.05;
    scheduleAlbumSteps();
    loop.timer = setInterval(scheduleAlbumSteps, 60);
    return;
  }

  const trackName = next === 'gameplay' ? 'gameplay-loop' : 'power-loop';
  if (files.has(trackName)) {
    loop.track = playFile(trackName, { loopForever: true });
    return;
  }
  if (next === 'gameplay' && files.has('pac-dot')) {
    // Alternate the two chomps when a second take was supplied — that's what makes it "waka waka".
    const takes = files.has('pac-dot-2') ? ['pac-dot', 'pac-dot-2'] : ['pac-dot'];
    let index = 0;
    const chomp = () => playFile(takes[index++ % takes.length]);
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

/** What the between-runs music is doing right now, for diagnostics and the tests. */
export function backgroundStatus() {
  const idle = loop.name === 'idle';
  return {
    loop: loop.name,
    source: !idle ? 'off' : album.songs ? 'songs' : 'built-in',
    track: currentTrack(),
    playing: idle && (album.songs ? Boolean(songPlayer.element && !songPlayer.element.paused) : true),
    waitingForClick: idle && album.songs && songPlayer.blocked,
  };
}

/** The piece playing right now, or null when the background music isn't running. */
export function currentTrack() {
  if (loop.name !== 'idle' || !album.order.length) return null;
  return album.songs ? songs[album.order[album.index]].name : IDLE_TRACKS[album.order[album.index]].name;
}

/**
 * Jump to the next or previous piece (the deck's NEXT/PREV keys).
 * Returns the new track's name, or null when the music isn't playing.
 */
export function skipTrack(delta) {
  if (loop.name !== 'idle' || !album.order.length) return null;
  const ctx = ensureContext();
  if (!ctx) return null;
  if (album.songs) {
    startSong(album.index + delta);
    return currentTrack();
  }
  album.index = (album.index + delta + album.order.length) % album.order.length;
  album.step = 0;
  loop.nextTime = ctx.currentTime + 0.05;
  scheduleAlbumSteps();
  return currentTrack();
}
