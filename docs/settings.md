# Settings

Most things are changed on the night in **Manage scores** (`http://localhost:3000/admin/settings`).
They're saved straight away, every screen picks them up at once, and they survive a restart. A few
things that rarely change live in `config.json`.

← [All guides](README.md)

## Manage scores

| Card | What it controls | Default |
| --- | --- | --- |
| **Completion timer** | Whether staff record a completion time, and the TV shows a TIME column | Off |
| **Run timer** | **Run length** in seconds (`0` = no limit) · **Power pellet** seconds: how long power mode lasts and how much time a pellet adds · **Pellets that add time** per run | 20 s · 5 s · 1 |
| **Scoring** | Points for each fruit, which fruit are in the maze, and the ghost values | Arcade ÷ 10, first 5 fruit, ghosts 20/40/80/160 |
| **Prize rounds** | On/off · **Round length** in minutes · **Prize places** (top how many win) · **End round now** · **Restart the clock** | On · 15 min · top 3 |
| **How to play (on the TV)** | On/off · **width** of the rules panel (25–65% of the screen, the TV resizes as you drag) · seconds per rule | On · 40% · 6 s |
| **Background music** | On/off and volume of the songs between runs, separate from the TV volume | On · 35% |
| **Sound effects** | All sound on the TV on/off (also the speaker button next to **+ ADD PLAYER**) | On |
| **Blocked initials** | Your own blocked combos, on top of the built-in list (`?` is a wildcard) | Empty |
| **Backup & export** | **Save backup now** and **Download CSV** | |
| **Clear leaderboard** | Wipes the board after you type `RESET`, backing it up first | |

How these behave on the night is explained in [How it works](how-it-works.md). The TV volume itself is
set with the Stream Deck's VOL keys.

## config.json

Edit `config.json` in the project folder and restart the app. Every key is optional. The settings
that also appear in Manage scores are only the **starting values for a brand-new database**; after
that, Manage scores wins.

| Key | Default | Meaning |
| --- | --- | --- |
| `port` | `3000` | Web server port (env `PORT`) |
| `host` | `"0.0.0.0"` | `"0.0.0.0"` lets tablets on the Wi-Fi connect; `"127.0.0.1"` = this Mac only (env `HOST`) |
| `databaseFile` | `"data/pacman-maze.db"` | The scores database (env `DB_PATH`) |
| `backupDirectory` | `"backups"` | Where backups are written (env `BACKUP_DIR`) |
| `adminPin` | `""` | Staff PIN; empty = no PIN (env `ADMIN_PIN`) |
| `leaderboardSize` | `10` | Rows per TV column; the first column pins this many top players |
| `boardColumns` | `3` | Most TV columns (1–4). Fewer are used when the rules panel or a narrow screen needs the room |
| `pageSeconds` | `10` | Seconds between page flips of the lower ranks |
| `spotlightSeconds` | `20` | How long a newly added player stays highlighted |
| `maxScore` | `999` | Highest score accepted |
| `maxTimeSeconds` | `3600` | Longest completion time accepted |
| `duplicateWarningSeconds` | `60` | "Same player again?" window; `0` turns it off |
| `audioDirectory` | `"assets/audio"` | Folder holding your own sounds and songs (env `AUDIO_DIR`) |
| `soundVolume` | `80` | Starting TV volume, 0–100 |
| `wakaIntervalMs` | `150` | How often the eating-a-dot sound repeats during a run |
| `countdownSeconds` | `3` | Length of the 3·2·1 countdown |
| `completionTimeEnabled` | `false` | Starting value of **Completion timer** |
| `soundEnabled` | `true` | Starting value of **Sound effects** |
| `runSeconds` · `powerPelletSeconds` · `maxPellets` | `20` · `5` · `1` | Starting values of **Run timer** |
| `idleMusicEnabled` · `idleMusicVolume` | `true` · `35` | Starting values of **Background music** |
| `rulesEnabled` · `rulesPercent` · `rulesStepSeconds` | `true` · `40` · `6` | Starting values of **How to play** |
| `roundsEnabled` · `roundMinutes` · `prizeCount` | `true` · `15` · `3` | Starting values of **Prize rounds** |

Fruit and ghost points have no `config.json` key; set them in **Manage scores → Scoring**.
