import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AppConfig } from './config.ts';
import { BUILT_IN_DENY_LIST, DenyList, parseDenyList } from './denylist.ts';
import { isNewHighScore, rankScores, type RankedScore, type ScoreRecord } from './ranking.ts';
import type { ScoreStore } from './store.ts';
import { validateInitials, validateScore, validateTime, ValidationError } from './validation.ts';

export interface Settings {
  completionTimeEnabled: boolean;
  soundEnabled: boolean;
  /** TV master volume, 0–100. */
  soundVolume: number;
  customDenyList: string[];
}

export interface DisplaySettings {
  soundEnabled: boolean;
  soundVolume: number;
  rowsPerColumn: number;
  columns: number;
  pageSeconds: number;
  spotlightSeconds: number;
}

export interface LeaderboardSnapshot {
  /** Every run, in rank order. The TV pins the first `rowsPerColumn` and pages through the rest. */
  entries: RankedScore[];
  totalPlayers: number;
  latest: RankedScore | null;
  completionTimeEnabled: boolean;
  maxScore: number;
  display: DisplaySettings;
}

export interface AdminScore extends RankedScore {
  /** True when the code matches the current deny-list (e.g. a word added after it was entered). */
  flagged: boolean;
}

export interface ScoreInput {
  initials?: unknown;
  score?: unknown;
  timeSeconds?: unknown;
}

export interface SubmitOptions {
  /** Client-generated id; re-sending the same id returns the original result instead of adding twice. */
  submissionId?: string;
  /** Staff confirmed this really is a different player with the same initials and score. */
  confirmDuplicate?: boolean;
  now?: number;
}

export type SubmitResult =
  | { kind: 'created'; entry: RankedScore; isNewHighScore: boolean; replayed: boolean }
  | { kind: 'possible-duplicate'; existing: ScoreRecord; secondsAgo: number };

export class NotFoundError extends Error {}

const SETTING_TIME = 'completionTimeEnabled';
const SETTING_SOUND = 'soundEnabled';
const SETTING_VOLUME = 'soundVolume';
const SETTING_DENY = 'customDenyList';
const SUBMISSION_MEMORY_MS = 15 * 60 * 1000;

/** Local date and time parts, zero-padded: [yyyy, mm, dd, HH, MM, SS]. */
function localParts(date: Date): string[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  return [String(date.getFullYear()), pad(date.getMonth() + 1), pad(date.getDate()), pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())];
}

function timestampForFile(date = new Date()): string {
  const [y, mo, d, h, mi, s] = localParts(date);
  return `${y}-${mo}-${d}_${h}-${mi}-${s}`;
}

