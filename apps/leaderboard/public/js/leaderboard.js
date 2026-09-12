import { api } from './api.js';
import { confirmDialog } from './dialogs.js';
import { h } from './dom.js';
import { createEntryForm } from './entry-form.js';
import { formatTime, ordinal } from './format.js';
import { connectLive } from './live.js';
import { pageCount, pageForPosition, pageRange, splitColumns } from './paging.js';
import { pixelText, pixelWidth } from './pixelfont.js';
import { isSoundEnabled, play, primeAudio, setLoop, setSoundEnabled, setVolume, soundForEntry } from './sounds.js';
import { FRUIT_BY_RANK, GHOST_COLORS, ghost, pacman, scaredGhost, speaker } from './sprites.js';

const FLASH_MS = 4_400; // matches the .fresh CSS animation (0.55s × 8)
const NEW_TAG_MS = 20_000;
const OVERLAY_MS = 6_500;
const WIPE_MS = 900; // matches the .wipe CSS animation
const OFFLINE_NOTICE_DELAY_MS = 5_000;
const CURSOR_IDLE_MS = 3_000;
const PANEL_IDLE_EMPTY_MS = 45_000;
const PANEL_IDLE_MAX_MS = 180_000;
const UNDO_WINDOW_MS = 10 * 60_000;

// Column-width recipe, in font pixels (see .row-inner in board.css).
const NAME_EM = 17; // 3 glyphs
const SCORE_EM = 17; // up to 3 digits
const ICON_EM = 8;
const TIME_EM = 26; // "12:34.5" at 0.72em
const LEAD_MIN_EM = 14; // room for the NEW! tag
const GAP_EM = 2.5;
const PAD_EM = 2;

const $ = (id) => document.getElementById(id);
const els = {
  frame: $('frame'),
  board: $('board'),
  topTitle: $('top-title'),
  topCols: $('top-cols'),
  pagerTitle: $('pager-title'),
  pagerCols: $('pager-cols'),
  wipe: $('wipe'),
  empty: $('empty'),
  lastRun: $('last-run'),
  players: $('players'),
  addBtn: $('add-btn'),
  soundBtn: $('sound-btn'),
  conn: $('conn'),
  overlay: $('overlay'),
  overlayBanner: $('overlay-banner'),
  overlayInitials: $('overlay-initials'),
  overlayScore: $('overlay-score'),
  overlayChase: $('overlay-chase'),
  panel: $('entry-panel'),
  entryLast: $('entry-last'),
  subtitle: $('subtitle'),
  gameStatus: $('game-status'),
  gameFlash: $('game-flash'),
};

const state = {
  snapshot: null,
  renderKey: '',
  /** score id → time it was added (flash + NEW tag) */
  fresh: new Map(),
  page: 0,
  nextPageAt: 0,
  wiping: false,
  pendingPage: null,
  enterAnimation: false,
  /** { id, until } — the player whose row is highlighted and held on screen */
  spot: null,
  overlayQueue: [],
  overlayBusy: false,
  lastAdded: null,
  /** Latest game state from the server (driven by the Stream Deck or any controller). */
  game: null,
  lastCueId: 0,
  flashTimer: null,
  flashKey: '',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function div(className, ...children) {
  const el = document.createElement('div');
  el.className = className;
  el.append(...children);
  return el;
}

function setupStaticArt() {
  $('title').append(pixelText('PAC-MAN MAZE'));
  $('subtitle').append(pixelText('LIVE LEADERBOARD'));
  $('ghosts-left').innerHTML = ghost(GHOST_COLORS.red) + ghost(GHOST_COLORS.pink);
  $('ghosts-right').innerHTML = ghost(GHOST_COLORS.cyan) + ghost(GHOST_COLORS.orange);
  $('wipe-pac').innerHTML = pacman();
  els.addBtn.innerHTML = pacman();
  els.addBtn.append(pixelText('ADD PLAYER'));
  els.empty.append(pixelText('READY!', 'ready'), pixelText('BE THE FIRST TO RUN THE MAZE!', 'ready-hint'));
  els.conn.append(pixelText('RECONNECTING...'));
  $('entry-title').append(pixelText('NEW PLAYER'));
}

// ---------- Layout helpers ----------

function display() {
  return state.snapshot?.display ?? { rowsPerColumn: 10, columns: 3, pageSeconds: 10, spotlightSeconds: 20 };
}

/** Columns that fit this screen's shape (a TV is ~16:9 → 3), capped by config. */
function effectiveColumns() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const byShape = aspect >= 2.1 ? 4 : aspect >= 1.45 ? 3 : aspect >= 1.1 ? 2 : 1;
  return Math.max(1, Math.min(display().columns, byShape));
}

