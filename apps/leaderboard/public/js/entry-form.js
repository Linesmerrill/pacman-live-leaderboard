// The staff score-entry form. Shared by /admin and the "+ ADD PLAYER" panel on the TV board,
// so both behave identically: sanitised initials, big −/+ stepper, duplicate guard, no double submits.

import { api } from './api.js';
import { confirmDialog, toast } from './dialogs.js';
import { cleanInitials, h, newId } from './dom.js';

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
  const minusBtn = h('button', { type: 'button', class: 'step-btn', 'aria-label': 'One fewer Pac-Dot' }, '−');
  const plusBtn = h('button', { type: 'button', class: 'step-btn', 'aria-label': 'One more Pac-Dot' }, '+');
  const summaryEl = h('p', { class: 'summary', 'aria-live': 'polite' });
  const submitBtn = h('button', { type: 'submit', class: 'btn btn-primary btn-huge' }, 'ADD TO LEADERBOARD');
  const formError = h('p', { class: 'banner-error', role: 'alert', hidden: true });
  const inputForField = { initials: initialsEl, score: dotsEl, timeSeconds: timeEl };

  const label = (forId, text, hint) => h('label', { class: 'field-label', for: forId }, text, h('span', { class: 'hint' }, hint));
  const timeField = h('div', { class: 'field', hidden: true },
    label('entry-time', 'Completion time', 'seconds · leave blank if not timed'), timeEl, errorEls.timeSeconds);

  const form = h('form', { class: 'entry-form', autocomplete: 'off', novalidate: true },
    h('div', { class: 'field' }, label('entry-initials', 'Player', '3 letters or numbers'), initialsEl, errorEls.initials),
    h('div', { class: 'field' },
      label('entry-dots', 'Pac-Dots collected', '1 Pac-Dot = 1 point'),
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
      text = `${initials}: now enter the Pac-Dots collected.`;
    } else {
      const time = timeEnabled && timeEl.value.trim() !== '' ? ` in ${timeEl.value.trim()}s` : '';
      text = `Ready: ${initials} with ${dots} Pac-Dot${dots === 1 ? '' : 's'}${time}.`;
      ready = true;
    }
    summaryEl.textContent = text;
    summaryEl.classList.toggle('ready', ready);
    submitBtn.classList.toggle('is-ready', ready);
  }

  function reset() {
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
    // Jump to the Pac-Dots box the moment the third character is typed (synchronously, so fast
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
    // Initials already full and nothing selected: a digit belongs to the Pac-Dots count.
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
      setFieldError('score', 'Enter how many Pac-Dots the player collected.');
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
          message: `${existing.initials} with ${existing.score} Pac-Dots was added ${secondsAgo} seconds ago. Is this a different player with the same initials and score?`,
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

  updateSummary();

  return {
    el: form,
    /** Apply live settings from the leaderboard snapshot. */
    setSettings({ completionTimeEnabled, maxScore: limit }) {
      maxScore = limit;
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
