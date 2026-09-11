import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { ScoreRecord } from './ranking.ts';

const SCHEMA_VERSION = 1;
const SCHEMA_SQL = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

interface ScoreRow {
  id: number;
  initials: string;
  score: number;
  time_seconds: number | null;
  created_at: number;
}

export interface NewScore {
  initials: string;
  score: number;
  timeSeconds: number | null;
  createdAt: number;
}

function toRecord(row: ScoreRow): ScoreRecord {
  return {
    id: Number(row.id),
    initials: row.initials,
    score: Number(row.score),
    timeSeconds: row.time_seconds === null ? null : Number(row.time_seconds),
    createdAt: Number(row.created_at),
  };
}

/** Thin, synchronous SQLite persistence layer. Every write is committed before the call returns. */
export class ScoreStore {
  readonly #db: DatabaseSync;
  readonly #statements: Record<string, StatementSync>;

  constructor(filePath: string) {
    if (filePath !== ':memory:') mkdirSync(path.dirname(filePath), { recursive: true });
    this.#db = new DatabaseSync(filePath);
    // WAL + FULL sync: every committed score is on disk even if the Mac loses power.
    this.#db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;');
    this.#migrate();
    const prepare = (sql: string) => this.#db.prepare(sql);
    this.#statements = {
      insert: prepare('INSERT INTO scores (initials, score, time_seconds, created_at) VALUES (?, ?, ?, ?)'),
      get: prepare('SELECT * FROM scores WHERE id = ?'),
      all: prepare('SELECT * FROM scores ORDER BY id'),
      count: prepare('SELECT COUNT(*) AS n FROM scores'),
      update: prepare('UPDATE scores SET initials = ?, score = ?, time_seconds = ? WHERE id = ?'),
      delete: prepare('DELETE FROM scores WHERE id = ?'),
      deleteAll: prepare('DELETE FROM scores'),
      recentSame: prepare('SELECT * FROM scores WHERE initials = ? AND score = ? AND created_at >= ? ORDER BY created_at DESC'),
      getSetting: prepare('SELECT value FROM settings WHERE key = ?'),
      setSetting: prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
      backup: prepare('VACUUM INTO ?'),
    };
  }

  #migrate(): void {
    const { user_version: version } = this.#db.prepare('PRAGMA user_version').get() as { user_version: number };
    if (version > SCHEMA_VERSION) {
      throw new Error(`Database schema v${version} is newer than this app (v${SCHEMA_VERSION}). Update the app.`);
    }
    this.#db.exec(SCHEMA_SQL);
    if (version < SCHEMA_VERSION) this.#db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }

  insert(score: NewScore): ScoreRecord {
    const result = this.#statements.insert.run(score.initials, score.score, score.timeSeconds, score.createdAt);
    return { id: Number(result.lastInsertRowid), ...score };
  }

  get(id: number): ScoreRecord | null {
    const row = this.#statements.get.get(id) as ScoreRow | undefined;
    return row ? toRecord(row) : null;
  }

  list(): ScoreRecord[] {
    return (this.#statements.all.all() as unknown as ScoreRow[]).map(toRecord);
  }

  count(): number {
    return Number((this.#statements.count.get() as { n: number }).n);
  }

  update(id: number, values: Omit<NewScore, 'createdAt'>): ScoreRecord | null {
    const result = this.#statements.update.run(values.initials, values.score, values.timeSeconds, id);
    return Number(result.changes) > 0 ? this.get(id) : null;
  }

  delete(id: number): boolean {
    return Number(this.#statements.delete.run(id).changes) > 0;
  }

  deleteAll(): number {
    return Number(this.#statements.deleteAll.run().changes);
  }

  /** Runs with the same initials and score submitted at or after `sinceMs`, newest first. */
  findRecentSame(initials: string, score: number, sinceMs: number): ScoreRecord[] {
    return (this.#statements.recentSame.all(initials, score, sinceMs) as unknown as ScoreRow[]).map(toRecord);
  }

  getSetting(key: string): string | null {
    const row = this.#statements.getSetting.get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  setSetting(key: string, value: string): void {
    this.#statements.setSetting.run(key, value);
  }

  /** Consistent point-in-time copy of the whole database, safe while the app is running. */
  backupTo(filePath: string): void {
    mkdirSync(path.dirname(filePath), { recursive: true });
    this.#statements.backup.run(filePath);
  }

  close(): void {
    if (this.#db.isOpen) this.#db.close();
  }
}
