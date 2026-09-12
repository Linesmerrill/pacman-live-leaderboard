import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';
import { ScoreStore } from '../src/store.ts';
import { ValidationError } from '../src/validation.ts';
import { makeFixture, type Fixture } from './helpers.ts';

let fixture: Fixture;
afterEach(() => fixture?.cleanup());

function add(initials: string, score: number, extra: { timeSeconds?: number | null; now?: number; submissionId?: string } = {}) {
  const result = fixture.service.submit({ initials, score, timeSeconds: extra.timeSeconds }, { now: extra.now, submissionId: extra.submissionId });
  assert.equal(result.kind, 'created');
  return result;
}

describe('LeaderboardService', () => {
  test('scores persist across an app restart', () => {
    fixture = makeFixture();
    add('MAX', 12, { now: 1_000 });
    add('SAM', 30, { now: 2_000 });
    fixture = fixture.reopen();
    const snap = fixture.service.snapshot();
    assert.deepEqual(snap.entries.map((e) => [e.rank, e.initials, e.score]), [[1, 'SAM', 30], [2, 'MAX', 12]]);
    assert.equal(snap.totalPlayers, 2);
  });

  test('snapshot lists every run in rank order with TV display settings, and tracks the latest run', () => {
    fixture = makeFixture({ leaderboardSize: 3, boardColumns: 2, pageSeconds: 7, spotlightSeconds: 15 });
    [5, 9, 1, 7, 3].forEach((score, i) => add(`P0${i}`, score, { now: 1_000 + i }));
    const snap = fixture.service.snapshot();
    assert.deepEqual(snap.entries.map((e) => e.score), [9, 7, 5, 3, 1]);
    assert.deepEqual(snap.entries.map((e) => e.position), [1, 2, 3, 4, 5]);
    assert.equal(snap.totalPlayers, 5);
    assert.equal(snap.latest?.initials, 'P04');
    assert.equal(snap.latest?.rank, 4);
    assert.deepEqual(snap.display, {
      soundEnabled: true,
      soundVolume: 80,
      idleMusicEnabled: true,
      idleMusicVolume: 35,
      rowsPerColumn: 3,
      columns: 2,
      pageSeconds: 7,
      spotlightSeconds: 15,
    });
  });

  test('flags new high scores only when #1 is beaten outright', () => {
    fixture = makeFixture();
    assert.equal(add('ONE', 10, { now: 1 }).isNewHighScore, true);
    assert.equal(add('TIE', 10, { now: 2 }).isNewHighScore, false);
    assert.equal(add('LOW', 3, { now: 3 }).isNewHighScore, false);
    assert.equal(add('TOP', 11, { now: 4 }).isNewHighScore, true);
  });

  test('same initials are allowed any number of times', () => {
    fixture = makeFixture();
    add('MAX', 4, { now: 1 });
    add('MAX', 9, { now: 100_000 });
    add('MAX', 4, { now: 200_000 });
    assert.equal(fixture.service.snapshot().entries.filter((e) => e.initials === 'MAX').length, 3);
  });

  test('re-sending a submission id does not add the score twice', () => {
    fixture = makeFixture();
    const first = add('DUP', 8, { submissionId: 'abc-123' });
    const again = fixture.service.submit({ initials: 'DUP', score: 8 }, { submissionId: 'abc-123' });
    assert.equal(again.kind, 'created');
    assert.equal(again.kind === 'created' && again.replayed, true);
    assert.equal(again.kind === 'created' && again.entry.id, first.entry.id);
    assert.equal(fixture.store.count(), 1);
  });

  test('warns about an identical entry moments ago, but allows it when confirmed', () => {
    fixture = makeFixture({ duplicateWarningSeconds: 60 });
    add('ZOE', 7, { now: 10_000 });
    const warned = fixture.service.submit({ initials: 'ZOE', score: 7 }, { now: 25_000 });
    assert.equal(warned.kind, 'possible-duplicate');
    assert.equal(warned.kind === 'possible-duplicate' && warned.secondsAgo, 15);
    assert.equal(fixture.service.submit({ initials: 'ZOE', score: 8 }, { now: 26_000 }).kind, 'created');
    assert.equal(fixture.service.submit({ initials: 'ZOE', score: 7 }, { now: 27_000, confirmDuplicate: true }).kind, 'created');
    assert.equal(fixture.service.submit({ initials: 'ZOE', score: 7 }, { now: 200_000 }).kind, 'created');
  });

  test('rejects invalid and deny-listed initials without saving anything', () => {
    fixture = makeFixture();
    assert.throws(() => fixture.service.submit({ initials: 'AB', score: 3 }), ValidationError);
    assert.throws(() => fixture.service.submit({ initials: 'A55', score: 3 }), ValidationError);
    assert.throws(() => fixture.service.submit({ initials: 'ABC', score: -1 }), ValidationError);
    assert.equal(fixture.store.count(), 0);
  });

  test('completion time is ignored when disabled and used for ties when enabled', () => {
    fixture = makeFixture({ completionTimeEnabled: false });
    add('SLO', 10, { timeSeconds: 90, now: 1 });
    assert.equal(fixture.service.snapshot().entries[0].timeSeconds, null, 'time not stored while disabled');

    fixture.service.updateSettings({ completionTimeEnabled: true });
    add('FST', 10, { timeSeconds: 30, now: 2 });
    add('MID', 10, { timeSeconds: 45.25, now: 3 });
    const snap = fixture.service.snapshot();
    assert.equal(snap.completionTimeEnabled, true);
    assert.deepEqual(snap.entries.map((e) => `${e.rank}:${e.initials}:${e.timeSeconds}`), ['1:FST:30', '2:MID:45.3', '3:SLO:null']);
  });

  test('the completion-time setting persists and config only sets the initial default', () => {
    fixture = makeFixture({ completionTimeEnabled: true });
    assert.equal(fixture.service.getSettings().completionTimeEnabled, true);
    fixture.service.updateSettings({ completionTimeEnabled: false });
    fixture = fixture.reopen();
    assert.equal(fixture.service.getSettings().completionTimeEnabled, false);
  });

  test('the sound setting persists and rejects non-boolean values', () => {
    fixture = makeFixture();
    assert.equal(fixture.service.getSettings().soundEnabled, true, 'sound is on by default');
    fixture.service.updateSettings({ soundEnabled: false });
    fixture = fixture.reopen();
    assert.equal(fixture.service.getSettings().soundEnabled, false);
    assert.equal(fixture.service.snapshot().display.soundEnabled, false);
    assert.throws(() => fixture.service.updateSettings({ soundEnabled: 'off' }), TypeError);
  });

  test('ships with the run timing chosen for this event', () => {
    fixture = makeFixture();
    const { runSeconds, powerPelletSeconds, maxPellets } = fixture.service.getSettings();
    assert.deepEqual({ runSeconds, powerPelletSeconds, maxPellets }, { runSeconds: 20, powerPelletSeconds: 10, maxPellets: 1 });
    // Worst case for one maze session, so the queue keeps moving.
    assert.equal(runSeconds + powerPelletSeconds * maxPellets, 30);
  });

  test('run timing and idle music are saved settings staff can change mid-event', () => {
    fixture = makeFixture({ runSeconds: 30, powerPelletSeconds: 10, maxPellets: 2 });
    const initial = fixture.service.getSettings();
    assert.equal(initial.runSeconds, 30);
    assert.equal(initial.powerPelletSeconds, 10);
    assert.equal(initial.maxPellets, 2);
    assert.equal(initial.idleMusicEnabled, true);

    fixture.service.updateSettings({ runSeconds: 45, powerPelletSeconds: 8, maxPellets: 1, idleMusicEnabled: false, idleMusicVolume: 20 });
    fixture = fixture.reopen();
    const saved = fixture.service.getSettings();
    assert.equal(saved.runSeconds, 45);
    assert.equal(saved.powerPelletSeconds, 8);
    assert.equal(saved.maxPellets, 1);
    assert.equal(saved.idleMusicEnabled, false);
    assert.equal(saved.idleMusicVolume, 20);
    assert.equal(fixture.service.snapshot().display.idleMusicVolume, 20);

    assert.equal(fixture.service.updateSettings({ runSeconds: 0 }) && fixture.service.getSettings().runSeconds, 0, 'zero means no time limit');
    for (const bad of [{ runSeconds: -1 }, { runSeconds: 4000 }, { powerPelletSeconds: 0 }, { maxPellets: 99 }, { idleMusicVolume: 101 }, { runSeconds: 'soon' }]) {
      assert.throws(() => fixture.service.updateSettings(bad), TypeError, JSON.stringify(bad));
    }
  });

  test('volume starts from config, persists, and rejects out-of-range values', () => {
    fixture = makeFixture({ soundVolume: 65 });
    assert.equal(fixture.service.getSettings().soundVolume, 65, 'a fresh database uses the configured volume');
    fixture.service.updateSettings({ soundVolume: 40 });
    fixture = fixture.reopen();
    assert.equal(fixture.service.snapshot().display.soundVolume, 40);
    fixture.service.updateSettings({ soundVolume: 0 });
    assert.equal(fixture.service.getSettings().soundVolume, 0, 'zero is a real volume, not "unset"');
    for (const bad of [-1, 101, 'loud']) {
      assert.throws(() => fixture.service.updateSettings({ soundVolume: bad }), TypeError);
    }
  });

  test('custom deny-list entries block new codes and flag existing ones', () => {
    fixture = makeFixture();
    const { entry } = add('BOO', 5);
    const { rejectedDenyEntries } = fixture.service.updateSettings({ customDenyList: 'boo, toolong' });
    assert.deepEqual(rejectedDenyEntries, ['TOOLONG']);
    assert.deepEqual(fixture.service.getSettings().customDenyList, ['BOO']);
    assert.throws(() => fixture.service.submit({ initials: 'B00', score: 1 }), ValidationError);
    assert.equal(fixture.service.listForAdmin().find((s) => s.id === entry.id)?.flagged, true);
  });

  test('edit changes only the given fields and re-ranks', () => {
    fixture = makeFixture();
    const { entry } = add('OOP', 2, { now: 1 });
    add('TOP', 10, { now: 2 });
    const edited = fixture.service.update(entry.id, { score: 20 });
    assert.equal(edited.initials, 'OOP');
    assert.equal(edited.score, 20);
    assert.equal(edited.rank, 1);
    assert.equal(fixture.service.update(entry.id, { initials: 'yes' }).initials, 'YES');
    assert.throws(() => fixture.service.update(entry.id, { initials: 'NO' }), ValidationError);
    assert.throws(() => fixture.service.update(9999, { score: 1 }), /not found/);
  });

  test('delete removes one score', () => {
    fixture = makeFixture();
    const { entry } = add('BAD', 3);
    add('GUD', 4);
    fixture.service.remove(entry.id);
    assert.deepEqual(fixture.service.snapshot().entries.map((e) => e.initials), ['GUD']);
    assert.throws(() => fixture.service.remove(entry.id), /not found/);
  });

  test('reset clears everything but writes a restorable backup first', () => {
    fixture = makeFixture();
    add('AAA', 1);
    add('BBB', 2);
    const { deleted, backupFile } = fixture.service.reset();
    assert.equal(deleted, 2);
    assert.equal(fixture.service.snapshot().totalPlayers, 0);
    assert.ok(backupFile && existsSync(backupFile));

    const restored = new ScoreStore(backupFile);
    assert.equal(restored.count(), 2);
    restored.close();

    assert.equal(fixture.service.reset().backupFile, null, 'no backup needed for an empty board');
  });

  test('manual backups never overwrite each other', () => {
    fixture = makeFixture();
    add('AAA', 1);
    const a = fixture.service.backup();
    const b = fixture.service.backup();
    assert.notEqual(a, b);
    assert.equal(readdirSync(fixture.config.backupDirectory).length, 2);
  });

  test('CSV export lists every score in rank order', () => {
    fixture = makeFixture();
    add('LOW', 1, { now: new Date(2026, 9, 31, 19, 5, 9).getTime() });
    add('TOP', 9, { now: new Date(2026, 9, 31, 19, 6, 0).getTime() });
    const lines = fixture.service.exportCsv().trim().split('\n');
    assert.deepEqual(lines, [
      'rank,player,pac_dots,completion_time_seconds,submitted_at',
      '1,TOP,9,,2026-10-31 19:06:00',
      '2,LOW,1,,2026-10-31 19:05:09',
    ]);
  });
});
