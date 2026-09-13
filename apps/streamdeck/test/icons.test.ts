import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { keyImage, statusImage } from '../src/icons.ts';

/** Pull the rendered SVG back out of the data URI the key is painted with. */
function svgOf(image: string): string {
  return decodeURIComponent(image.replace(/^data:image\/svg\+xml;charset=utf8,/, ''));
}

function fontSizes(image: string): number[] {
  return [...svgOf(image).matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
}

describe('key artwork', () => {
  test('long labels shrink so they fit the key instead of running off it', () => {
    // "HIGH SCORE" and "23 on board" were clipped at both ends when Stream Deck drew
    // them at its own fixed size, which is why the label is part of the image now.
    const short = fontSizes(keyImage({ command: 'ready', text: 'READY' }))[0];
    const long = fontSizes(keyImage({ command: 'high-score', text: 'HIGH SCORE' }))[0];
    assert.ok(long < short, 'a longer label should be drawn smaller');

    for (const text of ['HIGH SCORE', 'GHOST TAG', 'POWER UP', 'SPOTLIGHT', 'VOL −\n100%', 'NO SERVER\ncheck the\nleaderboard']) {
      const size = fontSizes(keyImage({ command: 'ready', text }))[0];
      const widest = Math.max(...text.split('\n').map((line) => line.length));
      // 0.6em per bold uppercase character is the width this is fitted against.
      assert.ok(widest * size * 0.6 <= 64.5, `"${text}" at ${size}px would overflow a 72px key`);
    }
  });

  test('the status tile fits its three lines', () => {
    const image = statusImage({ state: 'playing', offline: false, text: 'PLAYING\n14s left\n123 on board' });
    const sizes = fontSizes(image);
    assert.equal(sizes.length, 3, 'all three lines should be drawn');
    assert.ok(Math.max(...sizes) * '123 on board'.length * 0.6 <= 64.5, 'the longest line should still fit');
    // Nothing may be drawn below the bottom edge of the key.
    const ys = [...svgOf(image).matchAll(/<text[^>]*y="([\d.]+)"/g)].map((m) => Number(m[1]));
    assert.ok(Math.max(...ys) <= 71, 'the last line should sit inside the key');
  });

  test('labels with XML characters do not break the image', () => {
    const svg = svgOf(keyImage({ command: 'ready', text: 'A & B' }));
    assert.match(svg, /A &amp; B/);
    assert.doesNotMatch(svg, /A & B/);
  });
});
