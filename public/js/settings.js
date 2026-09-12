import { api } from './api.js';
import { confirmDialog, editScoreDialog, toast } from './dialogs.js';
import { h } from './dom.js';
import { clockTime, formatTime, ordinal, timeAgo } from './format.js';
import { connectLive } from './live.js';
import { pixelText } from './pixelfont.js';

const $ = (id) => document.getElementById(id);
const els = {
  count: $('count'),
  filter: $('filter'),
  sort: $('sort'),
  scores: $('scores'),
  scoresEmpty: $('scores-empty'),
  timeToggle: $('time-toggle'),
  timeToggleLabel: $('time-toggle-label'),
  soundToggle: $('sound-toggle'),
  soundToggleLabel: $('sound-toggle-label'),
  builtinCount: $('builtin-count'),
  deny: $('deny'),
  denySave: $('deny-save'),
  denyMsg: $('deny-msg'),
  exportBtn: $('export'),
  backupBtn: $('backup'),
  backupMsg: $('backup-msg'),
  resetBtn: $('reset'),
  status: $('status'),
  statusText: $('status-text'),
};

const state = { scores: [], settings: null, maxScore: 999, denyDirty: false };

$('brand').append(pixelText('PAC-MAN MAZE'));

// ---------- Scores table ----------

function visibleScores() {
  const query = els.filter.value.trim().toUpperCase();
  const list = state.scores.filter((s) => !query || s.initials.includes(query));
  if (els.sort.value === 'newest') list.sort((a, b) => b.createdAt - a.createdAt);
  return list;
}

function renderScores() {
  const showTime = Boolean(state.settings?.completionTimeEnabled) || state.scores.some((s) => s.timeSeconds !== null);
  document.body.classList.toggle('hide-time', !showTime);
  els.count.textContent = String(state.scores.length);
  const rows = visibleScores();
  els.scoresEmpty.hidden = rows.length > 0;
  els.scoresEmpty.textContent = state.scores.length ? 'No scores match that filter.' : 'No scores yet.';
  els.scores.replaceChildren(
    ...rows.map((s) =>
      h(
        'tr',
        { class: s.flagged ? 'flagged' : '' },
        h('td', { class: 'rank' }, ordinal(s.rank).toLowerCase()),
        h('td', { class: 'player' }, h('span', { class: 'mono big-initials' }, s.initials), s.flagged ? h('span', { class: 'badge badge-danger', title: 'Matches the blocked list — edit or delete it' }, 'Blocked word') : null),
        h('td', { class: 'num score' }, String(s.score)),
        h('td', { class: 'num time-col' }, s.timeSeconds === null ? '—' : formatTime(s.timeSeconds)),
        h('td', { class: 'entered' }, clockTime(s.createdAt), h('small', {}, ` · ${timeAgo(s.createdAt)}`)),
        h('td', { class: 'actions' },
          h('button', { class: 'btn btn-small', type: 'button', title: 'Show this player’s spot on the TV', onclick: () => showOnTv(s) }, 'Show on TV'),
          h('button', { class: 'btn btn-small', type: 'button', onclick: () => editEntry(s) }, 'Edit'),
          h('button', { class: 'btn btn-small btn-danger-ghost', type: 'button', onclick: () => deleteEntry(s) }, 'Delete'),
        ),
      ),
    ),
  );
}

async function load() {
  try {
    const { scores, settings } = await api('GET', '/api/scores');
    state.scores = scores;
    state.settings = settings;
    renderSettings();
    renderScores();
  } catch (err) {
    toast(err.message, { tone: 'error', duration: 5000 });
  }
}

async function showOnTv(entry) {
  try {
    await api('POST', `/api/scores/${entry.id}/spotlight`);
    toast(`${entry.initials} is on the TV now.`, { tone: 'info' });
  } catch (err) {
    toast(err.message, { tone: 'error' });
  }
}

async function editEntry(entry) {
  const saved = await editScoreDialog({
    entry,
    showTime: Boolean(state.settings?.completionTimeEnabled) || entry.timeSeconds !== null,
    maxScore: state.maxScore,
    onSave: (values) => api('PUT', `/api/scores/${entry.id}`, values),
  });
  if (saved) {
    toast('Score updated — the TV has been refreshed.', { tone: 'ok' });
    await load();
  }
}

async function deleteEntry(entry) {
  const ok = await confirmDialog({
    title: `Delete ${entry.initials}?`,
    message: `This removes ${entry.initials} — ${entry.score} Pac-Dots (${ordinal(entry.rank).toLowerCase()} place) from the leaderboard.`,
    confirmLabel: 'Delete score',
    tone: 'danger',
  });
  if (!ok) return;
  try {
    await api('DELETE', `/api/scores/${entry.id}`);
    toast(`${entry.initials} deleted.`, { tone: 'info' });
  } catch (err) {
    toast(err.message, { tone: 'error' });
  }
  await load();
}

