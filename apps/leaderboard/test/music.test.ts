import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { IDLE_TRACKS } from '../public/js/sounds.js';

describe('background music between runs', () => {
  test('is an album of ten pieces, about half a minute each', () => {
    assert.equal(IDLE_TRACKS.length, 10);
    for (const track of IDLE_TRACKS) {
      assert.ok(track.seconds >= 25 && track.seconds <= 35, `piece is ${track.seconds}s`);
      assert.ok(track.steps.length > 100);
    }
    const total = IDLE_TRACKS.reduce((sum, track) => sum + track.seconds, 0);
    assert.ok(total > 280, `only ${total}s before it repeats — an event runs for hours`);
  });

  test('the pieces differ from each other', () => {
    const fingerprints = new Set(IDLE_TRACKS.map((track) => JSON.stringify(track.steps.slice(0, 32))));
    assert.equal(fingerprints.size, 10, 'every piece opens differently');
    assert.ok(new Set(IDLE_TRACKS.map((track) => track.stepSeconds)).size > 1, 'and they vary in tempo');
  });

  test('every note sits in a range a TV speaker can actually play', () => {
    const notes = IDLE_TRACKS.flatMap((track) => track.steps.flatMap((step) => [step.lead, step.bass, step.arp].filter(Boolean) as number[]));
    assert.ok(Math.min(...notes) >= 100, 'nothing below ~100 Hz, which small speakers turn to rumble');
    assert.ok(Math.max(...notes) <= 2200, 'and nothing piercing');
  });

  test('is composed the same way every start-up', async () => {
    const again = (await import('../public/js/sounds.js')).IDLE_TRACKS;
    assert.deepEqual(again[0].steps.slice(0, 16), IDLE_TRACKS[0].steps.slice(0, 16));
  });

  test('leaves room to breathe rather than playing a note every step', () => {
    for (const track of IDLE_TRACKS) {
      const rests = track.steps.filter((step) => step.lead === null).length;
      assert.ok(rests / track.steps.length > 0.25, 'at least a quarter of the piece is rest');
    }
  });
});
