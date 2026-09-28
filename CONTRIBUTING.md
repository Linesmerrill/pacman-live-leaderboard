# Contributing

Thanks for helping make the Pac-Man Maze better! Bug reports, ideas, docs fixes and code are all
welcome.

## Reporting a bug or suggesting an idea

[Open an issue](https://github.com/Linesmerrill/pacman-live-leaderboard/issues/new/choose) and pick a
template:

| Template | Title starts with | Use it for |
| --- | --- | --- |
| **Bug report** | `[Bug]` | Something doesn't work the way the guides say |
| **Feature request** | `[Feature]` | Something new, or a change to how something works |
| **Docs** | `[Docs]` | A guide that's wrong, missing or confusing |
| **Hardware** | `[Hardware]` | The Stream Deck, the router, or the power-up sensors |
| **Question / other** | `[Question]` | Anything else |

Keep the title short and specific, after the prefix:

- `[Bug] Staff entry accepts scores on port 8080 when the port is set to 3000`
- `[Feature] Show the round clock on the Stream Deck's status key`
- `[Docs] The sensor guide doesn't say which pin the LED is on`

Before opening one, have a quick look at [Troubleshooting](docs/troubleshooting.md) and the existing
issues. Please **don't include real kids' initials** or photos from the event in issues or
screenshots.

## Changing the code

### Set up

You need Node.js 22.18 or newer. From a clone of the repo:

```bash
npm install
npm run check      # type-check, then all the tests
```

Run your own copy on a spare port, so you never touch a real event's scores:

```bash
PORT=3100 DB_PATH=data/demo.db BACKUP_DIR=backups/demo npm run dev
```

Then open `http://localhost:3100/`. `npm run dev` restarts the server whenever you save a file. How
the code is laid out is in [Development](docs/development.md).

### Guidelines

- **No new runtime dependencies.** The app runs on Node's built-ins alone (web server, SQLite, test
  runner), which is what lets it run offline on a Mac with nothing else installed. Dev-only tools are
  fine.
- **TypeScript that Node can run directly.** Node strips types without compiling, so avoid enums,
  namespaces and constructor parameter properties.
- **Plain browser JavaScript** in `apps/leaderboard/public/js`: modules, no framework, no CDN, no web
  fonts. Everything must work with no internet.
- **Kid safety first.** Store nothing about players beyond 3-character initials, a score, an optional
  time and a timestamp.
- **Commands and game states** belong in `packages/shared/game-events.ts`, so the leaderboard and
  the Stream Deck always agree.
- Match the surrounding code: its naming, its comments, its style.

### Tests

Add or update tests for what you change. The suites live in `apps/leaderboard/test` and
`apps/streamdeck/test`, and run with Node's built-in test runner:

```bash
npm test
```

Before you open a pull request, **`npm run check` must pass**. It type-checks the server, the plugin
and the browser JavaScript, then runs every test.

### Docs and screenshots go with the change

If your change affects what someone sees or does, **update the guides in the same pull request**:
the page in [`docs/`](docs/) that covers it, and the README if it mentions it. If a screen looks
different, **re-take its screenshot** in [`docs/screenshots/`](docs/screenshots/):

- Use your demo copy on port 3100 with made-up initials, never real event data.
- Capture at **1920×1080**, the size of the TV, in Chrome.
- Keep the file name, so the guides pick it up without edits.

Docs that describe how things used to work are worse than no docs, so a pull request that changes
behaviour without its docs will be asked to add them.

### Commits and pull requests

- Branch from `main` and keep each pull request to one change.
- Write commit messages as a short sentence saying what the change does, in the imperative:
  `Fix the TV rules getting stuck on rule 1`, `Add a round clock to the status key`.
- Fill in the pull request template: what changed, why, how you tested it, and which docs and
  screenshots you updated.

### Hardware changes

Changes to the Stream Deck plugin should be tried on a real deck when possible. Say in the pull
request if you couldn't. For the sensor examples in `hardware/`, say which board you tested on.

## Audio and licensing

Don't commit Pac-Man's own sound effects or any audio you don't have the rights to share. Sound
effect files in `assets/audio/` are git-ignored for that reason. See
[Music and sound](docs/music-and-sound.md).

By contributing, you agree that your contributions are licensed under the project's
[MIT license](LICENSE).
