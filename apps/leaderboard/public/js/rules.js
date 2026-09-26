// The how-to-play panel beside the leaderboard, for the kids waiting in line.
//
// One rule at a time: its number, a little looping animation of that moment in the game, and one
// or two lines of text. After a few seconds it moves on to the next rule, round and round.
// Animations use the Web Animations API so each one can be timed exactly (a dot vanishes the
// instant Pac-Man reaches it) and cleaned up when the rule changes.

import { canDraw, pixelText, pixelWidth } from './pixelfont.js';
import { DEFAULT_SCORING, FRUITS } from './scoring.js';
import { FRUIT_ART, GHOST_COLORS, candy, ghost, pacman, scaredGhost } from './sprites.js';

/** The rules, in order. Pure: the tests check every line can be drawn by the pixel font. */
/**
 * @param {{ runSeconds?: number, powerPelletSeconds?: number, maxPellets?: number,
 *   round?: { enabled: boolean, minutes: number, prizeCount: number } | null }} [options]
 */
export function ruleSteps({ runSeconds = 20, powerPelletSeconds = 5, maxPellets = 1, round = null } = {}) {
  const clock =
    runSeconds > 0
      ? {
          scene: 'clock',
          title: 'BEAT THE CLOCK',
          // Only promise extra time when a power orb actually adds some.
          lines: [`${runSeconds} SECONDS`, 'TO PLAY', ...(maxPellets > 0 ? [`+${powerPelletSeconds} WITH THE ORB!`] : [])],
        }
      : { scene: 'clock', title: 'BE QUICK!', lines: ['GRAB ALL THE', 'FRUIT YOU CAN!'] };
  return [
    { scene: 'enter', title: 'ENTER THE MAZE', lines: ['WAIT FOR', '3 2 1 GO!'] },
    { scene: 'chase', title: 'AVOID THE GHOSTS', lines: ["DON'T GET", 'TAGGED!'] },
    { scene: 'fruit', title: 'COLLECT FRUIT', lines: ['EVERY FRUIT', 'IS POINTS!'] },
    { scene: 'power', title: 'POWER ORB', lines: ['ACTIVATE IT FOR', `${powerPelletSeconds} SECONDS OF`, 'POWER MODE!'] },
    { scene: 'tag', title: 'TAG THE GHOSTS', lines: ['IN POWER MODE', 'FOR POINTS!'] },
    { scene: 'duo', title: '2 KIDS PER GAME', lines: ['START ON', 'OPPOSITE SIDES!'] },
    clock,
    { scene: 'board', title: 'GAME OVER!', lines: ['TELL STAFF YOUR', 'INITIALS TO GET', 'ON THE BOARD!'] },
    // Prize rounds, only while they're switched on.
    ...(round?.enabled
      ? [{ scene: 'prize', title: 'WIN CANDY!', lines: [`BE TOP ${round.prizeCount} WHEN`, `THE ${round.minutes} MINUTE`, 'ROUND ENDS!'] }]
      : []),
  ];
}

/** Every piece of text the panel will show, for the drawability test. */
export function allRuleText(options) {
  return ['HOW TO PLAY', ...ruleSteps(options).flatMap((step, i) => [`RULE ${i + 1}`, step.title, ...step.lines])];
}

export { canDraw };

// ---------- Scenes ----------

const LOOP_MS = 3200;
const html = (markup) => {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
};
const actor = (markup, className) => {
  const el = document.createElement('div');
  el.className = `actor ${className}`;
  el.append(html(markup));
  return el;
};
const dot = (className = '') => {
  const el = document.createElement('div');
  el.className = `dot ${className}`.trim();
  return el;
};
const loop = (el, keyframes, options = {}) => el.animate(keyframes, { duration: LOOP_MS, iterations: Infinity, easing: 'linear', ...options });

