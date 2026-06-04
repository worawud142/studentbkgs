#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ============================================================
// ESP32-S3 + GM65 QR Box
//
// - Connects to Wi-Fi
// - Fetches device config from the school management web app
// - Reads QR codes from GM65 over UART
// - Sends scans to the server as attendance check-ins
// - Supports one ESP32 used across multiple classrooms by changing
//   the assignment in the admin page and letting the ESP refresh config
// ============================================================

// -------------------- Wi-Fi --------------------
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = ""; // Leave empty for open Wi-Fi

// -------------------- Server -------------------
// Example: https://studentbkgs.onrender.com
const char* SERVER_BASE_URL = "https://studentbkgs.onrender.com";

// This identifies the physical ESP32 box in the admin panel.
// Keep it the same, and just reassign the box to another classroom
// from the web admin when you want to move rooms.
const int DEVICE_ID = 1;

// Device token copied from the QR box page.
const char* DEVICE_TOKEN = "PUT_YOUR_DEVICE_TOKEN_HERE";

// -------------------- GM65 UART ----------------
static const int GM65_RX_PIN = 18; // ESP32 receives from GM65 TX
static const int GM65_TX_PIN = 17; // ESP32 transmits to GM65 RX
static const uint32_t GM65_BAUD = 9600;

// -------------------- Feedback I/O -------------
// Disabled for now. You can enable these later if you want beeps / LEDs.
static const int STATUS_LED_PIN = -1;
static const int GREEN_LED_PIN = -1;
static const int RED_LED_PIN = -1;
static const int BUZZER_PIN = -1;
static const bool LED_ACTIVE_HIGH = true;
static const bool BUZZER_ACTIVE_HIGH = true;

// -------------------- Timing -------------------
static const unsigned long WIFI_RETRY_INTERVAL_MS = 5000;
static const unsigned long HEARTBEAT_INTERVAL_MS = 30000;
static const unsigned long CONFIG_REFRESH_INTERVAL_MS = 5UL * 60UL * 1000UL;
static const unsigned long DUPLICATE_SCAN_LOCK_MS = 1500;

// -------------------- State --------------------
HardwareSerial GM65(1);
WiFiClientSecure secureClient;

struct DeviceConfig {
  bool loaded = false;
  bool active = true;
  String name;
  String scanEndpoint;
  String pingEndpoint;
  String serverDate;
  int assignmentId = 0;
};

DeviceConfig deviceConfig;

String lineBuffer;
String lastScanValue;
unsigned long lastScanAt = 0;
unsigned long lastHeartbeatAt = 0;
unsigned long lastWifiAttemptAt = 0;
unsigned long lastConfigRefreshAt = 0;

// -------------------- Helpers ------------------
String trimTrailingSlash(String value) {
  while (value.endsWith("/")) {
    value.remove(value.length() - 1);
  }
  return value;
}

String buildUrl(const String& maybeRelativePath) {
  if (maybeRelativePath.startsWith("http://") || maybeRelativePath.startsWith("https://")) {
    return maybeRelativePath;
  }
  return String(trimTrailingSlash(SERVER_BASE_URL)) + maybeRelativePath;
}

void printWifiStatus() {
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WIFI] connected, IP=");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("[WIFI] disconnected");
  }
}

void setOutputPin(int pin, bool active) {
  if (pin < 0) return;
  digitalWrite(pin, active ? (LED_ACTIVE_HIGH ? HIGH : LOW) : (LED_ACTIVE_HIGH ? LOW : HIGH));
}

void setBuzzerPin(bool active) {
  if (BUZZER_PIN < 0) return;
  digitalWrite(BUZZER_PIN, active ? (BUZZER_ACTIVE_HIGH ? HIGH : LOW) : (BUZZER_ACTIVE_HIGH ? LOW : HIGH));
}

void beep(int count, int onMs, int offMs) {
  if (BUZZER_PIN < 0) return;
  for (int i = 0; i < count; i++) {
    setBuzzerPin(true);
    delay(onMs);
    setBuzzerPin(false);
    if (i + 1 < count) {
      delay(offMs);
    }
  }
}

