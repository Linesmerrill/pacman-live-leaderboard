# Troubleshooting

Find the symptom, try the fix. Still stuck? [Open an issue](https://github.com/Linesmerrill/pacman-live-leaderboard/issues/new/choose).

← [All guides](README.md)

## The app and the TV

| Problem | Fix |
| --- | --- |
| "Port 3000 is already in use" | The app is already running, perhaps from auto-start. Use that one, or stop the other copy. |
| TV shows "RECONNECTING…" | The app stopped. Start it again with `npm start`; the TV recovers on its own. |
| Chrome isn't full-screen | Use `npm run kiosk`, or press Ctrl+Cmd+F. |
| Initials rejected | They're on the blocked list, or aren't exactly 3 letters or numbers. Ask the kid for another combo. |
| A score went in wrong | **Edit** or **Delete** it in Manage scores. See [Fixing mistakes](running-the-event.md#fixing-mistakes). |
| The rules panel is too wide or narrow | **Manage scores → How to play**: drag the width slider and watch the TV. |
| **End round now** is greyed out | The round hasn't started yet: it starts with its first score. |
| Notifications pop up on the TV | Turn on **Focus → Do Not Disturb** on the Mac. |

## Sound

| Problem | Fix |
| --- | --- |
| No sound on the TV | Check the speaker button next to **+ ADD PLAYER**, the TV's own volume, the Stream Deck's MUTE key, and that the Mac sends audio to the TV (System Settings → Sound → Output). Outside kiosk mode, click the board once so the browser allows sound. |
| No music between runs | Check **Manage scores → Background music** is on. After **STOP ALL**, the music comes back with the next READY, FINISH or RESET. |
| My own sound files don't play | Restart the app (the folder is read at startup), reload the TV, then check <http://localhost:3000/api/audio>. Names must match the cue names exactly, e.g. `go.wav`. |

## Tablets and the network

| Problem | Fix |
| --- | --- |
| A tablet can't open `/admin` | Is it on the `PacManMaze` Wi-Fi? Use `http://192.168.8.10:3000/admin`, or the **On this Wi-Fi** address the app prints. If macOS asks about the firewall, click **Allow**. |
| The Mac isn't at `192.168.8.10` | Is its cable in a **LAN** port (not WAN)? Unplug it for a few seconds to renew. Still wrong? Check the reservation in [Event network](network.md#setting-up-the-router-from-scratch). |
| Can't reach the router's page | Go to `http://192.168.8.1` from a device on `PacManMaze`, or cabled into the router. |

## Stream Deck

| Problem | Fix |
| --- | --- |
| Keys say "(offline)" | The leaderboard isn't running, or the key points at the wrong address. Start it with `npm start`, or set the address in any key's Connection section. |
| No Pac-Man Maze actions in the list | Run `npm run streamdeck:build && npm run streamdeck:install` again, and check the Stream Deck app is 7.1 or newer. |
| The profile import does nothing | Stream Deck asks you to confirm the import in a dialog; click through it. If it still doesn't appear, drag the keys on by hand. |

## Power-up sensors

| Problem | Fix |
| --- | --- |
| Board never joins the Wi-Fi | ESP32s only use **2.4 GHz**; check it's switched on in the router. Check the name and password (case-sensitive). |
| Joins, but requests fail | Is the address right (`192.168.8.10`)? Did macOS ask about the firewall? Try the `curl` test from a laptop. |
| `"applied": false` | No run in progress. Start one (READY → START) and try again. |
| `401 pin_required` | A staff PIN is set: add the `X-Admin-Pin` header (both examples have a setting for it). |
| Fires too often | Raise `COOLDOWN`; for a motion sensor, turn its sensitivity and time knobs down. |

More detail in [Power-up sensors](sensors.md#troubleshooting).