/** CSS variables that size one column's cells (see .row-inner). */
function columnVars({ withIcon, withTime, rankChars }) {
  const widths = [rankChars * 6 - 1];
  if (withIcon) widths.push(ICON_EM);
  widths.push(NAME_EM);
  const leadIndex = widths.length;
  widths.push(LEAD_MIN_EM);
  if (withTime) widths.push(TIME_EM);
  widths.push(SCORE_EM);
  const fit = widths.reduce((a, b) => a + b, 0) + GAP_EM * (widths.length - 1) + PAD_EM * 2;
  const tpl = widths.map((w, i) => (i === leadIndex ? 'minmax(0, 1fr)' : `${((w / fit) * 100).toFixed(3)}cqw`)).join(' ');
  return { '--tpl': tpl, '--fit': String(fit), '--gap': String(GAP_EM), '--pad': String(PAD_EM) };
}

function buildColumn(entries, { rows, withIcon, withTime, rankChars, rowTemplate, now, startIndex = 0 }) {
  const col = div('col');
  for (const [name, value] of Object.entries(columnVars({ withIcon, withTime, rankChars }))) col.style.setProperty(name, value);

  const head = [div('c-rank', pixelText('RANK'))];
  if (withIcon) head.push(div('c-icon'));
  head.push(div('c-name', pixelText('PLAYER')), div('c-lead'));
  if (withTime) head.push(div('c-time', pixelText('TIME')));
  head.push(div('c-score', pixelText('PAC-DOTS')));
  col.append(div('col-head', div('row-inner', ...head)));

  const list = document.createElement('ol');
  list.className = 'rows';
  list.style.gridTemplateRows = rowTemplate;
  for (let i = 0; i < rows; i++) {
    const entry = entries[i];
    const row = entry ? buildRow(entry, { withIcon, withTime, now }) : buildPlaceholder({ withIcon, withTime });
    row.style.setProperty('--i', String(startIndex + i));
    list.append(row);
  }
  col.append(list);
  return col;
}

function buildRow(entry, { withIcon, withTime, now }) {
  const row = document.createElement('li');
  const classes = ['row', `pos-${entry.position}`];
  if (entry.rank <= 3) classes.push(`rank-${entry.rank}`);
  if (state.spot?.id === entry.id) classes.push('spot');
  const addedAt = state.fresh.get(entry.id);
  if (addedAt !== undefined && now - addedAt < FLASH_MS) classes.push('fresh');
  row.className = classes.join(' ');
  row.setAttribute('aria-label', `${ordinal(entry.rank)} place, ${entry.initials}, ${entry.score} Pac-Dots`);

  const cells = [div('c-rank', pixelText(ordinal(entry.rank)))];
  if (withIcon) {
    const icon = div('c-icon');
    const fruit = FRUIT_BY_RANK[entry.rank];
    if (fruit) icon.innerHTML = fruit();
    cells.push(icon);
  }
  const lead = div('c-lead');
  if (addedAt !== undefined) lead.append(pixelText('NEW!', 'new-tag'));
  cells.push(div('c-name', pixelText(entry.initials)), lead);
  if (withTime) cells.push(div('c-time', pixelText(formatTime(entry.timeSeconds) || '--')));
  cells.push(div('c-score', pixelText(String(entry.score))));
  row.append(div('row-inner', ...cells));
  return row;
}

