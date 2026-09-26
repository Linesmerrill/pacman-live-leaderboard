// The how-to-play panel beside the leaderboard, for the kids waiting in line.
//
// One rule at a time: its number, a little looping animation of that moment in the game, and one
// or two lines of text. After a few seconds it moves on to the next rule, round and round.
// Animations use the Web Animations API so each one can be timed exactly (a dot vanishes the
// instant Pac-Man reaches it) and cleaned up when the rule changes.

import { canDraw, pixelText, pixelWidth } from './pixelfont.js';
import { GHOST_COLORS, cherry, ghost, pacman, scaredGhost } from './sprites.js';

/** The rules, in order. Pure: the tests check every line can be drawn by the pixel font. */
export function ruleSteps({ runSeconds = 20, powerPelletSeconds = 10 } = {}) {
  return [
    { scene: 'enter', title: 'ENTER THE MAZE', lines: ['WAIT FOR', '3 2 1 GO!'] },
    { scene: 'chase', title: 'AVOID THE GHOSTS', lines: ["DON'T GET", 'TAGGED!'] },
    { scene: 'dots', title: 'COLLECT PAC-DOTS', lines: ['EVERY DOT IS', '1 POINT'] },
    { scene: 'power', title: 'POWER PELLET', lines: [`+${powerPelletSeconds} SECONDS`, 'FOR EVERYONE!'] },
    runSeconds > 0
      ? { scene: 'clock', title: 'BEAT THE CLOCK', lines: [`${runSeconds} SECONDS`, 'TO GRAB DOTS!'] }
      : { scene: 'clock', title: 'BE QUICK!', lines: ['GRAB ALL THE', 'DOTS YOU CAN!'] },
    { scene: 'board', title: 'GET ON THE BOARD', lines: ['TELL STAFF YOUR', '3 INITIALS'] },
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

  // A row of dots; each disappears the moment Pac-Man reaches it.
  dots(scene) {
    const xs = [14, 26, 38, 50, 62, 74, 86];
    const start = -12;
    const end = 112;
    const dots = xs.map((x) => {
      const d = dot();
      d.style.left = `${x}%`;
      scene.append(d);
      return d;
    });
    const pac = actor(pacman(), 'pac');
    scene.append(pac);
    const at = (x) => (x - start) / (end - start);
    return [
      loop(pac, [{ left: `${start}%` }, { left: `${end}%` }]),
      ...dots.map((d, i) => {
        const t = at(xs[i]);
        return loop(d, [{ opacity: 1 }, { opacity: 1, offset: t }, { opacity: 0, offset: Math.min(1, t + 0.01) }, { opacity: 0, offset: 0.97 }, { opacity: 1 }]);
      }),
    ];
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
    bonus.append(pixelText(`+${powerPelletSeconds}`));
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
};

// ---------- Panel ----------

const state = { els: null, options: { runSeconds: 20, powerPelletSeconds: 10, stepSeconds: 6 }, index: 0, running: [], timer: null, active: false };

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
export function setRules({ enabled, stepSeconds, runSeconds, powerPelletSeconds }) {
  if (!state.els) return;
  const changed =
    stepSeconds !== state.options.stepSeconds || runSeconds !== state.options.runSeconds || powerPelletSeconds !== state.options.powerPelletSeconds;
  state.options = { stepSeconds, runSeconds, powerPelletSeconds };
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
