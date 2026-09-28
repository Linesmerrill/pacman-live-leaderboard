# Pac-Man Maze — Stream Deck plugin

The Stream Deck controller for the attraction. **Installing it and using the keys is covered in
[docs/stream-deck.md](../../docs/stream-deck.md).** This page is for changing the plugin itself.

![The 15 keys of a Stream Deck MK.2 running the attraction](../../docs/screenshots/streamdeck-layout.png)

## How it fits together

```
Stream Deck key ──POST /api/game/<command>──▶ leaderboard app ──Server-Sent Events──▶ TV board
       ▲                                            │                                  • sounds
       └────────── live state on the keys ──────────┘                                  • visuals
```

The command list lives in [`packages/shared/game-events.ts`](../../packages/shared/game-events.ts) and is
imported by both apps, so there are no magic strings to keep in sync. The build generates the
manifest's action list from it too, so a new command becomes a new key with nothing to wire by hand.

## Building

```bash
npm run build --workspace @pacman/streamdeck    # bundle to com.pacmanmaze.controller.sdPlugin/bin
npm run watch --workspace @pacman/streamdeck    # rebuild on save
```

Source layout:

```
src/plugin.ts     entry point: registers every action, repaints keys on game changes
src/actions.ts    the key actions — one per command, plus the status tile and the spare key
src/client.ts     talks to the leaderboard (commands + live state, with reconnect)
src/icons.ts      original SVG key art, one icon per command
build.mjs         bundles the plugin and regenerates the manifest's action list
scripts/make-icons.mjs    renders the actions-list icons (Chrome as an SVG rasteriser)
scripts/make-profile.mjs  builds the ready-made deck layout
com.pacmanmaze.controller.sdPlugin/
  manifest.json   plugin metadata for Stream Deck
  ui/game-key.html  property inspector (self-contained, works offline)
  imgs/           plugin and action icons (one per command)
  bin/            build output (not committed)
```

After a change, run `npm run streamdeck:build && npm run streamdeck:install` from the repo root
to load it into the Stream Deck app, and `npm test` to run the plugin tests (`test/`) against a
simulated Stream Deck.

Logs from the plugin land in `com.pacmanmaze.controller.sdPlugin/logs/` once it runs.