function localDateTime(ms: number): string {
  const [y, mo, d, h, mi, s] = localParts(new Date(ms));
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** All leaderboard business rules. The HTTP layer is a thin wrapper around this class. */
export class LeaderboardService {
  readonly #store: ScoreStore;
  readonly #config: AppConfig;
  readonly #submissions = new Map<string, { scoreId: number; at: number; isNewHighScore: boolean }>();
  #settings: Settings;
  #denyList: DenyList;

  constructor(store: ScoreStore, config: AppConfig) {
    this.#store = store;
    this.#config = config;
    this.#settings = this.#loadSettings();
    this.#denyList = this.#buildDenyList();
  }

  get config(): AppConfig {
    return this.#config;
  }

  // ---- settings -----------------------------------------------------------

  #loadSettings(): Settings {
    const time = this.#store.getSetting(SETTING_TIME);
    const sound = this.#store.getSetting(SETTING_SOUND);
    const storedVolume = this.#store.getSetting(SETTING_VOLUME);
    const volume = storedVolume === null ? Number.NaN : Number(storedVolume);
    const deny = this.#store.getSetting(SETTING_DENY);
    let customDenyList: string[] = [];
    if (deny) {
      try {
        customDenyList = parseDenyList(JSON.parse(deny)).entries;
      } catch {
        customDenyList = [];
      }
    }
    return {
      completionTimeEnabled: time === null ? this.#config.completionTimeEnabled : time === 'true',
      soundEnabled: sound === null ? this.#config.soundEnabled : sound === 'true',
      soundVolume: Number.isFinite(volume) && volume >= 0 && volume <= 100 ? volume : this.#config.soundVolume,
      customDenyList,
    };
  }

  #buildDenyList(): DenyList {
    return new DenyList([...BUILT_IN_DENY_LIST, ...this.#settings.customDenyList]);
  }

  getSettings(): Settings & { builtInDenyListSize: number } {
    return { ...this.#settings, customDenyList: [...this.#settings.customDenyList], builtInDenyListSize: BUILT_IN_DENY_LIST.length };
  }

  updateSettings(patch: { completionTimeEnabled?: unknown; soundEnabled?: unknown; soundVolume?: unknown; customDenyList?: unknown }): { rejectedDenyEntries: string[] } {
    let rejectedDenyEntries: string[] = [];
    for (const [field, key] of [['completionTimeEnabled', SETTING_TIME], ['soundEnabled', SETTING_SOUND]] as const) {
      const value = patch[field];
      if (value === undefined) continue;
      if (typeof value !== 'boolean') throw new TypeError(`${field} must be true or false`);
      this.#store.setSetting(key, String(value));
    }
    if (patch.soundVolume !== undefined) {
      const volume = Number(patch.soundVolume);
      if (!Number.isFinite(volume) || volume < 0 || volume > 100) throw new TypeError('soundVolume must be a number from 0 to 100');
      this.#store.setSetting(SETTING_VOLUME, String(Math.round(volume)));
    }
    if (patch.customDenyList !== undefined) {
      const raw = patch.customDenyList;
      if (typeof raw !== 'string' && !(Array.isArray(raw) && raw.every((item) => typeof item === 'string'))) {
        throw new TypeError('customDenyList must be text or a list of codes');
      }
      const parsed = parseDenyList(raw as string | string[]);
      rejectedDenyEntries = parsed.rejected;
      this.#store.setSetting(SETTING_DENY, JSON.stringify(parsed.entries));
    }
    this.#settings = this.#loadSettings();
    this.#denyList = this.#buildDenyList();
    return { rejectedDenyEntries };
  }

  /** Returns the blocking entry if these initials would be rejected, else null. */
  checkInitials(initials: string): string | null {
    return this.#denyList.match(initials);
  }

  // ---- reads --------------------------------------------------------------

  #rankAll(): RankedScore[] {
    return rankScores(this.#store.list(), { useTime: this.#settings.completionTimeEnabled });
  }

  snapshot(): LeaderboardSnapshot {
    const ranked = this.#rankAll();
    let latest: RankedScore | null = null;
    for (const entry of ranked) {
      if (!latest || entry.createdAt > latest.createdAt || (entry.createdAt === latest.createdAt && entry.id > latest.id)) latest = entry;
    }
    const { leaderboardSize, boardColumns, pageSeconds, spotlightSeconds } = this.#config;
    return {
      entries: ranked,
      totalPlayers: ranked.length,
      latest,
      completionTimeEnabled: this.#settings.completionTimeEnabled,
      maxScore: this.#config.maxScore,
      display: { soundEnabled: this.#settings.soundEnabled, soundVolume: this.#settings.soundVolume, rowsPerColumn: leaderboardSize, columns: boardColumns, pageSeconds, spotlightSeconds },
    };
  }

  /** Current ranked entry for one score (used to re-show a player on the TV). */
  getRanked(id: number): RankedScore {
    const entry = this.#rankAll().find((e) => e.id === id);
    if (!entry) throw new NotFoundError(`Score ${id} not found`);
    return entry;
  }

  listForAdmin(): AdminScore[] {
    return this.#rankAll().map((entry) => ({ ...entry, flagged: this.#denyList.match(entry.initials) !== null }));
  }

  // ---- writes -------------------------------------------------------------

  submit(input: ScoreInput, options: SubmitOptions = {}): SubmitResult {
    const now = options.now ?? Date.now();
    for (const [id, memo] of this.#submissions) {
      if (now - memo.at > SUBMISSION_MEMORY_MS) this.#submissions.delete(id);
    }

    const submissionId = typeof options.submissionId === 'string' ? options.submissionId.slice(0, 100) : '';
    const prior = submissionId ? this.#submissions.get(submissionId) : undefined;
    if (prior) {
      const entry = this.#rankAll().find((e) => e.id === prior.scoreId);
      if (entry) return { kind: 'created', entry, isNewHighScore: prior.isNewHighScore, replayed: true };
    }

    const useTime = this.#settings.completionTimeEnabled;
    const initials = validateInitials(input.initials, this.#denyList);
    const score = validateScore(input.score, this.#config.maxScore);
    const timeSeconds = useTime ? validateTime(input.timeSeconds, this.#config.maxTimeSeconds) : null;

    if (!options.confirmDuplicate && this.#config.duplicateWarningSeconds > 0) {
      const since = now - this.#config.duplicateWarningSeconds * 1000;
      const existing = this.#store
        .findRecentSame(initials, score, since)
        .find((run) => !useTime || run.timeSeconds === null || timeSeconds === null || run.timeSeconds === timeSeconds);
      if (existing) {
        return { kind: 'possible-duplicate', existing, secondsAgo: Math.max(0, Math.round((now - existing.createdAt) / 1000)) };
      }
    }

    const record = this.#store.insert({ initials, score, timeSeconds, createdAt: now });
    const ranked = this.#rankAll();
    const entry = ranked.find((e) => e.id === record.id);
    if (!entry) throw new Error('Inserted score was not found');
    const highScore = isNewHighScore(ranked, record.id);
    if (submissionId) this.#submissions.set(submissionId, { scoreId: record.id, at: now, isNewHighScore: highScore });
    return { kind: 'created', entry, isNewHighScore: highScore, replayed: false };
  }

  /** Partial update: only the fields present in `input` change. */
  update(id: number, input: ScoreInput): RankedScore {
    const existing = this.#store.get(id);
    if (!existing) throw new NotFoundError(`Score ${id} not found`);
    const initials = input.initials === undefined ? existing.initials : validateInitials(input.initials, this.#denyList);
    const score = input.score === undefined ? existing.score : validateScore(input.score, this.#config.maxScore);
    const timeSeconds =
      input.timeSeconds === undefined ? existing.timeSeconds : validateTime(input.timeSeconds, this.#config.maxTimeSeconds);
    this.#store.update(id, { initials, score, timeSeconds });
    const entry = this.#rankAll().find((e) => e.id === id);
    if (!entry) throw new NotFoundError(`Score ${id} not found`);
    return entry;
  }

  remove(id: number): ScoreRecord {
    const existing = this.#store.get(id);
    if (!existing || !this.#store.delete(id)) throw new NotFoundError(`Score ${id} not found`);
    return existing;
  }

  /** Clears every score. A backup is written first so a mistaken reset can be recovered. */
  reset(): { deleted: number; backupFile: string | null } {
    const backupFile = this.#store.count() > 0 ? this.backup('before-reset') : null;
    const deleted = this.#store.deleteAll();
    this.#submissions.clear();
    return { deleted, backupFile };
  }

  backup(label = 'backup'): string {
    const base = path.join(this.#config.backupDirectory, `pacman-maze-${label}-${timestampForFile()}`);
    let file = `${base}.db`;
    for (let n = 2; existsSync(file); n++) file = `${base}-${n}.db`;
    this.#store.backupTo(file);
    return file;
  }

  exportCsv(): string {
    const header = ['rank', 'player', 'pac_dots', 'completion_time_seconds', 'submitted_at'];
    const lines = [header.join(',')];
    for (const entry of this.#rankAll()) {
      lines.push([entry.rank, entry.initials, entry.score, entry.timeSeconds, localDateTime(entry.createdAt)].map(csvCell).join(','));
    }
    return `${lines.join('\n')}\n`;
  }
}

export { ValidationError };
