# Event audio

Sound files the TV plays. **How it all works, and the full list of file names, is in
[docs/music-and-sound.md](../../docs/music-and-sound.md).**

- **Sound effects** go in this folder, named after their cue: `go.wav`, `power-up.wav`, `pac-dot.wav`,
  `finish.wav`… Anything missing keeps its built-in sound. They are **not committed to git**, so this
  public repository never redistributes them; use recordings you have the right to use.
- **Songs between runs** go in [`music/`](music/), any name. They're the event's own and **are
  committed**, so a fresh clone comes with its music.

Restart the app after adding files, then check <http://localhost:3000/api/audio>.
