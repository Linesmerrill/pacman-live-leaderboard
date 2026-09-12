/**
 * The contract between the game app (apps/leaderboard) and any controller (apps/streamdeck).
 * Both sides import this file, so there are no magic strings duplicated across apps.
 */

/** Buttons a controller can press. */
export const GAME_COMMANDS = [
  'ready',
  'countdown',
  'start',
  'power-up',
  'ghost-tag',
  'fruit',
  'pac-dot',
  'high-score',
  'finish',
  'stop-all',
  'reset',
  'volume-up',
  'volume-down',
  'mute',
] as const;
export type GameCommand = (typeof GAME_COMMANDS)[number];

/** Where the run currently is. */
export const GAME_STATES = ['idle', 'ready', 'countdown', 'playing', 'power-mode', 'finished'] as const;
export type GameState = (typeof GAME_STATES)[number];

/** One-shot sounds (and matching on-screen moments) the TV plays. */
export const CUES = ['intro', 'countdown', 'go', 'power-up', 'power-end', 'ghost-tag', 'fruit', 'pac-dot', 'finish', 'high-score', 'stop'] as const;
export type Cue = (typeof CUES)[number];

/** Background music the TV loops while a run is under way. */
export const MUSIC_LOOPS = ['none', 'gameplay', 'power'] as const;
export type MusicLoop = (typeof MUSIC_LOOPS)[number];

export interface GameStatus {
  state: GameState;
  loop: MusicLoop;
  /** Last one-shot cue; `id` increases every time so a screen plays each cue exactly once. */
  cue: { name: Cue; id: number } | null;
  /** Epoch ms when the current timed phase (countdown / power mode) ends, else null. */
  phaseEndsAt: number | null;
  /** Epoch ms when the current run started playing, else null. */
  startedAt: number | null;
  /** Master volume for the TV, 0–100. */
  volume: number;
  soundEnabled: boolean;
  updatedAt: number;
}

export interface Transition {
  state: GameState;
  loop: MusicLoop;
  cue?: Cue;
  /** Seconds until the phase ends on its own (countdown → start, power mode → playing). */
  phaseSeconds?: number;
  /** Starts the run clock. */
  startsRun?: boolean;
  /** Clears the run clock. */
  clearsRun?: boolean;
}

export interface TransitionOptions {
  countdownSeconds: number;
  powerModeSeconds: number;
}

/** Commands that only fire a sound; they never change the state. */
const CUE_ONLY: Partial<Record<GameCommand, Cue>> = {
  'ghost-tag': 'ghost-tag',
  fruit: 'fruit',
  'pac-dot': 'pac-dot',
  'high-score': 'high-score',
};

/**
 * Pure state machine. Returns the next state, or null when the command doesn't apply
 * (e.g. POWER UP before the run has started) so the caller can ignore it safely.
 * Volume and mute are handled separately — they never change the run state.
 */
export function transition(state: GameState, command: GameCommand, options: TransitionOptions, loop: MusicLoop = 'none'): Transition | null {
  const cueOnly = CUE_ONLY[command];
  if (cueOnly) {
    // A stray sound button before the run starts shouldn't do anything.
    if (command !== 'high-score' && state !== 'playing' && state !== 'power-mode') return null;
    return { state, loop, cue: cueOnly };
  }

  switch (command) {
    case 'ready':
      return { state: 'ready', loop: 'none', cue: 'intro', clearsRun: true };
    case 'countdown':
      return { state: 'countdown', loop: 'none', cue: 'countdown', phaseSeconds: options.countdownSeconds, clearsRun: true };
    case 'start':
      return { state: 'playing', loop: 'gameplay', cue: 'go', startsRun: true };
    case 'power-up':
      if (state !== 'playing' && state !== 'power-mode') return null;
      return { state: 'power-mode', loop: 'power', cue: 'power-up', phaseSeconds: options.powerModeSeconds };
    case 'finish':
      if (state === 'idle' || state === 'finished') return null;
      return { state: 'finished', loop: 'none', cue: 'finish' };
    case 'stop-all':
      return { state, loop: 'none', cue: 'stop' };
    case 'reset':
      return { state: 'idle', loop: 'none', clearsRun: true };
    default:
      return null;
  }
}

/** What happens when a timed phase runs out on its own. */
export function phaseEnded(state: GameState): Transition | null {
  if (state === 'countdown') return { state: 'playing', loop: 'gameplay', cue: 'go', startsRun: true };
  if (state === 'power-mode') return { state: 'playing', loop: 'gameplay', cue: 'power-end' };
  return null;
}

/** Labels for controller keys. */
export const COMMAND_LABELS: Record<GameCommand, string> = {
  ready: 'READY',
  countdown: '3·2·1',
  start: 'START',
  'power-up': 'POWER UP',
  'ghost-tag': 'GHOST TAG',
  fruit: 'FRUIT',
  'pac-dot': 'PAC-DOT',
  'high-score': 'HIGH SCORE',
  finish: 'FINISH',
  'stop-all': 'STOP ALL',
  reset: 'RESET',
  'volume-up': 'VOL +',
  'volume-down': 'VOL −',
  mute: 'MUTE',
};
