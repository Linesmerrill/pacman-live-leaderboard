import { createRoundPanel } from './round-panel.js';
import { DEFAULT_SCORING, FRUITS } from './scoring.js';
import { FRUIT_ART } from './sprites.js';
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
  runSeconds: $('run-seconds'),
  pelletSeconds: $('pellet-seconds'),
  maxPellets: $('max-pellets'),
  runSave: $('run-save'),
  runMsg: $('run-msg'),
  roundsToggle: $('rounds-toggle'),
  roundsToggleLabel: $('rounds-toggle-label'),
  roundMinutes: $('round-minutes'),
  prizeCount: $('prize-count'),
  roundsSave: $('rounds-save'),
  scoringFruit: $('scoring-fruit'),
  scoringGhosts: $('scoring-ghosts'),
  scoringSave: $('scoring-save'),
  scoringDefaults: $('scoring-defaults'),
  scoringMsg: $('scoring-msg'),
  rulesToggle: $('rules-toggle'),
  rulesToggleLabel: $('rules-toggle-label'),
  rulesPercent: $('rules-percent'),
  rulesPercentLabel: $('rules-percent-label'),
  rulesSeconds: $('rules-seconds'),
  rulesSecondsLabel: $('rules-seconds-label'),
  idleToggle: $('idle-toggle'),
  idleToggleLabel: $('idle-toggle-label'),
  idleVolume: $('idle-volume'),
  idleVolumeLabel: $('idle-volume-label'),
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
    message: `This removes ${entry.initials} — ${entry.score} points (${ordinal(entry.rank).toLowerCase()} place) from the leaderboard.`,
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
  els.timeToggleLabel.textContent = completionTimeEnabled ? 'On — TIME column shown' : 'Off — ranked by score only';
  els.soundToggle.checked = soundEnabled;
  els.soundToggleLabel.textContent = soundEnabled ? 'On — the TV plays arcade sounds' : 'Off — the TV is silent';

  const { runSeconds, powerPelletSeconds, maxPellets, idleMusicEnabled, idleMusicVolume } = state.settings;
  if (document.activeElement !== els.runSeconds) els.runSeconds.value = String(runSeconds);
  if (document.activeElement !== els.pelletSeconds) els.pelletSeconds.value = String(powerPelletSeconds);
  if (document.activeElement !== els.maxPellets) els.maxPellets.value = String(maxPellets);
  els.idleToggle.checked = idleMusicEnabled;
  els.idleToggleLabel.textContent = idleMusicEnabled ? 'On — plays between runs' : 'Off — silence between runs';
  if (document.activeElement !== els.idleVolume) els.idleVolume.value = String(idleMusicVolume);
  els.idleVolumeLabel.textContent = `${idleMusicVolume}%`;
  if (!state.scoringDirty) renderScoring(state.settings.scoring);
  const { roundsEnabled, roundMinutes, prizeCount } = state.settings;
  els.roundsToggle.checked = roundsEnabled;
  els.roundsToggleLabel.textContent = roundsEnabled ? 'On — top players win, then the board starts fresh' : 'Off — one leaderboard all night';
  if (document.activeElement !== els.roundMinutes) els.roundMinutes.value = String(roundMinutes);
  if (document.activeElement !== els.prizeCount) els.prizeCount.value = String(prizeCount);
  const { rulesEnabled, rulesPercent, rulesStepSeconds } = state.settings;
  els.rulesToggle.checked = rulesEnabled;
  els.rulesToggleLabel.textContent = rulesEnabled ? 'On — rules beside the leaderboard' : 'Off — leaderboard fills the screen';
  els.rulesPercent.disabled = !rulesEnabled;
  els.rulesSeconds.disabled = !rulesEnabled;
  if (document.activeElement !== els.rulesPercent) els.rulesPercent.value = String(rulesPercent);
  if (document.activeElement !== els.rulesSeconds) els.rulesSeconds.value = String(rulesStepSeconds);
  els.rulesPercentLabel.textContent = `${els.rulesPercent.value}% of the screen`;
  els.rulesSecondsLabel.textContent = `${els.rulesSeconds.value} seconds`;
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

els.runSave.addEventListener('click', async () => {
  const patch = {
    runSeconds: Number(els.runSeconds.value),
    powerPelletSeconds: Number(els.pelletSeconds.value),
    maxPellets: Number(els.maxPellets.value),
  };
  try {
    const { settings } = await api('PUT', '/api/settings', patch);
    state.settings = settings;
    const limit = settings.runSeconds === 0 ? 'no time limit' : `${settings.runSeconds}s runs`;
    const most = settings.runSeconds === 0 ? '' : `, up to ${settings.runSeconds + settings.powerPelletSeconds * settings.maxPellets}s with pellets`;
    els.runMsg.textContent = `Saved: ${limit}${most}.`;
    renderSettings();
  } catch (err) {
    els.runMsg.textContent = err.message;
  }
});

els.idleToggle.addEventListener('change', () => void saveIdleMusic({ idleMusicEnabled: els.idleToggle.checked }));
els.idleVolume.addEventListener('input', () => {
  els.idleVolumeLabel.textContent = `${els.idleVolume.value}%`;
});
els.idleVolume.addEventListener('change', () => void saveIdleMusic({ idleMusicVolume: Number(els.idleVolume.value) }));

