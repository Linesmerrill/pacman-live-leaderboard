// Bundles the plugin into com.pacmanmaze.controller.sdPlugin/bin/plugin.js
// (Stream Deck runs that single file with its own bundled Node runtime.)
import { writeFileSync } from 'node:fs';
import esbuild from 'esbuild';

const options = {
  entryPoints: ['src/plugin.ts'],
  outfile: 'com.pacmanmaze.controller.sdPlugin/bin/plugin.js',
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
writeFileSync('com.pacmanmaze.controller.sdPlugin/bin/package.json', JSON.stringify({ type: 'module' }, null, 2) + '\n');

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('Watching apps/streamdeck/src for changes…');
} else {
  await esbuild.build(options);
}
