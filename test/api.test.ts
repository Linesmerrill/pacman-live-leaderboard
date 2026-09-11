import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import { createApp, type App } from '../src/http.ts';
import { makeFixture, type Fixture } from './helpers.ts';

interface Harness {
  fixture: Fixture;
  app: App;
  base: string;
  call(method: string, url: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; body: any }>;
  stop(): Promise<void>;
}

async function start(overrides = {}): Promise<Harness> {
  const fixture = makeFixture(overrides);
  const app = createApp({ service: fixture.service });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  return {
    fixture,
    app,
    base,
    async call(method, url, body, headers = {}) {
      const res = await fetch(base + url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // CSV / HTML responses stay as text
      }
      return { status: res.status, body: parsed };
    },
    async stop() {
      await app.close();
      fixture.cleanup();
    },
  };
}

/** Collects Server-Sent Events from /api/stream. */
async function openStream(base: string) {
  const controller = new AbortController();
  const res = await fetch(`${base}/api/stream`, { signal: controller.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  return {
    async next(): Promise<any> {
      for (;;) {
        const match = /data: (.*)\n\n/.exec(buffer);
        if (match) {
          buffer = buffer.slice(match.index + match[0].length);
          return JSON.parse(match[1]);
        }
        const { value, done } = await reader.read();
        if (done) throw new Error('stream closed');
        buffer += decoder.decode(value, { stream: true });
      }
    },
    close: () => controller.abort(),
  };
}

describe('HTTP API', () => {
  let h: Harness;
  before(async () => {
    h = await start();
  });
  after(() => h.stop());

  test('serves the three screens', async () => {
    for (const [url, marker] of [['/', 'LIVE LEADERBOARD'], ['/admin', 'Staff score entry'], ['/admin/settings', 'Clear leaderboard']]) {
      const res = await fetch(h.base + url);
      assert.equal(res.status, 200, url);
      assert.match(res.headers.get('content-type') ?? '', /text\/html/);
      assert.ok((await res.text()).includes(marker), `${url} should include "${marker}"`);
    }
  });

  test('does not serve files outside the public folder', async () => {
    const res = await fetch(`${h.base}/%2e%2e/package.json`);
    assert.equal(res.status, 404);
  });

  test('adding a score updates the leaderboard and pushes a live update', async () => {
    const stream = await openStream(h.base);
    const hello = await stream.next();
    assert.equal(hello.reason, 'connected');

    const res = await h.call('POST', '/api/scores', { initials: 'max', score: 12, submissionId: 'sub-1' });
    assert.equal(res.status, 201);
    assert.equal(res.body.entry.initials, 'MAX');
    assert.equal(res.body.entry.rank, 1);
    assert.equal(res.body.isNewHighScore, true);

    const pushed = await stream.next();
    assert.equal(pushed.reason, 'added');
    assert.equal(pushed.added.isNewHighScore, true);
    assert.equal(pushed.snapshot.entries[0].initials, 'MAX');
    stream.close();

    const board = await h.call('GET', '/api/leaderboard');
    assert.equal(board.body.totalPlayers, 1);
    assert.equal(board.body.completionTimeEnabled, false);
  });

  test('a double-submitted request is only saved once', async () => {
    const payload = { initials: 'TWO', score: 3, submissionId: 'double-tap' };
    const [a, b] = await Promise.all([h.call('POST', '/api/scores', payload), h.call('POST', '/api/scores', payload)]);
    assert.deepEqual([a.status, b.status].sort(), [200, 201]);
    assert.equal(a.body.entry.id, b.body.entry.id);
    const all = await h.call('GET', '/api/scores');
    assert.equal(all.body.scores.filter((s: any) => s.initials === 'TWO').length, 1);
  });

  test('validation errors name the field', async () => {
    const res = await h.call('POST', '/api/scores', { initials: 'AB', score: 3 });
    assert.equal(res.status, 422);
    assert.equal(res.body.field, 'initials');
    const res2 = await h.call('POST', '/api/scores', { initials: 'ABC', score: 'lots' });
    assert.equal(res2.status, 422);
    assert.equal(res2.body.field, 'score');
    const res3 = await h.call('POST', '/api/scores', { initials: 'KKK', score: 3 });
    assert.equal(res3.status, 422);
  });

  test('possible duplicates need confirmation', async () => {
    assert.equal((await h.call('POST', '/api/scores', { initials: 'REP', score: 5 })).status, 201);
    const warn = await h.call('POST', '/api/scores', { initials: 'REP', score: 5 });
    assert.equal(warn.status, 409);
    assert.equal(warn.body.error, 'possible_duplicate');
    assert.equal((await h.call('POST', '/api/scores', { initials: 'REP', score: 5, confirmDuplicate: true })).status, 201);
  });

  test('edit, delete, export, and reset', async () => {
    const created = await h.call('POST', '/api/scores', { initials: 'OOP', score: 1 });
    const id = created.body.entry.id;

    const edited = await h.call('PUT', `/api/scores/${id}`, { initials: 'FIX', score: 99 });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.entry.rank, 1);
    assert.equal((await h.call('PUT', `/api/scores/${id}`, { initials: 'FUK' })).status, 422);

    const csv = await h.call('GET', '/api/export.csv');
    assert.equal(csv.status, 200);
    assert.match(csv.body, /^rank,player,pac_dots/);
    assert.match(csv.body, /\n1,FIX,99,/);

    assert.equal((await h.call('DELETE', `/api/scores/${id}`)).status, 200);
    assert.equal((await h.call('DELETE', `/api/scores/${id}`)).status, 404);
    assert.equal((await h.call('DELETE', '/api/scores/abc')).status, 404);

    assert.equal((await h.call('POST', '/api/reset', {})).status, 400, 'reset requires typed confirmation');
    const reset = await h.call('POST', '/api/reset', { confirm: 'RESET' });
    assert.equal(reset.status, 200);
    assert.ok(reset.body.backupFile);
    assert.equal((await h.call('GET', '/api/leaderboard')).body.totalPlayers, 0);
  });

  test('settings toggle completion time and broadcast', async () => {
    const stream = await openStream(h.base);
    await stream.next();
    const res = await h.call('PUT', '/api/settings', { completionTimeEnabled: true, customDenyList: 'QQQ' });
    assert.equal(res.status, 200);
    assert.equal(res.body.settings.completionTimeEnabled, true);
    assert.deepEqual(res.body.settings.customDenyList, ['QQQ']);
    const pushed = await stream.next();
    assert.equal(pushed.reason, 'settings');
    assert.equal(pushed.snapshot.completionTimeEnabled, true);
    stream.close();

    const timed = await h.call('POST', '/api/scores', { initials: 'TIM', score: 4, timeSeconds: '63.25' });
    assert.equal(timed.body.entry.timeSeconds, 63.3);
    assert.equal((await h.call('PUT', '/api/settings', { completionTimeEnabled: 'yes' })).status, 400);
  });

  test('staff can put any player back in the TV spotlight', async () => {
    const created = await h.call('POST', '/api/scores', { initials: 'PIC', score: 2 });
    const stream = await openStream(h.base);
    await stream.next();
    const res = await h.call('POST', `/api/scores/${created.body.entry.id}/spotlight`);
    assert.equal(res.status, 200);
    const pushed = await stream.next();
    assert.equal(pushed.reason, 'spotlight');
    assert.equal(pushed.spotlight.entry.initials, 'PIC');
    stream.close();
    assert.equal((await h.call('POST', '/api/scores/99999/spotlight')).status, 404);
  });

  test('bad JSON is a 400, not a crash', async () => {
    const res = await fetch(`${h.base}/api/scores`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{nope' });
    assert.equal(res.status, 400);
    assert.equal((await h.call('GET', '/api/health')).body.ok, true);
  });
});

describe('HTTP API with a staff PIN', () => {
  let h: Harness;
  before(async () => {
    h = await start({ adminPin: '4321' });
  });
  after(() => h.stop());

  test('the public leaderboard stays open', async () => {
    assert.equal((await h.call('GET', '/api/leaderboard')).status, 200);
  });

  test('staff endpoints require the PIN', async () => {
    assert.equal((await h.call('POST', '/api/scores', { initials: 'PIN', score: 1 })).status, 401);
    assert.equal((await h.call('GET', '/api/scores', undefined, { 'X-Admin-Pin': 'wrong' })).status, 401);
    assert.equal((await h.call('POST', '/api/reset', { confirm: 'RESET' })).status, 401);
    const ok = await h.call('POST', '/api/scores', { initials: 'PIN', score: 1 }, { 'X-Admin-Pin': '4321' });
    assert.equal(ok.status, 201);
  });
});
