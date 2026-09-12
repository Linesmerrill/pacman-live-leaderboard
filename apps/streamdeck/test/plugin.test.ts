import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { COMMAND_LABELS, GAME_COMMANDS } from '../../../packages/shared/game-events.ts';
import { DEFAULT_CONFIG, type AppConfig } from '../../leaderboard/src/config.ts';
import { createApp, type App } from '../../leaderboard/src/http.ts';
import { LeaderboardService } from '../../leaderboard/src/service.ts';
import { ScoreStore } from '../../leaderboard/src/store.ts';

/**
 * Drives the built plugin the way the Stream Deck app does — a WebSocket server, the registration
 * handshake, and key events — against a real leaderboard. No hardware needed.
 */
const PLUGIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../com.pacmanmaze.controller.sdPlugin');
const ACTION = 'com.pacmanmaze.controller.game-key';
const MANIFEST = JSON.parse(readFileSync(path.join(PLUGIN_DIR, 'manifest.json'), 'utf8')) as {
  Actions: { Name: string; UUID: string; Icon: string }[];
};
/** The id of a dedicated key, e.g. `power-up` → `com.pacmanmaze.controller.power-up`. */
const uuidFor = (command: string) => `com.pacmanmaze.controller.${command}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let store: ScoreStore;
let app: App;
let leaderboardUrl: string;
let wss: WebSocketServer;
let socket: WebSocket;
let plugin: ChildProcess;
let temp: string;
const sent: Record<string, any>[] = [];

function send(message: Record<string, unknown>): void {
  socket.send(JSON.stringify(message));
}

function keyEvent(event: string, context: string, command: string, action = ACTION): Record<string, unknown> {
  // Dedicated keys carry their command in the action id and need no settings at all.
  const settings = action === ACTION ? { command, url: leaderboardUrl } : { url: leaderboardUrl };
  return {
    event,
    action,
    context,
    device: 'DEV1',
    payload: { settings, coordinates: { column: 0, row: 0 }, isInMultiAction: false, controller: 'Keypad' },
  };
}

/** The title a key was last painted with, or undefined if it was never painted. */
function lastTitle(context: string): string | undefined {
  return sent.filter((m) => m.event === 'setTitle' && m.context === context).at(-1)?.payload.title;
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(50);
  }
  throw new Error('timed out waiting for the plugin');
}

describe('Stream Deck plugin', { concurrency: false }, () => {
  before(async () => {
    temp = mkdtempSync(path.join(tmpdir(), 'pacman-sd-test-'));
    const config: AppConfig = { ...DEFAULT_CONFIG, databaseFile: path.join(temp, 'scores.db'), backupDirectory: path.join(temp, 'backups'), powerModeSeconds: 10 };
    store = new ScoreStore(config.databaseFile);
    app = createApp({ service: new LeaderboardService(store, config) });
    await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
    leaderboardUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;

    wss = new WebSocketServer({ port: 0 });
    await new Promise<void>((resolve) => wss.once('listening', resolve));
    const connected = new Promise<WebSocket>((resolve) => wss.once('connection', resolve));

    const info = JSON.stringify({
      application: { font: 'Arial', language: 'en', platform: 'mac', platformVersion: '14.0', version: '7.1.0' },
      plugin: { uuid: 'com.pacmanmaze.controller', version: '1.0.0.0' },
      devicePixelRatio: 2,
      colors: {},
      devices: [{ id: 'DEV1', name: 'Stream Deck MK.2', size: { columns: 5, rows: 3 }, type: 0 }],
    });
    const port = String((wss.address() as AddressInfo).port);
    // Stream Deck runs the plugin from inside the .sdPlugin folder (that's where manifest.json is).
    plugin = spawn(process.execPath, [path.join(PLUGIN_DIR, 'bin/plugin.js'), '-port', port, '-pluginUUID', 'TEST', '-registerEvent', 'registerPlugin', '-info', info], {
      cwd: PLUGIN_DIR,
      stdio: 'ignore',
    });

    socket = await connected;
    socket.on('message', (raw) => sent.push(JSON.parse(raw.toString())));
  });

  after(async () => {
    plugin?.kill();
    wss?.close();
    await app?.close();
    store?.close();
    rmSync(temp, { recursive: true, force: true });
  });

  test('registers itself with Stream Deck', async () => {
    await waitFor(() => sent.some((m) => m.event === 'registerPlugin'));
    assert.equal(sent[0].uuid, 'TEST');
  });

  test('paints a key when it appears, and reports when the leaderboard is reachable', async () => {
    send(keyEvent('willAppear', 'KEY-READY', 'ready'));
    await waitFor(() => sent.some((m) => m.event === 'setTitle' && m.context === 'KEY-READY' && m.payload.title === 'READY'));
    const image = sent.find((m) => m.event === 'setImage' && m.context === 'KEY-READY');
    assert.match(image!.payload.image, /^data:image\/svg\+xml/, 'keys get their Pac-Man artwork');
  });

  test('pressing a key drives the game state on the leaderboard', async () => {
    sent.length = 0;
    send(keyEvent('keyDown', 'KEY-READY', 'ready'));
    await waitFor(() => sent.some((m) => m.event === 'showOk'));
    const status = await (await fetch(`${leaderboardUrl}/api/game`)).json();
    assert.equal(status.game.state, 'ready');
    assert.equal(status.game.cue.name, 'intro');
  });

  test('the POWER UP key counts its own seconds down', async () => {
    send(keyEvent('willAppear', 'KEY-POWER', 'power-up'));
    await fetch(`${leaderboardUrl}/api/game/start`, { method: 'POST' });
    sent.length = 0;
    send(keyEvent('keyDown', 'KEY-POWER', 'power-up'));
    await waitFor(() => sent.filter((m) => m.event === 'setTitle' && m.context === 'KEY-POWER' && /POWER UP\n\d+s/.test(m.payload.title)).length >= 2, 6000);
    const titles = sent.filter((m) => m.event === 'setTitle' && m.context === 'KEY-POWER').map((m) => m.payload.title);
    assert.match(titles.at(-1)!, /POWER UP\n\d+s/);
    await fetch(`${leaderboardUrl}/api/game/reset`, { method: 'POST' });
  });


  test('the manifest declares a key for every game command, with its own icon', () => {
    for (const command of GAME_COMMANDS) {
      const entry = MANIFEST.Actions.find((a) => a.UUID === uuidFor(command));
      assert.ok(entry, `no Stream Deck action for ${command}`);
      assert.equal(entry!.Name, COMMAND_LABELS[command], `${command} should be listed under its key label`);
      for (const suffix of ['.png', '@2x.png']) {
        const icon = path.join(PLUGIN_DIR, `${entry!.Icon}${suffix}`);
        assert.ok(existsSync(icon), `missing actions-list icon: ${entry!.Icon}${suffix}`);
      }
    }
    // Plus the status tile and the spare configurable key.
    assert.equal(MANIFEST.Actions.length, GAME_COMMANDS.length + 2);
  });

  test('the settings panel offers every command on the spare key', () => {
    const html = readFileSync(path.join(PLUGIN_DIR, 'ui/game-key.html'), 'utf8');
    for (const command of GAME_COMMANDS) assert.match(html, new RegExp(`'${command}'`), `${command} missing from the settings panel`);
  });

  test('every dedicated key works with no settings at all', async () => {
    // A key dragged straight from the actions list has an empty settings object: the
    // command comes from the action id, so it must still drive the game.
    await fetch(`${leaderboardUrl}/api/game/reset`, { method: 'POST' });
    for (const command of ['ready', 'start', 'power-up', 'finish', 'reset'] as const) {
      const context = `DEDICATED-${command}`;
      send(keyEvent('willAppear', context, '', uuidFor(command)));
      sent.length = 0;
      send(keyEvent('keyDown', context, '', uuidFor(command)));
      await waitFor(() => sent.some((m) => m.event === 'showOk'), 4000);
    }
    const { game } = await (await fetch(`${leaderboardUrl}/api/game`)).json();
    assert.equal(game.state, 'idle', 'the last press (RESET) should have returned the board to idle');
  });

  test('dedicated keys paint themselves without being configured', async () => {
    sent.length = 0;
    send(keyEvent('willAppear', 'PAINT-GHOST', '', uuidFor('ghost-tag')));
    await waitFor(() => lastTitle('PAINT-GHOST') !== undefined);
    assert.equal(lastTitle('PAINT-GHOST'), 'GHOST TAG');
  });

  test('the status key reports the state and the player count', async () => {
    await fetch(`${leaderboardUrl}/api/scores`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initials: 'SDK', score: 12 }),
    });
    send(keyEvent('willAppear', 'STATUS-KEY', '', 'com.pacmanmaze.controller.status'));
    await waitFor(() => /on board/.test(lastTitle('STATUS-KEY') ?? ''));
    assert.match(lastTitle('STATUS-KEY')!, /^IDLE\n1 on board$/);

    sent.length = 0;
    await fetch(`${leaderboardUrl}/api/game/start`, { method: 'POST' });
    await waitFor(() => /PLAYING/.test(lastTitle('STATUS-KEY') ?? ''));
    await fetch(`${leaderboardUrl}/api/game/reset`, { method: 'POST' });
  });

  test('a key with no address does not disconnect the keys that have one', async () => {
    // Fifteen keys appear at start-up and only one of them carries the address;
    // the others must not reset the plugin back to its default server.
    sent.length = 0;
    send({
      ...keyEvent('willAppear', 'NO-URL', '', uuidFor('fruit')),
      payload: { settings: {}, coordinates: { column: 4, row: 2 }, isInMultiAction: false, controller: 'Keypad' },
    });
    await waitFor(() => lastTitle('NO-URL') !== undefined);
    assert.equal(lastTitle('NO-URL'), 'FRUIT', 'the key should still be online, not "(offline)"');
  });

  test('an unreachable leaderboard shows an alert instead of crashing', async () => {
    const unreachable = { settings: { command: 'ready', url: 'http://127.0.0.1:1' }, coordinates: { column: 0, row: 0 }, isInMultiAction: false, controller: 'Keypad' };
    sent.length = 0;
    send({ ...keyEvent('didReceiveSettings', 'KEY-READY', 'ready'), payload: unreachable });
    // The key tells the operator the server is gone, without being pressed.
    await waitFor(() => sent.some((m) => m.event === 'setTitle' && /offline/.test(m.payload.title)));

    sent.length = 0;
    send({ ...keyEvent('keyDown', 'KEY-READY', 'ready'), payload: unreachable });
    await waitFor(() => sent.some((m) => m.event === 'showAlert'));
  });
});
