import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { allRuleText, canDraw, ruleSteps } from '../public/js/rules.js';
import { makeFixture } from './helpers.ts';

describe('how-to-play rules on the TV', () => {
  test('walk through the maze in order, each with its own animation', () => {
    const steps = ruleSteps({ runSeconds: 20, powerPelletSeconds: 10 });
    assert.deepEqual(
      steps.map((s) => s.title),
      ['ENTER THE MAZE', 'AVOID THE GHOSTS', 'COLLECT FRUIT', 'POWER ORB', 'TAG THE GHOSTS', '2 KIDS PER GAME'],
    );
    assert.equal(new Set(steps.map((s) => s.scene)).size, steps.length, 'no two rules share an animation');
  });

  test('the power orb quotes the power time from the settings', () => {
    const orb = ruleSteps({ powerPelletSeconds: 15 }).find((s) => s.scene === 'power');
    assert.ok(orb!.lines.includes('15 SECONDS OF'), orb!.lines.join(' / '));
  });

  test('every line can be drawn by the pixel font, whatever the settings', () => {
    // A character the font lacks prints as "?" on the TV.
    for (const options of [{ runSeconds: 20, powerPelletSeconds: 10 }, { runSeconds: 0, powerPelletSeconds: 1 }, { runSeconds: 3600, powerPelletSeconds: 120 }]) {
      for (const line of allRuleText(options)) assert.ok(canDraw(line), `can't draw "${line}"`);
    }
  });
});

describe('rules settings', () => {
  test('default to on, 40% of the screen, 6 seconds a rule, and reach the TV', () => {
    const f = makeFixture();
    try {
      const { display } = f.service.snapshot();
      assert.equal(display.rulesEnabled, true);
      assert.equal(display.rulesPercent, 40);
      assert.equal(display.rulesStepSeconds, 6);
      assert.equal(display.runSeconds, 20, 'the rules quote the run length');
    } finally {
      f.cleanup();
    }
  });

  test('are saved, survive a restart, and stay within sensible limits', () => {
    const f = makeFixture();
    try {
      f.service.updateSettings({ rulesEnabled: false, rulesPercent: 55, rulesStepSeconds: 10 });
      const reopened = f.reopen();
      const { display } = reopened.service.snapshot();
      assert.deepEqual([display.rulesEnabled, display.rulesPercent, display.rulesStepSeconds], [false, 55, 10]);
      assert.throws(() => reopened.service.updateSettings({ rulesPercent: 90 }), /25 to 65/);
      assert.throws(() => reopened.service.updateSettings({ rulesStepSeconds: 1 }), /3 to 30/);
      assert.throws(() => reopened.service.updateSettings({ rulesEnabled: 'yes' }), /true or false/);
    } finally {
      f.cleanup();
    }
  });
});
