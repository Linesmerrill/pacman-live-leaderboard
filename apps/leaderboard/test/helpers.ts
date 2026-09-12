import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_CONFIG, type AppConfig } from '../src/config.ts';
import { LeaderboardService } from '../src/service.ts';
import { ScoreStore } from '../src/store.ts';

export interface Fixture {
  dir: string;
  config: AppConfig;
  store: ScoreStore;
  service: LeaderboardService;
  reopen(): Fixture;
  cleanup(): void;
}

/** A throwaway on-disk database + service in a temp folder. */
export function makeFixture(overrides: Partial<AppConfig> = {}, dir = mkdtempSync(path.join(tmpdir(), 'pacman-maze-test-'))): Fixture {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    databaseFile: path.join(dir, 'scores.db'),
    backupDirectory: path.join(dir, 'backups'),
    ...overrides,
  };
  const store = new ScoreStore(config.databaseFile);
  const service = new LeaderboardService(store, config);
  return {
    dir,
    config,
    store,
    service,
    reopen() {
      store.close();
      return makeFixture(overrides, dir);
    },
    cleanup() {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
