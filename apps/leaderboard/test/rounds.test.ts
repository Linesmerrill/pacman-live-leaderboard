import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { describe, test } from 'node:test';
import { createApp } from '../src/http.ts';
import { allRuleText, canDraw, ruleSteps } from '../public/js/rules.js';
import { makeFixture } from './helpers.ts';

const MIN = 60_000;
const add = (f: ReturnType<typeof makeFixture>, initials: string, score: number, now: number) => {
  const result = f.service.submit({ initials, score }, { now });
  assert.equal(result.kind, 'created');
};

describe('prize rounds', () => {
  test('are on by default: 15 minutes, top 3', () => {
    const f = makeFixture();
    try {
      const round = f.service.roundStatus();
      assert.deepEqual([round.enabled, round.minutes, round.prizeCount, round.number, round.endsAt, round.lastRound], [true, 15, 3, 1, null, null]);
    } finally {
      f.cleanup();
    }
  });

  test("a round's clock starts with its first score, not before", () => {
    const f = makeFixture();
    try {
      const t0 = 1_000_000;
      add(f, 'AAA', 10, t0);
      assert.equal(f.service.roundStatus().endsAt, t0 + 15 * MIN);
      add(f, 'BBB', 20, t0 + 5 * MIN);
      assert.equal(f.service.roundStatus().endsAt, t0 + 15 * MIN, 'later scores do not move the clock');
    } finally {
      f.cleanup();
    }
  });

  test('ending a round crowns the top places (ties included), then clears the board safely', () => {
    const f = makeFixture();
    try {
      const t = 2_000_000;
      for (const [initials, score] of [['ONE', 90], ['TWO', 80], ['TIE', 70], ['EYE', 70], ['OUT', 10]] as const) add(f, initials, score, t);
      const result = f.service.endRound(t + 15 * MIN);
      assert.equal(result.number, 1);
      assert.deepEqual(result.winners.map((w) => `${w.rank}${w.initials}`).sort(), ['1ONE', '2TWO', '3EYE', '3TIE'], 'both kids tied for 3rd win');

      assert.equal(f.service.snapshot().totalPlayers, 0, 'the board starts fresh');
      assert.ok(readdirSync(f.config.backupDirectory).length > 0, 'backed up first');
      const round = f.service.roundStatus();
      assert.equal(round.number, 2);
      assert.equal(round.endsAt, null, 'round 2 waits for its first score');
      assert.equal(round.lastRound?.winners.length, 4, 'the winners stay on screen for staff and the TV');
    } finally {
      f.cleanup();
    }
  });

  test('a round nobody played keeps showing the last real winners', () => {
    const f = makeFixture();
    try {
      add(f, 'WIN', 50, 1);
      f.service.endRound(2);
      const empty = f.service.endRound(3);
      assert.deepEqual(empty.winners, []);
      assert.equal(f.service.roundStatus().lastRound?.winners[0].initials, 'WIN');
    } finally {
      f.cleanup();
    }
  });

  test('survive a restart, and can be restarted, shortened or switched off', () => {
    const f = makeFixture();
    try {
      add(f, 'AAA', 10, 5_000);
      const reopened = f.reopen();
      assert.equal(reopened.service.roundStatus().endsAt, 5_000 + 15 * MIN, 'a running round picks up where it was');

      reopened.service.updateSettings({ roundMinutes: 10, prizeCount: 5 });
      assert.equal(reopened.service.restartRoundClock(100_000).endsAt, 100_000 + 10 * MIN);
      assert.equal(reopened.service.roundStatus().prizeCount, 5);

      reopened.service.updateSettings({ roundsEnabled: false });
      assert.equal(reopened.service.roundStatus().endsAt, null, 'switching off cancels the clock');
      assert.equal(reopened.service.snapshot().totalPlayers, 1, '…but leaves the board alone');
      assert.throws(() => reopened.service.restartRoundClock(), /switched off/);
      assert.throws(() => reopened.service.updateSettings({ prizeCount: 0 }), /1 to 20/);
    } finally {
      f.cleanup();
    }
  });

  test('a manual reset stops the round clock until the next score', () => {
    const f = makeFixture();
    try {
      add(f, 'AAA', 10, 1_000);
      f.service.reset();
      assert.equal(f.service.roundStatus().endsAt, null);
    } finally {
      f.cleanup();
    }
  });

  test('the server ends an overdue round on its own and tells every screen', async () => {
    const f = makeFixture();
    // A round that should have ended while the server was off.
    f.service.submit({ initials: 'OLD', score: 33 }, { now: Date.now() - 20 * MIN });
    f.service.restartRoundClock(Date.now() - 16 * MIN);
    const app = createApp({ service: f.service });
    try {
      await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
      await new Promise((resolve) => setTimeout(resolve, 50));
      const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
      const board = (await (await fetch(`${base}/api/leaderboard`)).json()) as any;
      assert.equal(board.totalPlayers, 0);
      assert.equal(board.round.number, 2);
      assert.equal(board.round.lastRound.winners[0].initials, 'OLD');
    } finally {
      await app.close();
      f.cleanup();
    }
  });
});

describe('prize rounds in the rules', () => {
  test('explained on the TV only while they are on, with the real numbers', () => {
    assert.ok(!ruleSteps({ round: { enabled: false, minutes: 15, prizeCount: 3 } }).some((s) => s.scene === 'prize'));
    const prize = ruleSteps({ round: { enabled: true, minutes: 15, prizeCount: 3 } }).find((s) => s.scene === 'prize');
    assert.deepEqual(prize?.lines, ['BE TOP 3 WHEN', 'THE 15 MINUTE', 'ROUND ENDS!']);
    for (const line of allRuleText({ round: { enabled: true, minutes: 240, prizeCount: 20 } })) assert.ok(canDraw(line), line);
  });
});
