// Background music for the idle leaderboard: eight written-out chiptune pieces.
//
// The earlier version picked notes at random from a pentatonic scale, which is why it sounded
// like tones rather than tunes. These are composed: each piece has a key, a chord progression
// and real melodic phrases arranged into verses, a chorus, a bridge and an outro, the way a
// song is put together. Square-wave lead over a triangle bass, the classic NES voicing.
//
// Notation: a melody is a list of bars; a bar is a list of [scale degree, length in steps].
// Degree 0 is the key note, 7 is the octave above, null is a rest. Eight steps to a bar
// (six in the waltz). The compiler below checks every bar adds up, so a typo fails the tests
// rather than producing a limping bar.

const A4 = 440;
const noteHz = (midi) => A4 * 2 ** ((midi - 69) / 12);

const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

/** Semitones above the key for a scale degree, wrapping into octaves above and below. */
function step(mode, degree) {
  const octave = Math.floor(degree / 7);
  return mode[((degree % 7) + 7) % 7] + 12 * octave;
}

const R = (length) => [null, length];

export const SONGS = [
  {
    name: 'LANTERN ROAD',
    root: 62,
    mode: 'dorian',
    bpm: 96,
    form: ['intro', 'verse', 'verseB', 'chorus', 'verse', 'bridge', 'chorus', 'outro'],
    sections: {
      intro: {
        chords: [0, 0],
        melody: [
          [R(4), [0, 2], [2, 2]],
          [[4, 4], R(4)],
        ],
      },
      verse: {
        chords: [0, 6, 0, 4],
        melody: [
          [[4, 3], [3, 1], [2, 2], [3, 2]],
          [[4, 4], R(1), [2, 1], [1, 2]],
          [[0, 3], [1, 1], [2, 2], [4, 2]],
          [[3, 6], R(2)],
        ],
      },
      verseB: {
        chords: [0, 6, 3, 4],
        melody: [
          [[4, 3], [3, 1], [2, 2], [3, 2]],
          [[4, 4], R(1), [5, 1], [6, 2]],
          [[7, 3], [6, 1], [4, 2], [2, 2]],
          [[0, 6], R(2)],
        ],
      },
      chorus: {
        chords: [3, 4, 0, 6],
        arp: true,
        melody: [
          [[7, 2], [6, 2], [4, 4]],
          [[5, 2], [6, 2], [7, 4]],
          [[6, 3], [4, 1], [3, 2], [2, 2]],
          [[1, 4], [0, 4]],
        ],
      },
      bridge: {
        chords: [2, 6, 5, 4],
        melody: [
          [[2, 2], [4, 2], [6, 2], [4, 2]],
          [[5, 4], [4, 4]],
          [[3, 2], [2, 2], [1, 2], [2, 2]],
          [[4, 8]],
        ],
      },
      outro: {
        chords: [4, 0],
        melody: [
          [[2, 2], [1, 2], [0, 4]],
          [[0, 8]],
        ],
      },
    },
  },
  {
    name: 'MOONWELL',
    root: 64,
    mode: 'minor',
    bpm: 84,
    form: ['intro', 'verse', 'verseB', 'chorus', 'bridge', 'chorus', 'outro'],
    sections: {
      intro: {
        chords: [0, 5],
        melody: [
          [[0, 4], [2, 4]],
          [[4, 6], R(2)],
        ],
      },
      verse: {
        chords: [0, 5, 3, 4],
        melody: [
          [[4, 2], [2, 2], [0, 4]],
          [[2, 2], [4, 2], [5, 4]],
          [[4, 3], [3, 1], [2, 4]],
          [[1, 4], [0, 4]],
        ],
      },
      verseB: {
        chords: [0, 5, 6, 4],
        melody: [
          [[4, 2], [2, 2], [0, 4]],
          [[2, 2], [4, 2], [7, 4]],
          [[6, 3], [5, 1], [4, 4]],
          [[2, 6], R(2)],
        ],
      },
      chorus: {
        chords: [5, 2, 0, 4],
        arp: true,
        melody: [
          [[7, 4], [6, 2], [5, 2]],
          [[6, 4], [4, 4]],
          [[5, 2], [4, 2], [2, 4]],
          [[1, 2], [2, 2], [0, 4]],
        ],
      },
      bridge: {
        chords: [2, 6, 3, 4],
        melody: [
          [[2, 4], [4, 2], [6, 2]],
          [[7, 4], [6, 4]],
          [[4, 2], [5, 2], [4, 2], [2, 2]],
          [[4, 8]],
        ],
      },
      outro: {
        chords: [4, 0],
        melody: [
          [[2, 4], [1, 4]],
          [[0, 8]],
        ],
      },
    },
  },
  {
    name: 'PELLET PARADE',
    root: 60,
    mode: 'major',
    bpm: 116,
    form: ['intro', 'verse', 'verseB', 'chorus', 'verse', 'bridge', 'chorus', 'outro'],
    sections: {
      intro: {
        chords: [0, 4],
        melody: [
          [[0, 1], [2, 1], [4, 2], R(4)],
          [[4, 1], [2, 1], [0, 2], R(4)],
        ],
      },
      verse: {
        chords: [0, 5, 3, 4],
        melody: [
          [[0, 2], [2, 1], [4, 1], [2, 2], [0, 2]],
          [[5, 2], [4, 2], [2, 4]],
          [[3, 2], [4, 1], [5, 1], [4, 2], [2, 2]],
          [[4, 4], R(4)],
        ],
      },
      verseB: {
        chords: [0, 5, 3, 4],
        melody: [
          [[0, 2], [2, 1], [4, 1], [5, 2], [4, 2]],
          [[5, 2], [7, 2], [6, 4]],
          [[5, 2], [4, 1], [3, 1], [2, 2], [1, 2]],
          [[0, 4], R(4)],
        ],
      },
      chorus: {
        chords: [3, 4, 5, 0],
        arp: true,
        melody: [
          [[7, 2], [6, 1], [7, 1], [9, 4]],
          [[8, 2], [7, 2], [6, 4]],
          [[7, 2], [6, 1], [5, 1], [4, 2], [5, 2]],
          [[4, 4], [2, 4]],
        ],
      },
      bridge: {
        chords: [5, 3, 1, 4],
        melody: [
          [[5, 2], [4, 2], [2, 2], [4, 2]],
          [[3, 4], [2, 4]],
          [[1, 2], [2, 2], [3, 2], [4, 2]],
          [[6, 4], [4, 4]],
        ],
      },
      outro: {
        chords: [4, 0],
        melody: [
          [[4, 2], [2, 2], [1, 2], [0, 2]],
          [[0, 8]],
        ],
      },
    },
  },
  {
    name: 'GHOST WALTZ',
    root: 61,
    mode: 'minor',
    bpm: 108,
    barSteps: 6,
    form: ['intro', 'verse', 'verseB', 'chorus', 'verse', 'bridge', 'chorus', 'verseB', 'chorus', 'outro'],
    sections: {
      intro: {
        chords: [0, 0],
        melody: [
          [[0, 3], [2, 3]],
          [[4, 6]],
        ],
      },
      verse: {
        chords: [0, 5, 6, 4],
        melody: [
          [[4, 2], [3, 1], [2, 3]],
          [[0, 2], [2, 1], [4, 3]],
          [[5, 2], [4, 1], [2, 3]],
          [[4, 6]],
        ],
      },
      verseB: {
        chords: [0, 5, 3, 4],
        melody: [
          [[4, 2], [3, 1], [2, 3]],
          [[0, 2], [2, 1], [5, 3]],
          [[7, 2], [6, 1], [5, 3]],
          [[4, 6]],
        ],
      },
      chorus: {
        chords: [5, 2, 6, 4],
        arp: true,
        melody: [
          [[7, 3], [6, 3]],
          [[5, 2], [6, 1], [7, 3]],
          [[6, 3], [4, 3]],
          [[2, 4], R(2)],
        ],
      },
      bridge: {
        chords: [2, 6, 5, 4],
        melody: [
          [[2, 2], [4, 1], [6, 3]],
          [[5, 2], [4, 1], [2, 3]],
          [[1, 2], [2, 1], [4, 3]],
          [[4, 6]],
        ],
      },
      outro: {
        chords: [4, 0],
        melody: [
          [[2, 3], [1, 3]],
          [[0, 6]],
        ],
      },
    },
  },
  {
    name: 'SKY CORRIDOR',
    root: 65,
    mode: 'lydian',
    bpm: 92,
    form: ['intro', 'verse', 'chorus', 'verse', 'bridge', 'chorus', 'outro'],
    sections: {
      intro: {
        chords: [0, 1],
        melody: [
          [R(2), [4, 3], [3, 3]],
          [[2, 4], R(4)],
        ],
      },
      verse: {
        chords: [0, 1, 5, 4],
        melody: [
          [[0, 2], [2, 2], [4, 4]],
          [[3, 2], [2, 2], [4, 4]],
          [[5, 3], [4, 1], [2, 4]],
          [[1, 4], [0, 4]],
        ],
      },
      chorus: {
        chords: [3, 4, 1, 0],
        arp: true,
        melody: [
          [[7, 3], [6, 1], [4, 4]],
          [[5, 3], [6, 1], [7, 4]],
          [[8, 2], [7, 2], [6, 4]],
          [[4, 4], [2, 4]],
        ],
      },
      bridge: {
        chords: [5, 3, 4, 1],
        melody: [
          [[5, 4], [4, 4]],
          [[2, 2], [4, 2], [5, 4]],
          [[6, 3], [5, 1], [4, 4]],
          [[3, 8]],
        ],
      },
      outro: {
        chords: [4, 0],
        melody: [
          [[2, 4], [1, 4]],
          [[0, 8]],
        ],
      },
    },
  },
  {
    name: 'CIDER HILL',
    root: 67,
    mode: 'mixolydian',
    bpm: 108,
    form: ['intro', 'verse', 'verseB', 'chorus', 'verse', 'bridge', 'chorus', 'outro'],
    sections: {
      intro: {
        chords: [0, 6],
        melody: [
          [[0, 2], [4, 2], [2, 4]],
          [[6, 4], R(4)],
        ],
      },
      verse: {
        chords: [0, 6, 3, 0],
        melody: [
          [[4, 2], [4, 1], [5, 1], [4, 2], [2, 2]],
          [[6, 4], [4, 4]],
          [[3, 2], [4, 2], [2, 2], [0, 2]],
          [[2, 4], R(4)],
        ],
      },
      verseB: {
        chords: [0, 6, 3, 4],
        melody: [
          [[4, 2], [4, 1], [5, 1], [7, 2], [6, 2]],
          [[7, 4], [4, 4]],
          [[5, 2], [4, 2], [2, 2], [1, 2]],
          [[0, 4], R(4)],
        ],
      },
      chorus: {
        chords: [3, 0, 6, 4],
        arp: true,
        melody: [
          [[7, 2], [8, 2], [7, 4]],
          [[6, 2], [7, 2], [9, 4]],
          [[8, 3], [7, 1], [6, 2], [4, 2]],
          [[2, 4], [0, 4]],
        ],
      },
      bridge: {
        chords: [5, 6, 3, 4],
        melody: [
          [[5, 2], [6, 2], [4, 4]],
          [[6, 2], [7, 2], [6, 4]],
          [[4, 2], [3, 2], [2, 4]],
          [[4, 8]],
        ],
      },
      outro: {
        chords: [6, 0],
        melody: [
          [[4, 2], [2, 2], [1, 4]],
          [[0, 8]],
        ],
      },
    },
  },
  {
    name: 'NIGHT MARKET',
    root: 63,
    mode: 'dorian',
    bpm: 104,
    form: ['intro', 'verse', 'verseB', 'chorus', 'verse', 'bridge', 'chorus', 'verseB', 'outro'],
    sections: {
      intro: {
        chords: [0, 3],
        melody: [
          [[4, 2], [2, 2], [0, 4]],
          [R(2), [3, 2], [4, 4]],
        ],
      },
      verse: {
        chords: [0, 3, 6, 0],
        melody: [
          [[0, 2], [2, 1], [3, 1], [4, 4]],
          [[5, 2], [4, 2], [2, 4]],
          [[6, 2], [5, 2], [4, 4]],
          [[2, 4], [0, 4]],
        ],
      },
      verseB: {
        chords: [0, 3, 6, 4],
        melody: [
          [[0, 2], [2, 1], [3, 1], [4, 4]],
          [[7, 2], [6, 2], [4, 4]],
          [[6, 2], [7, 2], [8, 4]],
          [[7, 4], [4, 4]],
        ],
      },
      chorus: {
        chords: [5, 4, 3, 0],
        arp: true,
        melody: [
          [[7, 3], [6, 1], [7, 2], [9, 2]],
          [[8, 4], [7, 4]],
          [[6, 2], [5, 2], [4, 2], [2, 2]],
          [[4, 4], [0, 4]],
        ],
      },
      bridge: {
        chords: [2, 5, 3, 4],
        melody: [
          [[2, 4], [4, 4]],
          [[5, 2], [4, 2], [2, 4]],
          [[3, 2], [4, 2], [5, 2], [6, 2]],
          [[4, 8]],
        ],
      },
      outro: {
        chords: [4, 0],
        melody: [
          [[2, 2], [1, 2], [0, 4]],
          [[0, 8]],
        ],
      },
    },
  },
  {
    name: 'HOME SCREEN',
    root: 60,
    mode: 'major',
    bpm: 76,
    form: ['intro', 'verse', 'chorus', 'verse', 'bridge', 'chorus', 'outro'],
    sections: {
      intro: {
        chords: [0, 4],
        melody: [
          [[4, 4], [2, 4]],
          [[0, 6], R(2)],
        ],
      },
      verse: {
        chords: [0, 3, 5, 4],
        melody: [
          [[2, 2], [4, 2], [5, 4]],
          [[4, 4], [2, 4]],
          [[1, 2], [2, 2], [4, 4]],
          [[2, 4], [0, 4]],
        ],
      },
      chorus: {
        chords: [5, 3, 0, 4],
        arp: true,
        melody: [
          [[7, 4], [6, 4]],
          [[4, 2], [6, 2], [7, 4]],
          [[6, 2], [5, 2], [4, 4]],
          [[2, 4], [0, 4]],
        ],
      },
      bridge: {
        chords: [3, 4, 5, 1],
        melody: [
          [[4, 4], [5, 4]],
          [[6, 4], [4, 4]],
          [[5, 2], [4, 2], [2, 4]],
          [[1, 8]],
        ],
      },
      outro: {
        chords: [4, 0],
        melody: [
          [[1, 4], [2, 4]],
          [[0, 8]],
        ],
      },
    },
  },
];

