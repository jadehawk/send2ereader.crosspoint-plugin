# Changelog

All notable changes to the Send2Ereader CrossPoint plugin are documented here.

## [0.1.8] - 2026-10-14

### Changed

- Promote the nightly/Razor-Crest validated ephemeral-token fallback: use firmware-owned `/.pcat_tmp.json` with `token.persist: false`, so baseline/nightly firmware deletes the credential on exit while enhanced firmware keeps it only in RAM for the open catalog session.
- Add token-scoped SD caching for catalog pages and covers, preserving revisits within one authorized session while separating every newly authorized reader token into its own cache namespace.
- Switch catalog covers to the server-generated `crosspoint-thumb` native 1-bit BMP variant, avoiding JPEG/PNG decode, resize, and dithering work on enhanced readers.
- Default enhanced browsing to a 3×2 cover grid and hide Prev/Next footer buttons; Refresh remains available, with hardware Up/Down and touch swipes handling visible-batch and page-boundary navigation.
- Remove the obsolete touch-only `Hide pagination buttons` setting now that the tested dual-mode package handles navigation consistently across supported hardware.
- Update Plugin Hub and session-lifecycle documentation for the single package tested successfully on nightly firmware, Razor-Crest, and nightly again.

## [0.1.7] - 2026-10-13

### Changed

- Promote the tested Razor-Crest catalog UI to the production plugin with 16-item catalog pages, grid/list layouts, cover thumbnails, manual refresh, and configurable row highlighting.
- Add touch-only `Hide pagination buttons` support while keeping Refresh available and preserving physical-button navigation.
- Improve session authentication presentation with the server URL, QR join hint, and manual Join Session fallback text.
- Include `settings.json` in catalog installs and release ZIPs, and show `v0.1.7` in the plugin title.
- Document the single-package dual-mode behavior for baseline and capability-aware firmware, including enhanced grid/list covers, Refresh, touch swipe paging, and touch-only hidden pagination.
- Replace obsolete store-based installation instructions with the firmware-agnostic **Plugin Hub** workflow.

## [0.1.6] - 2026-10-07

### Changed

- Adopt the Plugin Hub folder-first repository standard by moving the installable payload into `send2ereader.crosspoint-plugin/` while preserving the installed `/plugins/send2ereader/` layout.
- Keep the plugin README inside the installable payload so it travels with catalog and release installs; retain an identical root README for the GitHub repository landing page.
- Add explicit manifest `name` and `files` metadata and point the repository catalog at the payload directory.

## [0.1.5] - 2026-10-04

### Fixed

- Restore the native CrossPoint service endpoints to the production `https://send.techy-notes.com` host so a fresh install can start a receive session before the WebUI has created `/.crosspoint/send2ereader-settings.json`.
- Remove the native `device.json` dependency on `serverUrl`; the WebUI now shows the production server URL as read-only and normalizes any older custom server value back to `https://send.techy-notes.com`, clearing session credentials tied to the old host.

## [0.1.4] - 2026-10-01

### Changed

- Use the newer firmware `api.dir` plugin-directory API when available to locate Send2Ereader's own `manifest.json` for WebUI self-version detection.
- Keep older firmware compatible by falling back to `/.crosspoint/plugins/send2ereader/manifest.json` when `api.dir` is unavailable.
- Keep the shared `/.crosspoint/send2ereader-settings.json` configuration and `/.crosspoint/send2ereader.log` paths unchanged because the native `device.json` and browser UI share that configuration.
- Add browser regression tests covering both legacy firmware and the newer `api.dir` API shape.

## [0.1.3] - 2026-10-01

### Changed

- Return published plugin versions to the three-part `MAJOR.MINOR.PATCH` format used by the CrossPoint firmware plugin catalog.
- Keep browser-side update comparison backward-compatible with existing four-part installations such as `0.1.2.1`, allowing them to upgrade normally to `0.1.3`.

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
- Install through Plugin Hub or a versioned GitHub release ZIP.