void showSuccessFeedback() {
  setOutputPin(STATUS_LED_PIN, true);
  setOutputPin(GREEN_LED_PIN, true);
  setOutputPin(RED_LED_PIN, false);
  beep(1, 90, 0);
  delay(80);
  setOutputPin(GREEN_LED_PIN, false);
  setOutputPin(STATUS_LED_PIN, false);
}

void showErrorFeedback() {
  setOutputPin(STATUS_LED_PIN, true);
  setOutputPin(GREEN_LED_PIN, false);
  setOutputPin(RED_LED_PIN, true);
  beep(2, 70, 60);
  delay(120);
  setOutputPin(RED_LED_PIN, false);
  setOutputPin(STATUS_LED_PIN, false);
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWifiAttemptAt < WIFI_RETRY_INTERVAL_MS) return;
  lastWifiAttemptAt = now;

  Serial.printf("[WIFI] connecting to %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  if (strlen(WIFI_PASSWORD) == 0) {
    WiFi.begin(WIFI_SSID);
  } else {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}

bool postJson(const String& url, const String& body, String* responseBody = nullptr, int* responseCode = nullptr) {
  if (WiFi.status() != WL_CONNECTED) return false;

  secureClient.setInsecure(); // Easy setup for internal testing

  HTTPClient http;
  if (!http.begin(secureClient, url)) {
    Serial.println("[HTTP] begin failed");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  http.addHeader("x-device-token", DEVICE_TOKEN);

  int code = http.POST((uint8_t*)body.c_str(), body.length());
  if (responseCode) *responseCode = code;

  String response = http.getString();
  if (responseBody) *responseBody = response;

  http.end();
  return code > 0;
}

bool getJson(const String& url, String* responseBody = nullptr, int* responseCode = nullptr) {
  if (WiFi.status() != WL_CONNECTED) return false;

  secureClient.setInsecure();
  HTTPClient http;
  if (!http.begin(secureClient, url)) {
    Serial.println("[HTTP] begin failed");
    return false;
  }

  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  http.addHeader("x-device-token", DEVICE_TOKEN);

  int code = http.GET();
  if (responseCode) *responseCode = code;

  String response = http.getString();
  if (responseBody) *responseBody = response;

  http.end();
  return code > 0;
}

bool refreshDeviceConfig() {
  String url = String(trimTrailingSlash(SERVER_BASE_URL)) + "/api/qr-boxes/" + String(DEVICE_ID) + "/config";
  String response;
  int code = 0;
  if (!getJson(url, &response, &code)) {
    Serial.println("[CFG] request failed");
    return false;
  }

  if (code < 200 || code >= 300) {
    Serial.printf("[CFG] HTTP %d\n", code);
    Serial.println(response);
    return false;
  }

  DynamicJsonDocument doc(4096);
  DeserializationError err = deserializeJson(doc, response);
  if (err) {
    Serial.print("[CFG] JSON parse error: ");
    Serial.println(err.c_str());
    return false;
  }

  JsonObject device = doc["device"].as<JsonObject>();
  deviceConfig.loaded = true;
  deviceConfig.active = device["isActive"] | true;
  deviceConfig.name = device["name"] | "";
  deviceConfig.assignmentId = device["assignmentId"] | 0;
  deviceConfig.scanEndpoint = doc["scanEndpoint"] | "";
  deviceConfig.pingEndpoint = doc["pingEndpoint"] | "";
  deviceConfig.serverDate = doc["serverDate"] | "";

  lastConfigRefreshAt = millis();

  Serial.println("[CFG] loaded");
  Serial.print("[CFG] name=");
  Serial.println(deviceConfig.name);
  Serial.print("[CFG] active=");
  Serial.println(deviceConfig.active ? "true" : "false");
  Serial.print("[CFG] assignmentId=");
  Serial.println(deviceConfig.assignmentId);
  Serial.print("[CFG] scan=");
  Serial.println(deviceConfig.scanEndpoint);
  Serial.print("[CFG] ping=");
  Serial.println(deviceConfig.pingEndpoint);
  return true;
}

bool sendPing() {
  if (!deviceConfig.loaded || deviceConfig.pingEndpoint.length() == 0) {
    return false;
  }

  String response;
  int code = 0;
  bool ok = postJson(buildUrl(deviceConfig.pingEndpoint), "{}", &response, &code);
  Serial.printf("[PING] ok=%d code=%d\n", ok ? 1 : 0, code);
  if (response.length() > 0) {
    Serial.println("[PING] " + response);
  }
  return ok && code >= 200 && code < 300;
}

void handleScanResult(const String& rawValue) {
  String value = rawValue;
  value.trim();
  if (value.length() == 0) return;

  unsigned long now = millis();
  if (value == lastScanValue && (now - lastScanAt) < DUPLICATE_SCAN_LOCK_MS) {
    Serial.println("[SCAN] duplicate ignored");
    return;
  }

  lastScanValue = value;
  lastScanAt = now;

  if (!deviceConfig.loaded) {
    Serial.println("[SCAN] config not loaded yet");
    return;
  }
  if (!deviceConfig.active) {
    Serial.println("[SCAN] device inactive");
    return;
  }
  if (deviceConfig.scanEndpoint.length() == 0) {
    Serial.println("[SCAN] scan endpoint missing");
    return;
  }

  String payload = String("{\"rawValue\":\"");
  String escaped = value;
  escaped.replace("\\", "\\\\");
  escaped.replace("\"", "\\\"");
  payload += escaped;
  payload += "\"}";

  String response;
  int code = 0;
  bool ok = postJson(buildUrl(deviceConfig.scanEndpoint), payload, &response, &code);

  Serial.println("[SCAN] raw=" + value);
  Serial.printf("[SCAN] ok=%d code=%d\n", ok ? 1 : 0, code);
  if (response.length() > 0) {
    Serial.println("[SCAN] " + response);
  }

  if (ok && code >= 200 && code < 300) {
    Serial.println("[LED] success");
    showSuccessFeedback();
  } else {
    Serial.println("[LED] fail");
    showErrorFeedback();
  }
}

void readGM65Serial() {
  while (GM65.available()) {
    char c = static_cast<char>(GM65.read());
    if (c == '\r' || c == '\n') {
      if (lineBuffer.length() > 0) {
        handleScanResult(lineBuffer);
        lineBuffer = "";
      }
    } else {
      if (lineBuffer.length() < 250) {
        lineBuffer += c;
      } else {
        lineBuffer = "";
      }
    }
  }
}

void ensureConfigLoaded() {
  unsigned long now = millis();
  if (!deviceConfig.loaded || (now - lastConfigRefreshAt) >= CONFIG_REFRESH_INTERVAL_MS) {
    if (WiFi.status() == WL_CONNECTED) {
      refreshDeviceConfig();
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("ESP32-S3 QR Box booting...");

  if (STATUS_LED_PIN >= 0) pinMode(STATUS_LED_PIN, OUTPUT);
  if (GREEN_LED_PIN >= 0) pinMode(GREEN_LED_PIN, OUTPUT);
  if (RED_LED_PIN >= 0) pinMode(RED_LED_PIN, OUTPUT);
  if (BUZZER_PIN >= 0) pinMode(BUZZER_PIN, OUTPUT);
  setOutputPin(STATUS_LED_PIN, false);
  setOutputPin(GREEN_LED_PIN, false);
  setOutputPin(RED_LED_PIN, false);
  setBuzzerPin(false);

  GM65.begin(GM65_BAUD, SERIAL_8N1, GM65_RX_PIN, GM65_TX_PIN);

  connectWifi();

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();
  printWifiStatus();

  if (WiFi.status() == WL_CONNECTED) {
    refreshDeviceConfig();
    sendPing();
    lastHeartbeatAt = millis();
  }
}

void loop() {
  connectWifi();

  if (WiFi.status() == WL_CONNECTED) {
    ensureConfigLoaded();

    unsigned long now = millis();
    if (deviceConfig.loaded && (now - lastHeartbeatAt) >= HEARTBEAT_INTERVAL_MS) {
      sendPing();
      lastHeartbeatAt = now;
    }
  }

  readGM65Serial();
  delay(10);
}
