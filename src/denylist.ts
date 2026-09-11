/**
 * Kid-safety filter for 3-character player codes.
 *
 * Entries are exactly three characters from A–Z, 0–9, or "?" (matches any one character).
 * Codes are also checked after swapping look-alike digits for letters, so "A55" is caught by "ASS".
 * Staff can add more entries from /admin/settings; this built-in list always applies.
 */
export const BUILT_IN_DENY_LIST: readonly string[] = Object.freeze([
  'ASS', 'AZZ', 'BCH', 'BJS', 'CHK', 'CNT', 'COC', 'COK', 'CUK', 'CUM', 'CUN', 'DIC', 'DIK', 'DIX',
  'DKS', 'FAG', 'FAP', 'FCK', 'FKN', 'FKU', 'FUC', 'FUK', 'FUQ', 'FUX', 'FXK', 'GFY', 'HOE', 'JIZ',
  'JZZ', 'KIK', 'KKK', 'KYS', 'LSD', 'MFR', 'NAZ', 'NGA', 'NGR', 'NIG', 'PIS', 'PNS', 'POS', 'SEX',
  'SHT', 'SLT', 'SOB', 'SPK', 'SUC', 'SUK', 'THC', 'TIT', 'TTS', 'TWT', 'VAG', 'WHR', 'WOP', 'WTF',
  'XXX', '69?', '?69',
]);

const LOOKALIKES: Readonly<Record<string, readonly string[]>> = {
  '0': ['O'],
  '1': ['I', 'L'],
  '2': ['Z'],
  '3': ['E'],
  '4': ['A'],
  '5': ['S'],
  '6': ['G'],
  '7': ['T'],
  '8': ['B'],
  '9': ['G'],
};

const ENTRY_PATTERN = /^[A-Z0-9?]{3}$/;

/** Split free-form staff input ("abc, xyz\nq?q") into clean, unique, valid entries. */
export function parseDenyList(input: string | readonly string[]): { entries: string[]; rejected: string[] } {
  const tokens = typeof input === 'string' ? input.split(/[\s,;]+/) : input;
  const entries = new Set<string>();
  const rejected: string[] = [];
  for (const token of tokens) {
    const value = String(token).trim().toUpperCase();
    if (!value) continue;
    if (ENTRY_PATTERN.test(value)) entries.add(value);
    else rejected.push(value);
  }
  return { entries: [...entries].sort(), rejected };
}

function matchesPattern(pattern: string, code: string): boolean {
  for (let i = 0; i < 3; i++) {
    if (pattern[i] !== '?' && pattern[i] !== code[i]) return false;
  }
  return true;
}

/** Every spelling a code could be read as: "A55" → A55, AS5, A5S, ASS. */
function readings(code: string): string[] {
  let results = [''];
  for (const ch of code) {
    const options = [ch, ...(LOOKALIKES[ch] ?? [])];
    results = results.flatMap((prefix) => options.map((option) => prefix + option));
  }
  return results;
}

export class DenyList {
  readonly #patterns: string[];

  constructor(entries: readonly string[]) {
    this.#patterns = parseDenyList(entries).entries;
  }

  /** Returns the deny-list entry that blocks this code, or null if the code is allowed. */
  match(code: string): string | null {
    const upper = code.toUpperCase();
    for (const reading of readings(upper)) {
      for (const pattern of this.#patterns) {
        if (matchesPattern(pattern, reading)) return pattern;
      }
    }
    return null;
  }

  get size(): number {
    return this.#patterns.length;
  }
}
