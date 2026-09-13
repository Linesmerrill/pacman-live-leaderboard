# Pac-Man Maze — Stream Deck Controller

A hardware remote for the Pac-Man Maze attraction. Each key sends a command to the leaderboard app
running on the same Mac, which owns the game state, the sounds and what the TV shows.

![The 15 keys of a Stream Deck MK.2 running the attraction](../../docs/screenshots/streamdeck-layout.png)

## What a key does

Every key is its own action. Open the **Pac-Man Maze** category in the Stream Deck actions list and
drag the one you want onto the deck — there is nothing to configure, each key already knows its job:

| Key | What happens |
| --- | --- |
| **READY** | Intro sound, TV shows `READY!` |
| **3·2·1** | Countdown on the TV, then the run starts by itself |
| **START** | Starts the run, run clock and gameplay music |
| **POWER UP** | Power-mode music and blue ghosts for 10 seconds, then back to normal play automatically |
| **GHOST TAG / FRUIT / PAC-DOT** | One-shot sounds during a run |
| **PREV / NEXT** | Skip the background music back or forward a track; the TV shows the track name |
| **SPOTLIGHT** | Puts the player who just scored on the TV and holds their page there, for the photo |
| **HIGH SCORE** | Plays the high-score fanfare on demand |
| **FINISH** | Ends the run: music stops, `FINISH!` on the TV |
| **STOP ALL** | Silences everything without changing the state |
| **RESET** | Back to the idle leaderboard |
| **VOL + / VOL − / MUTE** | TV volume and mute (saved, so it survives a restart) |
| **Game Status** | Presses nothing: shows the state, the seconds left and how many players are on the board |
| **Game Action (pick one)** | A spare key — choose what it does in its settings |

Keys also *show* what's happening: POWER UP counts its seconds down, VOL keys show the current
volume, MUTE shows when sound is off, the live key lights up, keys that don't apply right now are
dimmed, and every key shows `(offline)` if the leaderboard can't be reached.

## Install on the event Mac

```bash
npm install                  # from the repo root, once
npm run streamdeck:build
npm run streamdeck:install
npm run streamdeck:profile   # optional: a ready-made 15-key layout
```

`streamdeck:profile` writes `profiles/Pac-Man Maze.streamDeckProfile` for the deck plugged into this
Mac. Double-click it and confirm the import to get every key placed at once:

```
READY   3·2·1   START      POWER UP    FINISH
PREV    NEXT    SPOTLIGHT  HI SCORE    RESET
VOL −   VOL +   MUTE       STOP ALL    STATUS
```

PAC-DOT, GHOST TAG and FRUIT are left off the layout on purpose — PAC-DOT duplicated the waka that
loops through every run, and the other two gave their keys to the music. All three are still in the
actions list if you want them back.

Prefer to arrange it yourself? Skip the profile and drag the keys over one at a time.

The installer quits Stream Deck, copies the plugin in, and starts it again. Requires the **Stream
Deck app 7.1 or newer** (it ships the Node runtime the plugin needs — you don't need Node for the
plugin itself, only to build it).

Re-run both commands after changing anything in `src/`.

## Settings

Each key has an optional **Connection** section. You only need to fill it in on *one* key — the
address is shared by every Pac-Man Maze key on the deck:

- **Leaderboard address** — leave blank for `http://localhost:3000`. Set it if the leaderboard runs on
  a different Mac, or on a different port.
- **Staff PIN** — only needed if `adminPin` is set in the repo's `config.json`.

## Driving the deck from an AI assistant (optional)

Elgato ships an MCP server that bridges to the running Stream Deck app. [`.mcp.json`](../../.mcp.json)
in the repo root registers it for Claude Code; Claude Desktop keeps the same block in its own
`claude_desktop_config.json`. It needs **MCP Actions enabled in the Stream Deck app**, and the app
running.

What it can do: list the actions installed plugins offer, list what's currently on the deck, and
*press* a key. That makes it useful for checking a real deck end to end without standing at it.

What it can't do: create or arrange profiles. Laying out the keys is still
`npm run streamdeck:profile` plus the import, or dragging them on by hand.

It fetches the server from npm on each start, so it needs the internet — which the attraction itself
never does. Nothing here runs during the event.

## How it fits together

```
Stream Deck key ──POST /api/game/<command>──▶ leaderboard app ──Server-Sent Events──▶ TV board
       ▲                                            │                                  • sounds
       └────────── live state on the keys ──────────┘                                  • visuals
```

The command list lives in [`packages/shared/game-events.ts`](../../packages/shared/game-events.ts) and is
imported by both apps, so there are no magic strings to keep in sync. The build generates the
manifest's action list from it too, so a new command becomes a new key with nothing to wire by hand.

## Development

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

Logs from the plugin land in `com.pacmanmaze.controller.sdPlugin/logs/` once it runs.
