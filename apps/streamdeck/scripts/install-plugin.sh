#!/bin/bash
# Installs (or re-installs) the Pac-Man Maze plugin into the Stream Deck app on this Mac.
#   npm run streamdeck:install
# Run it again after every `npm run streamdeck:build`.
set -euo pipefail

PLUGIN="com.pacmanmaze.controller.sdPlugin"
SRC="$(cd "$(dirname "$0")/.." && pwd)/$PLUGIN"
DEST_DIR="$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins"
DEST="$DEST_DIR/$PLUGIN"

if [[ ! -f "$SRC/bin/plugin.js" ]]; then
  echo "The plugin isn't built yet. Run:  npm run streamdeck:build" >&2
  exit 1
fi
if [[ ! -d "$DEST_DIR" ]]; then
  echo "Stream Deck doesn't look installed (missing $DEST_DIR)." >&2
  echo "Install the Elgato Stream Deck app (7.1 or newer), run it once, then try again." >&2
  exit 1
fi

# The app is "Elgato Stream Deck" on newer releases and "Stream Deck" on older ones.
APP="Elgato Stream Deck"
[[ -d "/Applications/$APP.app" ]] || APP="Stream Deck"

echo "Quitting $APP…"
osascript -e "quit app \"$APP\"" 2>/dev/null || true
sleep 2

rm -rf "$DEST"
mkdir -p "$DEST"
# Copy the plugin bundle only — no node_modules needed, everything is in bin/plugin.js.
cp -R "$SRC/" "$DEST/"
echo "✓ Installed to: $DEST"

echo "Starting $APP…"
open -a "$APP" 2>/dev/null || echo "Start the Stream Deck app yourself to load the plugin."
echo
echo "In Stream Deck, open the “Pac-Man Maze” category in the actions list on the right."
echo "Every key is its own action — drag READY, 3·2·1, START, POWER UP… straight onto"
echo "the deck. There is nothing to configure: each key already knows what it does."
