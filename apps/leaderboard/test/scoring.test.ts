import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEFAULT_SCORING, FRUITS, ghostPoints, normalizeScoring, scoreRun } from '../public/js/scoring.js';
import { makeFixture } from './helpers.ts';

describe('scoring a run', () => {
  test('defaults to the arcade fruit values divided by 10, first five fruit in play', () => {
    for (const fruit of FRUITS) assert.equal(DEFAULT_SCORING.fruits[fruit.id].points, fruit.arcade / 10, fruit.name);
    assert.deepEqual(
      FRUITS.filter((f) => DEFAULT_SCORING.fruits[f.id].enabled).map((f) => f.id),
      ['cherry', 'strawberry', 'orange', 'apple', 'melon'],
    );
  });

  test('adds up the fruit and ghosts staff tapped in', () => {
    // Orange, strawberry and cherry, plus two ghosts tagged in power mode.
    const { total, parts } = scoreRun({ fruit: { orange: 1, strawberry: 1, cherry: 1 }, ghosts: 2 });
    assert.equal(total, 50 + 30 + 10 + (20 + 40));
    assert.deepEqual(parts.map((p) => p.label), ['Cherry', 'Strawberry', 'Orange', 'Ghosts']);
    assert.equal(scoreRun({ fruit: { cherry: 3 } }).total, 30, 'the same fruit twice counts twice');
    assert.equal(scoreRun({}).total, 0);
  });

  test('ghosts double like the arcade, and the last value repeats', () => {
    const ghosts = DEFAULT_SCORING.ghosts;
    assert.deepEqual([1, 2, 3, 4].map((n) => ghostPoints(n, ghosts)), [20, 60, 140, 300]);
    assert.equal(ghostPoints(6, ghosts), 300 + 160 + 160);
  });

  test('uses the values staff configured', () => {
    const scoring = normalizeScoring({ fruits: { strawberry: { points: 100 }, orange: { points: 200 } }, ghosts: [5, 5, 5, 5] });
    assert.equal(scoreRun({ fruit: { strawberry: 1, orange: 1 }, ghosts: 3 }, scoring).total, 315);
  });

  test('rejects values the board cannot show, naming what to fix', () => {
    assert.throws(() => normalizeScoring({ fruits: { melon: { points: 1000 } } }), /Melon points .* 0 to 999/);
    assert.throws(() => normalizeScoring({ fruits: { cherry: { points: 2.5 } } }), /Cherry points/);
    assert.throws(() => normalizeScoring({ fruits: { cherry: { enabled: 'yes' } } }), /Cherry: on\/off/);
    assert.throws(() => normalizeScoring({ ghosts: [20, 40] }), /1st to 4th ghost/);
  });
});

describe('scoring settings', () => {
  test('are saved, survive a restart, and reach the entry screens', () => {
    const f = makeFixture();
    try {
      f.service.updateSettings({ scoring: { fruits: { strawberry: { points: 100, enabled: true }, apple: { enabled: false } } } });
      const reopened = f.reopen();
      const { scoring } = reopened.service.snapshot();
      assert.equal(scoring.fruits.strawberry.points, 100);
      assert.equal(scoring.fruits.apple.enabled, false);
      assert.equal(scoring.fruits.cherry.points, 10, 'untouched fruit keep their defaults');
      assert.throws(() => reopened.service.updateSettings({ scoring: { ghosts: [1] } }), TypeError);
    } finally {
      f.cleanup();
    }
  });

  test('a damaged saved value falls back to the defaults instead of breaking the board', () => {
    const f = makeFixture();
    try {
      f.store.setSetting('scoring', '{not json');
      assert.deepEqual(f.reopen().service.snapshot().scoring, normalizeScoring({}));
    } finally {
      f.cleanup();
    }
  });
});