function buildPlaceholder({ withIcon, withTime }) {
  const row = document.createElement('li');
  row.className = 'row placeholder';
  row.setAttribute('aria-hidden', 'true');
  const cells = [div('c-rank')];
  if (withIcon) cells.push(div('c-icon'));
  cells.push(div('c-name'), div('c-lead'));
  if (withTime) cells.push(div('c-time'));
  cells.push(div('c-score'));
  row.append(div('row-inner', ...cells));
  return row;
}

function spotlightTitle(entry, total) {
  const text = `* ${entry.initials} IS ${ordinal(entry.rank)}${total > 1 ? ` OF ${total}` : ''}! *`;
  const svg = pixelText(text);
  svg.style.setProperty('--tw', String(pixelWidth(text)));
  return [svg];
}

// ---------- Render ----------

function render() {
  const snapshot = state.snapshot;
  if (!snapshot) return;
  const { entries, completionTimeEnabled: withTime } = snapshot;
  const { rowsPerColumn: rows } = display();
  const columns = effectiveColumns();
  const total = entries.length;
  const layout = total === 0 ? 'empty' : columns === 1 || total <= rows ? 'single' : 'multi';
  const pages = layout === 'multi' ? pageCount(total, rows, columns) : 0;

  const spotEntry = state.spot ? entries.find((e) => e.id === state.spot.id) : undefined;
  if (state.spot && !spotEntry) state.spot = null;
  if (spotEntry && !state.wiping) {
    // Keep the spotlighted player on screen even if the order shifts while they're highlighted.
    const spotPage = pageForPosition(spotEntry.position, rows, columns);
    if (spotPage >= 0 && layout === 'multi') state.page = spotPage;
  }
  state.page = pages ? Math.min(state.page, pages - 1) : 0;

  const key = JSON.stringify([entries, withTime, rows, columns, state.page, state.spot?.id, [...state.fresh.keys()], state.enterAnimation]);
  if (key === state.renderKey) return;
  state.renderKey = key;

  const now = Date.now();
  els.board.dataset.layout = layout;
  els.board.style.setProperty('--pager-fr', `${columns - 1}fr`);

  // Pinned top group.
  const topRowTemplate = ['1.3fr', '1.15fr', '1.15fr', ...Array(Math.max(0, rows - 3)).fill('1fr')].map((fr) => `minmax(0, ${fr})`).join(' ');
  els.topCols.replaceChildren(
    buildColumn(entries.slice(0, rows), { rows, withIcon: true, withTime, rankChars: 4, rowTemplate: topRowTemplate, now }),
  );
  const spotInTop = spotEntry && spotEntry.position <= rows;
  els.topTitle.classList.toggle('spotlight', Boolean(spotInTop));
  els.topTitle.replaceChildren(...(spotInTop ? spotlightTitle(spotEntry, total) : [pixelText(`TOP ${Math.min(rows, Math.max(total, 1))}`)]));

  // Paging group.
  if (layout === 'multi') {
    const { first, last } = pageRange(state.page, rows, columns, total);
    const pageEntries = entries.slice(first - 1, last);
    const rankChars = Math.max(4, ordinal(entries[total - 1].rank).length);
    const rowTemplate = `repeat(${rows}, minmax(0, 1fr))`;
    els.pagerCols.classList.toggle('entering', state.enterAnimation);
    els.pagerCols.replaceChildren(
      ...splitColumns(pageEntries, rows, columns - 1).map((colEntries, c) =>
        buildColumn(colEntries, { rows, withIcon: false, withTime, rankChars, rowTemplate, now, startIndex: c * rows }),
      ),
    );
    const spotInPage = spotEntry && spotEntry.position >= first && spotEntry.position <= last;
    els.pagerTitle.classList.toggle('spotlight', Boolean(spotInPage));
    if (spotInPage) {
      els.pagerTitle.replaceChildren(...spotlightTitle(spotEntry, total));
    } else {
      const info = div('page-info');
      if (pages > 1) {
        if (pages <= 10) {
          const dots = div('page-dots');
          for (let p = 0; p < pages; p++) dots.append(h('span', { class: p === state.page ? 'on' : '' }));
          info.append(dots);
        }
        info.append(pixelText(`PAGE ${state.page + 1}/${pages}`));
      }
      els.pagerTitle.replaceChildren(pixelText(`RANKS ${first}-${last}`), info);
    }
  }

  renderTicker(snapshot);
}

