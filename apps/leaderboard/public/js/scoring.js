// How a run is scored: fruit bean-bags collected, plus ghosts tagged in power mode.
//
// Values follow the arcade's, divided by 10 so a great run still fits the board's 3 digits:
// the first-level cherry is 100 in the arcade, so it's 10 here. Ghosts double within a power-up
// (200, 400, 800, 1600 in the arcade). Staff can change every value, and switch fruit on or off
// to match the bean bags actually in the maze. Pure: shared by the server, the pages and the tests.

export const FRUITS = [
  { id: 'cherry', name: 'Cherry', arcade: 100 },
  { id: 'strawberry', name: 'Strawberry', arcade: 300 },
  { id: 'orange', name: 'Orange', arcade: 500 },
  { id: 'apple', name: 'Apple', arcade: 700 },
  { id: 'melon', name: 'Melon', arcade: 1000 },
  { id: 'galaxian', name: 'Galaxian', arcade: 2000 },
  { id: 'bell', name: 'Bell', arcade: 3000 },
  { id: 'key', name: 'Key', arcade: 5000 },
];

/** Points for the 1st, 2nd, 3rd, 4th… ghost tagged. Past the end of the list, the last value repeats. */
const GHOST_SLOTS = 4;
const MAX_POINTS = 999;

export const DEFAULT_SCORING = Object.freeze({
  // The first five arcade fruits are in play by default; the rest are there to switch on.
  fruits: Object.fromEntries(FRUITS.map((fruit, i) => [fruit.id, { points: fruit.arcade / 10, enabled: i < 5 }])),
  ghosts: [20, 40, 80, 160],
});

function points(value, what) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_POINTS) throw new TypeError(`${what} must be a whole number from 0 to ${MAX_POINTS}`);
  return n;
}

/**
 * Checks a scoring setup from the settings page and fills in anything missing from the defaults.
 * Throws a TypeError naming the bad value, so staff see what to fix.
 */
export function normalizeScoring(raw = {}) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('scoring must be an object');
  const fruits = {};
  for (const fruit of FRUITS) {
    const given = raw.fruits?.[fruit.id] ?? {};
    const fallback = DEFAULT_SCORING.fruits[fruit.id];
    if (given.enabled !== undefined && typeof given.enabled !== 'boolean') throw new TypeError(`${fruit.name}: on/off must be true or false`);
    fruits[fruit.id] = {
      points: given.points === undefined ? fallback.points : points(given.points, `${fruit.name} points`),
      enabled: given.enabled ?? fallback.enabled,
    };
  }
  const ghostsRaw = raw.ghosts ?? DEFAULT_SCORING.ghosts;
  if (!Array.isArray(ghostsRaw) || ghostsRaw.length !== GHOST_SLOTS) throw new TypeError(`ghosts must list points for the 1st to ${GHOST_SLOTS}th ghost`);
  const ghosts = ghostsRaw.map((value, i) => points(value, `Ghost ${i + 1} points`));
  return { fruits, ghosts };
}

/** Points for tagging `count` ghosts: 1st + 2nd + … (the last value repeats past the 4th). */
export function ghostPoints(count, ghosts) {
  let total = 0;
  for (let i = 0; i < count; i++) total += ghosts[Math.min(i, ghosts.length - 1)];
  return total;
}

/**
 * Adds up a run: `fruit` maps fruit id → how many were collected; `ghosts` is how many were tagged.
 * Returns the total and a line per part, for the staff to check before saving.
 */
export function scoreRun({ fruit = {}, ghosts = 0 }, scoring = DEFAULT_SCORING) {
  const parts = [];
  for (const { id, name } of FRUITS) {
    const count = fruit[id] ?? 0;
    if (count > 0) parts.push({ label: name, count, points: count * scoring.fruits[id].points });
  }
  if (ghosts > 0) parts.push({ label: ghosts === 1 ? 'Ghost' : 'Ghosts', count: ghosts, points: ghostPoints(ghosts, scoring.ghosts) });
  return { total: parts.reduce((sum, part) => sum + part.points, 0), parts };
}
