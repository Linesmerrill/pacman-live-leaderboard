import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Server-Sent Events hub. Browsers reconnect automatically (EventSource), and every connection
 * receives the full current leaderboard on connect, so a TV that blinks off the network catches up.
 */
export class LiveHub {
  readonly #clients = new Set<ServerResponse>();
  readonly #heartbeat: NodeJS.Timeout;

  constructor(heartbeatMs = 15_000) {
    // A comment line keeps idle connections (and any proxies/sleepy Wi-Fi) from timing out.
    this.#heartbeat = setInterval(() => this.#writeAll(': ping\n\n'), heartbeatMs);
    this.#heartbeat.unref();
  }

  get size(): number {
    return this.#clients.size;
  }

  add(req: IncomingMessage, res: ServerResponse, initialPayload: unknown): void {
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    res.write(this.#format(initialPayload));
    this.#clients.add(res);
    const remove = () => this.#clients.delete(res);
    req.on('close', remove);
    res.on('error', remove);
  }

  broadcast(payload: unknown): void {
    this.#writeAll(this.#format(payload));
  }

  #format(payload: unknown): string {
    return `data: ${JSON.stringify(payload)}\n\n`;
  }

  #writeAll(chunk: string): void {
    for (const client of this.#clients) {
      if (client.writableEnded || client.destroyed) {
        this.#clients.delete(client);
        continue;
      }
      client.write(chunk);
    }
  }

  close(): void {
    clearInterval(this.#heartbeat);
    for (const client of this.#clients) client.end();
    this.#clients.clear();
  }
}