/** Each builder fills `scene` and returns the animations/timers to stop when the rule changes. */
const SCENES = {
  // Pac-Man slides through the gap in the wall into a maze full of dots.
  enter(scene) {
    scene.append(html('<div class="wall wall-top"></div>'), html('<div class="wall wall-bottom"></div>'));
    const dots = [62, 72, 82, 92].map((x) => {
      const d = dot();
      d.style.left = `${x}%`;
      scene.append(d);
      return d;
    });
    const pac = actor(pacman(), 'pac');
    scene.append(pac);
    return [
      loop(pac, [{ left: '-12%', opacity: 1 }, { left: '52%', opacity: 1, offset: 0.62 }, { left: '58%', opacity: 1, offset: 0.72 }, { left: '58%', opacity: 0, offset: 0.8 }, { left: '58%', opacity: 0 }]),
      ...dots.map((d, i) => loop(d, [{ opacity: 0.35 }, { opacity: 0.35, offset: 0.6 + i * 0.05 }, { opacity: 1, offset: 0.65 + i * 0.05 }, { opacity: 1 }])),
    ];
  },

  // Pac-Man runs; a ghost chases a step behind.
  chase(scene) {
    const pac = actor(pacman(), 'pac');
    const red = actor(ghost(GHOST_COLORS.red), 'ghost-actor');
    const pink = actor(ghost(GHOST_COLORS.pink), 'ghost-actor');
    scene.append(pac, red, pink);
    return [
      loop(pac, [{ left: '-14%' }, { left: '112%' }]),
      loop(red, [{ left: '-40%' }, { left: '86%' }]),
      loop(pink, [{ left: '-62%' }, { left: '64%' }]),
    ];
  },

  // A row of fruit; each disappears with a point pop the moment Pac-Man reaches it.
  fruit(scene, { scoring = DEFAULT_SCORING }) {
    // The first three fruit actually in the maze, worth what the Scoring settings say.
    const shown = FRUITS.filter((f) => scoring.fruits[f.id]?.enabled).slice(0, 3);
    const xs = [26, 50, 74].slice(0, shown.length);
    const start = -12;
    const end = 112;
    const at = (x) => (x - start) / (end - start);
    const running = [];
    xs.forEach((x, i) => {
      const item = actor(FRUIT_ART[shown[i].id](), 'fruit-actor');
      item.style.left = `${x}%`;
      const pop = document.createElement('div');
      pop.className = 'bonus';
      pop.style.left = `${x}%`;
      pop.append(pixelText(`+${scoring.fruits[shown[i].id].points}`));
      scene.append(item, pop);
      const t = at(x);
      running.push(
        loop(item, [{ opacity: 1 }, { opacity: 1, offset: t }, { opacity: 0, offset: Math.min(1, t + 0.01) }, { opacity: 0, offset: 0.97 }, { opacity: 1 }]),
        loop(pop, [{ opacity: 0, transform: 'translate(-50%, 0)' }, { opacity: 0, offset: t }, { opacity: 1, transform: 'translate(-50%, -40%)', offset: Math.min(0.99, t + 0.06) }, { opacity: 0, transform: 'translate(-50%, -90%)', offset: Math.min(1, t + 0.3) }, { opacity: 0, transform: 'translate(-50%, -90%)' }]),
      );
    });
    const pac = actor(pacman(), 'pac');
    scene.append(pac);
    return [loop(pac, [{ left: `${start}%` }, { left: `${end}%` }]), ...running];
  },

  // Pac-Man eats the big pellet, the ghost turns blue and runs, "+10" pops up.
  power(scene, { powerPelletSeconds }) {
    const pellet = dot('big');
    pellet.style.left = '44%';
    const pac = actor(pacman(), 'pac');
    const angry = actor(ghost(GHOST_COLORS.cyan), 'ghost-actor');
    const blue = actor(scaredGhost(), 'ghost-actor');
    const bonus = document.createElement('div');
    bonus.className = 'bonus';
    bonus.append(pixelText(`${powerPelletSeconds} SEC`));
    scene.append(pellet, pac, angry, blue, bonus);
    const eaten = 0.42;
    const ghostPath = [{ left: '80%' }, { left: '66%', offset: eaten }, { left: '112%' }];
    return [
      loop(pac, [{ left: '-12%' }, { left: '40%', offset: eaten }, { left: '100%' }]),
      loop(pellet, [{ opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1.25)', offset: eaten * 0.5 }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: eaten - 0.02 }, { opacity: 0, offset: eaten }, { opacity: 0, offset: 0.97 }, { opacity: 1 }]),
      loop(angry, [...ghostPath.map((k) => ({ ...k, opacity: 1 })).slice(0, 2), { left: '66%', opacity: 0, offset: eaten + 0.01 }, { left: '112%', opacity: 0 }]),
      loop(blue, [{ left: '80%', opacity: 0 }, { left: '66%', opacity: 0, offset: eaten }, { left: '66%', opacity: 1, offset: eaten + 0.01 }, { left: '112%', opacity: 1 }]),
      loop(bonus, [{ opacity: 0, transform: 'translate(-50%, 0)' }, { opacity: 0, offset: eaten }, { opacity: 1, transform: 'translate(-50%, -40%)', offset: eaten + 0.08 }, { opacity: 1, transform: 'translate(-50%, -90%)', offset: 0.8 }, { opacity: 0, transform: 'translate(-50%, -110%)' }]),
    ];
  },

  // Power mode: Pac-Man chases two blue ghosts and tags them, each one worth points.
  tag(scene, { scoring = DEFAULT_SCORING }) {
    const catches = [0.45, 0.8];
    const running = [];
    catches.forEach((t, i) => {
      const x = 12 + t * 100 * 0.95;
      const blue = actor(scaredGhost(), 'ghost-actor');
      const pop = document.createElement('div');
      pop.className = 'bonus';
      pop.style.left = `${x}%`;
      pop.append(pixelText(`+${scoring.ghosts[i]}`));
      scene.append(blue, pop);
      // The ghost flees just ahead of Pac-Man until he catches it.
      running.push(
        loop(blue, [{ left: `${x - 30}%`, opacity: 1 }, { left: `${x}%`, opacity: 1, offset: t }, { left: `${x}%`, opacity: 0, offset: Math.min(1, t + 0.01) }, { left: `${x}%`, opacity: 0 }]),
        loop(pop, [{ opacity: 0, transform: 'translate(-50%, 0)' }, { opacity: 0, offset: t }, { opacity: 1, transform: 'translate(-50%, -40%)', offset: Math.min(0.99, t + 0.06) }, { opacity: 0, transform: 'translate(-50%, -90%)', offset: Math.min(1, t + 0.3) }, { opacity: 0, transform: 'translate(-50%, -90%)' }]),
      );
    });
    const pac = actor(pacman(), 'pac');
    scene.append(pac);
    return [loop(pac, [{ left: '-12%' }, { left: '100%', offset: 0.95 }, { left: '112%' }]), ...running];
  },

  // Two players, one at each end, heading into the maze from opposite sides.
  duo(scene) {
    scene.append(html('<div class="wall wall-middle"></div>'));
    const left = actor(pacman(), 'pac');
    const right = actor(pacman(), 'pac facing-left');
    const blinky = actor(ghost(GHOST_COLORS.red), 'ghost-actor small-ghost');
    blinky.style.left = '50%';
    scene.append(left, right, blinky);
    return [
      loop(left, [{ left: '-12%' }, { left: '26%', offset: 0.55 }, { left: '26%' }]),
      loop(right, [{ left: '112%' }, { left: '74%', offset: 0.55 }, { left: '74%' }]),
      loop(blinky, [{ transform: 'translate(-50%, -80%)' }, { transform: 'translate(-50%, -20%)', offset: 0.5 }, { transform: 'translate(-50%, -80%)' }]),
    ];
  },
  // A countdown from the run length to 0 while Pac-Man races along a draining bar.
  clock(scene, { runSeconds }) {
    const seconds = runSeconds > 0 ? runSeconds : 20;
    const number = document.createElement('div');
    number.className = 'clock-number';
    const bar = html('<div class="clock-bar"><div class="clock-fill"></div></div>');
    const pac = actor(pacman(), 'pac small');
    scene.append(number, bar, pac);
    const show = (n) => number.replaceChildren(pixelText(String(n)));
    show(seconds);
    const started = performance.now();
    const timer = setInterval(() => {
      const t = ((performance.now() - started) % LOOP_MS) / LOOP_MS;
      show(Math.max(0, Math.ceil(seconds * (1 - t / 0.9))));
    }, 80);
    return [
      loop(bar.firstElementChild, [{ width: '100%' }, { width: '0%', offset: 0.9 }, { width: '0%' }]),
      loop(pac, [{ left: '8%' }, { left: '86%', offset: 0.9 }, { left: '86%' }]),
      { cancel: () => clearInterval(timer) },
    ];
  },

  // A scoreboard row fills in: initials typed, dots counted up, and it lights up.
  board(scene) {
    const row = document.createElement('div');
    row.className = 'mini-row';
    const rank = document.createElement('span');
    const name = document.createElement('span');
    const score = document.createElement('span');
    rank.className = 'mini-rank';
    name.className = 'mini-name';
    score.className = 'mini-score';
    rank.append(pixelText('1ST'));
    row.append(rank, name, score);
    const fruit = actor(cherry(), 'fruit-actor');
    scene.append(row, fruit);
    const started = performance.now();
    let last = '';
    const timer = setInterval(() => {
      const t = ((performance.now() - started) % LOOP_MS) / LOOP_MS;
      const initials = 'YOU'.slice(0, Math.min(3, Math.floor(t / 0.1)));
      const points = t < 0.35 ? 0 : Math.min(42, Math.round(((t - 0.35) / 0.3) * 42));
      const key = `${initials}|${points}`;
      if (key === last) return;
      last = key;
      name.replaceChildren(pixelText(initials.padEnd(3, '-')));
      score.replaceChildren(pixelText(String(points)));
      row.classList.toggle('lit', t > 0.66);
    }, 60);
    return [loop(fruit, [{ transform: 'translate(-50%, -50%) rotate(-8deg)' }, { transform: 'translate(-50%, -60%) rotate(8deg)', offset: 0.5 }, { transform: 'translate(-50%, -50%) rotate(-8deg)' }]), { cancel: () => clearInterval(timer) }];
  },

  // The round clock runs down, then the candy bounces out for the top players.
  prize(scene, { round }) {
    const minutes = round?.minutes ?? 15;
    const number = document.createElement('div');
    number.className = 'clock-number';
    const sweets = document.createElement('div');
    sweets.className = 'prize-candy';
    sweets.innerHTML = candy() + candy() + candy();
    scene.append(number, sweets);
    const started = performance.now();
    let last = '';
    const timer = setInterval(() => {
      const t = ((performance.now() - started) % LOOP_MS) / LOOP_MS;
      const left = Math.max(0, Math.round(minutes * 60 * (1 - t / 0.55)));
      const text = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      if (text !== last) {
        last = text;
        number.replaceChildren(pixelText(text));
      }
    }, 60);
    return [
      loop(sweets, [{ opacity: 0, transform: 'translate(-50%, 30%) scale(0.6)' }, { opacity: 0, offset: 0.55 }, { opacity: 1, transform: 'translate(-50%, -10%) scale(1.1)', offset: 0.68 }, { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.78 }, { opacity: 1, transform: 'translate(-50%, 0) scale(1)' }]),
      { cancel: () => clearInterval(timer) },
    ];
  },
};

// ---------- Panel ----------

const state = { els: null, options: { runSeconds: 20, powerPelletSeconds: 5, maxPellets: 1, stepSeconds: 6 }, index: 0, running: [], timer: null, active: false };

/** Draws text as large as it can be while still fitting the panel's width (see .fit in CSS). */
function fitted(text, className) {
  const el = document.createElement('div');
  el.className = `fit ${className}`;
  el.style.setProperty('--tw', String(pixelWidth(text)));
  el.append(pixelText(text));
  return el;
}

function stopScene() {
  for (const animation of state.running) animation.cancel();
  state.running = [];
}

function show(index) {
  const { els, options } = state;
  const steps = ruleSteps(options);
  state.index = ((index % steps.length) + steps.length) % steps.length;
  const step = steps[state.index];

  stopScene();
  els.number.replaceChildren(fitted(`RULE ${state.index + 1}`, 'rule-number'));
  els.scene.replaceChildren();
  els.scene.dataset.scene = step.scene;
  state.running = SCENES[step.scene](els.scene, options);
  els.text.replaceChildren(fitted(step.title, 'rule-title'), ...step.lines.map((line) => fitted(line, 'rule-line')));

  els.progress.replaceChildren(
    ...steps.map((_, i) => {
      const pip = document.createElement('span');
      if (i === state.index) pip.append(html(pacman()));
      else pip.className = i < state.index ? 'done' : '';
      return pip;
    }),
  );

  els.card.classList.remove('enter');
  void els.card.offsetWidth; // restart the entrance animation
  els.card.classList.add('enter');
}

/** Wire the panel up once; `root` is the rules pane from index.html. */
export function mountRules(root) {
  state.els = {
    root,
    card: root.querySelector('.rules-card'),
    number: root.querySelector('.rules-number'),
    scene: root.querySelector('.rules-scene'),
    text: root.querySelector('.rules-text'),
    progress: root.querySelector('.rules-progress'),
  };
  root.querySelector('.rules-head').replaceChildren(fitted('HOW TO PLAY', 'rules-heading'));
}

/** Turn the panel on or off and apply the latest settings; restarts the cycle only when needed. */
export function setRules({ enabled, ...options }) {
  if (!state.els) return;
  const changed = JSON.stringify(options) !== JSON.stringify(state.options);
  state.options = options;
  state.els.root.hidden = !enabled;

  if (!enabled) {
    state.active = false;
    clearInterval(state.timer);
    stopScene();
    return;
  }
  if (state.active && !changed) return;
  state.active = true;
  clearInterval(state.timer);
  show(state.index);
  state.timer = setInterval(() => show(state.index + 1), stepSeconds * 1000);
}

/** For the staff screen and tests: jump straight to a rule. */
export function showRule(index) {
  if (!state.active) return;
  clearInterval(state.timer);
  show(index);
  state.timer = setInterval(() => show(state.index + 1), state.options.stepSeconds * 1000);
}
