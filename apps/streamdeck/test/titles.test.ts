import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { COMMAND_LABELS, GAME_COMMANDS, GAME_STATES } from '../../../packages/shared/game-events.ts';
import { KEY_TITLES, MAX_TITLE_LINE, keyTitle, statusTitle } from '../src/actions.ts';

/**
 * Stream Deck draws key titles at one fixed size and clips whatever overflows — it does not
 * shrink text, and it ignores <text> in a key's SVG, so the label has to be short enough to
 * fit as it is. GHOST TAG and HIGH SCORE both lost their ends before these limits existed.
 */
describe('key titles fit on a key', () => {
  const lines = (title: string) => title.split('\n');

  test('every command label is short enough not to be clipped', () => {
    for (const command of GAME_COMMANDS) {
      const name = KEY_TITLES[command] ?? COMMAND_LABELS[command];
      assert.ok(name.length <= MAX_TITLE_LINE, `"${name}" (${name.length}) will be clipped on the key`);
    }
  });

  test('the painted title fits, online and offline', () => {
    for (const command of GAME_COMMANDS) {
      for (const offline of [false, true]) {
        for (const line of lines(keyTitle(command, offline))) {
          assert.ok(line.length <= MAX_TITLE_LINE, `${command}${offline ? ' (offline)' : ''}: "${line}" will be clipped`);
        }
      }
    }
  });

  test('the status tile stays within two short lines', () => {
    for (const state of GAME_STATES) {
      for (const offline of [false, true]) {
        const title = statusTitle(state, offline);
        assert.ok(lines(title).length <= 2, `status "${title.replace(/\n/g, ' / ')}" has too many lines to read on a key`);
        for (const line of lines(title)) {
          assert.ok(line.length <= MAX_TITLE_LINE, `status line "${line}" will be clipped`);
        }
      }
    }
  });

  test('the shortened names still say what the key does', () => {
    // A short label is no good if an operator can't tell what they're pressing.
    assert.equal(KEY_TITLES['high-score'], 'HI SCORE');
    assert.equal(KEY_TITLES['ghost-tag'], 'GHOST');
    for (const [command, short] of Object.entries(KEY_TITLES)) {
      assert.ok(short!.length < COMMAND_LABELS[command as never].length, `${command} was not actually shortened`);
    }
  });
});
