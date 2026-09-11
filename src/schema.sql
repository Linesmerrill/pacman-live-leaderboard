-- Pac-Man Maze leaderboard schema (version 1).
-- Deliberately minimal: no names, ages, contact details, or photos — only what the scoreboard needs.

CREATE TABLE IF NOT EXISTS scores (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  initials     TEXT    NOT NULL CHECK (initials GLOB '[A-Z0-9][A-Z0-9][A-Z0-9]'),
  score        INTEGER NOT NULL CHECK (score >= 0),
  time_seconds REAL             CHECK (time_seconds IS NULL OR time_seconds > 0),
  created_at   INTEGER NOT NULL -- Unix epoch milliseconds
);

CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores (created_at);
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores (score DESC);

-- Runtime settings staff can change from /admin/settings (completion timer, custom deny-list).
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