function renderTicker({ latest, totalPlayers }) {
  const left = latest
    ? [
        pixelText('LAST RUN', 'label'),
        pixelText(latest.initials, 'value'),
        pixelText(`${latest.score} DOTS`, 'value gold'),
        pixelText(ordinal(latest.rank), 'value cyan'),
      ]
    : [pixelText('WAITING FOR THE FIRST RUN', 'label')];
  els.lastRun.replaceChildren(...left);
  els.players.replaceChildren(pixelText('PLAYERS', 'label'), pixelText(String(totalPlayers), 'value'));
}

// ---------- Paging ----------

function currentPageCount() {
  const snapshot = state.snapshot;
  if (!snapshot || els.board.dataset.layout !== 'multi') return 0;
  return pageCount(snapshot.entries.length, display().rowsPerColumn, effectiveColumns());
}

function goToPage(page, { withSound = false } = {}) {
  if (page === state.page) {
    render();
    return;
  }
  if (state.wiping) {
    state.pendingPage = page;
    return;
  }
  if (reducedMotion() || els.board.dataset.layout !== 'multi') {
    state.page = page;
    render();
    return;
  }
  state.wiping = true;
  if (withSound) play('chomp'); // idle page flips stay silent; only a jump to a player chomps
  els.wipe.classList.remove('run');
  void els.wipe.offsetWidth; // restart the CSS animation
  els.wipe.classList.add('run');
  setTimeout(() => {
    state.page = page;
    state.enterAnimation = true;
    render();
    state.enterAnimation = false;
    els.wipe.classList.remove('run');
    state.wiping = false;
    if (state.pendingPage !== null) {
      const next = state.pendingPage;
      state.pendingPage = null;
      goToPage(next);
    }
  }, WIPE_MS);
}

/** Highlight a player's row and hold their page on screen (photo time!). */
function spotlight(entryId, delayMs = 0) {
  state.spot = { id: entryId, until: Date.now() + delayMs + display().spotlightSeconds * 1000 };
  const entry = state.snapshot?.entries.find((e) => e.id === entryId);
  const page = entry ? pageForPosition(entry.position, display().rowsPerColumn, effectiveColumns()) : -1;
  if (page >= 0 && els.board.dataset.layout === 'multi') goToPage(page, { withSound: true });
  else render();
}

function tick() {
  const now = Date.now();
  let dirty = false;
  if (state.game && state.game.state !== 'idle') {
    renderGameStatus();
    if (state.game.state === 'countdown') {
      const left = phaseSecondsLeft();
      showFlash(left > 0 ? String(left) : 'GO!', { className: 'count' });
    }
  }
  if (state.spot && now >= state.spot.until) {
    state.spot = null;
    state.nextPageAt = now + display().pageSeconds * 1000;
    dirty = true;
  }
  for (const [id, addedAt] of state.fresh) {
    if (now - addedAt >= NEW_TAG_MS) {
      state.fresh.delete(id);
      dirty = true;
    }
  }
  if (dirty) render();

  const pages = currentPageCount();
  if (!state.nextPageAt) state.nextPageAt = now + display().pageSeconds * 1000;
  if (pages > 1 && !state.spot && !state.wiping && now >= state.nextPageAt) {
    state.nextPageAt = now + display().pageSeconds * 1000;
    goToPage((state.page + 1) % pages);
  }
}

// ---------- NEW HIGH SCORE celebration ----------

function queueCelebration(entry, withTime) {
  state.overlayQueue.push({ entry, withTime });
  if (!state.overlayBusy) void playCelebrations();
}

