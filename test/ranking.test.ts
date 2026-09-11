import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isNewHighScore, rankScores, type ScoreRecord } from '../src/ranking.ts';

let nextId = 1;
function run(initials: string, score: number, createdAt: number, timeSeconds: number | null = null): ScoreRecord {
  return { id: nextId++, initials, score, timeSeconds, createdAt };
}

const summary = (ranked: ReturnType<typeof rankScores>) => ranked.map((r) => `${r.rank}:${r.initials}`);

describe('rankScores — completion time disabled', () => {
  const options = { useTime: false };

  test('orders by Pac-Dots, highest first', () => {
    const ranked = rankScores([run('LOW', 3, 1), run('TOP', 20, 2), run('MID', 10, 3)], options);
    assert.deepEqual(summary(ranked), ['1:TOP', '2:MID', '3:LOW']);
  });

  test('tied scores share a rank, listed earliest submission first, next rank skips', () => {
    const ranked = rankScores([run('LAT', 10, 300), run('ERL', 10, 100), run('TOP', 12, 200), run('LOW', 5, 50)], options);
    assert.deepEqual(summary(ranked), ['1:TOP', '2:ERL', '2:LAT', '4:LOW']);
    assert.deepEqual(ranked.map((r) => r.position), [1, 2, 3, 4]);
  });

  test('ignores completion times when the timer is disabled', () => {
    const ranked = rankScores([run('SLO', 10, 1, 90), run('FST', 10, 2, 30)], options);
    assert.deepEqual(summary(ranked), ['1:SLO', '1:FST']);
  });

  test('same initials are separate players', () => {
    const ranked = rankScores([run('MAX', 8, 1), run('MAX', 9, 2), run('MAX', 8, 3)], options);
    assert.deepEqual(summary(ranked), ['1:MAX', '2:MAX', '2:MAX']);
    assert.equal(new Set(ranked.map((r) => r.id)).size, 3);
  });

  test('uses id as a final deterministic tiebreak for identical timestamps', () => {
    const a = run('AAA', 7, 500);
    const b = run('BBB', 7, 500);
    assert.deepEqual(rankScores([b, a], options).map((r) => r.id), [a.id, b.id]);
  });

  test('does not mutate the input and handles an empty board', () => {
    const input = [run('ONE', 1, 2), run('TWO', 2, 1)];
    const copy = structuredClone(input);
    rankScores(input, options);
    assert.deepEqual(input, copy);
    assert.deepEqual(rankScores([], options), []);
  });
});

describe('rankScores — completion time enabled', () => {
  const options = { useTime: true };

  test('score still wins over time', () => {
    const ranked = rankScores([run('FST', 9, 1, 20), run('BIG', 10, 2, 200)], options);
    assert.deepEqual(summary(ranked), ['1:BIG', '2:FST']);
  });

  test('equal scores are broken by fastest time', () => {
    const ranked = rankScores([run('SLO', 10, 1, 95.5), run('FST', 10, 2, 42.1), run('MID', 10, 3, 60)], options);
    assert.deepEqual(summary(ranked), ['1:FST', '2:MID', '3:SLO']);
  });

  test('untimed runs sort after timed runs with the same score', () => {
    const ranked = rankScores([run('NON', 10, 1, null), run('TMD', 10, 2, 120)], options);
    assert.deepEqual(summary(ranked), ['1:TMD', '2:NON']);
  });

  test('identical score and time share a rank, earliest first', () => {
    const ranked = rankScores([run('LAT', 10, 20, 50), run('ERL', 10, 10, 50), run('UNT', 10, 5, null)], options);
    assert.deepEqual(summary(ranked), ['1:ERL', '1:LAT', '3:UNT']);
  });
});

describe('isNewHighScore', () => {
  test('the first score of the night is a new high score', () => {
    const only = run('ONE', 4, 1);
    assert.equal(isNewHighScore(rankScores([only], { useTime: false }), only.id), true);
  });

  test('beating the leader is a new high score', () => {
    const newRun = run('NEW', 11, 5);
    const ranked = rankScores([run('OLD', 10, 1), newRun], { useTime: false });
    assert.equal(isNewHighScore(ranked, newRun.id), true);
  });

  test('tying the leader is not', () => {
    const newRun = run('TIE', 10, 5);
    const ranked = rankScores([run('OLD', 10, 1), newRun], { useTime: false });
    assert.equal(isNewHighScore(ranked, newRun.id), false);
  });

  test('a faster time on the same score is, when the timer is enabled', () => {
    const newRun = run('FST', 10, 5, 30);
    assert.equal(isNewHighScore(rankScores([run('OLD', 10, 1, 45), newRun], { useTime: true }), newRun.id), true);
    assert.equal(isNewHighScore(rankScores([run('OLD', 10, 1, 45), newRun], { useTime: false }), newRun.id), false);
  });

  test('anything below #1 is not', () => {
    const newRun = run('LOW', 2, 5);
    assert.equal(isNewHighScore(rankScores([run('OLD', 10, 1), newRun], { useTime: false }), newRun.id), false);
  });
});
