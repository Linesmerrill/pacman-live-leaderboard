// Builds a ready-made Stream Deck profile with every Pac-Man Maze key already placed,
// so a deck goes from empty to fully wired in one double-click.
//
//   npm run streamdeck:profile           build it
//   npm run streamdeck:profile -- --open build it and hand it to Stream Deck to import
//
// The profile is written for the deck that's actually plugged into this Mac: the model
// and grid size are read from the Stream Deck app's own files.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMAND_LABELS } from '../../../packages/shared/game-events.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SD_DATA = path.join(homedir(), 'Library/Application Support/com.elgato.StreamDeck');
const PROFILE_NAME = 'Pac-Man Maze';
const OUT = path.join(ROOT, 'profiles', `${PROFILE_NAME}.streamDeckProfile`);

/**
 * The deck, read top row to bottom row. The run reads left to right along the top;
 * the mid-run flourishes sit under it; sound and the status tile fill the bottom row.
 */
const LAYOUT = [
  'ready', 'countdown', 'start', 'power-up', 'finish',
  'ghost-tag', 'fruit', 'spotlight', 'high-score', 'reset',
  'volume-down', 'volume-up', 'mute', 'stop-all', 'status',
];

/** Known 15-key models, so an unfamiliar deck gets a warning rather than a broken profile. */
const GRIDS = { '20GAA9901': [5, 3], '20GBA9901': [5, 3], '20GAT9901': [5, 3] };

/** The deck plugged into this Mac, learnt from the profiles the Stream Deck app already keeps. */
function findDevice() {
  const dir = path.join(SD_DATA, 'ProfilesV3');
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir)) {
    const file = path.join(dir, entry, 'manifest.json');
    if (!existsSync(file)) continue;
    const { Device } = JSON.parse(readFileSync(file, 'utf8'));
    if (Device?.Model) return Device;
  }
  return null;
}

function keyAction(command, name) {
  return {
    ActionID: randomUUID(),
    // The plugin paints the key art and the label itself, so the profile carries neither.
    LinkedTitle: true,
    Name: name,
    Plugin: { Name: 'Pac-Man Maze Controller', UUID: 'com.pacmanmaze.controller', Version: '1.0.0.0' },
    Resources: null,
    Settings: {},
    State: 0,
    States: [
      {
        FontFamily: '',
        FontSize: 10,
        FontStyle: '',
        FontUnderline: false,
        Image: '',
        OutlineThickness: 2,
        ShowTitle: true,
        Title: '',
        TitleAlignment: 'bottom',
        TitleColor: '#ffffff',
      },
    ],
    UUID: `com.pacmanmaze.controller.${command}`,
  };
}

const device = findDevice();
if (!device) {
  console.error('No Stream Deck device found. Plug the deck in, open the Stream Deck app once, then run this again.');
  process.exit(1);
}
const [columns, rows] = GRIDS[device.Model] ?? [5, 3];
if (!GRIDS[device.Model]) console.warn(`Unfamiliar deck model ${device.Model}; assuming a ${columns}×${rows} grid.`);

const actions = {};
let placed = 0;
for (const [index, command] of LAYOUT.entries()) {
  const column = index % columns;
  const row = Math.floor(index / columns);
  if (row >= rows) break;
  actions[`${column},${row}`] = keyAction(command, command === 'status' ? 'Game Status' : COMMAND_LABELS[command]);
  placed++;
}
if (placed < LAYOUT.length) console.warn(`This deck has ${columns * rows} keys; the last ${LAYOUT.length - placed} were left out.`);

// Stream Deck profiles are a folder of JSON: one page of keys, plus an empty default page.
// The folder itself must be named for a UUID — the app rejects the import otherwise
// ("umbrella has malformed uuid"). The readable name lives in the manifest.
const work = mkdtempSync(path.join(tmpdir(), 'pacman-profile-'));
const bundleId = randomUUID().toUpperCase();
const bundle = path.join(work, `${bundleId}.sdProfile`);
const page = randomUUID().toUpperCase();
const blank = randomUUID().toUpperCase();

mkdirSync(path.join(bundle, 'Profiles', page), { recursive: true });
mkdirSync(path.join(bundle, 'Profiles', blank), { recursive: true });
writeFileSync(
  path.join(bundle, 'manifest.json'),
  JSON.stringify({
    Device: { Model: device.Model, UUID: device.UUID ?? '' },
    Name: PROFILE_NAME,
    Pages: { Current: page.toLowerCase(), Default: blank.toLowerCase(), Pages: [page.toLowerCase()] },
    Version: '3.0',
  }),
);
writeFileSync(
  path.join(bundle, 'Profiles', page, 'manifest.json'),
  JSON.stringify({ Controllers: [{ Actions: actions, Type: 'Keypad' }], Icon: '', Name: '' }),
);
writeFileSync(
  path.join(bundle, 'Profiles', blank, 'manifest.json'),
  JSON.stringify({ Controllers: [{ Actions: null, Type: 'Keypad' }], Icon: '', Name: '' }),
);

mkdirSync(path.dirname(OUT), { recursive: true });
rmSync(OUT, { force: true });
execFileSync('zip', ['-r', '-q', OUT, `${bundleId}.sdProfile`], { cwd: work });
rmSync(work, { recursive: true, force: true });

console.log(`Built a ${placed}-key profile for your ${device.Model}:\n  ${OUT}`);
if (process.argv.includes('--open')) {
  execFileSync('open', [OUT]);
  console.log('Stream Deck should now offer to import it.');
} else {
  console.log('Double-click it (or re-run with --open) to load it into Stream Deck.');
}
