# Pac-Man Maze — Stream Deck Controller

A hardware remote for the Pac-Man Maze attraction. Each key sends a command to the leaderboard app
running on the same Mac, which owns the game state, the sounds and what the TV shows.

![The 15 keys of a Stream Deck MK.2 running the attraction](../../docs/screenshots/streamdeck-layout.png)

## What a key does

Drag **Game Action** onto any key, then pick its job in the property inspector:

| Key | What happens |
| --- | --- |
| **READY** | Intro sound, TV shows `READY!` |
| **3·2·1** | Countdown on the TV, then the run starts by itself |
| **START** | Starts the run, run clock and gameplay music |
| **POWER UP** | Power-mode music and blue ghosts for 10 seconds, then back to normal play automatically |
| **GHOST TAG / FRUIT / PAC-DOT** | One-shot sounds during a run |
| **HIGH SCORE** | Plays the high-score fanfare on demand |
| **FINISH** | Ends the run: music stops, `FINISH!` on the TV |
| **STOP ALL** | Silences everything without changing the state |
| **RESET** | Back to the idle leaderboard |
| **VOL + / VOL − / MUTE** | TV volume and mute (saved, so it survives a restart) |

Keys also *show* what's happening: POWER UP counts its seconds down, VOL keys show the current
volume, MUTE shows when sound is off, the live key lights up, keys that don't apply right now are
dimmed, and every key shows `(offline)` if the leaderboard can't be reached.

## Install on the event Mac

```bash
npm install                  # from the repo root, once
npm run streamdeck:build
npm run streamdeck:install
```

The installer quits Stream Deck, copies the plugin in, and starts it again. Requires the **Stream
Deck app 7.1 or newer** (it ships the Node runtime the plugin needs — you don't need Node for the
plugin itself, only to build it).

Re-run both commands after changing anything in `src/`.

## Settings

Each key has an optional **Connection** section:

- **Leaderboard address** — leave blank for `http://localhost:3000`. Set it if the leaderboard runs on
  a different Mac, or on a different port.
- **Staff PIN** — only needed if `adminPin` is set in the repo's `config.json`.

## How it fits together

```
Stream Deck key ──POST /api/game/<command>──▶ leaderboard app ──Server-Sent Events──▶ TV board
       ▲                                            │                                  • sounds
       └────────── live state on the keys ──────────┘                                  • visuals
```

The command list lives in [`packages/shared/game-events.ts`](../../packages/shared/game-events.ts) and is
imported by both apps, so there are no magic strings to keep in sync.

## Development

```bash
npm run build --workspace @pacman/streamdeck    # bundle to com.pacmanmaze.controller.sdPlugin/bin
npm run watch --workspace @pacman/streamdeck    # rebuild on save
```

Source layout:

```
src/plugin.ts     entry point: registers the action, repaints keys on game changes
src/game-key.ts   the configurable key action
src/client.ts     talks to the leaderboard (commands + live state, with reconnect)
src/icons.ts      original SVG key art, one icon per command
com.pacmanmaze.controller.sdPlugin/
  manifest.json   plugin metadata for Stream Deck
  ui/game-key.html  property inspector (self-contained, works offline)
  imgs/           plugin and action icons
  bin/            build output (not committed)
```

Logs from the plugin land in `com.pacmanmaze.controller.sdPlugin/logs/` once it runs.
