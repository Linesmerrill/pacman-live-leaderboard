#!/usr/bin/env python3
"""Pac-Man Maze — power-up sensor for a Raspberry Pi.

When a sensor in a maze corner fires, this sends one request to the leaderboard and the game goes
into POWER MODE. See docs/sensors.md for the network setup and wiring.

    python3 pi-power-up.py           watch the sensors
    python3 pi-power-up.py --once    send one power-up now, to test the network

Uses only what ships with Raspberry Pi OS (gpiozero and the Python standard library), so it runs
without internet.
"""

import json
import sys
import time
import urllib.error
import urllib.request

# ---------- Settings: edit these ----------

LEADERBOARD = "http://192.168.8.10:3000"  # the Mac mini's address, no trailing slash
STAFF_PIN = ""  # only if adminPin is set in config.json

# One entry per sensor: GPIO number (BCM numbering) → the name the leaderboard log will show.
SENSORS = {
    17: "corner-ne",
    # 27: "corner-nw",
}

# Buttons, mats and break-beams connect the pin to GND when triggered → True.
# PIR motion sensors output HIGH when they see someone → set this to False.
ACTIVE_LOW = True

# Seconds before the same sensor can fire again, so a kid standing still doesn't keep re-triggering.
COOLDOWN = 8

# ---------- The rest ----------


def power_up(source):
    """POST /api/game/power-up. Returns the leaderboard's reply, or None if it couldn't be reached."""
    request = urllib.request.Request(f"{LEADERBOARD}/api/game/power-up?source={source}", data=b"", method="POST")
    if STAFF_PIN:
        request.add_header("X-Admin-Pin", STAFF_PIN)
    try:
        with urllib.request.urlopen(request, timeout=3) as response:
            reply = json.load(response)
    except urllib.error.HTTPError as err:
        print(f"{source} → HTTP {err.code}: {err.read().decode(errors='replace')[:200]}", flush=True)
        return None
    except (urllib.error.URLError, TimeoutError, OSError) as err:
        print(f"{source} → could not reach the leaderboard at {LEADERBOARD} ({err})", flush=True)
        return None
    # "applied": false just means no run was in progress — nothing went wrong.
    print(f"{source} → {'POWER MODE!' if reply.get('applied') else 'ignored (no run in progress)'}", flush=True)
    return reply


def watch():
    from gpiozero import Button  # only needed on the Pi itself, not for --once

    last_fired = {}

    def fire(name):
        now = time.monotonic()
        if now - last_fired.get(name, -COOLDOWN) < COOLDOWN:
            return
        last_fired[name] = now
        power_up(name)

    sensors = []
    for pin, name in SENSORS.items():
        # pull_up=True: triggered when the contact closes to GND. False: triggered when the pin goes HIGH.
        sensor = Button(pin, pull_up=ACTIVE_LOW, bounce_time=0.05)
        sensor.when_pressed = lambda name=name: fire(name)
        sensors.append(sensor)
        print(f"Watching GPIO {pin} as {name}", flush=True)

    print(f"Sending power-ups to {LEADERBOARD}. Ctrl+C to stop.", flush=True)
    while True:
        time.sleep(3600)


if __name__ == "__main__":
    if "--once" in sys.argv:
        reply = power_up("test")
        sys.exit(0 if reply is not None else 1)
    watch()
