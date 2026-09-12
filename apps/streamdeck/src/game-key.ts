import streamDeck, {
  action,
  SingletonAction,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from '@elgato/streamdeck';
import { COMMAND_LABELS, GAME_COMMANDS, type GameCommand, type GameState } from '../../../packages/shared/game-events.ts';
import { gameClient } from './client.ts';
import { keyImage } from './icons.ts';

export interface GameKeySettings {
  command?: GameCommand;
  url?: string;
  pin?: string;
  /** Stream Deck settings are plain JSON; every field here is an optional string. */
  [key: string]: string | undefined;
}

/** States in which a command does nothing, so the key can show itself as unavailable. */
const AVAILABLE_IN: Partial<Record<GameCommand, GameState[]>> = {
  'power-up': ['playing', 'power-mode'],
  'ghost-tag': ['playing', 'power-mode'],
  fruit: ['playing', 'power-mode'],
  'pac-dot': ['playing', 'power-mode'],
  finish: ['ready', 'countdown', 'playing', 'power-mode'],
};

/** Keys that light up while their moment is live. */
const ACTIVE_IN: Partial<Record<GameCommand, GameState[]>> = {
  ready: ['ready'],
  countdown: ['countdown'],
  start: ['playing'],
  'power-up': ['power-mode'],
  finish: ['finished'],
};

/** Keys currently on a deck, with the settings we last saw — no round-trip needed to repaint. */
const visibleKeys = new Map<string, { action: KeyAction<GameKeySettings>; settings: GameKeySettings; painted: string }>();

/**
 * One configurable key: pick the command in the property inspector, then press it.
 * Every key also mirrors what the game is doing — power-mode seconds, volume, connection.
 */
@action({ UUID: 'com.pacmanmaze.controller.game-key' })
export class GameKeyAction extends SingletonAction<GameKeySettings> {
  override onWillAppear(ev: WillAppearEvent<GameKeySettings>): void {
    if (!ev.action.isKey()) return;
    visibleKeys.set(ev.action.id, { action: ev.action, settings: ev.payload.settings, painted: '' });
    gameClient.configure(ev.payload.settings.url, ev.payload.settings.pin);
    void paint(ev.action.id);
  }

  override onWillDisappear(ev: WillDisappearEvent<GameKeySettings>): void {
    visibleKeys.delete(ev.action.id);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<GameKeySettings>): void {
    const entry = visibleKeys.get(ev.action.id);
    if (entry) entry.settings = ev.payload.settings;
    gameClient.configure(ev.payload.settings.url, ev.payload.settings.pin);
    void paint(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent<GameKeySettings>): Promise<void> {
    const command = ev.payload.settings.command;
    if (!command || !GAME_COMMANDS.includes(command)) {
      streamDeck.logger.warn('Key pressed before an action was chosen in the property inspector.');
      await ev.action.showAlert();
      return;
    }
    if (await gameClient.send(command)) await ev.action.showOk();
    else await ev.action.showAlert();
  }
}

export const gameKeyAction = new GameKeyAction();

/** Repaint every key on the deck (on game changes, and while the power-mode clock ticks). */
export async function refreshKeys(): Promise<void> {
  await Promise.all([...visibleKeys.keys()].map((id) => paint(id)));
}

async function paint(id: string): Promise<void> {
  const entry = visibleKeys.get(id);
  if (!entry) return;
  const { action: key, settings } = entry;
  const command = settings.command;

  const status = gameClient.status;
  const state = status?.state ?? 'idle';
  const offline = !gameClient.online;
  const look = command
    ? {
        command,
        dimmed: Boolean(AVAILABLE_IN[command] && !AVAILABLE_IN[command]!.includes(state)),
        active: Boolean(ACTIVE_IN[command]?.includes(state)),
        offline,
      }
    : { command: 'ready' as GameCommand, dimmed: true, offline: true };
  const title = command ? keyTitle(command, offline) : 'SET UP';

  // Only talk to Stream Deck when something actually changed.
  const fingerprint = `${JSON.stringify(look)}|${title}`;
  if (fingerprint === entry.painted) return;
  entry.painted = fingerprint;
  await key.setImage(keyImage(look));
  await key.setTitle(title);
}

/** Key label: the command name, plus whatever live detail is useful on that key. */
function keyTitle(command: GameCommand, offline: boolean): string {
  if (offline) return `${COMMAND_LABELS[command]}\n(offline)`;
  const status = gameClient.status;
  if (command === 'power-up' && status?.state === 'power-mode' && status.phaseEndsAt) {
    const left = Math.max(0, Math.ceil((status.phaseEndsAt - Date.now()) / 1000));
    return `${COMMAND_LABELS[command]}\n${left}s`;
  }
  if ((command === 'volume-up' || command === 'volume-down') && status) return `${COMMAND_LABELS[command]}\n${status.volume}%`;
  if (command === 'mute' && status) return status.soundEnabled ? 'MUTE' : 'MUTED';
  return COMMAND_LABELS[command];
}
