import type { GameCommand, GameState } from '../../../packages/shared/game-events.ts';

/** Original Pac-Man-flavoured key art, drawn as SVG so the keys stay crisp and need no image files. */
const ART: Record<GameCommand, (color: string) => string> = {
  ready: (c) => `<path d="M36 36 62 22a30 30 0 1 0 0 28z" fill="${c}"/><circle cx="70" cy="36" r="4" fill="#ffb8ae"/>`,
  countdown: (c) =>
    `<circle cx="36" cy="38" r="24" fill="none" stroke="${c}" stroke-width="6"/><path d="M36 24v16l10 7" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  start: (c) => `<path d="M26 18 62 38 26 58z" fill="${c}"/>`,
  'power-up': (c) =>
    `<circle cx="36" cy="38" r="20" fill="${c}"/><circle cx="36" cy="38" r="28" fill="none" stroke="${c}" stroke-width="3" opacity=".55"/>`,
  'ghost-tag': (c) =>
    `<path d="M14 60V38a22 22 0 0 1 44 0v22l-7-6-7 6-8-6-8 6-7-6z" fill="${c}"/><circle cx="28" cy="36" r="6" fill="#fff"/><circle cx="44" cy="36" r="6" fill="#fff"/><circle cx="30" cy="38" r="3" fill="#1d2fe0"/><circle cx="46" cy="38" r="3" fill="#1d2fe0"/>`,
  fruit: (c) =>
    `<path d="M24 46c4-14 14-24 26-31M46 48c-1-13 2-24 4-33" stroke="#c97a2c" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="24" cy="50" r="11" fill="${c}"/><circle cx="46" cy="52" r="11" fill="${c}"/>`,
  'pac-dot': (c) => `<circle cx="36" cy="38" r="9" fill="${c}"/>`,
  'high-score': (c) => `<path d="M36 12l7 18 19 1-15 12 5 19-16-11-16 11 5-19-15-12 19-1z" fill="${c}"/>`,
  // A camera: this key exists so the kid can photograph where they landed.
  spotlight: (c) =>
    `<rect x="8" y="22" width="56" height="36" rx="6" fill="none" stroke="${c}" stroke-width="5"/><path d="M25 22l5-8h12l5 8" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round"/><circle cx="36" cy="40" r="11" fill="none" stroke="${c}" stroke-width="5"/>`,
  finish: (c) =>
    `<path d="M18 14v48" stroke="${c}" stroke-width="5"/><g fill="${c}"><rect x="24" y="16" width="11" height="11"/><rect x="46" y="16" width="11" height="11"/><rect x="35" y="27" width="11" height="11"/><rect x="24" y="38" width="11" height="11"/><rect x="46" y="38" width="11" height="11"/></g>`,
  'stop-all': (c) => `<rect x="18" y="20" width="36" height="36" rx="5" fill="${c}"/>`,
  reset: (c) =>
    `<path d="M56 38a20 20 0 1 1-6-14" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M52 10v16H36" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  'volume-up': (c) =>
    `<path d="M12 30h10l13-11v38L22 46H12z" fill="${c}"/><path d="M44 28a14 14 0 0 1 0 20M52 20a26 26 0 0 1 0 36" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  'volume-down': (c) =>
    `<path d="M16 30h10l13-11v38L26 46H16z" fill="${c}"/><path d="M48 28a14 14 0 0 1 0 20" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  mute: (c) =>
    `<path d="M14 30h10l13-11v38L24 46H14z" fill="${c}"/><path d="M46 28l16 20M62 28 46 48" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
};

/** Accent colour per command, so a full deck reads at a glance. */
const COLORS: Record<GameCommand, string> = {
  ready: '#ffe135',
  countdown: '#ffe135',
  start: '#3ddc84',
  'power-up': '#ffffff',
  'ghost-tag': '#ff2d3c',
  fruit: '#ff5a5a',
  'pac-dot': '#ffb8ae',
  'high-score': '#ffe135',
  spotlight: '#ff8ae2',
  finish: '#3cf2ff',
  'stop-all': '#ff4d6d',
  reset: '#ff9f43',
  'volume-up': '#8ea2ff',
  'volume-down': '#8ea2ff',
  mute: '#8ea2ff',
};

export interface KeyLook {
  command: GameCommand;
  /** Dim the key when the command can't be used right now. */
  dimmed?: boolean;
  /** Highlight the key when its state is the live one (e.g. POWER UP during power mode). */
  active?: boolean;
  /** The leaderboard can't be reached. */
  offline?: boolean;
}

/** A 72×72 key image as an SVG data URI. */
export function keyImage({ command, dimmed = false, active = false, offline = false }: KeyLook): string {
  const color = offline ? '#5b6280' : COLORS[command];
  const background = active ? '#1d2a6b' : '#000000';
  const border = offline ? '#3a3f57' : active ? '#ffe135' : '#2447ff';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
<rect width="72" height="72" rx="10" fill="${background}"/>
<rect x="2" y="2" width="68" height="68" rx="9" fill="none" stroke="${border}" stroke-width="${active ? 4 : 2}" opacity="${offline ? 0.5 : 0.9}"/>
<g opacity="${dimmed ? 0.35 : 1}" transform="translate(6,-2) scale(0.82)">${ART[command](color)}</g>
${offline ? '<circle cx="61" cy="61" r="6" fill="#ff4d6d"/>' : ''}
</svg>`;
  return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}

/** Colour of the status tile, so the deck shows the game's state from across the room. */
const STATE_COLORS: Record<GameState, string> = {
  idle: '#8ea2ff',
  ready: '#ffe135',
  countdown: '#ffe135',
  playing: '#3ddc84',
  'power-mode': '#ffffff',
  finished: '#3cf2ff',
};

/**
 * The status tile: Pac-Man chasing a row of dots, coloured by what the game is doing.
 * Drawn here rather than shipped as images so it stays crisp on every deck.
 */
export function statusImage({ state, offline }: { state: GameState; offline: boolean }): string {
  const color = offline ? '#5b6280' : STATE_COLORS[state];
  const mouth = state === 'playing' || state === 'power-mode' ? 26 : 8;
  const dots = [46, 58, 70].map((x) => `<circle cx="${x}" cy="26" r="3.5" fill="${color}" opacity="${offline ? 0.4 : 0.85}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
<rect width="72" height="72" rx="10" fill="#000000"/>
<rect x="2" y="2" width="68" height="68" rx="9" fill="none" stroke="${offline ? '#ff4d6d' : color}" stroke-width="2" opacity="${offline ? 0.7 : 0.65}"/>
<path d="M26 26 ${26 + 18 * Math.cos((mouth * Math.PI) / 180)} ${26 - 18 * Math.sin((mouth * Math.PI) / 180)}a18 18 0 1 0 0 ${2 * 18 * Math.sin((mouth * Math.PI) / 180)}z" fill="${color}"/>
${dots}
</svg>`;
  return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}

/**
 * Flat artwork for the Stream Deck actions list — no key background, transparent around it.
 * `npm run streamdeck:icons` renders these to the PNG files the manifest points at.
 */
export function actionIconSvg(command: GameCommand, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 72 72">
<g transform="translate(4,2)">${ART[command](COLORS[command])}</g>
</svg>`;
}

/** Flat artwork for the status tile in the actions list. */
export function statusIconSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 72 72">
<path d="M34 36 52 21a24 24 0 1 0 0 30z" fill="#ffe135"/>
<circle cx="60" cy="36" r="4.5" fill="#8ea2ff"/>
</svg>`;
}
