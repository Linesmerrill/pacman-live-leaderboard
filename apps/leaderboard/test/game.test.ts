import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { phaseEnded, transition, type GameState } from '../../../packages/shared/game-events.ts';
import { GameEngine } from '../src/game.ts';

const options = { countdownSeconds: 3, powerPelletSeconds: 10, runSeconds: 30, maxPellets: 2 };

describe('game state machine (pure)', () => {
  test('the run walks ready → countdown → playing → finished', () => {
    assert.equal(transition('idle', 'ready', options)?.state, 'ready');
    const countdown = transition('ready', 'countdown', options);
    assert.equal(countdown?.state, 'countdown');
    assert.equal(countdown?.phaseSeconds, 3);
    assert.equal(phaseEnded('countdown', options)?.state, 'playing', 'the countdown starts the run by itself');
    assert.equal(transition('playing', 'finish', options)?.state, 'finished');
  });

  test('power mode is timed and drops back to playing on its own', () => {
    const power = transition('playing', 'power-up', options);
    assert.equal(power?.state, 'power-mode');
    assert.equal(power?.loop, 'power');
    assert.equal(power?.phaseSeconds, 10);
    assert.equal(power?.extendRunSeconds, 10, 'and it buys the run more time');
    assert.deepEqual(phaseEnded('power-mode', options), { state: 'playing', loop: 'gameplay', cue: 'power-end' });
  });

  test('commands that do not fit the moment are ignored, not errors', () => {
    assert.equal(transition('ready', 'power-up', options), null, 'no power mode before the run starts');
    assert.equal(transition('idle', 'ghost-tag', options), null);
    assert.equal(transition('idle', 'finish', options), null);
    assert.equal(transition('finished', 'finish', options), null);
  });

  test('sound-only buttons keep the state and the music loop', () => {
    for (const [command, cue] of [['ghost-tag', 'ghost-tag'], ['fruit', 'fruit'], ['pac-dot', 'pac-dot']] as const) {
      const result = transition('power-mode', command, options, 'power');
      assert.deepEqual(result, { state: 'power-mode', loop: 'power', cue });
    }
    // The high-score fanfare can be fired at any time, e.g. while the board is idle.
    assert.equal(transition('idle', 'high-score', options)?.cue, 'high-score');
  });

  test('stop-all silences the music without changing the state; reset returns to idle', () => {
    assert.deepEqual(transition('power-mode', 'stop-all', options, 'power'), { state: 'power-mode', loop: 'none', cue: 'stop' });
    const reset = transition('playing', 'reset', options);
    assert.equal(reset?.state, 'idle');
    assert.equal(reset?.clearsRun, true);
  });
});

