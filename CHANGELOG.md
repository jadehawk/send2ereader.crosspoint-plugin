# Changelog

All notable changes to the Send2Ereader CrossPoint plugin are documented here.

## [0.1.2.1] - 2026-10-01

### Changed

- Publish the independent `send2ereader.crosspoint-plugin` repository for Plugin Hub discovery and installation testing.
- Point the plugin catalog, README install URL, and WebUI release check at the new repository while preserving the existing `send2ereader` plugin ID and install path.

## [0.1.2] - 2026-10-01

### Added

- The browser WebUI now shows the installed plugin version and checks the latest published GitHub release for a newer three-part or four-part version.
- When a newer release exists, the WebUI displays an **Update available** label with the available version. Older or equal published versions are never presented as updates.

### Changed

- Native CrossPoint device-code authorization now identifies the client as `send2ereader-crosspoint` instead of the legacy `koreader` value.

## [0.1.1] - 2026-10-01

This release fixes custom server support so the CrossPoint WebUI and native reader plugin now use the same saved server configuration.

### Fixed

- The native CrossPoint plugin now uses the same saved Send2Ereader server URL as the WebUI settings plugin instead of falling back to `https://send.techy-notes.com`.
- Native authentication, token polling, catalog browsing, and book downloads all use the shared `serverUrl` from `/.crosspoint/send2ereader-settings.json`.
- The WebUI now creates the shared settings file automatically when it is missing.
- Invalid or malformed server settings are repaired back to the default server while preserving other valid settings where possible.
- Saved session credentials are cleared when the configured server changes or when an invalid server setting is repaired, preventing credentials from one server from being reused against another.

### Compatibility

- Existing installations that have never changed the server continue to use `https://send.techy-notes.com`.
- Existing valid custom server URLs are preserved and now apply to both the WebUI and the native CrossPoint plugin.

## [0.1.0] - 2026-09-27

### Initial release

- Create temporary Send2Ereader receive sessions directly from CrossPoint.
- Display a QR code and six-character join code for phone/browser uploads.
- Browse session books through the native CrossPoint plugin catalog with pagination.
- Download books directly to `/Send2Ereader` on the SD card.
- Join existing Send2Ereader sessions from the browser settings plugin.
- Configure the Send2Ereader server URL and browser-side download folder.
- Install through the CrossPoint Plugin Store catalog or a versioned GitHub release ZIP.