async function playCelebrations() {
  state.overlayBusy = true;
  while (state.overlayQueue.length) {
    const { entry, withTime } = state.overlayQueue.shift();
    const score = [pixelText(String(entry.score), 'num'), pixelText('PAC-DOTS')];
    if (withTime && entry.timeSeconds !== null) score.push(pixelText('IN'), pixelText(formatTime(entry.timeSeconds), 'num'));

    const train = div('train');
    train.innerHTML = pacman() + scaredGhost() + scaredGhost() + scaredGhost() + scaredGhost();

    els.overlayBanner.replaceChildren(pixelText('NEW HIGH SCORE!'));
    els.overlayInitials.replaceChildren(pixelText(entry.initials));
    els.overlayScore.replaceChildren(...score);
    els.overlayChase.replaceChildren(train);
    els.overlay.classList.remove('leaving');
    els.overlay.hidden = false;
    play('highScore');

    await sleep(OVERLAY_MS);
    els.overlay.classList.add('leaving');
    await sleep(500);
    els.overlay.hidden = true;
  }
  state.overlayBusy = false;
}

// ---------- Live updates ----------

function handleUpdate(message) {
  const { reason, snapshot, added, spotlight: shown } = message;
  if (reason === 'reset') {
    state.fresh.clear();
    state.spot = null;
    state.page = 0;
  }
  state.snapshot = snapshot;
  entryForm.setSettings(snapshot);
  applySoundSetting(snapshot.display.soundEnabled);
  setVolume(snapshot.display.soundVolume);
  applyGame(message.game);
  if (reason === 'game') {
    render();
    return;
  }

  if (added) {
    const { entry, isNewHighScore } = added;
    state.fresh.set(entry.id, Date.now());
    if (isNewHighScore) queueCelebration(entry, snapshot.completionTimeEnabled);
    else play(soundForEntry({ isNewHighScore, rank: entry.rank, position: entry.position, rowsPerColumn: display().rowsPerColumn }));
    els.lastRun.classList.remove('pop');
    void els.lastRun.offsetWidth; // restart the animation
    els.lastRun.classList.add('pop');
    render(); // lay out with the new entry before jumping to it
    spotlight(entry.id, isNewHighScore ? OVERLAY_MS : 0);
    return;
  }
  if (shown) {
    render();
    play('spotlight');
    spotlight(shown.entry.id);
    return;
  }
  render();
}

let offlineTimer = null;
function handleStatus(status) {
  clearTimeout(offlineTimer);
  if (status === 'live') {
    els.conn.hidden = true;
  } else {
    // Only show the notice if the outage lasts; a quick blip shouldn't distract the room.
    offlineTimer = setTimeout(() => {
      els.conn.hidden = false;
    }, OFFLINE_NOTICE_DELAY_MS);
  }
}

// ---------- Game state: READY / 3·2·1 / PLAYING / POWER MODE / FINISH ----------

const FLASH_TEXT = {
  ready: { text: 'READY!', ms: 2200 },
  go: { text: 'GO!', ms: 900 },
  'power-up': { text: 'POWER MODE!', ms: 1800, className: 'power' },
  finish: { text: 'FINISH!', ms: 2600 },
};

function showFlash(text, { ms, className = '' } = {}) {
  const key = `${className}:${text}`;
  if (key === state.flashKey && !els.gameFlash.hidden) return; // don't restart the animation each tick
  state.flashKey = key;
  clearTimeout(state.flashTimer);
  els.gameFlash.className = `game-flash ${className}`.trim();
  els.gameFlash.replaceChildren(pixelText(text));
  els.gameFlash.hidden = false;
  if (!ms) return; // stays until something replaces it (the countdown)
  state.flashTimer = setTimeout(hideFlash, ms);
}

function hideFlash() {
  clearTimeout(state.flashTimer);
  state.flashKey = '';
  if (els.gameFlash.hidden) return;
  els.gameFlash.classList.add('leaving');
  state.flashTimer = setTimeout(() => {
    els.gameFlash.hidden = true;
  }, 350);
}

/** Seconds left in a timed phase (countdown, power mode), rounded up. */
function phaseSecondsLeft() {
  if (!state.game?.phaseEndsAt) return 0;
  return Math.max(0, Math.ceil((state.game.phaseEndsAt - Date.now()) / 1000));
}

