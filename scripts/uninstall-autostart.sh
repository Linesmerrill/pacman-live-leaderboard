#!/bin/bash
# Removes the login items added by install-autostart.sh. Scores are not touched.
set -euo pipefail

DOMAIN="gui/$(id -u)"
for label in com.pacmanmaze.kiosk com.pacmanmaze.leaderboard; do
  plist="$HOME/Library/LaunchAgents/$label.plist"
  launchctl bootout "$DOMAIN/$label" 2>/dev/null || true
  if [[ -f "$plist" ]]; then
    rm "$plist"
    echo "✓ Removed $label"
  fi
done
echo "Auto-start is off. Start the leaderboard manually with: npm start"
