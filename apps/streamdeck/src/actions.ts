import streamDeck, {
  SingletonAction,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from '@elgato/streamdeck';
import { COMMAND_LABELS, GAME_COMMANDS, type GameCommand, type GameState } from '../../../packages/shared/game-events.ts';
import { gameClient } from './client.ts';
import { keyImage, statusImage } from './icons.ts';

/** Every action this plugin owns lives under this prefix, and must also appear in manifest.json. */
export const ACTION_PREFIX = 'com.pacmanmaze.controller.';
/** The one key you configure yourself — kept so existing decks keep working. */
export const GENERIC_UUID = `${ACTION_PREFIX}game-key`;
/** A key that presses nothing and just reports what the game is doing. */
export const STATUS_UUID = `${ACTION_PREFIX}status`;

/** The action id for a command, e.g. `power-up` → `com.pacmanmaze.controller.power-up`. */
export function commandUuid(command: GameCommand): string {
  return `${ACTION_PREFIX}${command}`;
}

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

/** Short state names for the status key. */
const STATE_LABELS: Record<GameState, string> = {
  idle: 'IDLE',
  ready: 'READY',
  countdown: '3·2·1',
  playing: 'PLAYING',
  'power-mode': 'POWER',
  finished: 'DONE',
};

interface Entry {
  action: KeyAction<GameKeySettings>;
  settings: GameKeySettings;
  /** Baked-in command for the dedicated actions; undefined for the configurable key. */
  fixed?: GameCommand;
  status: boolean;
  painted: string;
}

/** Keys currently on a deck, with the settings we last saw — no round-trip needed to repaint. */
const visibleKeys = new Map<string, Entry>();

/**
 * A key that drives one game command. Dedicated actions carry their command in the
 * manifest id, so dragging "POWER UP" onto the deck is all the setup there is.
 */
class GameKeyAction extends SingletonAction<GameKeySettings> {
  constructor(
    private readonly fixed?: GameCommand,
    private readonly status = false,
  ) {
    super();
  }

  override onWillAppear(ev: WillAppearEvent<GameKeySettings>): void {
    if (!ev.action.isKey()) return;
    visibleKeys.set(ev.action.id, { action: ev.action, settings: ev.payload.settings, fixed: this.fixed, status: this.status, painted: '' });
    applyConnection();
    void paint(ev.action.id);
  }

  override onWillDisappear(ev: WillDisappearEvent<GameKeySettings>): void {
    visibleKeys.delete(ev.action.id);
    applyConnection();
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<GameKeySettings>): void {
    const entry = visibleKeys.get(ev.action.id);
    if (entry) entry.settings = ev.payload.settings;
    applyConnection();
    void paint(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent<GameKeySettings>): Promise<void> {
    // The status key reports; it never sends a command.
    if (this.status) {
      gameClient.reconnect();
      await ev.action.showOk();
      return;
    }
    const command = this.fixed ?? ev.payload.settings.command;
    if (!command || !GAME_COMMANDS.includes(command)) {
      streamDeck.logger.warn('Key pressed before an action was chosen in the property inspector.');
      await ev.action.showAlert();
      return;
    }
    if (await gameClient.send(command)) await ev.action.showOk();
    else await ev.action.showAlert();
  }
}

/**
 * Every action the plugin registers: one per command, the configurable key, and the status tile.
 * The manifest id is set the same way the SDK's `@action` decorator sets it.
 */
export function createActions(): SingletonAction<GameKeySettings>[] {
  const bind = (uuid: string, instance: GameKeyAction): GameKeyAction => {
    Object.defineProperty(instance, 'manifestId', { value: uuid, enumerable: true, writable: false });
    return instance;
  };
  return [
    ...GAME_COMMANDS.map((command) => bind(commandUuid(command), new GameKeyAction(command))),
    bind(GENERIC_UUID, new GameKeyAction()),
    bind(STATUS_UUID, new GameKeyAction(undefined, true)),
  ];
}

/** Repaint every key on the deck (on game changes, and while the clocks tick). */
export async function refreshKeys(): Promise<void> {
  await Promise.all([...visibleKeys.keys()].map((id) => paint(id)));
}

/**
 * The address lives in any one key's settings, so a deck full of keys that were never
 * opened can't reset it back to localhost. First key with an address wins.
 */
function applyConnection(): void {
  let url: string | undefined;
  let pin: string | undefined;
  for (const { settings } of visibleKeys.values()) {
    if (!url && settings.url) url = settings.url;
    if (!pin && settings.pin) pin = settings.pin;
  }
  gameClient.configure(url, pin);
}

async function paint(id: string): Promise<void> {
  const entry = visibleKeys.get(id);
  if (!entry) return;
  const { action: key, settings } = entry;
  const state = gameClient.status?.state ?? 'idle';
  const offline = !gameClient.online;
  const command = entry.fixed ?? settings.command;

  let image: string;
  let title: string;
  if (entry.status) {
    title = statusTitle(state, offline);
    image = statusImage({ state, offline, text: title });
  } else if (!command) {
    // The configurable key before anyone has chosen what it does.
    title = 'SET UP';
    image = keyImage({ command: 'ready', dimmed: true, offline: true, text: title });
  } else {
    title = keyTitle(command, offline);
    image = keyImage({
      command,
      // SPOTLIGHT has nobody to show until a score has been entered.
      dimmed: command === 'spotlight' ? gameClient.players === 0 : Boolean(AVAILABLE_IN[command] && !AVAILABLE_IN[command]!.includes(state)),
      active: Boolean(ACTIVE_IN[command]?.includes(state)),
      offline,
      text: title,
    });
  }

  // Only talk to Stream Deck when something actually changed.
  const fingerprint = `${image}|${title}`;
  if (fingerprint === entry.painted) return;
  entry.painted = fingerprint;
  await key.setImage(image);
  // The label is drawn into the image so it can shrink to fit; Stream Deck's own
  // title would otherwise print a second, clipped copy over the top of it.
  await key.setTitle('');
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

/** Status tile: what the game is doing, how long is left, and how many players are on the board. */
function statusTitle(state: GameState, offline: boolean): string {
  if (offline) return 'NO SERVER\ncheck the\nleaderboard';
  const status = gameClient.status;
  const lines = [STATE_LABELS[state]];
  if (status?.runEndsAt) lines.push(`${Math.max(0, Math.ceil((status.runEndsAt - Date.now()) / 1000))}s left`);
  lines.push(`${gameClient.players} on board`);
  return lines.join('\n');
}
