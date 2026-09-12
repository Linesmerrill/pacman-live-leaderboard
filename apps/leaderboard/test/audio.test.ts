import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { contentTypeFor, readAudioManifest, resolveAudioFile } from '../src/audio.ts';

let dir: string;

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'pacman-audio-'));
  for (const name of ['go.wav', 'power-up.mp3', 'pac-dot.wav', 'pac-dot-2.wav', 'finish.ogg', 'gameplay-loop.wav', 'notes.txt', 'random.wav', '.hidden.wav']) {
    writeFileSync(path.join(dir, name), 'x');
  }
});
after(() => rmSync(dir, { recursive: true, force: true }));

describe('event audio folder', () => {
  test('picks up files named after cues, ignoring anything else', () => {
    const manifest = readAudioManifest(dir);
    assert.deepEqual(manifest.cues, {
      go: '/audio/go.wav',
      'power-up': '/audio/power-up.mp3',
      'pac-dot': '/audio/pac-dot.wav',
      finish: '/audio/finish.ogg',
    });
    assert.deepEqual(manifest.loops, { 'gameplay-loop': '/audio/gameplay-loop.wav' });
    assert.deepEqual(manifest.alternates, { 'pac-dot': '/audio/pac-dot-2.wav' }, 'a second take alternates with the first');
  });

  test('an empty or missing folder just means the built-in sounds are used', () => {
    assert.deepEqual(readAudioManifest(path.join(dir, 'nope')), { cues: {}, alternates: {}, loops: {} });
  });

  test('serves only real audio files from inside the folder', () => {
    assert.ok(resolveAudioFile(dir, 'go.wav'));
    assert.equal(resolveAudioFile(dir, 'missing.wav'), null);
    assert.equal(resolveAudioFile(dir, 'notes.txt'), null, 'only audio types');
    assert.equal(resolveAudioFile(dir, '.hidden.wav'), null);
    for (const attack of ['../../config.json', '..%2f..%2fconfig.json', '/etc/passwd', 'sub/dir/go.wav']) {
      assert.equal(resolveAudioFile(dir, attack), null, `must not escape the folder: ${attack}`);
    }
  });

  test('maps extensions to content types', () => {
    assert.equal(contentTypeFor('go.wav'), 'audio/wav');
    assert.equal(contentTypeFor('go.MP3'), 'audio/mpeg');
    assert.equal(contentTypeFor('go.txt'), null);
  });
});
