import { cleanInitials, h } from './dom.js';

function openDialog(content, className = '') {
  const dialog = h('dialog', { class: `ui dialog ${className}` }, content);
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
  return dialog;
}

/**
 * Modal yes/no. With `requireText`, the confirm button stays disabled until that word is typed.
 * Resolves true only when the confirm button is used; Esc / Cancel resolve false.
 */
export function confirmDialog({ title, message, confirmLabel = 'Yes', cancelLabel = 'Cancel', tone = 'primary', requireText = '', focusConfirm = false }) {
  return new Promise((resolve) => {
    let confirmed = false;
    let dialog;
    const input = requireText
      ? h('input', { class: 'text-input confirm-input', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': `Type ${requireText} to confirm` })
      : null;
    const confirmBtn = h('button', { class: `btn btn-${tone}`, type: 'submit', disabled: Boolean(requireText) }, confirmLabel);
    const cancelBtn = h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dialog.close() }, cancelLabel);
    const form = h(
      'form',
      { class: 'dialog-body', method: 'dialog' },
      h('h2', {}, title),
      message ? h('div', { class: 'dialog-message' }, message) : null,
      input ? h('label', { class: 'field-label confirm-label' }, `Type ${requireText} to confirm`, input) : null,
      h('div', { class: 'dialog-actions' }, cancelBtn, confirmBtn),
    );
    input?.addEventListener('input', () => {
      confirmBtn.disabled = input.value.trim().toUpperCase() !== requireText;
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (confirmBtn.disabled) return;
      confirmed = true;
      dialog.close();
    });
    dialog = openDialog(form, `tone-${tone}`);
    dialog.addEventListener('close', () => resolve(confirmed));
    (input ?? (focusConfirm ? confirmBtn : cancelBtn)).focus();
  });
}

/**
 * Edit a score. `onSave(values)` should throw an ApiError on failure; field errors are shown inline.
 * Resolves true when saved.
 */
export function editScoreDialog({ entry, showTime, maxScore, onSave }) {
  return new Promise((resolve) => {
    let saved = false;
    let dialog;
    const errors = {};
    const errorEl = (name) => (errors[name] = h('p', { class: 'field-error', role: 'alert' }));

    const initials = h('input', { class: 'text-input mono big', value: entry.initials, maxlength: '3', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' });
    initials.addEventListener('input', () => {
      initials.value = cleanInitials(initials.value);
    });
    const score = h('input', { class: 'text-input mono big', value: String(entry.score), inputmode: 'numeric', maxlength: String(String(maxScore).length) });
    score.addEventListener('input', () => {
      score.value = score.value.replace(/\D/g, '');
    });
    const time = h('input', { class: 'text-input mono', value: entry.timeSeconds ?? '', inputmode: 'decimal', placeholder: 'blank = not timed' });

    const general = h('p', { class: 'field-error', role: 'alert' });
    const saveBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save changes');
    const form = h(
      'form',
      { class: 'dialog-body', method: 'dialog' },
      h('h2', {}, `Edit ${entry.initials} — ${entry.score} Pac-Dots`),
      h('div', { class: 'dialog-grid' },
        h('label', { class: 'field-label' }, 'Player', initials, errorEl('initials')),
        h('label', { class: 'field-label' }, 'Pac-Dots', score, errorEl('score')),
        showTime ? h('label', { class: 'field-label span-2' }, 'Completion time (seconds)', time, errorEl('timeSeconds')) : null,
      ),
      general,
      h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dialog.close() }, 'Cancel'), saveBtn),
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      Object.values(errors).forEach((el) => (el.textContent = ''));
      general.textContent = '';
      const values = { initials: initials.value, score: score.value === '' ? null : Number(score.value) };
      if (showTime) values.timeSeconds = time.value.trim() === '' ? null : Number(time.value);
      saveBtn.disabled = true;
      try {
        await onSave(values);
        saved = true;
        dialog.close();
      } catch (err) {
        const target = errors[err.body?.field] ?? general;
        target.textContent = err.message;
      } finally {
        saveBtn.disabled = false;
      }
    });

    dialog = openDialog(form);
    dialog.addEventListener('close', () => resolve(saved));
    initials.focus();
    initials.select();
  });
}

/** Ask for the staff PIN. Resolves the PIN, or null if cancelled. */
export function pinDialog(wasWrong) {
  return new Promise((resolve) => {
    let value = null;
    let dialog;
    const input = h('input', { class: 'text-input mono big', type: 'password', inputmode: 'numeric', autocomplete: 'current-password', 'aria-label': 'Staff PIN' });
    const form = h(
      'form',
      { class: 'dialog-body', method: 'dialog' },
      h('h2', {}, 'Staff PIN'),
      h('p', { class: wasWrong ? 'field-error' : 'dialog-message' }, wasWrong ? 'That PIN didn’t work. Try again.' : 'Enter the staff PIN to manage scores.'),
      input,
      h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dialog.close() }, 'Cancel'), h('button', { class: 'btn btn-primary', type: 'submit' }, 'Unlock')),
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      value = input.value.trim();
      dialog.close();
    });
    dialog = openDialog(form);
    dialog.addEventListener('close', () => resolve(value));
    input.focus();
  });
}

let toastTimer = null;
/** Large non-blocking banner at the top of the screen. tone: ok | gold | error | info */
export function toast(content, { tone = 'ok', duration = 3200 } = {}) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = h('div', { class: `ui toast tone-${tone}`, role: 'status', 'aria-live': 'assertive' }, content);
  document.body.append(el);
  toastTimer = setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }, duration);
}
