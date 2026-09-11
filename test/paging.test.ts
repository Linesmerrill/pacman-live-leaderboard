import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { pageCount, pageForPosition, pageRange, splitColumns } from '../public/js/paging.js';

describe('TV board paging (10 rows, 3 columns)', () => {
  const rows = 10;
  const columns = 3;

  test('no paging until someone ranks below the pinned top 10', () => {
    assert.equal(pageCount(0, rows, columns), 0);
    assert.equal(pageCount(10, rows, columns), 0);
    assert.equal(pageCount(11, rows, columns), 1);
    assert.equal(pageCount(30, rows, columns), 1);
    assert.equal(pageCount(31, rows, columns), 2);
    assert.equal(pageCount(57, rows, columns), 3);
  });

  test('finds the page a player is on', () => {
    assert.equal(pageForPosition(1, rows, columns), -1, 'top 10 is always visible');
    assert.equal(pageForPosition(10, rows, columns), -1);
    assert.equal(pageForPosition(11, rows, columns), 0);
    assert.equal(pageForPosition(20, rows, columns), 0);
    assert.equal(pageForPosition(30, rows, columns), 0);
    assert.equal(pageForPosition(31, rows, columns), 1);
    assert.equal(pageForPosition(57, rows, columns), 2);
  });

  test('page ranges cover every position exactly once', () => {
    assert.deepEqual(pageRange(0, rows, columns, 57), { first: 11, last: 30 });
    assert.deepEqual(pageRange(1, rows, columns, 57), { first: 31, last: 50 });
    assert.deepEqual(pageRange(2, rows, columns, 57), { first: 51, last: 57 });
  });

  test('splits a page into columns of 10', () => {
    const page = Array.from({ length: 13 }, (_, i) => i + 11);
    assert.deepEqual(splitColumns(page, rows, 2), [page.slice(0, 10), page.slice(10)]);
  });

  test('a single-column board never pages', () => {
    assert.equal(pageCount(100, rows, 1), 0);
    assert.equal(pageForPosition(50, rows, 1), -1);
  });
});
