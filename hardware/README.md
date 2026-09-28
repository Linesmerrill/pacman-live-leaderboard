# Power-up sensors: Arduino / Raspberry Pi → POWER MODE

Put a sensor in each corner of the maze. When a kid reaches one, the board in that corner sends one
web request to the leaderboard, and the game goes into **POWER MODE** — exactly as if someone pressed
POWER UP on the Stream Deck: the power-up sound, blue ghosts on the TV, the power-mode music, and the
bonus seconds on the run clock.

```
 corner sensor ──► ESP32 / Pi ──Wi-Fi──► router ──► Mac mini (leaderboard) ──► TV + sound
 (button, mat,       sends                (no internet     POST /api/game/power-up
  motion sensor)     one request           needed)
```

Nothing here needs the internet. Everything talks over a small local Wi-Fi network at the event.

---

## 1. The event network

The attraction brings its own Wi-Fi: a **GL.iNet Opal travel router (GL-SFT1200)**, with no internet
connected. Everything joins it:

```
                 ┌─ Mac mini (leaderboard) ── Ethernet cable into a LAN port, fixed at 192.168.8.10
 GL.iNet Opal ───┼─ staff tablets / phones ── Wi-Fi
 (no internet)   └─ sensor boards (ESP32/Pi) ─ Wi-Fi, 2.4 GHz
```

