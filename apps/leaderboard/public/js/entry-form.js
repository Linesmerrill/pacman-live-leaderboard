// The staff score-entry form. Shared by /admin and the "+ ADD PLAYER" panel on the TV board,
// so both behave identically: sanitised initials, big −/+ stepper, duplicate guard, no double submits.

import { api } from './api.js';
import { confirmDialog, toast } from './dialogs.js';
import { cleanInitials, h, newId } from './dom.js';
import { DEFAULT_SCORING, FRUITS, scoreRun } from './scoring.js';
import { FRUIT_ART } from './sprites.js';

const COOLDOWN_MS = 700;

/**
 * @param {{
 *   onAdded?: (result: { entry: object, isNewHighScore: boolean }) => void,
 *   onCancel?: (() => void) | null,   // when set, a Cancel button is shown and Esc calls it
 *   onActivity?: () => void,          // any typing/tapping (used by the TV panel's idle timer)
 * }} options
 */
export function createEntryForm({ onAdded = () => {}, onCancel = null, onActivity = () => {} } = {}) {
  let submissionId = newId();
  let busy = false;
  let timeEnabled = false;
  let maxScore = 999;
  let scoring = DEFAULT_SCORING;
  /** What the staff tapped: fruit id → how many, and ghosts tagged. Never saved — only the total is. */
  const run = { fruit: {}, ghosts: 0 };

  const errorEl = (id) => h('p', { class: 'field-error', id, role: 'alert' });
  const errorEls = { initials: errorEl('entry-initials-error'), score: errorEl('entry-dots-error'), timeSeconds: errorEl('entry-time-error') };

  const initialsEl = h('input', {
    id: 'entry-initials', class: 'initials-input', maxlength: '3', autocapitalize: 'characters', autocorrect: 'off',
    spellcheck: 'false', autocomplete: 'off', enterkeyhint: 'next', placeholder: 'ABC', 'aria-describedby': 'entry-initials-error',
  });
  const dotsEl = h('input', {
    id: 'entry-dots', class: 'dots-input', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '3', enterkeyhint: 'done',
    placeholder: '0', 'aria-describedby': 'entry-dots-error',
  });
  const timeEl = h('input', {
    id: 'entry-time', class: 'time-input', inputmode: 'decimal', enterkeyhint: 'done', placeholder: 'e.g. 42.5', 'aria-describedby': 'entry-time-error',
  });
  const minusBtn = h('button', { type: 'button', class: 'step-btn', 'aria-label': 'One point fewer' }, '−');
  const plusBtn = h('button', { type: 'button', class: 'step-btn', 'aria-label': 'One point more' }, '+');

  // ---------- score calculator: tap the fruit they brought back, count the ghosts ----------
  const fruitGrid = h('div', { class: 'fruit-grid' });
  const ghostCount = h('output', { class: 'ghost-count', 'aria-live': 'polite' }, '0');
  const ghostPointsEl = h('span', { class: 'ghost-points' });
  const ghostMinus = h('button', { type: 'button', class: 'step-btn small', 'aria-label': 'One ghost fewer' }, '−');
  const ghostPlus = h('button', { type: 'button', class: 'step-btn small', 'aria-label': 'One ghost more' }, '+');
  const breakdownEl = h('p', { class: 'breakdown', 'aria-live': 'polite' });
  const clearRunBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-small clear-run' }, 'Clear');
  const calculator = h('div', { class: 'field calculator' },
    h('div', { class: 'field-label' }, 'Fruit collected', h('span', { class: 'hint' }, 'tap a fruit for each bean bag · tap − to take one off')),
    fruitGrid,
    h('div', { class: 'ghost-row' },
      h('span', { class: 'ghost-label' }, 'Ghosts tagged'),
      h('div', { class: 'stepper small' }, ghostMinus, ghostCount, ghostPlus),
      ghostPointsEl,
      clearRunBtn),
    breakdownEl);
  const summaryEl = h('p', { class: 'summary', 'aria-live': 'polite' });
  const submitBtn = h('button', { type: 'submit', class: 'btn btn-primary btn-huge' }, 'ADD TO LEADERBOARD');
  const formError = h('p', { class: 'banner-error', role: 'alert', hidden: true });
  const inputForField = { initials: initialsEl, score: dotsEl, timeSeconds: timeEl };

  const label = (forId, text, hint) => h('label', { class: 'field-label', for: forId }, text, h('span', { class: 'hint' }, hint));
  const timeField = h('div', { class: 'field', hidden: true },
    label('entry-time', 'Completion time', 'seconds · leave blank if not timed'), timeEl, errorEls.timeSeconds);

  const form = h('form', { class: 'entry-form', autocomplete: 'off', novalidate: true },
    h('div', { class: 'field' }, label('entry-initials', 'Player', '3 letters or numbers'), initialsEl, errorEls.initials),
    calculator,
    h('div', { class: 'field' },
      label('entry-dots', 'Score', 'added up from the fruit and ghosts — or type it'),
      h('div', { class: 'stepper' }, minusBtn, dotsEl, plusBtn),
      errorEls.score),
    timeField,
    summaryEl,
    h('div', { class: 'entry-actions' },
      onCancel ? h('button', { type: 'button', class: 'btn btn-ghost btn-cancel', onclick: () => onCancel() }, 'Cancel') : null,
      submitBtn),
    formError,
    h('p', { class: 'keys-hint' }, `Enter moves to the next box and adds the score · Esc ${onCancel ? 'closes' : 'clears the form'}`),
  );

  // ---------- helpers ----------

  function setFieldError(field, message) {
    errorEls[field].textContent = message;
    inputForField[field].classList.toggle('invalid', Boolean(message));
  }

  function clearErrors() {
    for (const field of Object.keys(errorEls)) setFieldError(field, '');
    formError.hidden = true;
  }

  const dotsValue = () => (dotsEl.value === '' ? null : Number(dotsEl.value));

  function updateSummary() {
    const initials = initialsEl.value;
    const dots = dotsValue();
    let text;
    let ready = false;
    if (initials.length < 3) {
      text = initials.length === 0 ? 'Type the player’s 3-character code.' : `Player code needs ${3 - initials.length} more character${initials.length === 2 ? '' : 's'}.`;
    } else if (dots === null) {
      text = `${initials}: now tap the fruit they collected, or type the score.`;
    } else {
      const time = timeEnabled && timeEl.value.trim() !== '' ? ` in ${timeEl.value.trim()}s` : '';
      text = `Ready: ${initials} with ${dots} point${dots === 1 ? '' : 's'}${time}.`;
      ready = true;
    }
    summaryEl.textContent = text;
    summaryEl.classList.toggle('ready', ready);
    submitBtn.classList.toggle('is-ready', ready);
  }

  // ---------- calculator ----------

  function renderFruit() {
    const inPlay = FRUITS.filter((fruit) => scoring.fruits[fruit.id]?.enabled);
    fruitGrid.replaceChildren(
      ...inPlay.map((fruit) => {
        const count = run.fruit[fruit.id] ?? 0;
        const tile = h('button', {
          type: 'button', class: `fruit-tile${count ? ' picked' : ''}`,
          'aria-label': `${fruit.name}, ${scoring.fruits[fruit.id].points} points${count ? `, ${count} so far` : ''}. Add one.`,
          onclick: () => changeFruit(fruit.id, 1),
        });
        tile.innerHTML = FRUIT_ART[fruit.id]();
        tile.append(h('span', { class: 'fruit-name' }, fruit.name), h('span', { class: 'fruit-pts' }, `${scoring.fruits[fruit.id].points} pts`));
        if (count) tile.append(h('span', { class: 'fruit-count' }, `×${count}`));
        const wrap = h('div', { class: 'fruit-cell' }, tile);
        if (count) {
          wrap.append(h('button', { type: 'button', class: 'fruit-minus', 'aria-label': `Take one ${fruit.name} off`, onclick: () => changeFruit(fruit.id, -1) }, '−'));
        }
        return wrap;
      }),
    );
  }

  function renderRun() {
    renderFruit();
    ghostCount.textContent = String(run.ghosts);
    const { total, parts } = scoreRun(run, scoring);
    const ghostPart = parts.find((part) => part.label.startsWith('Ghost'));
    ghostPointsEl.textContent = ghostPart ? `+${ghostPart.points} pts` : '';
    breakdownEl.textContent = parts.length
      ? `${parts.map((p) => `${p.count > 1 || p.label.startsWith('Ghost') ? `${p.count}× ` : ''}${p.label} ${p.points}`).join(' + ')} = ${total}`
      : '';
    clearRunBtn.hidden = !parts.length;
  }

  /** A tap on the calculator: update the tally and put the new total in the Score box. */
  function recalc() {
    renderRun();
    const { total, parts } = scoreRun(run, scoring);
    dotsEl.value = parts.length ? String(total) : '';
    setFieldError('score', total > maxScore ? `That adds up to ${total} — the board only goes to ${maxScore}.` : '');
    updateSummary();
    onActivity();
  }

  function changeFruit(id, delta) {
    run.fruit[id] = Math.max(0, Math.min(20, (run.fruit[id] ?? 0) + delta));
    recalc();
  }

  function changeGhosts(delta) {
    run.ghosts = Math.max(0, Math.min(20, run.ghosts + delta));
    recalc();
  }
  ghostMinus.addEventListener('click', () => changeGhosts(-1));
  ghostPlus.addEventListener('click', () => changeGhosts(1));
  clearRunBtn.addEventListener('click', () => {
    run.fruit = {};
    run.ghosts = 0;
    recalc();
  });

  function reset() {
    run.fruit = {};
    run.ghosts = 0;
    renderRun();
    initialsEl.value = '';
    dotsEl.value = '';
    timeEl.value = '';
    clearErrors();
    submissionId = newId();
    updateSummary();
  }

  function step(delta) {
    dotsEl.value = String(Math.min(maxScore, Math.max(0, (dotsValue() ?? 0) + delta)));
    setFieldError('score', '');
    updateSummary();
    onActivity();
  }

  /** Tap for ±1; press and hold to keep counting. */
  function bindStepper(button, delta) {
    let holdTimer = null;
    let repeatTimer = null;
    const stop = () => {
      clearTimeout(holdTimer);
      clearInterval(repeatTimer);
    };
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault(); // keep focus (and any on-screen keyboard) where it is
      step(delta);
      holdTimer = setTimeout(() => {
        repeatTimer = setInterval(() => step(delta), 80);
      }, 450);
    });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, stop);
    // Keyboard activation (Space/Enter) arrives as a click with detail 0.
    button.addEventListener('click', (event) => {
      if (event.detail === 0) step(delta);
    });
  }
  bindStepper(minusBtn, -1);
  bindStepper(plusBtn, +1);

  // ---------- inputs ----------

  initialsEl.addEventListener('input', (event) => {
    const clean = cleanInitials(initialsEl.value);
    if (clean !== initialsEl.value) initialsEl.value = clean;
    setFieldError('initials', '');
    updateSummary();
    onActivity();
    // Jump to the Score box the moment the third character is typed (synchronously, so fast
    // typists' next keystroke lands in the right box).
    if (event.inputType === 'insertText' && clean.length === 3) {
      dotsEl.focus();
      dotsEl.select();
    }
  });

  initialsEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (initialsEl.value.length === 3) dotsEl.focus();
      else setFieldError('initials', 'Enter exactly 3 letters or numbers.');
      return;
    }
    // Initials already full and nothing selected: a digit belongs to the score.
    const full = initialsEl.value.length === 3 && initialsEl.selectionStart === initialsEl.selectionEnd;
    if (full && /^[0-9]$/.test(event.key) && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      dotsEl.focus();
      dotsEl.value = `${dotsEl.value}${event.key}`.slice(0, String(maxScore).length);
      dotsEl.dispatchEvent(new Event('input'));
    }
  });

  dotsEl.addEventListener('input', () => {
    const clean = dotsEl.value.replace(/\D/g, '').slice(0, String(maxScore).length);
    if (clean !== dotsEl.value) dotsEl.value = clean;
    setFieldError('score', '');
    updateSummary();
    onActivity();
  });

  dotsEl.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      step(event.key === 'ArrowUp' ? 1 : -1);
    }
  });

  timeEl.addEventListener('input', () => {
    const clean = timeEl.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 7);
    if (clean !== timeEl.value) timeEl.value = clean;
    setFieldError('timeSeconds', '');
    updateSummary();
    onActivity();
  });

  form.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    if (onCancel) onCancel();
    else {
      reset();
      initialsEl.focus();
    }
  });

  // ---------- submit ----------

  function clientValidate() {
    if (initialsEl.value.length !== 3) {
      setFieldError('initials', 'Enter exactly 3 letters or numbers.');
      initialsEl.focus();
      return false;
    }
    if (dotsValue() === null) {
      setFieldError('score', 'Tap the fruit they collected, or type their score.');
      dotsEl.focus();
      return false;
    }
    return true;
  }

  async function submit(confirmDuplicate = false) {
    if (busy) return;
    clearErrors();
    if (!clientValidate()) return;

    busy = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'ADDING…';
    const payload = {
      initials: initialsEl.value,
      score: dotsValue(),
      timeSeconds: timeEnabled && timeEl.value.trim() !== '' ? Number(timeEl.value) : null,
      submissionId,
      confirmDuplicate,
    };

    let retryAsDuplicate = false;
    try {
      const result = await api('POST', '/api/scores', payload);
      reset();
      onAdded(result);
    } catch (err) {
      if (err.status === 409 && err.body.error === 'possible_duplicate') {
        const { existing, secondsAgo } = err.body;
        const again = await confirmDialog({
          title: 'Same player again?',
          message: `${existing.initials} with ${existing.score} points was added ${secondsAgo} seconds ago. Is this a different player with the same initials and score?`,
          confirmLabel: `Yes, add another ${existing.initials}`,
          cancelLabel: 'No, it’s a repeat',
        });
        if (again) retryAsDuplicate = true;
        else {
          reset();
          initialsEl.focus();
          toast('Not added: the earlier entry is already on the board.', { tone: 'info' });
        }
      } else if (err.status === 422 && errorEls[err.body.field]) {
        setFieldError(err.body.field, err.message);
        inputForField[err.body.field].focus();
        inputForField[err.body.field].select();
      } else {
        formError.textContent = `Score NOT saved. ${err.message}`;
        formError.hidden = false;
      }
    } finally {
      submitBtn.textContent = 'ADD TO LEADERBOARD';
      setTimeout(
        () => {
          busy = false;
          submitBtn.disabled = false;
          if (retryAsDuplicate) void submit(true);
        },
        retryAsDuplicate ? 0 : COOLDOWN_MS,
      );
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit();
  });

  renderRun();
  updateSummary();

  return {
    el: form,
    /** Apply live settings from the leaderboard snapshot. */
    setSettings({ completionTimeEnabled, maxScore: limit, scoring: nextScoring }) {
      maxScore = limit;
      if (nextScoring && JSON.stringify(nextScoring) !== JSON.stringify(scoring)) {
        scoring = nextScoring;
        renderRun(); // new point values or a different set of fruit in the maze
      }
      dotsEl.maxLength = String(limit).length;
      if (timeEnabled !== completionTimeEnabled) {
        timeEnabled = completionTimeEnabled;
        timeField.hidden = !timeEnabled;
        updateSummary();
      }
    },
    focus() {
      initialsEl.focus();
    },
    reset,
    get isEmpty() {
      return initialsEl.value === '' && dotsEl.value === '' && timeEl.value === '';
    },
    get isBusy() {
      return busy;
    },
    /** Start the form with a character typed elsewhere (e.g. straight onto the TV board). */
    typeInitial(ch) {
      initialsEl.value = cleanInitials(initialsEl.value + ch);
      initialsEl.focus();
      initialsEl.setSelectionRange(initialsEl.value.length, initialsEl.value.length);
      updateSummary();
    },
  };
}
