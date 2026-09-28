# Development

How the code fits together, the API, and the tests. For how to propose a change, see
[CONTRIBUTING.md](../CONTRIBUTING.md).

← [All guides](README.md)

## Architecture

- **Node.js + TypeScript**, run directly by Node's built-in TypeScript support, with no build step.
  Node only *strips* types, so TypeScript-only runtime features (enums, constructor parameter
  properties, namespaces) aren't allowed.
- **SQLite** via Node's built-in `node:sqlite` (WAL journal, `synchronous=FULL`): no native modules to
  compile and no database server. Schema: [`schema.sql`](../apps/leaderboard/src/schema.sql).
- **Server-Sent Events** (`/api/stream`) push every change to every screen. Browsers reconnect by
  themselves, and a 20-second poll is a safety net.
- **Frontend:** plain HTML, CSS and JavaScript modules, with no framework, no CDN and no web fonts, so
  it runs offline. The arcade lettering is an original 5×7 pixel font drawn as SVG; ghosts, fruit and
  Pac-Man are original SVGs; the built-in sounds and chiptune are generated with Web Audio.
- **The Stream Deck plugin** is a separate app built with Elgato's SDK. It and the leaderboard share
  one list of commands and game states in `packages/shared`, so there are no magic strings to keep in
  sync.

```
Stream Deck key ─┐
corner sensor ───┼─ POST /api/game/<command> ─▶ leaderboard app ── Server-Sent Events ─▶ TV board
curl ────────────┘                               (owns the game,                         staff screens
                                                  scores, rounds)                        Stream Deck keys
```

## Project layout

```
apps/leaderboard/            the app that runs the event
  src/
    server.ts       starts everything, prints the addresses, shuts down cleanly
    http.ts         routes, static files, audio, the staff PIN, the prize round timer
    service.ts      business rules: scores, settings, rounds, reset, backup, CSV
    game.ts         the game state machine and the timers behind the countdown and POWER MODE
    audio.ts        finds and serves your own sound files and songs from assets/audio
    ranking.ts      pure ranking and tie-break rules
    validation.ts   initials, score and time validation
    denylist.ts     blocked-initials matching (look-alikes, wildcards)
    store.ts        SQLite persistence
    live.ts         Server-Sent Events hub
    config.ts       config.json loading and limits
  public/
    index.html      TV leaderboard (+ the built-in entry panel)
    admin.html      staff entry          settings.html  Manage scores
    js/             board, rules, entry form, scoring, rounds, pixel font, sprites, sounds, music…
  test/             one suite per area, plus the HTTP API
apps/streamdeck/             the Stream Deck plugin (its README covers developing it)
packages/shared/             the command and game-state contract both apps import
hardware/                    example code for the power-up sensors
assets/audio/                your sound effects (not committed) and the songs (committed)
scripts/                     kiosk launcher, auto-start installer, backup, the browser-JS check
docs/                        these guides, and docs/screenshots for their images
config.json · data/ · backups/   settings and event data
```

## Running a copy for development

`npm start` uses port 3000 and the real scores database. When the real leaderboard is already running
on the machine, run a second copy on another port with its own database:

```bash
PORT=3100 DB_PATH=data/demo.db BACKUP_DIR=backups/demo npm start
```

`npm run dev` restarts the server whenever a file changes. `.claude/launch.json` has the same demo
setup for Claude Code's preview.

## Tests and checks

```bash
npm test          # the leaderboard suites, then the Stream Deck plugin against a simulated Stream Deck
npm run check     # type-check everything, then the tests
```

`npm run check` type-checks the server and the plugin, and runs `scripts/check-web.mjs` over the
browser JavaScript, which catches a missing import or a misspelt name before it blanks part of the
TV. The Stream Deck tests run the real built plugin against a real leaderboard with a stand-in for
the Stream Deck app, so key presses, key art and the offline behaviour are covered without a deck
plugged in.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | `{ "ok": true, … }` when the app is up |
| GET | `/api/leaderboard` | Public snapshot: every run in rank order, display settings, scoring, the round |
| GET | `/api/stream` | Public live updates (Server-Sent Events) |
| POST | `/api/scores` | `{ initials, score, timeSeconds?, submissionId?, confirmDuplicate? }` |
| GET | `/api/scores` | All scores for staff, with blocked-word flags |
| PUT / DELETE | `/api/scores/:id` | Edit / delete |
| POST | `/api/scores/:id/spotlight` | Show a player on the TV again |
| POST | `/api/round/end` · `/api/round/restart` | End the prize round now · restart its clock. Ending refuses (409) before the round's first score. |
| POST | `/api/reset` | `{ "confirm": "RESET" }`: backs up, then clears |
| POST | `/api/backup` · GET `/api/export.csv` | Backup file · CSV download |
| GET / PUT | `/api/settings` | Everything in Manage scores |
| GET | `/api/game` | Current game state: state, music loop, last cue, volume, timers |
| POST | `/api/game/:command` | Run a controller command (see [Stream Deck](stream-deck.md#no-stream-deck)). Optional `?source=` names the sender in the log. |
| GET | `/api/audio` | Which of your own sound files and songs were found |

Staff endpoints need the `X-Admin-Pin` header only when `adminPin` is set.
