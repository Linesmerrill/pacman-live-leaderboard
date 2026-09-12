import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** apps/leaderboard — where the server's own files (public/, schema) live. */
export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Repository root — where config.json, data/ and backups/ live, shared with the other apps. */
export const PROJECT_ROOT = path.resolve(APP_ROOT, '../..');

export interface AppConfig {
  /** TCP port for the web server. */
  port: number;
  /** Interface to bind. "0.0.0.0" lets a tablet on the same Wi-Fi open /admin; "127.0.0.1" restricts to this Mac. */
  host: string;
  /** SQLite database file (relative paths resolve from the project folder). */
  databaseFile: string;
  /** Where backups (manual and automatic pre-reset) are written. */
  backupDirectory: string;
  /** Rows per column on the TV. The first column always shows this many top players. */
  leaderboardSize: number;
  /** Columns on the TV (1–4). Column 1 pins the top players; the others page through everyone else. */
  boardColumns: number;
  /** Seconds each page of lower ranks stays up before Pac-Man flips to the next. */
  pageSeconds: number;
  /** Seconds the TV holds a just-entered player's page with their row highlighted (photo time!). */
  spotlightSeconds: number;
  /** Initial value of the completion-timer setting for a brand-new database. Toggle it later in /admin/settings. */
  completionTimeEnabled: boolean;
  /** Initial value of the TV sound-effects setting for a brand-new database. Toggle it later in /admin/settings. */
  soundEnabled: boolean;
  /** Initial TV volume (0–100) for a brand-new database. Stream Deck VOL +/− changes it live. */
  soundVolume: number;
  /** Folder holding your own event sounds (see assets/audio/README.md). */
  audioDirectory: string;
  /** How often the eating-a-dot sound repeats while a run is playing, in milliseconds. */
  wakaIntervalMs: number;
  /** Length of the 3·2·1 countdown before a run starts. */
  countdownSeconds: number;
  /** Initial run length in seconds before the maze finishes by itself; 0 = no limit. */
  runSeconds: number;
  /** Initial power-pellet time: how long POWER MODE lasts, and how much time a pellet adds. */
  powerPelletSeconds: number;
  /** Initial cap on how many pellets can extend one run's clock. */
  maxPellets: number;
  /** Initial state of the soft background music that plays between runs. */
  idleMusicEnabled: boolean;
  /** Initial volume (0–100) of that background music, relative to the TV volume. */
  idleMusicVolume: number;
  /** Optional PIN required by staff screens. Empty string = no PIN. */
  adminPin: string;
  /** Highest Pac-Dot count staff can enter. */
  maxScore: number;
  /** Longest completion time staff can enter, in seconds. */
  maxTimeSeconds: number;
  /** Ask staff to confirm when the same initials + score are entered again within this many seconds (0 disables). */
  duplicateWarningSeconds: number;
}

export const DEFAULT_CONFIG: Readonly<AppConfig> = Object.freeze({
  port: 3000,
  host: '0.0.0.0',
  databaseFile: 'data/pacman-maze.db',
  backupDirectory: 'backups',
  leaderboardSize: 10,
  boardColumns: 3,
  pageSeconds: 10,
  spotlightSeconds: 20,
  completionTimeEnabled: false,
  soundEnabled: true,
  soundVolume: 80,
  audioDirectory: 'assets/audio',
  wakaIntervalMs: 200,
  countdownSeconds: 3,
  runSeconds: 20,
  powerPelletSeconds: 10,
  maxPellets: 1,
  idleMusicEnabled: true,
  idleMusicVolume: 35,
  adminPin: '',
  maxScore: 999,
  maxTimeSeconds: 3600,
  duplicateWarningSeconds: 60,
});

const ENV_KEYS: Record<string, keyof AppConfig> = {
  PORT: 'port',
  HOST: 'host',
  DB_PATH: 'databaseFile',
  BACKUP_DIR: 'backupDirectory',
  AUDIO_DIR: 'audioDirectory',
  LEADERBOARD_SIZE: 'leaderboardSize',
  COMPLETION_TIME_ENABLED: 'completionTimeEnabled',
  SOUND_ENABLED: 'soundEnabled',
  ADMIN_PIN: 'adminPin',
};

/**
 * Build the runtime config from defaults, then config.json, then environment variables.
 * Unknown keys (like "_help") are ignored; keys with the wrong type are rejected loudly so a
 * typo can't silently change event behaviour.
 */
export function loadConfig(options: { file?: string; env?: NodeJS.ProcessEnv; root?: string } = {}): AppConfig {
  const root = options.root ?? PROJECT_ROOT;
  const file = options.file ?? path.join(root, 'config.json');
  const env = options.env ?? process.env;
  const config: AppConfig = { ...DEFAULT_CONFIG };

  if (existsSync(file)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`Could not read ${file}: ${(err as Error).message}`);
    }
    if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed)) {
        if (!(key in DEFAULT_CONFIG)) continue;
        const k = key as keyof AppConfig;
        if (typeof value !== typeof DEFAULT_CONFIG[k]) {
          throw new Error(`config.json: "${key}" must be a ${typeof DEFAULT_CONFIG[k]}`);
        }
        (config as unknown as Record<string, unknown>)[k] = value;
      }
    }
  }

  for (const [envKey, k] of Object.entries(ENV_KEYS)) {
    const raw = env[envKey];
    if (raw === undefined || raw === '') continue;
    const kind = typeof DEFAULT_CONFIG[k];
    let value: unknown = raw;
    if (kind === 'number') value = Number(raw);
    if (kind === 'boolean') value = /^(1|true|yes|on)$/i.test(raw);
    (config as unknown as Record<string, unknown>)[k] = value;
  }

  for (const k of ['port', 'leaderboardSize', 'boardColumns', 'pageSeconds', 'spotlightSeconds', 'maxScore', 'maxTimeSeconds', 'duplicateWarningSeconds', 'soundVolume', 'countdownSeconds', 'runSeconds', 'powerPelletSeconds', 'maxPellets', 'idleMusicVolume', 'wakaIntervalMs'] as const) {
    if (!Number.isInteger(config[k]) || config[k] < 0) throw new Error(`config: "${k}" must be a whole number ≥ 0`);
  }
  if (config.leaderboardSize < 3 || config.leaderboardSize > 20) throw new Error('config: "leaderboardSize" must be 3–20');
  if (config.boardColumns < 1 || config.boardColumns > 4) throw new Error('config: "boardColumns" must be 1–4');
  if (config.pageSeconds < 3) throw new Error('config: "pageSeconds" must be at least 3');
  if (config.soundVolume > 100) throw new Error('config: "soundVolume" must be 0–100');
  if (config.powerPelletSeconds < 1 || config.powerPelletSeconds > 120) throw new Error('config: "powerPelletSeconds" must be 1–120');
  if (config.runSeconds > 3600) throw new Error('config: "runSeconds" must be 0–3600 (0 = no time limit)');
  if (config.maxPellets > 20) throw new Error('config: "maxPellets" must be 0–20');
  if (config.idleMusicVolume > 100) throw new Error('config: "idleMusicVolume" must be 0–100');
  if (config.wakaIntervalMs < 60 || config.wakaIntervalMs > 2000) throw new Error('config: "wakaIntervalMs" must be 60–2000');

  if (config.databaseFile !== ':memory:') config.databaseFile = path.resolve(root, config.databaseFile);
  config.backupDirectory = path.resolve(root, config.backupDirectory);
  config.audioDirectory = path.resolve(root, config.audioDirectory);
  config.adminPin = config.adminPin.trim();
  return config;
}
