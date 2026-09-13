import {
  phaseEnded,
  runEnded,
  transition,
  type Cue,
  type GameCommand,
  type GameState,
  type GameStatus,
  type MusicLoop,
  type Transition,
} from '../../../packages/shared/game-events.ts';

export interface GameTiming {
  countdownSeconds: number;
  /** How long power mode lasts, and how much time a pellet adds to the run. */
  powerPelletSeconds: number;
  /** Run length before the maze finishes by itself; 0 = no limit. */
  runSeconds: number;
  /** How many pellets can extend one run's clock. */
  maxPellets: number;
}

export interface GameEngineOptions {
  /** Read live: staff can change the run length or pellet time mid-event. */
  getTiming: () => GameTiming;
  /** Volume and mute live in the saved settings so they survive a restart. */
  getSound: () => { soundEnabled: boolean; volume: number };
  setSound: (patch: { soundEnabled?: boolean; volume?: number }) => void;
  onChange: (status: GameStatus) => void;
  log?: (message: string) => void;
}

const VOLUME_STEP = 10;

/**
 * Runs the show: one authoritative game state for every screen.
 *
 * Two clocks run during a maze session. The *phase* clock handles the 3·2·1 countdown and how long
 * power mode lasts. The *run* clock is the session's time limit — it keeps ticking through power
 * mode, and a power pellet adds time to it (up to `maxPellets` times), so a pellet grabbed at the
 * last second buys exactly one more pellet's worth of maze and no more.
 */
export class GameEngine {
  readonly #options: GameEngineOptions;
  #state: GameState = 'idle';
  #loop: MusicLoop = 'idle';
  #cue: { name: Cue; id: number } | null = null;
  #cueCount = 0;
  #phaseEndsAt: number | null = null;
  #startedAt: number | null = null;
  #runEndsAt: number | null = null;
  #pelletsUsed = 0;
  /** Counts NEXT/PREV presses so a screen can tell a fresh skip from a repeated broadcast. */
  #music = { id: 0, delta: 0 };
  #phaseTimer: NodeJS.Timeout | null = null;
  #runTimer: NodeJS.Timeout | null = null;

  constructor(options: GameEngineOptions) {
    this.#options = options;
  }

  get status(): GameStatus {
    const { soundEnabled, volume } = this.#options.getSound();
    return {
      state: this.#state,
      loop: this.#loop,
      cue: this.#cue,
      phaseEndsAt: this.#phaseEndsAt,
      startedAt: this.#startedAt,
      runEndsAt: this.#runEndsAt,
      pelletsUsed: this.#pelletsUsed,
      maxPellets: this.#options.getTiming().maxPellets,
      volume,
      soundEnabled,
      music: this.#music,
      updatedAt: Date.now(),
    };
  }

  /** Runs a controller command. `applied: false` means it didn't fit the current state and was ignored. */
  command(command: GameCommand): { applied: boolean; status: GameStatus } {
    if (command === 'volume-up' || command === 'volume-down') {
      const { volume } = this.#options.getSound();
      const next = Math.max(0, Math.min(100, volume + (command === 'volume-up' ? VOLUME_STEP : -VOLUME_STEP)));
      this.#options.setSound({ volume: next, ...(next > 0 && command === 'volume-up' ? { soundEnabled: true } : {}) });
      this.#announce(`volume ${next}%`);
      return { applied: true, status: this.status };
    }
    if (command === 'music-prev' || command === 'music-next') {
      // The music plays on the screens, so the engine only records that a skip was asked
      // for; the board picks it up from the broadcast and moves to the next piece.
      const delta = command === 'music-next' ? 1 : -1;
      this.#music = { id: this.#music.id + 1, delta };
      this.#announce(delta > 0 ? 'next track' : 'previous track');
      return { applied: true, status: this.status };
    }
    if (command === 'mute') {
      const { soundEnabled } = this.#options.getSound();
      this.#options.setSound({ soundEnabled: !soundEnabled });
      this.#announce(soundEnabled ? 'muted' : 'unmuted');
      return { applied: true, status: this.status };
    }

    const timing = this.#options.getTiming();
    const next = transition(this.#state, command, timing, this.#loop);
    if (!next) return { applied: false, status: this.status };

    this.#apply(next, command);
    return { applied: true, status: this.status };
  }

  #apply(next: Transition, reason: string): void {
    clearTimeout(this.#phaseTimer ?? undefined);
    this.#phaseTimer = null;

    this.#state = next.state;
    this.#loop = next.loop;
    if (next.cue) this.#cue = { name: next.cue, id: ++this.#cueCount };

    if (next.startsRun) {
      this.#startedAt = Date.now();
      this.#pelletsUsed = 0;
      this.#setRunDeadline(next.runSeconds ? Date.now() + next.runSeconds * 1000 : null);
    }
    if (next.clearsRun) {
      this.#startedAt = null;
      this.#setRunDeadline(null);
      this.#pelletsUsed = 0;
    }

    // A power pellet adds time — but only while there's a clock, and only so many times, or one
    // maze session could run all night while everyone else waits.
    let extension = '';
    if (next.extendRunSeconds && this.#runEndsAt !== null) {
      const { maxPellets } = this.#options.getTiming();
      if (this.#pelletsUsed < maxPellets) {
        this.#pelletsUsed++;
        this.#setRunDeadline(this.#runEndsAt + next.extendRunSeconds * 1000);
        extension = ` (+${next.extendRunSeconds}s, pellet ${this.#pelletsUsed}/${maxPellets})`;
      } else {
        extension = ` (no extra time: ${maxPellets} pellet limit reached)`;
      }
    }

    if (next.phaseSeconds) {
      this.#phaseEndsAt = Date.now() + next.phaseSeconds * 1000;
      this.#phaseTimer = setTimeout(() => this.#endPhase(), next.phaseSeconds * 1000);
      this.#phaseTimer.unref?.();
    } else {
      this.#phaseEndsAt = null;
    }

    this.#announce(`${reason} → ${this.#state}${this.#loop === 'none' ? '' : ` (${this.#loop} loop)`}${extension}`);
  }

  /** Arms (or clears) the run's own auto-finish. */
  #setRunDeadline(at: number | null): void {
    clearTimeout(this.#runTimer ?? undefined);
    this.#runTimer = null;
    this.#runEndsAt = at;
    if (at === null) return;
    this.#runTimer = setTimeout(() => this.#apply(runEnded(), 'time up'), Math.max(0, at - Date.now()));
    this.#runTimer.unref?.();
  }

  /** A timed phase ran out: the countdown starts the run, power mode drops back to normal play. */
  #endPhase(): void {
    const next = phaseEnded(this.#state, this.#options.getTiming());
    if (next) this.#apply(next, 'timer');
  }

  #announce(message: string): void {
    this.#options.log?.(`▶ game: ${message}`);
    this.#options.onChange(this.status);
  }

  close(): void {
    clearTimeout(this.#phaseTimer ?? undefined);
    clearTimeout(this.#runTimer ?? undefined);
    this.#phaseTimer = null;
    this.#runTimer = null;
  }
}
