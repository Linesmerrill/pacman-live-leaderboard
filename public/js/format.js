/** 1 → "1ST", 2 → "2ND", 11 → "11TH", 23 → "23RD". */
export function ordinal(n) {
  const suffixes = ['TH', 'ST', 'ND', 'RD'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

/** Seconds → "0:42", "1:02.5". Returns "" for null. */
export function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return '';
  const tenths = Math.round(seconds * 10) / 10;
  const minutes = Math.floor(tenths / 60);
  const rest = tenths - minutes * 60;
  const secs = Number.isInteger(tenths) ? String(Math.round(rest)).padStart(2, '0') : rest.toFixed(1).padStart(4, '0');
  return `${minutes}:${secs}`;
}

/** Epoch ms → "just now", "4 min ago", "2 hr ago". */
export function timeAgo(ms, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} hr ago`;
}

/** Epoch ms → local "7:05 PM". */
export function clockTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
