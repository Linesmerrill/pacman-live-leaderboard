// Original vector sprites in a generic maze-arcade style. Returned as markup strings (static, trusted).

const BODY = 'M10 95V46a40 40 0 0 1 80 0v49l-13.3-12-13.4 12L50 83 36.7 95 23.3 83 10 95z';

export const GHOST_COLORS = {
  red: '#ff2d3c',
  pink: '#ff9ce6',
  cyan: '#2ef2ff',
  orange: '#ffa23a',
};

export function ghost(color, className = '') {
  return `<svg class="ghost ${className}" viewBox="0 0 100 100" aria-hidden="true">
    <path d="${BODY}" fill="${color}"/>
    <g class="ghost-eyes">
      <ellipse cx="35" cy="46" rx="11" ry="14" fill="#fff"/>
      <ellipse cx="65" cy="46" rx="11" ry="14" fill="#fff"/>
      <g class="ghost-pupils">
        <circle cx="38" cy="49" r="6.5" fill="#1d2fe0"/>
        <circle cx="68" cy="49" r="6.5" fill="#1d2fe0"/>
      </g>
    </g>
  </svg>`;
}

export function scaredGhost(className = '') {
  return `<svg class="ghost scared ${className}" viewBox="0 0 100 100" aria-hidden="true">
    <path d="${BODY}" fill="#2438ff"/>
    <rect x="31" y="38" width="10" height="11" fill="#ffd2b8"/>
    <rect x="59" y="38" width="10" height="11" fill="#ffd2b8"/>
    <path d="M20 71l7.5-6 7.5 6 7.5-6 7.5 6 7.5-6 7.5 6 7.5-6 7.5 6" fill="none" stroke="#ffd2b8" stroke-width="4.5" stroke-linejoin="bevel"/>
  </svg>`;
}

export function pacman(className = '') {
  return `<svg class="pacman ${className}" viewBox="0 0 100 100" aria-hidden="true">
    <path class="pac-top" d="M50 50L100 50A50 50 0 0 0 0 50z" fill="#ffe135"/>
    <path class="pac-bottom" d="M50 50L0 50A50 50 0 0 0 100 50z" fill="#ffe135"/>
  </svg>`;
}

export function cherry(className = '') {
  return `<svg class="fruit ${className}" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M30 70C34 46 52 26 76 12M64 74C62 52 67 30 76 12" fill="none" stroke="#c97a2c" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="30" cy="72" r="17" fill="#ff1f3d"/>
    <circle cx="64" cy="77" r="17" fill="#ff1f3d"/>
    <circle cx="24" cy="66" r="4.5" fill="#fff" opacity=".85"/>
    <circle cx="58" cy="71" r="4.5" fill="#fff" opacity=".85"/>
  </svg>`;
}

export function strawberry(className = '') {
  return `<svg class="fruit ${className}" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M50 94C22 78 12 50 21 34c9-13 22-8 29-5 7-3 20-8 29 5 9 16-1 44-29 60z" fill="#ff2d4d"/>
    <g fill="#fff">
      <rect x="34" y="44" width="4" height="5"/><rect x="48" y="40" width="4" height="5"/><rect x="62" y="44" width="4" height="5"/>
      <rect x="40" y="58" width="4" height="5"/><rect x="56" y="58" width="4" height="5"/><rect x="48" y="72" width="4" height="5"/>
    </g>
    <path d="M28 27l12 5 10-14 10 14 12-5-6 12-16-4-16 4z" fill="#3ddc5c"/>
  </svg>`;
}

export function orange(className = '') {
  return `<svg class="fruit ${className}" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="60" r="33" fill="#ffa21f"/>
    <path d="M50 28c1-9 6-15 13-18" fill="none" stroke="#7a5a2b" stroke-width="5" stroke-linecap="round"/>
    <path d="M53 24c9-11 26-10 31-4-8 9-23 10-31 4z" fill="#3ddc5c"/>
    <circle cx="38" cy="47" r="5" fill="#fff" opacity=".55"/>
  </svg>`;
}

export const FRUIT_BY_RANK = { 1: cherry, 2: strawberry, 3: orange };
