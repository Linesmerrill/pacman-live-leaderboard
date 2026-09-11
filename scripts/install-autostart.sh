#!/bin/bash
# Makes the leaderboard start automatically whenever this Mac user logs in (e.g. after a restart),
# and restarts it automatically if it ever stops.
#
#   npm run autostart:install              server only
#   npm run autostart:install -- --kiosk   server + open the TV board full-screen in Chrome at login
#
# Undo with: npm run autostart:remove
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node || true)"
AGENTS="$HOME/Library/LaunchAgents"
SERVER_LABEL="com.pacmanmaze.leaderboard"
KIOSK_LABEL="com.pacmanmaze.kiosk"
DOMAIN="gui/$(id -u)"

if [[ -z "$NODE" ]]; then
  echo "Node.js not found. Install it first:  brew install node" >&2
  exit 1
fi
case "$DIR" in
  "$HOME/Desktop"*|"$HOME/Documents"*|"$HOME/Downloads"*)
    echo "Note: macOS privacy rules can stop background apps from reading Desktop/Documents/Downloads." >&2
    echo "If the leaderboard doesn't start after a restart, move this folder (e.g. to ~/pacman-maze) and re-run." >&2
    ;;
esac

mkdir -p "$AGENTS" "$DIR/logs"

cat >"$AGENTS/$SERVER_LABEL.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$SERVER_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>--disable-warning=ExperimentalWarning</string>
    <string>$DIR/src/server.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>StandardOutPath</key><string>$DIR/logs/server.log</string>
  <key>StandardErrorPath</key><string>$DIR/logs/server.log</string>
</dict>
</plist>
PLIST

launchctl bootout "$DOMAIN/$SERVER_LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$AGENTS/$SERVER_LABEL.plist"
echo "✓ Leaderboard server will start at login (log: $DIR/logs/server.log)"

if [[ "${1:-}" == "--kiosk" ]]; then
  cat >"$AGENTS/$KIOSK_LABEL.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$KIOSK_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$DIR/scripts/start-kiosk.sh</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$DIR/logs/kiosk.log</string>
  <key>StandardErrorPath</key><string>$DIR/logs/kiosk.log</string>
</dict>
</plist>
PLIST
  launchctl bootout "$DOMAIN/$KIOSK_LABEL" 2>/dev/null || true
  launchctl bootstrap "$DOMAIN" "$AGENTS/$KIOSK_LABEL.plist"
  echo "✓ The TV board will open full-screen in Chrome at login"
fi
