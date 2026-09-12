import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SFX, soundForEntry, totalDuration } from '../public/js/sounds.js';

describe('sound effects', () => {
  test('picks the right effect for a new run', () => {
    const pick = (over: Record<string, unknown>) =>
      soundForEntry({ isNewHighScore: false, rank: 40, position: 40, rowsPerColumn: 10, ...over });

    assert.equal(pick({ isNewHighScore: true, rank: 1, position: 1 }), 'highScore');
    assert.equal(pick({ rank: 1, position: 2 }), 'topThree', 'tying first place still gets the podium sound');
    assert.equal(pick({ rank: 3, position: 3 }), 'topThree');
    assert.equal(pick({ rank: 4, position: 4 }), 'topTen');
    assert.equal(pick({ rank: 10, position: 10 }), 'topTen');
    assert.equal(pick({ rank: 11, position: 11 }), 'addScore');
    assert.equal(pick({ rank: 11, position: 11, rowsPerColumn: 12 }), 'topTen', 'follows the configured column size');
  });

  test('every effect is playable and short enough for the moment it marks', () => {
    for (const [name, notes] of Object.entries(SFX)) {
      assert.ok(notes.length > 0, `${name} has notes`);
      for (const note of notes) {
        assert.ok(note.freq > 20 && note.freq < 20_000, `${name}: audible frequency`);
        assert.ok(note.dur > 0, `${name}: positive duration`);
        assert.ok(note.start >= 0, `${name}: no negative start`);
      }
    }
    // The high-score fanfare has to finish inside the 6.5s celebration overlay.
    assert.ok(totalDuration(SFX.highScore) < 6.5);
    assert.ok(totalDuration(SFX.highScore) > 1, 'but it is still a fanfare');
    // Everything else is a quick blip so back-to-back entries never pile up.
    for (const name of ['addScore', 'topTen', 'topThree', 'spotlight', 'chomp', 'panelOpen']) {
      assert.ok(totalDuration(SFX[name]) <= 0.6, `${name} is short`);
    }
  });
});
