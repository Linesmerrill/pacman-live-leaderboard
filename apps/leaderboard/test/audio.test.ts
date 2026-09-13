import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { contentTypeFor, readAudioManifest, resolveAudioFile, trackTitle } from '../src/audio.ts';

let dir: string;

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'pacman-audio-'));
  for (const name of ['go.wav', 'power-up.mp3', 'pac-dot.wav', 'pac-dot-2.wav', 'finish.ogg', 'gameplay-loop.wav', 'notes.txt', 'random.wav', '.hidden.wav']) {
    writeFileSync(path.join(dir, name), 'x');
  }
  mkdirSync(path.join(dir, 'music'));
  for (const name of ['Where_the_Map_Ends.mp3', 'b-side.ogg', 'cover.jpg', '.DS_Store']) {
    writeFileSync(path.join(dir, 'music', name), 'x');
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
    assert.deepEqual(readAudioManifest(path.join(dir, 'nope')), { cues: {}, alternates: {}, loops: {}, music: [] });
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

  test('songs in the music folder are listed for between runs, with readable names', () => {
    assert.deepEqual(readAudioManifest(dir).music, [
      { name: 'B SIDE', url: '/audio/music/b-side.ogg' },
      { name: 'WHERE THE MAP ENDS', url: '/audio/music/Where_the_Map_Ends.mp3' },
    ]);
  });

  test('a song never lands in the sound-effect slots, even with a cue name', () => {
    // A song called intro.mp3 in the music folder must not replace the READY sound.
    writeFileSync(path.join(dir, 'music', 'intro.mp3'), 'x');
    try {
      const manifest = readAudioManifest(dir);
      assert.equal(manifest.cues.intro, undefined);
      assert.ok(manifest.music.some((song) => song.url === '/audio/music/intro.mp3'));
    } finally {
      rmSync(path.join(dir, 'music', 'intro.mp3'));
    }
  });

  test('song titles are tidied into something the TV can print', () => {
    assert.equal(trackTitle('Where_the_Map_Ends.mp3'), 'WHERE THE MAP ENDS');
    assert.equal(trackTitle("Don't-Stop__Me.m4a"), 'DONT STOP ME');
    assert.equal(trackTitle('!!!.mp3'), 'UNTITLED');
  });

  test('serves songs from the music folder, and nothing around it', () => {
    assert.ok(resolveAudioFile(dir, 'music/Where_the_Map_Ends.mp3'));
    assert.equal(resolveAudioFile(dir, 'music/cover.jpg'), null, 'only audio types');
    assert.equal(resolveAudioFile(dir, 'music/.DS_Store'), null);
    for (const attack of ['music/../go.wav', 'music/../../config.json', 'music%2f..%2fgo.wav', 'music/sub/song.mp3']) {
      assert.equal(resolveAudioFile(dir, attack), null, `must not escape the music folder: ${attack}`);
    }
  });

  test('maps extensions to content types', () => {
    assert.equal(contentTypeFor('go.wav'), 'audio/wav');
    assert.equal(contentTypeFor('go.MP3'), 'audio/mpeg');
    assert.equal(contentTypeFor('go.txt'), null);
  });
});
