// Bundles the plugin into com.pacmanmaze.controller.sdPlugin/bin/plugin.js
// (Stream Deck runs that single file with its own bundled Node runtime.)
import { readFileSync, writeFileSync } from 'node:fs';
import esbuild from 'esbuild';
import { COMMAND_DESCRIPTIONS, COMMAND_LABELS, GAME_COMMANDS } from '../../packages/shared/game-events.ts';

const PLUGIN_DIR = 'com.pacmanmaze.controller.sdPlugin';

/**
 * The manifest lists one action per game command, so wiring up a deck is a single
 * drag per key with nothing to configure. Generated from the shared command list:
 * the plugin refuses to register an action that the manifest doesn't declare, so
 * these two must never drift apart.
 */
function actionEntries() {
  const key = (name, uuid, icon, tooltip) => ({
    Name: name,
    UUID: `com.pacmanmaze.controller.${uuid}`,
    Icon: `imgs/actions/${icon}/icon`,
    Tooltip: tooltip,
    PropertyInspectorPath: 'ui/game-key.html',
    Controllers: ['Keypad'],
    States: [{ Image: `${'imgs/actions/game-key/key'}`, TitleAlignment: 'bottom', FontSize: '10' }],
  });
  return [
    ...GAME_COMMANDS.map((command) => key(COMMAND_LABELS[command], command, command, COMMAND_DESCRIPTIONS[command])),
    key('Game Status', 'status', 'status', 'Shows what the game is doing, the time left, and how many players are on the board.'),
    key('Game Action (pick one)', 'game-key', 'game-key', 'A spare key: choose which action it runs in its settings.'),
  ];
}

function writeManifest() {
  const file = `${PLUGIN_DIR}/manifest.json`;
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  manifest.Actions = actionEntries();
  writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
}

const options = {
  entryPoints: ['src/plugin.ts'],
  outfile: `${PLUGIN_DIR}/bin/plugin.js`,
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: 'linked',
  logLevel: 'info',
  banner: {
    // The SDK bundles `ws`, which is CommonJS: give the ESM bundle a working `require`.
    js: [
      '/* Built from apps/streamdeck/src — run `npm run streamdeck:build` after editing. */',
      "import { createRequire as __createRequire } from 'node:module';",
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
};

// Pin the module type next to the bundle: without this, Node reads bin/plugin.js as CommonJS
// once the plugin is installed (no package.json nearby) and as ESM here in the workspace.
writeFileSync(`${PLUGIN_DIR}/bin/package.json`, JSON.stringify({ type: 'module' }, null, 2) + '\n');
writeManifest();

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('Watching apps/streamdeck/src for changes…');
} else {
  await esbuild.build(options);
}
