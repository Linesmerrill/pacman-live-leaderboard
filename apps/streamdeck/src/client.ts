import streamDeck from '@elgato/streamdeck';
import type { GameCommand, GameStatus } from '../../../packages/shared/game-events.ts';

export interface LeaderboardMessage {
  reason: string;
  game?: GameStatus;
  snapshot?: { totalPlayers: number };
}

/**
 * Talks to the leaderboard app running on this Mac: sends commands, and keeps a live
 * subscription so the keys can show what the game is actually doing.
 */
export class GameClient {
  #url = 'http://localhost:3000';
  #pin = '';
  #status: GameStatus | null = null;
  #online = false;
  #players = 0;
  #abort: AbortController | null = null;
  #retry: NodeJS.Timeout | null = null;
  readonly #listeners = new Set<() => void>();

  get status(): GameStatus | null {
    return this.#status;
  }

  get online(): boolean {
    return this.#online;
  }

  get players(): number {
    return this.#players;
  }

  onChange(listener: () => void): void {
    this.#listeners.add(listener);
  }

  /** Point at a different server (from the action's settings). Reconnects when it changes. */
  configure(url?: string, pin?: string): void {
    const nextUrl = (url || 'http://localhost:3000').replace(/\/+$/, '');
    const nextPin = pin ?? '';
    if (nextUrl === this.#url && nextPin === this.#pin && this.#abort) return;
    this.#url = nextUrl;
    this.#pin = nextPin;
    this.#connect();
  }

  /** Drop the live connection and dial the leaderboard again (the status key does this). */
  reconnect(): void {
    this.#connect();
  }

  /** Press a button. Returns false when the leaderboard couldn't be reached. */
  async send(command: GameCommand): Promise<boolean> {
    try {
      const res = await fetch(`${this.#url}/api/game/${command}`, { method: 'POST', headers: this.#headers() });
      if (!res.ok) {
        streamDeck.logger.warn(`Command ${command} failed: HTTP ${res.status}`);
        return false;
      }
      const body = (await res.json()) as { status: GameStatus };
      this.#status = body.status;
      this.#emit();
      return true;
    } catch (err) {
      streamDeck.logger.warn(`Command ${command} could not reach ${this.#url}: ${String(err)}`);
      this.#setOnline(false);
      return false;
    }
  }

  #headers(): Record<string, string> {
    return this.#pin ? { 'X-Admin-Pin': this.#pin } : {};
  }

  /** Server-Sent Events from the leaderboard, with an automatic retry loop. */
  #connect(): void {
    this.#abort?.abort();
    clearTimeout(this.#retry ?? undefined);
    const abort = new AbortController();
    this.#abort = abort;

    void (async () => {
      try {
        const res = await fetch(`${this.#url}/api/stream`, { headers: this.#headers(), signal: abort.signal });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        this.#setOnline(true);
        let buffer = '';
        const decoder = new TextDecoder();
        for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
          buffer += decoder.decode(chunk, { stream: true });
          let split = buffer.indexOf('\n\n');
          while (split !== -1) {
            const frame = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            const data = frame.split('\n').find((line) => line.startsWith('data: '));
            if (data) this.#handle(data.slice(6));
            split = buffer.indexOf('\n\n');
          }
        }
        throw new Error('stream ended');
      } catch (err) {
        if (abort.signal.aborted) return;
        streamDeck.logger.debug(`Live connection lost: ${String(err)}`);
        this.#setOnline(false);
        this.#retry = setTimeout(() => this.#connect(), 3000);
      }
    })();
  }

  #handle(raw: string): void {
    try {
      const message = JSON.parse(raw) as LeaderboardMessage;
      if (message.game) this.#status = message.game;
      if (message.snapshot) this.#players = message.snapshot.totalPlayers;
      this.#setOnline(true);
    } catch {
      // ignore malformed frames
    }
  }

  #setOnline(online: boolean): void {
    if (this.#online === online) return;
    this.#online = online;
    this.#emit();
  }

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }
}

export const gameClient = new GameClient();
