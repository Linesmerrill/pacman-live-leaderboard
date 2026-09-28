// Pac-Man Maze — power-up sensor for an ESP32 (Arduino IDE).
//
// When a sensor in a maze corner fires, this sends one request to the leaderboard and the game goes
// into POWER MODE. See hardware/README.md for the network setup and wiring.
//
// Boards: any ESP32 dev board ("ESP32 Dev Module" in Tools → Board).
// Sensors: buttons, pressure mats, break-beams, or PIR motion sensors — one per GPIO pin below.

#include <WiFi.h>
#include <HTTPClient.h>

// ---------- Settings: edit these ----------

const char* WIFI_NAME = "PacManMaze";        // the event router's Wi-Fi name (2.4 GHz)
const char* WIFI_PASSWORD = "change-me";
const char* LEADERBOARD = "http://192.168.8.10:3000";  // the Mac mini's address, no trailing slash
const char* STAFF_PIN = "";                   // only if adminPin is set in config.json

// One entry per sensor wired to this board: the GPIO pin, and a name the leaderboard log will show.
struct Sensor {
  int pin;
  const char* name;
};
Sensor SENSORS[] = {
  {13, "corner-ne"},
  // {14, "corner-nw"},   // more sensors on the same board: add a line each
};

// Buttons, mats and break-beams connect the pin to GND when triggered → true.
// PIR motion sensors output HIGH when they see someone → set this to false.
const bool ACTIVE_LOW = true;

// Seconds before the same sensor can fire again, so a kid standing still doesn't keep re-triggering.
const unsigned long COOLDOWN_MS = 8000;

// ---------- The rest ----------

// The on-board light blinks while a request is sent. Not every ESP32 board defines one.
#ifdef LED_BUILTIN
const int LED_PIN = LED_BUILTIN;
#else
const int LED_PIN = -1;
#endif

const int SENSOR_COUNT = sizeof(SENSORS) / sizeof(SENSORS[0]);
bool wasTriggered[sizeof(SENSORS) / sizeof(SENSORS[0])] = {false};
unsigned long lastFired[sizeof(SENSORS) / sizeof(SENSORS[0])] = {0};

bool triggered(int pin) {
  int level = digitalRead(pin);
  return ACTIVE_LOW ? level == LOW : level == HIGH;
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Joining Wi-Fi \"%s\"", WIFI_NAME);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_NAME, WIFI_PASSWORD);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
    delay(250);
    Serial.print('.');
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nConnected, this board is %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nCould not join Wi-Fi yet; will keep trying.");
  }
}

// Sends POST /api/game/power-up. "applied":false in the reply just means no run was in progress.
void powerUp(const char* source) {
  connectWifi();
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(LEADERBOARD) + "/api/game/power-up?source=" + source;
  http.begin(url);
  http.setTimeout(3000);
  if (strlen(STAFF_PIN) > 0) http.addHeader("X-Admin-Pin", STAFF_PIN);
  int status = http.POST("");
  if (status > 0) {
    String body = http.getString();
    bool applied = body.indexOf("\"applied\":true") >= 0;
    Serial.printf("%s → HTTP %d, %s\n", source, status, applied ? "POWER MODE!" : "ignored (no run in progress)");
  } else {
    Serial.printf("%s → could not reach the leaderboard (%s)\n", source, http.errorToString(status).c_str());
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\nPac-Man Maze power-up sensor");
  for (int i = 0; i < SENSOR_COUNT; i++) {
    pinMode(SENSORS[i].pin, ACTIVE_LOW ? INPUT_PULLUP : INPUT);
  }
  if (LED_PIN >= 0) pinMode(LED_PIN, OUTPUT);
  connectWifi();
}

void loop() {
  for (int i = 0; i < SENSOR_COUNT; i++) {
    bool now = triggered(SENSORS[i].pin);
    // Fire on the moment it becomes triggered, not all the while it stays triggered.
    if (now && !wasTriggered[i] && millis() - lastFired[i] > COOLDOWN_MS) {
      lastFired[i] = millis();
      if (LED_PIN >= 0) digitalWrite(LED_PIN, HIGH);
      powerUp(SENSORS[i].name);
      if (LED_PIN >= 0) digitalWrite(LED_PIN, LOW);
    }
    wasTriggered[i] = now;
  }
  delay(20);  // also debounces buttons and mats
}
