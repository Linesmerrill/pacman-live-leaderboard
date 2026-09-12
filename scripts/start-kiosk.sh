#!/bin/bash
# Opens the leaderboard full-screen in Google Chrome (kiosk mode) and keeps the Mac awake while it's up.
# Usage:  npm run kiosk            (or: bash scripts/start-kiosk.sh http://localhost:3000/)
# Exit kiosk mode with  Cmd+Q.
set -euo pipefail

URL="${1:-http://localhost:${PORT:-3000}/}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="$HOME/Library/Application Support/PacManMaze-Kiosk"

if [[ ! -x "$CHROME" ]]; then
  echo "Google Chrome not found at: $CHROME" >&2
  echo "Install Chrome, or open $URL in any browser and press Ctrl+Cmd+F for full screen." >&2
  exit 1
fi

# Wait (up to ~60s) for the leaderboard server, e.g. right after the Mac boots.
for _ in $(seq 1 60); do
  if curl -fsS "${URL%/}/api/health" >/dev/null 2>&1; then break; fi
  sleep 1
done

# A separate Chrome profile means kiosk mode works even if normal Chrome is already open,
# and no personal bookmarks, logins, or pop-ups ever show up on the TV.
"$CHROME" \
  --kiosk "$URL" \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --noerrdialogs \
  --disable-features=Translate,TranslateUI \
  --autoplay-policy=no-user-gesture-required \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  >/dev/null 2>&1 &
CHROME_PID=$!

# Keep the display and system awake for as long as the kiosk window is open.
caffeinate -d -i -m -w "$CHROME_PID"
