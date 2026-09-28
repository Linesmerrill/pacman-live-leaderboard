# Setting up the Mac

The whole attraction runs on one Mac mini plugged into the TV. It needs the internet only once, to
install; after that it runs completely offline.

← [All guides](README.md)

## 1. Install (one time, needs internet)

1. Install **Google Chrome**, for full-screen kiosk mode: <https://www.google.com/chrome/>
2. Install **Node.js 22.18 or newer**. The easiest way is [Homebrew](https://brew.sh):
   ```bash
   brew install node
   ```
3. Get the project into a simple folder such as `~/pacman-maze`. Avoid Desktop, Documents and
   Downloads if you plan to use auto-start, because macOS restricts those folders for background apps.
   ```bash
   git clone https://github.com/Linesmerrill/pacman-live-leaderboard.git ~/pacman-maze
   cd ~/pacman-maze
   npm install
   ```
   The app itself has **no runtime packages**: it uses Node's built-in web server and SQLite.
   `npm install` only adds the TypeScript checker and the Stream Deck build tools, so you can skip it
   on a Mac that will only run the event and has no Stream Deck.

The songs that play between runs come with the project. Sound effects are optional; see
[Music and sound](music-and-sound.md).

## 2. Start the app

```bash
cd ~/pacman-maze
npm start
```

It prints the addresses to open:

```
  TV leaderboard:  http://localhost:3000/
  Staff entry:     http://localhost:3000/admin
  Manage scores:   http://localhost:3000/admin/settings
  On this Wi-Fi:   http://192.168.8.10:3000/admin
```

Leave that Terminal window open. Stop the app with **Ctrl+C**; scores are already saved.

## 3. Open the screens

| Screen | Address | Who uses it |
| --- | --- | --- |
| **TV leaderboard**, with a built-in **+ ADD PLAYER** entry panel | `http://localhost:3000/` | Everyone; staff at the Mac |
| Staff entry, for a tablet or laptop | `http://localhost:3000/admin` | Staff on a second device |
| Manage scores | `http://localhost:3000/admin/settings` | Staff: edit, delete, export, reset, settings |

On the Mac, open Chrome to **`http://localhost:3000/`** for the TV. Tablets and phones join the
event Wi-Fi and use the **On this Wi-Fi** address instead. At the event that's
`http://192.168.8.10:3000/admin`; see [Event network](network.md).

## 4. Full-screen on the TV

Pick one:

- **Kiosk mode (recommended).** In a second Terminal window run
  ```bash
  npm run kiosk
  ```
  Chrome opens the board full-screen with no toolbars, using its own clean profile, with sound
  allowed from the start, and keeps the Mac from sleeping. Quit it with **Cmd+Q**.
- **Normal Chrome.** Press **Ctrl+Cmd+F**, or double-click the board. Click the board once so the
  browser lets it play sound.

The mouse pointer hides after 3 seconds; move the mouse to bring it back.

**Sound comes out of the TV** only if the Mac sends audio over HDMI: System Settings → Sound →
Output → the TV.

## 5. Start everything automatically after a restart (optional)

```bash
npm run autostart:install -- --kiosk
```

This adds two macOS login items for the current user: the leaderboard server, restarted
automatically if it ever stops, and Chrome kiosk mode on the TV. Logs go to `logs/`. Leave off
`-- --kiosk` to auto-start only the server. Remove them with:

```bash
npm run autostart:remove
```

For a fully hands-off restart, also set:

- **System Settings → Users & Groups → Automatically log in as** this user.
- **System Settings → Displays / Energy → Prevent automatic sleeping when the display is off**, and
  **Turn display off** to **Never**. Kiosk mode also keeps the display awake while it runs.

## 6. Stop anything popping up on the TV

Turn on **Focus → Do Not Disturb** during the event so notifications don't appear over the board.

## 7. Optional extras

- **[Stream Deck](stream-deck.md)**: runs the show from physical keys.
- **[Event network](network.md)**: the travel router that gives the attraction its own Wi-Fi.
- **[Power-up sensors](sensors.md)**: corner sensors that trigger POWER MODE on their own.

## Updating to a new version

With internet, from the project folder:

```bash
git pull
npm install
```

Then restart the app (Ctrl+C, `npm start`) and reload the TV page. If you use the Stream Deck, rebuild
it too: `npm run streamdeck:build && npm run streamdeck:install`. Scores and settings are kept.
