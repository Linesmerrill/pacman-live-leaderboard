import {
  phaseEnded,
  transition,
  type Cue,
  type GameCommand,
  type GameState,
  type GameStatus,
  type MusicLoop,
  type Transition,
} from '../../../packages/shared/game-events.ts';

export interface GameEngineOptions {
  countdownSeconds: number;
  powerModeSeconds: number;
  /** Volume and mute live in the saved settings so they survive a restart. */
  getSound: () => { soundEnabled: boolean; volume: number };
  setSound: (patch: { soundEnabled?: boolean; volume?: number }) => void;
  onChange: (status: GameStatus) => void;
  log?: (message: string) => void;
}

const VOLUME_STEP = 10;

/**
 * Runs the show: one authoritative game state for every screen, with the timed phases
 * (3·2·1 countdown, power mode) handled here so an operator can never leave the TV
 * stuck in the wrong mode or have to press buttons in the right order.
 */
export class GameEngine {
  readonly #options: GameEngineOptions;
  #state: GameState = 'idle';
  #loop: MusicLoop = 'none';
  #cue: { name: Cue; id: number } | null = null;
  #cueCount = 0;
  #phaseEndsAt: number | null = null;
  #startedAt: number | null = null;
  #timer: NodeJS.Timeout | null = null;

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
      volume,
      soundEnabled,
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
    if (command === 'mute') {
      const { soundEnabled } = this.#options.getSound();
      this.#options.setSound({ soundEnabled: !soundEnabled });
      this.#announce(soundEnabled ? 'muted' : 'unmuted');
      return { applied: true, status: this.status };
    }

    const next = transition(this.#state, command, {
      countdownSeconds: this.#options.countdownSeconds,
      powerModeSeconds: this.#options.powerModeSeconds,
    }, this.#loop);
    if (!next) return { applied: false, status: this.status };

    this.#apply(next, command);
    return { applied: true, status: this.status };
  }

  #apply(next: Transition, reason: string): void {
    clearTimeout(this.#timer ?? undefined);
    this.#timer = null;

    this.#state = next.state;
    this.#loop = next.loop;
    if (next.cue) this.#cue = { name: next.cue, id: ++this.#cueCount };
    if (next.startsRun) this.#startedAt = Date.now();
    if (next.clearsRun) this.#startedAt = null;

    if (next.phaseSeconds) {
      this.#phaseEndsAt = Date.now() + next.phaseSeconds * 1000;
      this.#timer = setTimeout(() => this.#endPhase(), next.phaseSeconds * 1000);
      this.#timer.unref?.();
    } else {
      this.#phaseEndsAt = null;
    }

    this.#announce(`${reason} → ${this.#state}${this.#loop === 'none' ? '' : ` (${this.#loop} loop)`}`);
  }

  /** A timed phase ran out: countdown becomes the run starting, power mode drops back to normal play. */
  #endPhase(): void {
    const next = phaseEnded(this.#state);
    if (next) this.#apply(next, 'timer');
  }

  #announce(message: string): void {
    this.#options.log?.(`▶ game: ${message}`);
    this.#options.onChange(this.status);
  }

  close(): void {
    clearTimeout(this.#timer ?? undefined);
    this.#timer = null;
  }
}