// ---------- Prize rounds ----------

const roundPanel = createRoundPanel({ controls: true });
document.getElementById('round-panel-root').append(roundPanel.el);
els.roundsToggle.addEventListener('change', () => void saveIdleMusic({ roundsEnabled: els.roundsToggle.checked }));
els.roundsSave.addEventListener('click', async () => {
  if (!(await saveIdleMusic({ roundMinutes: Number(els.roundMinutes.value), prizeCount: Number(els.prizeCount.value) }))) return;
  toast('Saved. A round that’s already running keeps its end time — use “Restart the clock” to apply a new length now.', { tone: 'ok' });
});

// ---------- Scoring ----------

/** Draws the fruit and ghost rows from a scoring setup (the saved one, or the arcade defaults). */
function renderScoring(scoring) {
  els.scoringFruit.replaceChildren(
    ...FRUITS.map((fruit) => {
      const { points, enabled } = scoring.fruits[fruit.id];
      const art = document.createElement('span');
      art.className = 'scoring-art';
      art.innerHTML = FRUIT_ART[fruit.id]();
      const row = h('label', { class: `scoring-row${enabled ? '' : ' off'}` },
        h('input', { type: 'checkbox', 'data-fruit': fruit.id, 'data-kind': 'enabled', checked: enabled, 'aria-label': `${fruit.name} in the maze` }),
        art,
        h('span', { class: 'scoring-name' }, fruit.name, h('small', {}, `arcade ${fruit.arcade}`)),
        h('input', { type: 'number', min: '0', max: '999', step: '1', inputmode: 'numeric', value: String(points), 'data-fruit': fruit.id, 'data-kind': 'points', 'aria-label': `${fruit.name} points` }),
        h('span', { class: 'hint' }, 'pts'));
      return row;
    }),
  );
  els.scoringGhosts.replaceChildren(
    ...scoring.ghosts.map((value, i) =>
      h('label', { class: 'scoring-ghost' }, h('span', {}, ['1st', '2nd', '3rd', '4th+'][i]),
        h('input', { type: 'number', min: '0', max: '999', step: '1', inputmode: 'numeric', value: String(value), 'data-ghost': String(i), 'aria-label': `Points for ghost ${i + 1}` }))),
  );
}

function readScoring() {
  const fruits = {};
  for (const fruit of FRUITS) {
    fruits[fruit.id] = {
      enabled: els.scoringFruit.querySelector(`[data-fruit="${fruit.id}"][data-kind="enabled"]`).checked,
      points: Number(els.scoringFruit.querySelector(`[data-fruit="${fruit.id}"][data-kind="points"]`).value),
    };
  }
  const ghosts = [...els.scoringGhosts.querySelectorAll('[data-ghost]')].map((input) => Number(input.value));
  return { fruits, ghosts };
}

function markScoringDirty() {
  state.scoringDirty = true;
  els.scoringMsg.textContent = 'Unsaved changes';
}
for (const container of [els.scoringFruit, els.scoringGhosts]) {
  container.addEventListener('input', markScoringDirty);
  container.addEventListener('change', (event) => {
    const row = event.target.closest('.scoring-row');
    if (row && event.target.dataset.kind === 'enabled') row.classList.toggle('off', !event.target.checked);
  });
}
els.scoringDefaults.addEventListener('click', () => {
  renderScoring(DEFAULT_SCORING);
  markScoringDirty();
});
els.scoringSave.addEventListener('click', async () => {
  try {
    const { settings } = await api('PUT', '/api/settings', { scoring: readScoring() });
    state.settings = settings;
    state.scoringDirty = false;
    els.scoringMsg.textContent = '';
    toast('Scoring saved — the entry screens pick it up straight away.', { tone: 'ok' });
  } catch (err) {
    toast(err.message, { tone: 'error' });
  }
  renderSettings();
});

els.rulesToggle.addEventListener('change', () => void saveIdleMusic({ rulesEnabled: els.rulesToggle.checked }));
// Save while the slider moves (lightly throttled) so the TV resizes as you drag, and you can
// stop when it looks right.
let rulesSave = null;
for (const [input, key, label, unit] of [
  [els.rulesPercent, 'rulesPercent', els.rulesPercentLabel, '% of the screen'],
  [els.rulesSeconds, 'rulesStepSeconds', els.rulesSecondsLabel, ' seconds'],
]) {
  input.addEventListener('input', () => {
    label.textContent = `${input.value}${unit}`;
    clearTimeout(rulesSave);
    rulesSave = setTimeout(() => void saveIdleMusic({ [key]: Number(input.value) }), 200);
  });
}

/** Saves a settings change; true when it went through (errors are shown as a toast). */
async function saveIdleMusic(patch) {
  let ok = false;
  try {
    const { settings } = await api('PUT', '/api/settings', patch);
    state.settings = settings;
    ok = true;
  } catch (err) {
    toast(err.message, { tone: 'error' });
  }
  renderSettings();
  return ok;
}

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
    roundPanel.update(snapshot);
    if (reason !== 'poll' && reason !== 'spotlight') void load();
  },
  onStatus: (status) => {
    els.status.dataset.state = status;
    els.statusText.textContent = status === 'live' ? 'Connected' : 'Server offline';
  },
});
setInterval(renderScores, 30_000);
