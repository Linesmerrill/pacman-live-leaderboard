import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BUILT_IN_DENY_LIST, DenyList, parseDenyList } from '../src/denylist.ts';
import { validateInitials, validateScore, validateTime, ValidationError } from '../src/validation.ts';

const denyList = new DenyList([...BUILT_IN_DENY_LIST, 'ZZ?']);

function field(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ValidationError, `expected ValidationError, got ${err}`);
    return err.field;
  }
  assert.fail('expected a ValidationError');
}

describe('validateInitials', () => {
  test('accepts exactly three letters or digits and uppercases them', () => {
    assert.equal(validateInitials('MAX', denyList), 'MAX');
    assert.equal(validateInitials('j07', denyList), 'J07');
    assert.equal(validateInitials(' abc ', denyList), 'ABC');
    assert.equal(validateInitials('123', denyList), '123');
  });

  test('rejects wrong lengths and characters', () => {
    for (const bad of ['', 'AB', 'ABCD', 'A B', 'A-B', 'ÄBC', 'AB!', 'ab ', null, 7, undefined]) {
      assert.equal(field(() => validateInitials(bad, denyList)), 'initials', `should reject ${JSON.stringify(bad)}`);
    }
  });

  test('rejects deny-listed codes, including digit look-alikes and wildcards', () => {
    for (const bad of ['ASS', 'ass', 'A55', '4SS', 'KKK', '690', 'X69', 'ZZT']) {
      assert.equal(field(() => validateInitials(bad, denyList)), 'initials', `should reject ${bad}`);
    }
  });

  test('does not over-block ordinary initials', () => {
    for (const ok of ['MAX', 'SAM', 'J07', 'ABC', 'BOB', 'AMY', 'ZOE', 'LEO', 'ACE', 'DAD', 'MOM', '007', 'PAC', 'BOO']) {
      assert.equal(validateInitials(ok, denyList), ok);
    }
  });
});

describe('DenyList', () => {
  test('match reports the blocking entry', () => {
    assert.equal(new DenyList(['QQQ']).match('QQQ'), 'QQQ');
    assert.equal(new DenyList(['QQQ']).match('QQR'), null);
    assert.equal(new DenyList(['B?B']).match('B0B'), 'B?B');
  });

  test('parseDenyList cleans staff input and reports rejects', () => {
    const { entries, rejected } = parseDenyList('abc, xyz\n  q?q ;abc toolong x');
    assert.deepEqual(entries, ['ABC', 'Q?Q', 'XYZ']);
    assert.deepEqual(rejected, ['TOOLONG', 'X']);
  });
});

describe('validateScore', () => {
  test('accepts whole numbers from 0 to the max', () => {
    assert.equal(validateScore(0, 999), 0);
    assert.equal(validateScore(42, 999), 42);
    assert.equal(validateScore('17', 999), 17);
    assert.equal(validateScore(999, 999), 999);
  });

  test('rejects negatives, fractions, text, and values over the max', () => {
    for (const bad of [-1, 1.5, 'abc', '', null, undefined, NaN, 1000, '12abc']) {
      assert.equal(field(() => validateScore(bad, 999)), 'score', `should reject ${String(bad)}`);
    }
  });
});

describe('validateTime', () => {
  test('blank means untimed', () => {
    assert.equal(validateTime(null, 3600), null);
    assert.equal(validateTime(undefined, 3600), null);
    assert.equal(validateTime('  ', 3600), null);
  });

  test('accepts seconds and rounds to tenths', () => {
    assert.equal(validateTime(42, 3600), 42);
    assert.equal(validateTime('42.46', 3600), 42.5);
    assert.equal(validateTime(61.04, 3600), 61);
  });

  test('rejects zero, negatives, junk, and times over the max', () => {
    for (const bad of [0, -5, 'fast', 3601, Infinity, 0.01]) {
      assert.equal(field(() => validateTime(bad, 3600)), 'timeSeconds', `should reject ${String(bad)}`);
    }
  });
});
