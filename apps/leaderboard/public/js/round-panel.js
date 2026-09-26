// The prize round, for staff: the clock, and who won last round so the candy goes to the right kids.
// Used on the score-entry page (read-only) and in Manage scores (with End / Restart controls).

import { api } from './api.js';
import { confirmDialog, toast } from './dialogs.js';
import { h } from './dom.js';
import { ordinal } from './format.js';

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Which winners have had their candy, per round — this browser only, just a staff checklist. */
function givenKey(round) {
  return `pacman-candy-given-${round.number}-${round.endedAt}`;
}
function readGiven(round) {
  try {
    return new Set(JSON.parse(localStorage.getItem(givenKey(round)) ?? '[]'));
  } catch {
    return new Set();
  }
}
function writeGiven(round, given) {
  try {
    localStorage.setItem(givenKey(round), JSON.stringify([...given]));
  } catch {
    // private window or storage blocked: the ticks just won't survive a reload
  }
}

export function createRoundPanel({ controls = false } = {}) {
  let round = null;
  const statusEl = h('p', { class: 'round-status' });
  const winnersEl = h('div', { class: 'round-winners-staff' });
  const endBtn = h('button', { type: 'button', class: 'btn btn-ghost' }, 'End round now');
  const restartBtn = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Restart the clock');
  const el = h('div', { class: 'round-panel' }, statusEl, controls ? h('div', { class: 'row-actions' }, endBtn, restartBtn) : null, winnersEl);

  function renderStatus() {
    if (!round || !round.enabled) {
      statusEl.textContent = 'Prize rounds are off.';
      statusEl.dataset.state = 'off';
    } else if (round.endsAt) {
      const at = new Date(round.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      statusEl.textContent = `Round ${round.number} ends at ${at} — ${clock(round.endsAt - Date.now())} left. Top ${round.prizeCount} win.`;
      statusEl.dataset.state = 'running';
    } else {
      statusEl.textContent = `Round ${round.number} starts with its first score. Top ${round.prizeCount} win.`;
      statusEl.dataset.state = 'waiting';
    }
    endBtn.disabled = !round?.enabled || !round.endsAt;
    restartBtn.disabled = !round?.enabled;
  }

  function renderWinners() {
    const last = round?.lastRound;
    if (!last) {
      winnersEl.replaceChildren();
      return;
    }
    const given = readGiven(last);
    const ended = new Date(last.endedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    winnersEl.replaceChildren(
      h('h3', {}, `Round ${last.number} winners`, h('span', { class: 'hint' }, ` · ended ${ended} · tick each kid off as they get their candy`)),
      h('ul', { class: 'winner-list' },
        ...last.winners.map((w, i) => {
          const id = `${i}-${w.initials}`;
          const box = h('input', { type: 'checkbox', checked: given.has(id), 'aria-label': `Candy given to ${w.initials}` });
          box.addEventListener('change', () => {
            if (box.checked) given.add(id);
            else given.delete(id);
            writeGiven(last, given);
            li.classList.toggle('given', box.checked);
          });
          const li = h('li', { class: given.has(id) ? 'given' : '' },
            h('label', {}, box, h('span', { class: 'w-rank' }, ordinal(w.rank)), h('span', { class: 'w-name' }, w.initials), h('span', { class: 'w-score' }, `${w.score} pts`)));
          return li;
        })),
    );
  }

  endBtn.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: `End round ${round.number} now?`,
      message: `Everyone in the top ${round.prizeCount} right now wins, and the board clears for round ${round.number + 1} (it's backed up first).`,
      confirmLabel: 'End round',
    });
    if (!ok) return;
    try {
      await api('POST', '/api/round/end');
      toast(`Round ${round.number} ended.`, { tone: 'ok' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  });
  restartBtn.addEventListener('click', async () => {
    try {
      const { round: next } = await api('POST', '/api/round/restart');
      toast(`Round ${next.number} now ends at ${new Date(next.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`, { tone: 'ok' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  });

  setInterval(renderStatus, 1000);

  return {
    el,
    update(snapshot) {
      const winnersKey = JSON.stringify(snapshot.round?.lastRound ?? null);
      const changed = winnersKey !== JSON.stringify(round?.lastRound ?? null);
      round = snapshot.round ?? null;
      renderStatus();
      if (changed) renderWinners();
    },
  };
}
