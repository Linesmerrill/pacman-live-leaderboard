// Live leaderboard feed: Server-Sent Events with automatic reconnect, plus a slow safety-net poll.

const POLL_MS = 20_000;
const RECONNECT_MS = 3_000;

/**
 * @param {{ onUpdate: (message: {reason: string, snapshot: object, added?: object}) => void,
 *           onStatus?: (status: 'live' | 'offline') => void }} handlers
 */
export function connectLive({ onUpdate, onStatus = () => {} }) {
  let source = null;
  let status = null;
  let reconnectTimer = null;

  const setStatus = (next) => {
    if (next !== status) {
      status = next;
      onStatus(next);
    }
  };

  function open() {
    clearTimeout(reconnectTimer);
    source?.close();
    source = new EventSource('/api/stream');
    source.onopen = () => setStatus('live');
    source.onmessage = (event) => {
      setStatus('live');
      try {
        onUpdate(JSON.parse(event.data));
      } catch (err) {
        console.error('Bad live message', err);
      }
    };
    source.onerror = () => {
      setStatus('offline');
      // EventSource retries by itself unless the connection is fully closed (e.g. server returned an error page).
      if (source.readyState === EventSource.CLOSED) reconnectTimer = setTimeout(open, RECONNECT_MS);
    };
  }

  async function poll() {
    try {
      const res = await fetch('/api/leaderboard', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onUpdate({ reason: 'poll', snapshot: await res.json() });
      if (source?.readyState === EventSource.CLOSED) open();
    } catch {
      setStatus('offline');
    }
  }

  open();
  const pollTimer = setInterval(poll, POLL_MS);
  return {
    close() {
      clearInterval(pollTimer);
      clearTimeout(reconnectTimer);
      source?.close();
    },
  };
}
