import { pinDialog } from './dialogs.js';

const PIN_KEY = 'pacmanMaze.staffPin';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Request failed (${status})`);
    this.status = status;
    this.body = body ?? {};
  }
}

let memoryPin = '';

function storedPin() {
  try {
    return localStorage.getItem(PIN_KEY) || memoryPin;
  } catch {
    return memoryPin;
  }
}

function storePin(pin) {
  memoryPin = pin;
  try {
    localStorage.setItem(PIN_KEY, pin);
  } catch {
    // storage blocked (private mode): the in-memory copy lasts until the page is closed
  }
}

async function request(method, url, body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const pin = storedPin();
  if (pin) headers['X-Admin-Pin'] = pin;
  try {
    return await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  } catch {
    throw new ApiError(0, { error: 'network', message: 'Can’t reach the scoreboard server. Check that it’s running, then try again.' });
  }
}

// Concurrent requests that all hit a 401 share one PIN prompt.
let pendingPrompt = null;
function askForPin(wasWrong) {
  pendingPrompt ??= pinDialog(wasWrong).finally(() => {
    pendingPrompt = null;
  });
  return pendingPrompt;
}

/** Fetch wrapper for staff APIs: JSON in/out, friendly errors, and a PIN prompt if the server asks for one. */
export async function api(method, url, body, { raw = false } = {}) {
  for (;;) {
    const sentPin = storedPin();
    const res = await request(method, url, body);
    if (res.status === 401) {
      // Another request may have just stored a fresh PIN; retry with it before prompting.
      if (storedPin() !== sentPin) continue;
      const pin = await askForPin(Boolean(sentPin));
      if (pin === null) throw new ApiError(401, { error: 'pin_required', message: 'Staff PIN required.' });
      storePin(pin);
      continue;
    }
    if (raw && res.ok) return res;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
  }
}
