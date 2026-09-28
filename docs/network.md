# Event network

The attraction brings its own Wi-Fi: a **GL.iNet Opal travel router (GL-SFT1200)** with no internet
connected. The Mac, the staff tablets and the power-up sensors all join it, so nothing depends on the
venue's Wi-Fi.

← [All guides](README.md)

```
                 ┌─ Mac mini (leaderboard) ── Ethernet cable into a LAN port, fixed at 192.168.8.10
 GL.iNet Opal ───┼─ staff tablets / phones ── Wi-Fi
 (no internet)   └─ sensor boards (ESP32/Pi) ─ Wi-Fi, 2.4 GHz
```

| | |
| --- | --- |
| **Wi-Fi name** | `PacManMaze` (both 2.4 and 5 GHz) |
| **Wi-Fi password** | `wakawaka` |
| **The leaderboard** | `http://192.168.8.10:3000`, the Mac mini's reserved address |
| **Staff entry on a tablet** | `http://192.168.8.10:3000/admin` |
| **Power-up for sensors** | `POST http://192.168.8.10:3000/api/game/power-up` |
| **Router's settings page** | `http://192.168.8.1` (works with no internet) |

## Setting up at the event

1. Power the router. Leave its **WAN** port empty: that's only for bringing internet in.
2. Plug the Mac into one of the router's **LAN** ports with an Ethernet cable. The Mac is cabled
   rather than on Wi-Fi because it's the one thing that must never drop out.
3. Start the leaderboard. Among the addresses it prints you should see
   `On this Wi-Fi: http://192.168.8.10:3000/admin`.
4. Join `PacManMaze` on a phone and open `http://192.168.8.10:3000`. If the board loads, the network
   is working.

If the Mac's Firewall is on (System Settings → Network → Firewall), macOS may ask the first time
whether `node` may accept incoming connections: click **Allow**.

## Setting up the router from scratch

The router is already set up. If it's ever reset to factory settings, or you're using a new one:

1. Plug the Mac into a **LAN** port and open `http://192.168.8.1`. Choose a language and set an admin
   password (keep it with the kit).
2. **Wireless.** On the **5GHz WiFi** card click **Modify**, set **Wi-Fi Name** to `PacManMaze` and
   **Wi-Fi Password** to `wakawaka`, and **Apply**. Do the same on the **2.4GHz WiFi** card. Keep both
   switched on: ESP32 sensor boards can only use 2.4 GHz.
3. **Network → LAN.** Under the address reservation note, click **Add**, pick the Mac from the MAC
   list, set the IP to `192.168.8.10`, and **Submit**.
4. Unplug the Mac's cable for a few seconds and plug it back in, so it picks up its new address. Check
   with `ipconfig getifaddr en0` in Terminal: it should print `192.168.8.10`.
5. Test from a phone as in step 4 above.

Using a different router or address? Everything still works: use whatever address the leaderboard
prints at startup, and change it in the sensor code and the Stream Deck's Connection setting.

## Why not Bluetooth for the sensors?

It can be done, but it's more moving parts: the leaderboard doesn't speak Bluetooth, so the Mac would
need an extra program running all night to listen for the sensors and pass the message on. That's one
more thing to start and one more thing to fail mid-event. Wi-Fi to a local router needs nothing extra
on the Mac, easily reaches across the room, and ESP32 boards have Wi-Fi built in.