els.filter.addEventListener('input', () => {
  els.filter.value = els.filter.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  renderScores();
});
els.sort.addEventListener('change', renderScores);

// ---------- Settings ----------

function renderSettings() {
  const { completionTimeEnabled, soundEnabled, customDenyList, builtInDenyListSize } = state.settings;
  els.timeToggle.checked = completionTimeEnabled;
  els.timeToggleLabel.textContent = completionTimeEnabled ? 'On — TIME column shown' : 'Off — ranked by Pac-Dots only';
  els.soundToggle.checked = soundEnabled;
  els.soundToggleLabel.textContent = soundEnabled ? 'On — the TV plays arcade sounds' : 'Off — the TV is silent';
  els.builtinCount.textContent = String(builtInDenyListSize);
  if (!state.denyDirty && document.activeElement !== els.deny) els.deny.value = customDenyList.join(' ');
}

els.timeToggle.addEventListener('change', async () => {
  const enabled = els.timeToggle.checked;
  try {
    const { settings } = await api('PUT', '/api/settings', { completionTimeEnabled: enabled });
    state.settings = settings;
    toast(enabled ? 'Completion timer ON. Staff will see a time box.' : 'Completion timer OFF.', { tone: 'info' });
  } catch (err) {
    els.timeToggle.checked = !enabled;
    toast(err.message, { tone: 'error' });
  }
  renderSettings();
  renderScores();
});

els.soundToggle.addEventListener('change', async () => {
  const enabled = els.soundToggle.checked;
  try {
    const { settings } = await api('PUT', '/api/settings', { soundEnabled: enabled });
    state.settings = settings;
    toast(enabled ? 'Sound effects ON.' : 'Sound effects OFF.', { tone: 'info' });
  } catch (err) {
    els.soundToggle.checked = !enabled;
    toast(err.message, { tone: 'error' });
  }
  renderSettings();
});

els.deny.addEventListener('input', () => {
  state.denyDirty = true;
  els.denyMsg.textContent = 'Unsaved changes';
});

els.denySave.addEventListener('click', async () => {
  try {
    const { settings, rejectedDenyEntries } = await api('PUT', '/api/settings', { customDenyList: els.deny.value });
    state.settings = settings;
    state.denyDirty = false;
    els.deny.value = settings.customDenyList.join(' ');
    els.denyMsg.textContent = rejectedDenyEntries.length
      ? `Saved. Ignored (must be exactly 3 of A–Z, 0–9, ?): ${rejectedDenyEntries.join(', ')}`
      : `Saved ${settings.customDenyList.length} blocked code${settings.customDenyList.length === 1 ? '' : 's'}.`;
    await load();
  } catch (err) {
    els.denyMsg.textContent = err.message;
  }
});

// ---------- Backup / export / reset ----------

els.exportBtn.addEventListener('click', async () => {
  try {
    const res = await api('GET', '/api/export.csv', undefined, { raw: true });
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'pacman-maze-scores.csv';
    const link = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  } catch (err) {
    toast(err.message, { tone: 'error' });
  }
});

els.backupBtn.addEventListener('click', async () => {
  els.backupBtn.disabled = true;
  try {
    const { file } = await api('POST', '/api/backup');
    els.backupMsg.textContent = `Backup saved: ${file}`;
    toast('Backup saved.', { tone: 'ok' });
  } catch (err) {
    toast(err.message, { tone: 'error' });
  } finally {
    els.backupBtn.disabled = false;
  }
});

els.resetBtn.addEventListener('click', async () => {
  const total = state.scores.length;
  const ok = await confirmDialog({
    title: 'Clear the whole leaderboard?',
    message: `All ${total} score${total === 1 ? '' : 's'} will disappear from the TV. A backup copy is saved first, so this can be recovered — but only by restoring a file on this Mac.`,
    confirmLabel: 'Clear leaderboard',
    tone: 'danger',
    requireText: 'RESET',
  });
  if (!ok) return;
  try {
    const { deleted, backupFile } = await api('POST', '/api/reset', { confirm: 'RESET' });
    toast(`Leaderboard cleared (${deleted} scores).`, { tone: 'info', duration: 5000 });
    els.backupMsg.textContent = backupFile ? `Pre-reset backup: ${backupFile}` : '';
  } catch (err) {
    toast(err.message, { tone: 'error' });
  }
  await load();
});

// ---------- Live ----------

connectLive({
  onUpdate: ({ reason, snapshot }) => {
    state.maxScore = snapshot.maxScore;
    if (reason !== 'poll' && reason !== 'spotlight') void load();
  },
  onStatus: (status) => {
    els.status.dataset.state = status;
    els.statusText.textContent = status === 'live' ? 'Connected' : 'Server offline';
  },
});
setInterval(renderScores, 30_000);
