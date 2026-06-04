# ESP32-S3 + GM65 QR Box

This sketch connects one ESP32 box to the school management web app and lets you reuse the same device across multiple classrooms.

## What it does

- Connects to Wi-Fi
- Loads the device config from the web app
- Reads QR codes from GM65 over UART
- Sends the QR payload to the scan endpoint
- Sends a heartbeat ping every 30 seconds

## Why this works for multiple classrooms

You only need one ESP32 box.

- Keep the same `DEVICE_ID` and `DEVICE_TOKEN` in the sketch
- In the admin page, change the box assignment to another classroom when needed
- The ESP32 refreshes its config from the server automatically

So the workflow is:

1. Put the box in room A and assign it to room A in the web admin
2. Later move it to room B
3. Update the assignment in the admin page
4. The ESP32 picks up the new config on refresh

## Required libraries

The ESP32 core already provides:

- `WiFi`
- `HTTPClient`
- `WiFiClientSecure`

No extra JSON library is required for this sketch.

## Wiring

Typical GM65 wiring:

- `GM65 TX` -> `ESP32-S3 RX`
- `GM65 RX` -> `ESP32-S3 TX`
- `GND` -> `GND`
- `VCC` -> per your module spec

## Setup

Edit these values in `esp32_qr_box.ino`:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `SERVER_BASE_URL`
- `DEVICE_ID`
- `DEVICE_TOKEN`
- `GM65_RX_PIN`
- `GM65_TX_PIN`

If your Wi-Fi has no password, leave `WIFI_PASSWORD` empty.

## Notes

- The sketch uses `setInsecure()` for HTTPS so you can get started quickly.
- For production, replace that with proper certificate validation.
- One ESP32 can serve many classrooms if you reassign the device in the web admin before moving the box.
