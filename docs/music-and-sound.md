# Music and sound

The TV plays everything: sound effects during a run, and quiet songs between runs. It all works out
of the box, and any of it can be swapped for your own recordings.

← [All guides](README.md)

## Sound effects

With no files added, the TV plays original arcade-style blips, generated in the browser:

| When | Sound |
| --- | --- |
| A run lands below the top 10 | Short two-note blip |
| A run makes the pinned top 10 | Rising three-note blip |
| 1st, 2nd or 3rd place | Podium arpeggio with a bass note |
| **New high score** (#1 beaten outright) | Full fanfare, timed to the celebration |
| The board jumps to a player (including **Show on TV**) | Sparkle, plus a Pac-Man chomp on the page flip |
| Opening the entry panel | Soft blip |
| During a run | The Stream Deck's cues: intro, countdown, go, the waka, power-up, finish… |

Idle page flips are deliberately silent, so the room only hears something when a kid actually scores.

### Using your own sound effects

Drop files into [`assets/audio/`](../assets/audio/) and they replace the built-in blips. The file name
is the cue name; `.wav`, `.mp3`, `.ogg`, `.m4a` and `.aac` all work.

| File | Plays when |
| --- | --- |
| `intro.wav` | READY |
| `countdown.wav` | The 3·2·1 countdown starts |
| `go.wav` | **The run begins** (after the countdown, or on START) |
| `pac-dot.wav` | **Eating a dot**, repeated over and over for the whole run |
| `pac-dot-2.wav` | Optional second chomp: the run alternates the two, "waka waka" like the arcade |
| `power-up.wav` | **Power pellet**: POWER UP pressed, or a corner sensor |
| `power-end.wav` | Power mode runs out |
| `ghost-tag.wav` | GHOST TAG |
| `fruit.wav` | FRUIT |
| `high-score.wav` | A new high score, and the HI SCORE key |
| `finish.wav` | **Game over**: FINISH, or the run clock running out |
| `intermission.wav` | RESET, between runs |
| `stop.wav` | STOP ALL |

Two optional tracks loop continuously instead:

| File | Plays when |
| --- | --- |
| `gameplay-loop.wav` | Through the whole run, instead of the repeated `pac-dot` waka |
| `power-loop.wav` | Through power mode |

Anything you don't supply keeps its built-in sound, so the show always has audio. Keep `pac-dot` short:
it repeats every `wakaIntervalMs` (150 ms, in `config.json`), so anything longer than about a quarter
of a second overlaps itself.

**Restart the app after adding files** (the folder is read at startup), reload the TV page, and check
what it found at <http://localhost:3000/api/audio>.

**Licensing.** Pac-Man's own audio belongs to Bandai Namco, so use recordings you have the right to
use: a licensed sound pack, sounds you made yourself, or sounds licensed for your event. Sound effect
files are **not committed to git** (see `.gitignore`), so this public repository never redistributes
them; they live only on the event Mac.

## Songs between runs

Soft background songs play whenever a run *isn't* under way: the idle board, READY, and after FINISH.
They duck under every sound effect and stop completely once a run starts, so they never fight the
waka.

The project comes with **the event's own songs** in [`assets/audio/music/`](../assets/audio/music/).
They play shuffled, back to back, and the TV flashes each song's name, taken from the file name
(`Where_the_Map_Ends.mp3` shows as `WHERE THE MAP ENDS`). Skip back and forward with the Stream Deck's
**PREV** and **NEXT**. A run interrupts the song, and the next break picks up where it stopped.

**Adding or replacing songs.** Put MP3s (or `.m4a`, `.ogg`, `.wav`) in `assets/audio/music/`, any
name, then restart the app. Songs play at their own recorded level, which lands about level with the
rest of the show. The songs are committed with the repo, so only add music you own or have the rights
to share.

**With no songs at all**, the TV falls back to a built-in album: eight original chiptune pieces of
about a minute each, stored as notes in [`music.js`](../apps/leaderboard/public/js/music.js), so they
cost nothing to ship.

## Volume and switching sound off

| What | Where |
| --- | --- |
| **TV volume** and mute | The Stream Deck's **VOL −**, **VOL +** and **MUTE**. Saved, so it survives a restart. |
| **Background music** on/off and how loud it sits under the room | **Manage scores → Background music** (35% by default) |
| **All sound** on/off | The speaker button next to **+ ADD PLAYER** on the TV, or **Manage scores → Sound effects** |

The TV's sound comes from the Mac over HDMI: check System Settings → Sound → Output. Browsers block
sound until someone interacts with the page. `npm run kiosk` launches Chrome with sound allowed from
the start; otherwise, click the board once.