describe('GameEngine', () => {
  let engine: GameEngine | null = null;
  afterEach(() => engine?.close());

  function makeEngine(overrides: Partial<typeof options> = {}) {
    const sound = { soundEnabled: true, volume: 80 };
    const timing = { ...options, runSeconds: 0, ...overrides };
    const changes: GameState[] = [];
    engine = new GameEngine({
      getTiming: () => ({ ...timing }),
      getSound: () => ({ ...sound }),
      setSound: (patch) => Object.assign(sound, patch),
      onChange: (status) => changes.push(status.state),
    });
    return { engine, sound, timing, changes };
  }

  test('each cue gets a new id so screens play it exactly once', () => {
    const { engine } = makeEngine();
    engine.command('ready');
    const first = engine.status.cue;
    assert.equal(first?.name, 'intro');
    engine.command('start');
    engine.command('ghost-tag');
    const third = engine.status.cue;
    assert.equal(third?.name, 'ghost-tag');
    assert.equal(third!.id > first!.id, true);
  });

  test('ignored commands report applied: false and change nothing', () => {
    const { engine } = makeEngine();
    const before = engine.status;
    const result = engine.command('power-up');
    assert.equal(result.applied, false);
    assert.equal(result.status.state, before.state);
    assert.equal(result.status.cue, before.cue);
  });

  test('power mode ends by itself and resumes the gameplay loop', async () => {
    const { engine, changes } = makeEngine({ powerPelletSeconds: 0.05 });
    engine.command('start');
    engine.command('power-up');
    assert.equal(engine.status.state, 'power-mode');
    assert.ok(engine.status.phaseEndsAt && engine.status.phaseEndsAt > Date.now());
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(engine.status.state, 'playing');
    assert.equal(engine.status.loop, 'gameplay');
    assert.equal(engine.status.cue?.name, 'power-end');
    assert.equal(engine.status.phaseEndsAt, null);
    assert.deepEqual(changes, ['playing', 'power-mode', 'playing']);
  });

  test('the countdown starts the run without anyone pressing START', async () => {
    const { engine } = makeEngine({ countdownSeconds: 0.05 });
    engine.command('ready');
    engine.command('countdown');
    assert.equal(engine.status.startedAt, null);
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(engine.status.state, 'playing');
    assert.ok(engine.status.startedAt, 'the run clock is running');
  });

  test('a new command cancels the pending phase timer', async () => {
    const { engine } = makeEngine({ powerPelletSeconds: 0.05 });
    engine.command('start');
    engine.command('power-up');
    engine.command('finish');
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(engine.status.state, 'finished', 'the expiring power mode must not resurrect the run');
    assert.equal(engine.status.loop, 'idle', 'and the soft background music takes over');
  });

  test('a run finishes by itself when its time is up', async () => {
    const { engine, changes } = makeEngine({ runSeconds: 0.15 });
    engine.command('start');
    assert.ok(engine.status.runEndsAt, 'the run clock is armed');
    await new Promise((resolve) => setTimeout(resolve, 260));
    assert.equal(engine.status.state, 'finished');
    assert.equal(engine.status.cue?.name, 'finish');
    assert.equal(engine.status.runEndsAt, null);
    assert.deepEqual(changes, ['playing', 'finished']);
  });

  test('a power pellet adds its time to the run that is already ticking', () => {
    // The event case: 30-second run, pellet grabbed at the 29th second → finish at 40s, not 60s.
    const { engine } = makeEngine({ runSeconds: 30, powerPelletSeconds: 10 });
    engine.command('start');
    const firstDeadline = engine.status.runEndsAt!;
    engine.command('power-up');
    assert.equal(engine.status.runEndsAt! - firstDeadline, 10_000, 'exactly one pellet of extra time');
    assert.equal(engine.status.pelletsUsed, 1);
    // Power mode itself is the same length, so play resumes just before the run ends.
    assert.ok(engine.status.phaseEndsAt! < engine.status.runEndsAt!);
  });

  test('pellets stop buying time once the cap is reached, but still light up the maze', () => {
    const { engine } = makeEngine({ runSeconds: 30, powerPelletSeconds: 10, maxPellets: 2 });
    engine.command('start');
    const base = engine.status.runEndsAt!;
    for (let i = 0; i < 5; i++) engine.command('power-up');
    assert.equal(engine.status.pelletsUsed, 2, 'only two pellets extend the clock');
    assert.equal(engine.status.runEndsAt! - base, 20_000, 'so one session can never run away with the night');
    assert.equal(engine.status.state, 'power-mode', 'the fifth pellet still starts power mode for everyone');
    assert.equal(engine.status.cue?.name, 'power-up', 'and still plays the sound');
  });

  test('with no time limit set, runs never finish on their own', () => {
    const { engine } = makeEngine({ runSeconds: 0 });
    engine.command('start');
    assert.equal(engine.status.runEndsAt, null);
    engine.command('power-up');
    assert.equal(engine.status.runEndsAt, null, 'a pellet has no clock to extend');
    assert.equal(engine.status.pelletsUsed, 0);
  });

  test('the run clock survives power mode and is cleared by finish and reset', async () => {
    const { engine } = makeEngine({ runSeconds: 30 });
    engine.command('start');
    engine.command('power-up');
    assert.ok(engine.status.runEndsAt, 'still ticking through power mode');
    engine.command('finish');
    assert.equal(engine.status.runEndsAt, null);
    engine.command('reset');
    assert.equal(engine.status.state, 'idle');
    assert.equal(engine.status.cue?.name, 'intermission', 'reset plays the intermission jingle');
    assert.equal(engine.status.loop, 'idle', 'and the soft background music comes back');
  });

  test('volume buttons step and clamp, and mute toggles', () => {
    const { engine, sound } = makeEngine();
    engine.command('volume-up');
    assert.equal(sound.volume, 90);
    engine.command('volume-up');
    engine.command('volume-up');
    assert.equal(sound.volume, 100, 'clamped at the top');
    for (let i = 0; i < 12; i++) engine.command('volume-down');
    assert.equal(sound.volume, 0, 'clamped at the bottom');
    engine.command('mute');
    assert.equal(sound.soundEnabled, false);
    engine.command('mute');
    assert.equal(sound.soundEnabled, true);
  });
});
