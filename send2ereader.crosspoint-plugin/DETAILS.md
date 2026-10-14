# Send2Ereader

Receive books on your reader through a temporary Send2Ereader session without moving files manually over USB.

## Features

- Start a new Send2Ereader session or join an existing session.
- Show a QR code and session code for fast phone or browser pairing.
- Browse books transferred into the active session.
- Download selected books directly to the reader.
- Use enhanced cover, grid/list, refresh, and touch navigation features when the firmware exposes them.

## Requirements

- The plugin system must be enabled.
- Wi-Fi and access to the configured Send2Ereader service are required for transfers.

## Notes

The same plugin package supports baseline and capability-aware firmware. Native quick-transfer sessions are intentionally temporary; reopening the plugin starts a fresh reader session instead of silently restoring an old reader token.
