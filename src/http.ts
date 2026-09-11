import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import { PROJECT_ROOT } from './config.ts';
import { LiveHub } from './live.ts';
import { NotFoundError, type LeaderboardService } from './service.ts';
import { ValidationError } from './validation.ts';

export interface AppOptions {
  service: LeaderboardService;
  publicDir?: string;
  log?: (message: string) => void;
}

export interface App {
  server: Server;
  hub: LiveHub;
  close(): Promise<void>;
}

type UpdateReason = 'added' | 'updated' | 'deleted' | 'reset' | 'settings' | 'spotlight';

class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const PAGE_ROUTES: Record<string, string> = {
  '/': 'index.html',
  '/admin': 'admin.html',
  '/admin/': 'admin.html',
  '/admin/settings': 'settings.html',
  '/admin/settings/': 'settings.html',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage, limitBytes = 32 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limitBytes) throw new HttpError(413, 'too_large', 'Request body too large.');
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'bad_json', 'Request body must be JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, 'bad_json', 'Request body must be a JSON object.');
  return parsed as Record<string, unknown>;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(404, 'not_found', 'Score not found.');
  return id;
}

export function createApp({ service, publicDir = path.join(PROJECT_ROOT, 'public'), log = () => {} }: AppOptions): App {
  const hub = new LiveHub();
  const root = path.resolve(publicDir);
  const pin = service.config.adminPin;

  function broadcast(reason: UpdateReason, extra: Record<string, unknown> = {}): void {
    hub.broadcast({ reason, snapshot: service.snapshot(), ...extra });
  }

  function requireStaff(req: IncomingMessage): void {
    if (!pin) return;
    const supplied = req.headers['x-admin-pin'];
    if (typeof supplied !== 'string' || !timingSafeEqual(digest(supplied), digest(pin))) {
      throw new HttpError(401, 'pin_required', 'Staff PIN required.');
    }
  }

  async function serveStatic(pathname: string, res: ServerResponse): Promise<boolean> {
    const relative = PAGE_ROUTES[pathname] ?? pathname.replace(/^\/+/, '');
    const file = path.resolve(root, relative);
    if (file !== root && !file.startsWith(root + path.sep)) return false;
    try {
      const info = await stat(file);
      if (!info.isFile()) return false;
      const body = await readFile(file);
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': MIME_TYPES[path.extname(file)] ?? 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'no-cache',
      });
      res.end(body);
      return true;
    } catch {
      return false;
    }
  }

  async function handleApi(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
    const method = req.method ?? 'GET';
    const scoreMatch = /^\/api\/scores\/([^/]+)$/.exec(pathname);
    const spotlightMatch = /^\/api\/scores\/([^/]+)\/spotlight$/.exec(pathname);

    if (method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, liveClients: hub.size, uptimeSeconds: Math.round(process.uptime()) });
    }
    if (method === 'GET' && pathname === '/api/leaderboard') {
      return sendJson(res, 200, service.snapshot());
    }
    if (method === 'GET' && pathname === '/api/stream') {
      hub.add(req, res, { reason: 'connected', snapshot: service.snapshot() });
      return;
    }

    // Everything below is staff-only.
    requireStaff(req);

    if (method === 'GET' && pathname === '/api/auth') {
      return sendJson(res, 200, { ok: true, pinRequired: Boolean(pin) });
    }
    if (method === 'GET' && pathname === '/api/scores') {
      return sendJson(res, 200, { scores: service.listForAdmin(), settings: service.getSettings() });
    }
    if (method === 'POST' && pathname === '/api/scores') {
      const body = await readJsonBody(req);
      const result = service.submit(body, {
        submissionId: typeof body.submissionId === 'string' ? body.submissionId : undefined,
        confirmDuplicate: body.confirmDuplicate === true,
      });
      if (result.kind === 'possible-duplicate') {
        return sendJson(res, 409, {
          error: 'possible_duplicate',
          message: `${result.existing.initials} with ${result.existing.score} Pac-Dots was added ${result.secondsAgo} seconds ago.`,
          existing: result.existing,
          secondsAgo: result.secondsAgo,
        });
      }
      if (!result.replayed) {
        const { entry } = result;
        log(`+ ${entry.initials} ${entry.score} dots${entry.timeSeconds !== null ? ` ${entry.timeSeconds}s` : ''} → rank ${entry.rank}${result.isNewHighScore ? ' (NEW HIGH SCORE)' : ''}`);
        broadcast('added', { added: { entry, isNewHighScore: result.isNewHighScore } });
      }
      return sendJson(res, result.replayed ? 200 : 201, { entry: result.entry, isNewHighScore: result.isNewHighScore, replayed: result.replayed });
    }
    if (method === 'PUT' && scoreMatch) {
      const id = parseId(scoreMatch[1]);
      const entry = service.update(id, await readJsonBody(req));
      log(`~ edited #${id} → ${entry.initials} ${entry.score}`);
      broadcast('updated');
      return sendJson(res, 200, { entry });
    }
    if (method === 'DELETE' && scoreMatch) {
      const id = parseId(scoreMatch[1]);
      const removed = service.remove(id);
      log(`- deleted #${id} (${removed.initials} ${removed.score})`);
      broadcast('deleted');
      return sendJson(res, 200, { deleted: removed });
    }
    if (method === 'POST' && spotlightMatch) {
      const entry = service.getRanked(parseId(spotlightMatch[1]));
      log(`* showing ${entry.initials} (${entry.rank}) on the TV`);
      broadcast('spotlight', { spotlight: { entry } });
      return sendJson(res, 200, { entry });
    }
    if (method === 'POST' && pathname === '/api/reset') {
      const body = await readJsonBody(req);
      if (body.confirm !== 'RESET') throw new HttpError(400, 'confirm_required', 'Type RESET to confirm clearing the leaderboard.');
      const result = service.reset();
      log(`! leaderboard reset (${result.deleted} scores cleared; backup: ${result.backupFile ?? 'none needed'})`);
      broadcast('reset');
      return sendJson(res, 200, result);
    }
    if (method === 'POST' && pathname === '/api/backup') {
      const file = service.backup();
      log(`* backup written to ${file}`);
      return sendJson(res, 200, { file });
    }
    if (method === 'GET' && pathname === '/api/export.csv') {
      const csv = service.exportCsv();
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pacman-maze-scores-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      });
      res.end(csv);
      return;
    }
    if (method === 'GET' && pathname === '/api/settings') {
      return sendJson(res, 200, service.getSettings());
    }
    if (method === 'PUT' && pathname === '/api/settings') {
      const body = await readJsonBody(req);
      let outcome;
      try {
        outcome = service.updateSettings(body);
      } catch (err) {
        if (err instanceof TypeError) throw new HttpError(400, 'bad_settings', err.message);
        throw err;
      }
      log(`* settings updated: ${JSON.stringify(body)}`);
      broadcast('settings');
      return sendJson(res, 200, { settings: service.getSettings(), ...outcome });
    }

    throw new HttpError(404, 'not_found', 'Not found.');
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    } catch {
      return sendJson(res, 400, { error: 'bad_url', message: 'Bad URL.' });
    }

    try {
      if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname);
      if ((req.method === 'GET' || req.method === 'HEAD') && (await serveStatic(pathname, res))) return;
      res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found. Try / for the leaderboard or /admin for staff entry.');
    } catch (err) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (err instanceof ValidationError) return sendJson(res, 422, { error: 'invalid', field: err.field, message: err.message });
      if (err instanceof NotFoundError) return sendJson(res, 404, { error: 'not_found', message: 'That score no longer exists.' });
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.code, message: err.message });
      log(`!! ${req.method} ${pathname} failed: ${(err as Error).stack ?? err}`);
      return sendJson(res, 500, { error: 'server_error', message: 'Something went wrong on the server. Please try again.' });
    }
  }

  const server = createServer((req, res) => {
    void handle(req, res);
  });
  // Kiosk browsers keep connections open for hours; don't let Node reap the live stream.
  server.requestTimeout = 0;
  server.headersTimeout = 60_000;

  return {
    server,
    hub,
    close: () =>
      new Promise<void>((resolve) => {
        hub.close();
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
