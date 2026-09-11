import { api } from './api.js';
import { confirmDialog, editScoreDialog, toast } from './dialogs.js';
import { h } from './dom.js';
import { createEntryForm } from './entry-form.js';
import { formatTime, ordinal, timeAgo } from './format.js';
import { connectLive } from './live.js';
import { pixelText } from './pixelfont.js';

const RECENT_COUNT = 8;

const $ = (id) => document.getElementById(id);
const recentList = $('recent');
const recentEmpty = $('recent-empty');
const statusEl = $('status');
const statusText = $('status-text');

let recentScores = [];
let snapshot = null;

$('brand').append(pixelText('PAC-MAN MAZE'));

function celebrate({ entry, isNewHighScore }) {
  if (isNewHighScore) {
    toast(h('span', {}, h('strong', {}, '★ NEW HIGH SCORE! '), `${entry.initials}: ${entry.score} Pac-Dots`), { tone: 'gold', duration: 4500 });
  } else {
    toast(h('span', {}, h('strong', {}, `✓ ${entry.initials} added `), `${entry.score} Pac-Dots · ${ordinal(entry.rank).toLowerCase()} place`), { tone: 'ok' });
  }
}

const entryForm = createEntryForm({
  onAdded: (result) => {
    celebrate(result);
    entryForm.focus();
    void loadRecent();
  },
});
$('entry-root').append(entryForm.el);

// ---------- Recent entries ----------

function renderRecent() {
  const recent = [...recentScores].sort((a, b) => b.createdAt - a.createdAt).slice(0, RECENT_COUNT);
  recentEmpty.hidden = recent.length > 0;
  recentList.replaceChildren(
    ...recent.map((entry) =>
      h(
        'li',
        { class: `recent-item${entry.flagged ? ' flagged' : ''}` },
        h('span', { class: 'recent-initials' }, entry.initials),
        h('span', { class: 'recent-score' }, `${entry.score}`, h('small', {}, ' dots')),
        h('span', { class: 'recent-meta' }, `${ordinal(entry.rank).toLowerCase()}${entry.timeSeconds !== null ? ` · ${formatTime(entry.timeSeconds)}` : ''} · ${timeAgo(entry.createdAt)}`),
        entry.flagged ? h('span', { class: 'badge badge-danger', title: 'Matches the blocked list' }, 'Blocked word') : null,
        h('span', { class: 'recent-actions' },
          h('button', { class: 'btn btn-small', type: 'button', title: 'Show this player’s spot on the TV again', onclick: () => showOnTv(entry) }, 'Show on TV'),
          h('button', { class: 'btn btn-small', type: 'button', onclick: () => editEntry(entry) }, 'Edit'),
          h('button', { class: 'btn btn-small btn-danger-ghost', type: 'button', onclick: () => deleteEntry(entry) }, 'Delete'),
        ),
      ),
    ),
  );
}

async function loadRecent() {
  try {
    const { scores } = await api('GET', '/api/scores');
    recentScores = scores;
    renderRecent();
  } catch (err) {
    if (err.status !== 0) console.warn(err);
  }
}

async function showOnTv(entry) {
  try {
    await api('POST', `/api/scores/${entry.id}/spotlight`);
    toast(`${entry.initials} is on the TV now. Say cheese!`, { tone: 'info' });
  } catch (err) {
    toast(err.message, { tone: 'error' });
  }
}

async function editEntry(entry) {
  const saved = await editScoreDialog({
    entry,
    showTime: Boolean(snapshot?.completionTimeEnabled) || entry.timeSeconds !== null,
    maxScore: snapshot?.maxScore ?? 999,
    onSave: (values) => api('PUT', `/api/scores/${entry.id}`, values),
  });
  if (saved) {
    toast('Score updated.', { tone: 'ok' });
    void loadRecent();
  }
  entryForm.focus();
}

async function deleteEntry(entry) {
  const ok = await confirmDialog({
    title: `Delete ${entry.initials}?`,
    message: `This removes ${entry.initials} (${entry.score} Pac-Dots) from the leaderboard.`,
    confirmLabel: 'Delete score',
    tone: 'danger',
  });
  if (ok) {
    try {
      await api('DELETE', `/api/scores/${entry.id}`);
      toast(`${entry.initials} deleted.`, { tone: 'info' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
    void loadRecent();
  }
  entryForm.focus();
}

// ---------- Live connection ----------

connectLive({
  onUpdate: (message) => {
    snapshot = message.snapshot;
    entryForm.setSettings(snapshot);
    if (message.reason !== 'poll' && message.reason !== 'spotlight') void loadRecent();
  },
  onStatus: (state) => {
    statusEl.dataset.state = state;
    statusText.textContent = state === 'live' ? 'Connected' : 'Server offline';
  },
});
setInterval(renderRecent, 30_000);

entryForm.focus();
