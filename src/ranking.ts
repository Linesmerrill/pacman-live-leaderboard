/**
 * Pure ranking rules — no I/O, so they're easy to test.
 *
 * Order: most Pac-Dots first. When completion time is enabled, equal scores are broken by the
 * fastest time (runs without a time sort after timed runs). Anything still tied keeps the same
 * rank number ("1, 1, 3" competition ranking) and is listed earliest-submission first.
 */

export interface ScoreRecord {
  id: number;
  initials: string;
  score: number;
  /** Completion time in seconds (one decimal), or null when not recorded. */
  timeSeconds: number | null;
  /** Unix epoch milliseconds. */
  createdAt: number;
}

export interface RankedScore extends ScoreRecord {
  /** Shared rank: tied results get the same number. */
  rank: number;
  /** 1-based row position in the sorted list (unique). */
  position: number;
}

export interface RankingOptions {
  useTime: boolean;
}

function compareTimes(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/** True when two runs are indistinguishable under the ranking rules (and so share a rank). */
export function isTiedResult(a: ScoreRecord, b: ScoreRecord, options: RankingOptions): boolean {
  if (a.score !== b.score) return false;
  return !options.useTime || compareTimes(a.timeSeconds, b.timeSeconds) === 0;
}

export function compareForRanking(a: ScoreRecord, b: ScoreRecord, options: RankingOptions): number {
  if (a.score !== b.score) return b.score - a.score;
  if (options.useTime) {
    const byTime = compareTimes(a.timeSeconds, b.timeSeconds);
    if (byTime !== 0) return byTime;
  }
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.id - b.id;
}

export function rankScores(records: readonly ScoreRecord[], options: RankingOptions): RankedScore[] {
  const sorted = [...records].sort((a, b) => compareForRanking(a, b, options));
  const ranked: RankedScore[] = [];
  sorted.forEach((record, index) => {
    const previous = ranked[index - 1];
    const rank = previous && isTiedResult(previous, record, options) ? previous.rank : index + 1;
    ranked.push({ ...record, rank, position: index + 1 });
  });
  return ranked;
}

/**
 * A new high score means the entry is now alone at #1 — it strictly beat every other run.
 * Tying the current leader doesn't trigger the celebration. The very first run of the night does.
 */
export function isNewHighScore(ranked: readonly RankedScore[], id: number): boolean {
  const [first, second] = ranked;
  if (!first || first.id !== id) return false;
  return !second || second.rank !== 1;
}