/** A triad on a scale degree, as degree offsets — the notes under the melody. */
const TRIAD = [0, 2, 4];

/**
 * Turns a written song into the flat list of steps the player schedules.
 * Throws on a bar that doesn't add up, so a mistyped rhythm fails the tests.
 */
export function compile(song) {
  const mode = MODES[song.mode];
  if (!mode) throw new Error(`${song.name}: unknown mode "${song.mode}"`);
  const barSteps = song.barSteps ?? 8;
  const stepSeconds = 30 / song.bpm; // one step is an eighth note
  const steps = [];

  for (const sectionName of song.form) {
    const section = song.sections[sectionName];
    if (!section) throw new Error(`${song.name}: form names a missing section "${sectionName}"`);
    if (section.melody.length !== section.chords.length) {
      throw new Error(`${song.name}/${sectionName}: ${section.melody.length} bars of melody but ${section.chords.length} chords`);
    }

    section.melody.forEach((bar, barIndex) => {
      const chord = section.chords[barIndex];
      const first = steps.length;
      for (const [degree, length] of bar) {
        // A held note is one struck note followed by nothing: the player sustains it.
        steps.push({
          // The melody is written against the key; only the bass and counter-line follow the chord.
          lead: degree === null ? null : noteHz(song.root + step(mode, degree)),
          leadSteps: length,
          bass: null,
          arp: null,
        });
        for (let i = 1; i < length; i++) steps.push({ lead: null, leadSteps: 0, bass: null, arp: null });
      }
      const written = steps.length - first;
      if (written !== barSteps) {
        throw new Error(`${song.name}/${sectionName} bar ${barIndex + 1}: ${written} steps, expected ${barSteps}`);
      }

      // Bass: the chord root on the downbeat, its fifth halfway through the bar.
      const half = Math.floor(barSteps / 2);
      steps[first].bass = noteHz(song.root + step(mode, chord) - 12);
      steps[first].bassSteps = half;
      steps[first + half].bass = noteHz(song.root + step(mode, chord + 4) - 12);
      steps[first + half].bassSteps = barSteps - half;

      // A quiet counter-line under the chorus, one chord tone per beat.
      if (section.arp) {
        for (let i = 1; i < barSteps; i += 2) {
          steps[first + i].arp = noteHz(song.root + step(mode, chord + TRIAD[((i - 1) / 2) % TRIAD.length]) + 12);
        }
      }
    });
  }

  return { name: song.name, stepSeconds, steps, seconds: Math.round(steps.length * stepSeconds) };
}

/** The album, in the order it was written. */
export const IDLE_TRACKS = SONGS.map(compile);
