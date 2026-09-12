import type { DenyList } from './denylist.ts';

export type Field = 'initials' | 'score' | 'timeSeconds';

export class ValidationError extends Error {
  readonly field: Field;

  constructor(field: Field, message: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export const INITIALS_PATTERN = /^[A-Z0-9]{3}$/;

export function validateInitials(raw: unknown, denyList: DenyList): string {
  if (typeof raw !== 'string') throw new ValidationError('initials', 'Enter exactly 3 letters or numbers.');
  const initials = raw.trim().toUpperCase();
  if (!INITIALS_PATTERN.test(initials)) {
    throw new ValidationError('initials', 'Player code must be exactly 3 letters (A–Z) or numbers (0–9).');
  }
  if (denyList.match(initials)) {
    throw new ValidationError('initials', `"${initials}" isn't allowed. Ask the player to pick different initials.`);
  }
  return initials;
}

export function validateScore(raw: unknown, maxScore: number): number {
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ValidationError('score', 'Enter the number of Pac-Dots collected (a whole number).');
  }
  if (value < 0 || value > maxScore) {
    throw new ValidationError('score', `Pac-Dots must be between 0 and ${maxScore}.`);
  }
  return value;
}

/** Completion time in seconds, rounded to tenths. Blank/null means "not timed". */
export function validateTime(raw: unknown, maxSeconds: number): number | null {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) return null;
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError('timeSeconds', 'Completion time must be a number of seconds, like 42 or 42.5.');
  }
  const rounded = Math.round(value * 10) / 10;
  if (rounded <= 0 || rounded > maxSeconds) {
    throw new ValidationError('timeSeconds', `Completion time must be between 0.1 and ${maxSeconds} seconds.`);
  }
  return rounded;
}
