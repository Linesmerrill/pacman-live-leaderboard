import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { IDLE_TRACKS, SONGS, compile } from '../public/js/music.js';

/**
 * The first version of this music chose notes at random from a pentatonic scale, which is
 * exactly what it sounded like. These tests are about the qualities that make the difference
 * between a tune and a sequence of tones: written phrases, a shape that repeats, and an ending
 * that resolves.
 */
describe('background music between runs', () => {
  test('is an album of full-length pieces, long enough for an evening', () => {
    assert.equal(IDLE_TRACKS.length, 8);
    for (const track of IDLE_TRACKS) {
      assert.ok(track.seconds >= 50 && track.seconds <= 100, `${track.name} is ${track.seconds}s`);
      assert.ok(track.name.length > 0, 'every piece is named, so a key can announce it');
    }
    const total = IDLE_TRACKS.reduce((sum, track) => sum + track.seconds, 0);
    assert.ok(total > 8 * 60, `only ${total}s before it repeats — an event runs for hours`);
  });

  test('every piece is built like a song, not a loop', () => {
    for (const song of SONGS) {
      assert.ok(song.form.includes('chorus'), `${song.name} has no chorus`);
      assert.ok(song.form.includes('bridge') || song.form.includes('verseB'), `${song.name} never leaves its verse`);
      assert.ok(song.form.filter((s) => s.startsWith('verse')).length >= 2, `${song.name} states its verse only once`);
      assert.ok(song.form.at(-1) === 'outro', `${song.name} just stops instead of ending`);

      // The chorus should sit higher than the verse — that's what makes it lift.
      const top = (name: string) => Math.max(...song.sections[name].melody.flat().map(([d]: [number | null, number]) => d ?? -99));
      assert.ok(top('chorus') > top('verse'), `${song.name}'s chorus doesn't rise above its verse`);
    }
  });

  test('the melodies move by steps, the way a tune does', () => {
    for (const track of IDLE_TRACKS) {
      const notes = track.steps.map((s) => s.lead).filter((hz): hz is number => Boolean(hz));
      assert.ok(notes.length > 40, `${track.name} has only ${notes.length} melody notes`);
      // Semitones between one note and the next.
      const leaps = notes.slice(1).map((hz, i) => Math.abs(12 * Math.log2(hz / notes[i])));
      const stepwise = leaps.filter((semitones) => semitones <= 4).length / leaps.length;
      assert.ok(stepwise >= 0.6, `${track.name}: only ${Math.round(stepwise * 100)}% of moves are small — that reads as random`);
      assert.ok(Math.max(...leaps) <= 12, `${track.name} jumps more than an octave in one move`);
    }
  });

  test('every piece ends on its key note', () => {
    for (const song of SONGS) {
      const outro = song.sections[song.form.at(-1)!];
      const lastBar = outro.melody.at(-1)!;
      const [degree] = lastBar.at(-1)! as [number | null, number];
      assert.equal(degree === null ? null : ((degree % 7) + 7) % 7, 0, `${song.name} doesn't resolve home`);
    }
  });

  test('the pieces differ from each other, in key and in tempo', () => {
    const openings = new Set(IDLE_TRACKS.map((track) => JSON.stringify(track.steps.slice(0, 24))));
    assert.equal(openings.size, IDLE_TRACKS.length, 'every piece opens differently');
    assert.ok(new Set(SONGS.map((s) => s.bpm)).size >= 6, 'they should not all sit at the same tempo');
    assert.ok(new Set(SONGS.map((s) => s.mode)).size >= 3, 'and not all in the same mode');
  });

  test('stays in a range small TV speakers can actually reproduce', () => {
    for (const track of IDLE_TRACKS) {
      for (const { lead, bass, arp } of track.steps) {
        for (const hz of [lead, bass, arp]) {
          if (!hz) continue;
          assert.ok(hz > 100 && hz < 2200, `${track.name} plays ${Math.round(hz)}Hz`);
        }
      }
    }
  });

  test('a bar that does not add up fails loudly rather than limping', () => {
    const broken = {
      name: 'BROKEN',
      root: 60,
      mode: 'major',
      bpm: 100,
      form: ['verse'],
      sections: { verse: { chords: [0], melody: [[[0, 3]]] } },
    };
    assert.throws(() => compile(broken), /3 steps, expected 8/);
  });
});
