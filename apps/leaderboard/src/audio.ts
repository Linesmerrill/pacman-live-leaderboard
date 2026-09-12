import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { CUES, type Cue } from '../../../packages/shared/game-events.ts';

/** Background tracks that can replace the built-in loops. */
export const LOOP_NAMES = ['gameplay-loop', 'power-loop'] as const;
export type LoopName = (typeof LOOP_NAMES)[number];

export const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.m4a', '.aac'] as const;

const CONTENT_TYPES: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};

export interface AudioManifest {
  /** cue name → URL to play, for cues the operator supplied a file for. */
  cues: Partial<Record<Cue, string>>;
  /** cue name → URL of a second take, e.g. `pac-dot-2.wav`; the waka alternates the two. */
  alternates: Partial<Record<Cue, string>>;
  /** loop name → URL, for background tracks. */
  loops: Partial<Record<LoopName, string>>;
}

const NAMES = new Set<string>([...CUES, ...LOOP_NAMES]);

export function contentTypeFor(file: string): string | null {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? null;
}

/**
 * Looks for `<cue>.wav` (or .mp3/.ogg/.m4a/.aac) in the audio folder. Anything found replaces the
 * built-in synthesised sound for that cue; anything missing just keeps the built-in one.
 * Read once at startup — drop files in, then restart.
 */
export function readAudioManifest(directory: string): AudioManifest {
  const manifest: AudioManifest = { cues: {}, alternates: {}, loops: {} };
  if (!existsSync(directory)) return manifest;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!CONTENT_TYPES[extension]) continue;
    const name = path.basename(entry.name, extension);
    const url = `/audio/${encodeURIComponent(entry.name)}`;

    if (LOOP_NAMES.includes(name as LoopName)) {
      manifest.loops[name as LoopName] = url;
      continue;
    }
    if (NAMES.has(name)) {
      manifest.cues[name as Cue] = url;
      continue;
    }
    // A second take: `pac-dot-2.wav` alternates with `pac-dot.wav`, like the arcade's two chomps.
    const alternate = /^(.+)-2$/.exec(name)?.[1];
    if (alternate && NAMES.has(alternate)) manifest.alternates[alternate as Cue] = url;
  }
  return manifest;
}

/** Resolves a request like /audio/go.wav to a real file inside the audio folder, or null. */
export function resolveAudioFile(directory: string, requestPath: string): string | null {
  let name: string;
  try {
    name = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  // Flat folder only: no sub-paths, no traversal, no dotfiles.
  if (!name || name.startsWith('.') || /[/\\]/.test(name)) return null;
  if (!contentTypeFor(name)) return null;
  const file = path.resolve(directory, name);
  if (path.dirname(file) !== path.resolve(directory) || !existsSync(file)) return null;
  return file;
}