| | |
| --- | --- |
| **Wi-Fi name** | `PacManMaze` |
| **Wi-Fi password** | `wakawaka` (the sample the examples use — if the router was set up with a different one, it's on the label taped to the router) |
| **Band for sensors** | 2.4 GHz (ESP32 boards can't use 5 GHz; the Opal broadcasts both) |
| **Leaderboard address** | `http://192.168.8.10:3000` — the Mac mini's reserved address on the router |
| **Router's own settings page** | `http://192.168.8.1` (works with no internet) |

So a sensor board just needs to **join `PacManMaze`** and send its request to
`http://192.168.8.10:3000/api/game/power-up` — that address goes into the sensor code below.

The Mac mini is plugged into the router with a cable rather than Wi-Fi: it's the one thing that must
never drop out. Its address is reserved in the router (a *DHCP reservation*), so it's the same every
time the Mac restarts. When the leaderboard starts, it prints that address:

```
  On this Wi-Fi:   http://192.168.8.10:3000/admin
```

> **Status:** the router is on order. Until it's set up, the name and addresses above are the plan;
> this section will be confirmed once it's configured. For building and testing a sensor before then,
> any home Wi-Fi works — use whatever address the leaderboard prints at startup.

**macOS firewall:** if it's on (System Settings → Network → Firewall), the first time a device on the
network connects macOS may ask whether `node` may accept incoming connections — click **Allow**.

### Why not Bluetooth?

It can be done, but it's more moving parts: the leaderboard doesn't speak Bluetooth, so the Mac would
need an extra program running all night to listen for the sensors and pass the message on — one more
thing to start, and one more thing to fail mid-event. Wi-Fi to a local router needs nothing extra on
the Mac, reaches across a room easily, and the same boards (ESP32) have Wi-Fi built in.

---

## 2. Picking the hardware

**The board — one per corner (simplest), or one board with long wires to several sensors:**

| Board | Language | Notes |
| --- | --- | --- |
| **ESP32 dev board** (recommended) | Arduino IDE (C++) | ~$5–10, Wi-Fi built in, powered from any USB charger or power bank. Example: [`esp32-power-up/esp32-power-up.ino`](esp32-power-up/esp32-power-up.ino) |
| Raspberry Pi Pico W | MicroPython | Also cheap with Wi-Fi; same idea as the ESP32 sketch. |
| Raspberry Pi Zero 2 W / Pi 4 | Python | A full little computer; more setup, but easy to program. Example: [`pi-power-up.py`](pi-power-up.py) |

**The sensor — how "someone reached the corner" is detected:**

| Sensor | Good | Watch out for |
| --- | --- | --- |
| **Big arcade button** the kid slaps | Unmistakable, fun, never fires by accident | The kid has to hit it |
| **Pressure mat** (floor switch) | Fires exactly when someone stands there | Needs taping down; can wear out |
| **IR break-beam** across the corner | Precise, fast | Needs lining up; two parts to mount |
| **PIR motion sensor** (HC-SR501) | Cheapest, no contact | Sees *anyone* moving nearby (ghosts, staff), wide cone, ~2–3 s to re-arm — set its sensitivity low and aim it tight |

All of these just close a contact or pull a pin high/low, so the same code works with any of them.

---

## 3. What the board sends

One request, no body needed:

```
POST http://<mac-address>:3000/api/game/power-up?source=corner-ne
```

- `source` is optional: a name for the corner (letters, digits and dashes). The leaderboard's
  Terminal window then shows which sensor fired: `↳ power-up from corner-ne`.
- The reply is JSON. `"applied": true` means power mode started. `"applied": false` means there was
  no run in progress (e.g. between kids), so it was safely ignored — sending it at the wrong moment
  never breaks anything.
- If a **staff PIN** is set (`adminPin` in `config.json`), add the header `X-Admin-Pin: <pin>`.
  With no PIN (the default), no header is needed.
- To check the leaderboard is reachable at all: `GET http://<mac-address>:3000/api/health` returns
  `{"ok":true,…}`.

**How the game treats repeated triggers:** power mode lasts the **Power pellet** time from Manage
scores → Run timer (5 seconds by default). A trigger during power mode restarts it from the top. Only
the first pellet of a run (**Pellets that add time**, 1 by default) adds seconds to the run clock;
later ones still give power mode, sounds and blue ghosts, just no extra time. A motion sensor that
keeps firing while a kid stands in the corner would keep power mode going — so the examples below wait
a few seconds (`COOLDOWN`) before a sensor can fire again.

---

## 4. Test it before wiring anything

From any laptop on the event Wi-Fi, with the leaderboard running and a run started (READY → START on
the Stream Deck, or `curl -X POST http://<mac-address>:3000/api/game/start`):

```bash
curl -X POST "http://192.168.8.10:3000/api/game/power-up?source=test"
```

The TV should go into POWER MODE, and the leaderboard's Terminal shows `↳ power-up from test`. If that
works, the network is right, and the only thing left is the sensor board.

The Raspberry Pi script has the same test built in: `python3 pi-power-up.py --once`.

---

## 5. ESP32 (Arduino)

1. Install the [Arduino IDE](https://www.arduino.cc/en/software), then add ESP32 support:
   **Tools → Board → Boards Manager**, search **esp32**, install *esp32 by Espressif*.
2. Open [`esp32-power-up/esp32-power-up.ino`](esp32-power-up/esp32-power-up.ino).
3. Edit the settings at the top: Wi-Fi name and password, the Mac's address, this corner's name, and
   which pins the sensors are on.
4. **Tools → Board → ESP32 Dev Module**, pick the port, click **Upload**.
5. Open **Tools → Serial Monitor** at 115200 baud: it prints when it joins Wi-Fi and every time a
   sensor fires, with the leaderboard's reply.

Wiring for a button, mat or break-beam receiver: one wire to the GPIO pin, the other to **GND**. The
sketch turns on the chip's internal pull-up, so the pin reads LOW while the contact is closed — no
resistor needed. For a PIR sensor (which outputs HIGH when it sees motion), set `ACTIVE_LOW` to `false`
and power it from 5V/GND.

## 6. Raspberry Pi (Python)

Raspberry Pi OS already includes everything the script uses (`gpiozero` and Python's standard
library), so it works without internet.

1. Copy [`pi-power-up.py`](pi-power-up.py) to the Pi and edit the settings at the top.
2. Test the network: `python3 pi-power-up.py --once`
3. Run it: `python3 pi-power-up.py`

To start it automatically when the Pi boots, add this line with `crontab -e`:

```
@reboot python3 /home/pi/pi-power-up.py >> /home/pi/power-up.log 2>&1
```

---

## Troubleshooting

| Problem | Check |
| --- | --- |
| Board never connects to Wi-Fi | ESP32s only use **2.4 GHz** Wi-Fi — make sure the router has 2.4 GHz switched on. Check the name/password (case-sensitive). |
| Connects, but requests fail | Is the Mac on the **same** network? Is the address right (it's printed when the leaderboard starts)? Did macOS ask about the firewall? Try the `curl` test from a laptop. |
| `"applied": false` | No run in progress. Start one (READY → START) and try again. |
| `401 pin_required` | A staff PIN is set; add the `X-Admin-Pin` header (both examples have a setting for it). |
| Fires too often | Raise `COOLDOWN`; for a PIR, turn its sensitivity and time knobs down. |
| Works, then stops after a Mac restart | The Mac's address changed — set a DHCP reservation on the router (section 1). |
