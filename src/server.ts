import { networkInterfaces } from 'node:os';
import { loadConfig } from './config.ts';
import { createApp } from './http.ts';
import { LeaderboardService } from './service.ts';
import { ScoreStore } from './store.ts';

function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function log(message: string): void {
  console.log(`[${timestamp()}] ${message}`);
}

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((info) => info && info.family === 'IPv4' && !info.internal)
    .map((info) => info!.address);
}

const config = loadConfig();
const store = new ScoreStore(config.databaseFile);
const service = new LeaderboardService(store, config);
const app = createApp({ service, log });

app.server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${config.port} is already in use — is the leaderboard already running in another window?`);
    console.error('Close the other copy, or set a different "port" in config.json.\n');
  } else {
    console.error(err);
  }
  store.close();
  process.exit(1);
});

app.server.listen(config.port, config.host, () => {
  const local = `http://localhost:${config.port}`;
  const snapshot = service.snapshot();
  console.log('');
  console.log('  ᗧ • • •  PAC-MAN MAZE — LIVE LEADERBOARD');
  console.log('');
  console.log(`  TV leaderboard:  ${local}/`);
  console.log(`  Staff entry:     ${local}/admin`);
  console.log(`  Manage scores:   ${local}/admin/settings`);
  if (config.host === '0.0.0.0') {
    for (const address of lanAddresses()) console.log(`  On this Wi-Fi:   http://${address}:${config.port}/admin`);
  }
  console.log('');
  console.log(`  Database: ${config.databaseFile} (${snapshot.totalPlayers} scores)`);
  console.log(`  Completion timer: ${snapshot.completionTimeEnabled ? 'ON' : 'off'} · Staff PIN: ${config.adminPin ? 'ON' : 'off'}`);
  console.log('  Press Ctrl+C to stop.\n');
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`${signal} received — saving and shutting down.`);
  await app.close();
  store.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Keep the scoreboard up during the event: log unexpected errors instead of exiting.
process.on('uncaughtException', (err) => log(`Unexpected error (still running): ${err.stack ?? err}`));
process.on('unhandledRejection', (reason) => log(`Unhandled rejection (still running): ${String(reason)}`));
