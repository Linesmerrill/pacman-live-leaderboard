import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { COMMAND_LABELS, GAME_COMMANDS } from '../../../packages/shared/game-events.ts';

/**
 * The ready-made deck layout. Only runs where a Stream Deck has been set up, since the
 * profile is built for the deck that's actually plugged in.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'profiles', 'Pac-Man Maze.streamDeckProfile');
const hasDeck = existsSync(path.join(process.env.HOME ?? '', 'Library/Application Support/com.elgato.StreamDeck/ProfilesV3'));

describe('deck profile', { skip: hasDeck ? false : 'no Stream Deck app on this machine' }, () => {
  const listing = (() => {
    execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'scripts/make-profile.mjs'], { cwd: ROOT, stdio: 'ignore' });
    return execFileSync('unzip', ['-l', OUT], { encoding: 'utf8' });
  })();

  test('names the bundle after a UUID, which is what Stream Deck will accept', () => {
    // A readable folder name fails the import with "umbrella has malformed uuid".
    const root = listing.match(/([^\s/]+)\.sdProfile\//)?.[1];
    assert.ok(root, 'no .sdProfile folder in the archive');
    assert.match(root!, /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/);
  });

  test('fills all fifteen keys with actions the plugin really registers', () => {
    // The archive holds two pages: the one with the keys, and an empty default page.
    const pages = listing
      .split('\n')
      .map((line) => line.match(/\S+\.sdProfile\/Profiles\/\S+\/manifest\.json/)?.[0])
      .filter((name): name is string => Boolean(name));
    const parsed = pages.map((name) => JSON.parse(execFileSync('unzip', ['-p', OUT, name], { encoding: 'utf8' })));
    const page = parsed.find((p: { Controllers: { Actions: unknown }[] }) => p.Controllers[0].Actions) as {
      Controllers: { Actions: Record<string, { UUID: string }> }[];
    };
    assert.ok(page, 'the profile has no page with any keys on it');

    const actions = page.Controllers[0].Actions;
    assert.equal(Object.keys(actions).length, 15, 'the deck has fifteen keys and all of them should be used');

    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'com.pacmanmaze.controller.sdPlugin/manifest.json'), 'utf8')) as {
      Actions: { UUID: string }[];
    };
    const declared = new Set(manifest.Actions.map((a) => a.UUID));
    for (const [coordinate, entry] of Object.entries(actions)) {
      assert.match(coordinate, /^[0-4],[0-2]$/, `key ${coordinate} is off the deck`);
      assert.ok(declared.has(entry.UUID), `${entry.UUID} is not an action this plugin declares`);
    }

    // Every command a runner needs during a session is on the deck, not just some of them.
    const placed = new Set(Object.values(actions).map((a) => a.UUID.replace('com.pacmanmaze.controller.', '')));
    for (const command of GAME_COMMANDS) assert.ok(placed.has(command), `${COMMAND_LABELS[command]} is missing from the layout`);
  });
});
