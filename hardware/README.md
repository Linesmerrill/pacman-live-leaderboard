# Power-up sensor examples

Example code for the maze-corner sensors that trigger POWER MODE. **The full guide (network, parts,
wiring, testing) is [docs/sensors.md](../docs/sensors.md).**

| File | For |
| --- | --- |
| [`esp32-power-up/esp32-power-up.ino`](esp32-power-up/esp32-power-up.ino) | An ESP32 board, from the Arduino IDE |
| [`pi-power-up.py`](pi-power-up.py) | A Raspberry Pi, in Python (`--once` sends a single test trigger) |

Both are set up for the event Wi-Fi (`PacManMaze`, password `wakawaka`) and the leaderboard at
`http://192.168.8.10:3000`; edit the settings at the top of the file for your corners and pins.