function runClock() {
  if (!state.game?.startedAt) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - state.game.startedAt) / 1000));
  return ` ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The line under the title: normally "LIVE LEADERBOARD", otherwise what the run is doing. */
function renderGameStatus() {
  const game = state.game;
  const idle = !game || game.state === 'idle';
  els.subtitle.hidden = !idle;
  els.gameStatus.hidden = idle;
  if (idle) return;
  const label = {
    ready: 'READY!',
    countdown: 'GET SET...',
    playing: `PLAYING${runClock()}`,
    'power-mode': `POWER MODE ${phaseSecondsLeft()}`,
    finished: 'FINISH!',
  }[game.state];
  els.gameStatus.replaceChildren(pixelText(label));
}

/** Ghosts turn frightened-blue while the power pellet is active. */
function renderGhosts(powerMode) {
  const left = powerMode ? scaredGhost() + scaredGhost() : ghost(GHOST_COLORS.red) + ghost(GHOST_COLORS.pink);
  const right = powerMode ? scaredGhost() + scaredGhost() : ghost(GHOST_COLORS.cyan) + ghost(GHOST_COLORS.orange);
  if ($('ghosts-left').dataset.scared === String(powerMode)) return;
  $('ghosts-left').dataset.scared = String(powerMode);
  $('ghosts-right').dataset.scared = String(powerMode);
  $('ghosts-left').innerHTML = left;
  $('ghosts-right').innerHTML = right;
}

function applyGame(game) {
  if (!game) return;
  const previous = state.game;
  state.game = game;

  applySoundSetting(game.soundEnabled);
  setVolume(game.volume);
  setLoop(game.loop);

  // Each cue carries an id that only ever increases, so every screen plays it exactly once.
  if (game.cue && game.cue.id !== state.lastCueId) {
    state.lastCueId = game.cue.id;
    play(game.cue.name);
    const flash = FLASH_TEXT[game.cue.name];
    if (flash) showFlash(flash.text, flash);
  }

  document.body.dataset.gameState = game.state;
  renderGhosts(game.state === 'power-mode');
  if (game.state !== 'countdown' && previous?.state === 'countdown') hideFlash();
  if (game.state === 'idle' && previous && previous.state !== 'idle') hideFlash();
  renderGameStatus();
}

// ---------- Sound ----------

function renderSoundButton() {
  const on = isSoundEnabled();
  els.soundBtn.innerHTML = speaker(!on);
  if (!on) setLoop('none');
  else if (state.game) setLoop(state.game.loop);
  els.soundBtn.dataset.muted = String(!on);
  els.soundBtn.title = on ? 'Sound effects on — click to mute' : 'Sound effects off — click to unmute';
}

function applySoundSetting(on) {
  if (on !== isSoundEnabled()) {
    setSoundEnabled(on);
    renderSoundButton();
  }
}

els.soundBtn.addEventListener('click', async () => {
  const next = !isSoundEnabled();
  primeAudio();
  applySoundSetting(next); // instant feedback; the server confirms below
  if (next) play('panelOpen');
  try {
    // Saved on the server so every screen agrees, and so it survives a refresh.
    await api('PUT', '/api/settings', { soundEnabled: next });
  } catch {
    applySoundSetting(!next);
  }
});

// ---------- Staff entry panel ----------

let panelIdleTimer = null;
let panelOpenedAt = 0;

const entryForm = createEntryForm({
  onAdded: ({ entry }) => {
    state.lastAdded = { entry, at: Date.now() };
    closePanel();
  },
  onCancel: () => closePanel(),
  onActivity: () => schedulePanelIdle(),
});
$('entry-root').append(entryForm.el);

function schedulePanelIdle() {
  clearTimeout(panelIdleTimer);
  panelIdleTimer = setTimeout(() => {
    if (document.querySelector('dialog[open]') || entryForm.isBusy) return schedulePanelIdle();
    // Don't leave the form covering the TV if someone walks away.
    if (entryForm.isEmpty || Date.now() - panelOpenedAt > PANEL_IDLE_MAX_MS) closePanel();
    else schedulePanelIdle();
  }, entryForm.isEmpty ? PANEL_IDLE_EMPTY_MS : PANEL_IDLE_MAX_MS);
}

function renderLastAdded() {
  const last = state.lastAdded;
  const stillOnBoard = last && state.snapshot?.entries.some((e) => e.id === last.entry.id);
  if (!last || !stillOnBoard || Date.now() - last.at > UNDO_WINDOW_MS) {
    els.entryLast.hidden = true;
    return;
  }
  els.entryLast.hidden = false;
  els.entryLast.replaceChildren(
    h('span', {}, 'Last added: ', h('strong', {}, last.entry.initials), ` · ${last.entry.score} Pac-Dots`),
    h('button', { type: 'button', class: 'btn btn-small btn-danger-ghost', onclick: undoLastAdded }, 'Undo'),
  );
}

async function undoLastAdded() {
  const { entry } = state.lastAdded;
  const ok = await confirmDialog({
    title: `Remove ${entry.initials}?`,
    message: `This deletes ${entry.initials} (${entry.score} Pac-Dots) from the leaderboard.`,
    confirmLabel: 'Remove it',
    tone: 'danger',
  });
  if (!ok) return entryForm.focus();
  try {
    await api('DELETE', `/api/scores/${entry.id}`);
  } catch {
    // already gone, or offline: the board will show the truth on the next update
  }
  state.lastAdded = null;
  renderLastAdded();
  entryForm.focus();
}

function openPanel(firstChar = '') {
  if (!els.panel.hidden) return;
  els.panel.hidden = false;
  panelOpenedAt = Date.now();
  primeAudio();
  play('panelOpen');
  renderLastAdded();
  if (firstChar) entryForm.typeInitial(firstChar);
  else entryForm.focus();
  schedulePanelIdle();
}

function closePanel() {
  clearTimeout(panelIdleTimer);
  els.panel.hidden = true;
  if (entryForm.isEmpty) entryForm.reset();
  els.addBtn.blur();
}

els.addBtn.addEventListener('click', () => openPanel());
els.panel.addEventListener('pointerdown', (event) => {
  if (event.target === els.panel) closePanel(); // click outside the sheet
});

// Keyboard: staff can just start typing initials on the TV, or press Enter / + to open the form.
document.addEventListener('keydown', (event) => {
  if (!els.panel.hidden || document.querySelector('dialog[open]')) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (/^[a-z0-9]$/i.test(event.key)) {
    event.preventDefault();
    openPanel(event.key);
  } else if (event.key === 'Enter' || event.key === '+' || event.key === '=') {
    event.preventDefault();
    openPanel();
  }
});

// ---------- TV care: hide the idle cursor, stay awake, avoid burn-in ----------

let cursorTimer = null;
function wakeCursor() {
  document.body.classList.remove('cursor-idle');
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => document.body.classList.add('cursor-idle'), CURSOR_IDLE_MS);
}
document.addEventListener('pointermove', wakeCursor);
document.addEventListener('pointerdown', () => {
  wakeCursor();
  primeAudio(); // browsers keep audio muted until the page is interacted with
});
document.addEventListener('keydown', primeAudio);

let wakeLock = null;
async function keepScreenAwake() {
  try {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null; // not fatal: caffeinate / Energy settings cover this too
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !wakeLock) void keepScreenAwake();
});

function pixelShift() {
  const offset = () => `${Math.round(Math.random() * 8 - 4)}px`;
  els.frame.style.setProperty('--shift-x', offset());
  els.frame.style.setProperty('--shift-y', offset());
}

// Double-click the board (not the button) to toggle full screen when not in kiosk mode.
els.frame.addEventListener('dblclick', (event) => {
  if (event.target.closest('button')) return;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => {});
});

window.addEventListener('resize', () => render());

setupStaticArt();
renderSoundButton();
wakeCursor();
primeAudio();
connectLive({ onUpdate: handleUpdate, onStatus: handleStatus });
void keepScreenAwake();
setInterval(tick, 500);
setInterval(pixelShift, 90_000);

// Handy from the browser console: pacmanMaze.preview('SAM', 42)
window.pacmanMaze = { state, preview: (initials = 'MAX', score = 42) => queueCelebration({ initials, score, timeSeconds: null }, false) };
