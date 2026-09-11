// Writes a consistent copy of the scores database into the backups folder.
// Safe to run while the leaderboard is running:  npm run backup
import { loadConfig } from '../src/config.ts';
import { LeaderboardService } from '../src/service.ts';
import { ScoreStore } from '../src/store.ts';

const config = loadConfig();
const store = new ScoreStore(config.databaseFile);
try {
  const service = new LeaderboardService(store, config);
  const file = service.backup();
  console.log(`Backed up ${service.snapshot().totalPlayers} scores to:\n  ${file}`);
} finally {
  store.close();
}
