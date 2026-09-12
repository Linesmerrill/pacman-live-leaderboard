// Writes a consistent copy of the scores database into the backups folder.
// Safe to run while the leaderboard is running:  npm run backup
import { loadConfig } from '../apps/leaderboard/src/config.ts';
import { LeaderboardService } from '../apps/leaderboard/src/service.ts';
import { ScoreStore } from '../apps/leaderboard/src/store.ts';

const config = loadConfig();
const store = new ScoreStore(config.databaseFile);
try {
  const service = new LeaderboardService(store, config);
  const file = service.backup();
  console.log(`Backed up ${service.snapshot().totalPlayers} scores to:\n  ${file}`);
} finally {
  store.close();
}
