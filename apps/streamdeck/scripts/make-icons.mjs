// Renders one actions-list icon per game command, so every key is recognisable in
// the Stream Deck actions list before it's even dragged onto the deck.
//
//   npm run streamdeck:icons
//
// The PNGs are committed, so this only needs re-running when the artwork changes.
// Uses Chrome purely as an SVG rasteriser — nothing here runs at the event.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_COMMANDS } from '../../../packages/shared/game-events.ts';
import { actionIconSvg, statusIconSvg } from '../src/icons.ts';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMGS = path.join(ROOT, 'com.pacmanmaze.controller.sdPlugin/imgs/actions');
const work = mkdtempSync(path.join(tmpdir(), 'pacman-icons-'));

/** Stream Deck wants a 20px icon and a 40px @2x next to it. */
const SIZES = [
  { px: 20, suffix: '' },
  { px: 40, suffix: '@2x' },
];

function render(name, svgFor) {
  mkdirSync(path.join(IMGS, name), { recursive: true });
  for (const { px, suffix } of SIZES) {
    const svg = path.join(work, `${name}-${px}.svg`);
    const png = path.join(work, `${name}-${px}.png`);
    writeFileSync(svg, svgFor(px));
    execFileSync(CHROME, [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      `--window-size=${px},${px}`,
      `--screenshot=${png}`,
      svg,
    ], { stdio: 'ignore' });
    renameSync(png, path.join(IMGS, name, `icon${suffix}.png`));
  }
}

try {
  for (const command of GAME_COMMANDS) render(command, (px) => actionIconSvg(command, px));
  render('status', statusIconSvg);
  console.log(`Rendered ${GAME_COMMANDS.length + 1} action icons into ${path.relative(ROOT, IMGS)}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
