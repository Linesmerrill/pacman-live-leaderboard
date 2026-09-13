# Event audio

Drop sound files in this folder and the TV plays them instead of the built-in synthesised blips.
Nothing here is required — with the folder empty, the app falls back to its own sounds.

## Filenames

The file name is the cue name. `.wav`, `.mp3`, `.ogg`, `.m4a` and `.aac` all work.

| File | Plays when |
| --- | --- |
| `go.wav` | **Game start** — the run begins (after the 3·2·1 countdown, or on START) |
| `power-up.wav` | **Power pellet** — POWER UP pressed |
| `pac-dot.wav` | **Eating a dot** — also repeated over and over while the run is playing |
| `finish.wav` | **Game over** — FINISH pressed, or the run timer running out |
| `intermission.wav` | Between runs — RESET pressed |
| `intro.wav` | READY |
| `countdown.wav` | The 3·2·1 countdown starts |
| `power-end.wav` | Power mode runs out |
| `ghost-tag.wav` | GHOST TAG |
| `fruit.wav` | FRUIT |
| `high-score.wav` | A new high score (and the HIGH SCORE key) |
| `stop.wav` | STOP ALL |

### A second take for the chomp

The arcade alternates two slightly different chomps. Add `pac-dot-2.wav` next to `pac-dot.wav` and the
run alternates them — that's what makes it sound like "waka waka" instead of one repeated blip.

Two optional background tracks, looped continuously:

| File | Plays when |
| --- | --- |
| `gameplay-loop.wav` | While a run is playing — replaces the repeated `pac-dot` waka |
| `power-loop.wav` | While power mode is active |

Short files work best: the dot sound repeats every `wakaIntervalMs` (150 ms by default, in
`config.json`), so anything longer than about a quarter of a second will overlap itself.

## Songs between runs

Put songs in the `music/` folder inside this one — any name, any of the formats above:

```
assets/audio/music/Where_the_Map_Ends.mp3
assets/audio/music/Some Other Song.m4a
```

When the folder has at least one song, those play between runs instead of the built-in chiptune
album: shuffled, back to back, with the deck's **PREV** and **NEXT** keys skipping between them and the
TV flashing the name (taken from the file name, so `Where_the_Map_Ends.mp3` shows as
`WHERE THE MAP ENDS`). A round interrupts the song and the next break picks it up where it stopped.

Finished recordings are mastered far louder than the built-in music, so songs are turned down
(`SONG_TRIM` in `apps/leaderboard/public/js/sounds.js`) and passed through a gentle leveller before the
**Background music** volume slider applies. If they still sit too far forward, lower that slider.

Songs are yours to supply and stay on this Mac: like everything else in this folder, they're ignored
by git.



Restart the app (`npm start`) — the folder is scanned at startup — then reload the TV page.
Check what was picked up at <http://localhost:3000/api/audio>.

## Licensing

These are **your** files. The audio from Pac-Man is owned by Bandai Namco, so use recordings you have
the right to use — a licensed sound pack, audio you made yourself, or sounds licensed for your event.

Audio files in this folder are deliberately **not committed to git** (see `.gitignore`), so the public
repository never redistributes them. They live only on the event Mac.
