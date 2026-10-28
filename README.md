# Send2Ereader for CrossPoint

Send2Ereader for CrossPoint is a native receive plugin for supported CrossPoint devices. It creates a short-lived anonymous Send2Ereader session on the reader, shows a QR code and six-character session code, and lets a phone or browser upload books into that session for direct download to the SD card.

No Send2Ereader account is required for the normal receive workflow.

## Dual-mode compatibility

Version **0.1.10** is one Plugin Hub package that adapts to the capabilities exposed by the installed firmware; there is no separate Razor-Crest plugin build.

- **Baseline plugin firmware:** keeps the core native receive flow: create a session, show the QR/session code, browse transferred books in the standard list UI, page through the catalog, and download books to `/Send2Ereader`.
- **Capability-aware/enhanced firmware:** the same package automatically enables 16-item token-scoped catalog caching, native 1-bit BMP cover thumbnails, configurable list/grid layouts with a **3×2 grid default**, an explicit **Refresh** action, and improved QR/manual-join presentation. Prev/Next footer buttons are intentionally hidden; Up/Down hardware controls and touch swipes (where available) move through visible batches and cross catalog-page boundaries, while **Refresh remains available**.
- Enhanced-only fields are declarative capabilities. Firmware that does not support them ignores them and continues using the baseline behavior from the same `device.json`.

## Runtime payload

In this GitHub repository, the installable payload lives under `send2ereader.crosspoint-plugin/`. That source-repository folder is only an organization boundary; the installed plugin directory remains `send2ereader`.

Install the complete plugin payload in one of the CrossPoint plugin locations:

Preferred location:

```text
/.crosspoint/plugins/send2ereader/
```

Alternate location also supported by current firmware:

```text
/plugins/send2ereader/
```

The payload contains:

```text
manifest.json
device.json
settings.json
plugin.js
README.md
DETAILS.md
```

GitHub releases also provide a versioned package such as `send2ereader-0.1.10.zip`. Extracting that archive at the root of the SD card creates:

```text
/plugins/send2ereader/
```

with the six runtime files above inside it.

## Install with Plugin Hub

Plugin Hub is the preferred installation and update path.

1. Enable the device plugin system if it is not already enabled.
2. Open **Plugins** and launch **Plugin Hub**.
3. Open the Community catalog and refresh it if needed.
4. Find **Send2Ereader** and choose **Install** or **Update**.
5. Open Send2Ereader from the device Plugins UI after installation.

Plugin Hub discovers the published plugin release and handles the installable payload; users do not need to add a separate store URL manually. The versioned GitHub ZIP remains available as a manual installation fallback.

Books are downloaded to:

```text
/Send2Ereader
```

## Receive workflow

1. Open **Send2Ereader** from the **Plugins** button on the main/home screen, or from **Settings > System > Plugins > Send2Ereader**.
2. The plugin creates a new temporary anonymous Send2Ereader session.
3. The reader displays a QR code and a random `XXX-XXX` code.
4. Scan the QR code with a phone, or enter the displayed code in the configured Send2Ereader web UI. The default server is <https://send.techy-notes.com>.
5. When the phone/browser successfully joins that session, the pending CrossPoint authorization is approved automatically.
6. On its next poll, normally within about three seconds, the reader receives its session-scoped reader token and leaves the QR screen.
7. The reader opens a **Transfers** row. Baseline firmware also displays **Select Transfers to refresh** as an instructional fallback row. Upload, add, or remove books from the phone/browser as needed.
8. Open **Transfers** to fetch the current book catalog and select a book to download. On baseline firmware, either picker row opens the same catalog; press Back and choose **Transfers** to fetch it again.

The one-time device code, the CrossPoint reader token, the browser uploader token, and the hidden session-owner token are separate credentials. The one-time device code is never reused as the catalog/download credential.

## Catalog and refresh behavior

The Send2Ereader picker declares two rows to prevent vanilla CrossPoint from automatically skipping the picker. The second row explains how to refresh, and both rows open the same session catalog. Firmware exposing `catalog.refresh` and supporting `browse.lists[].hide_if.plugin_capability` hides the instructional row while retaining the picker and native Refresh button. The catalog requests up to **16 books per page**.

```text
Transfers
Select Transfers to refresh  (baseline only)
```



On baseline firmware, the standard native list and normal pagination remain available. Back from the book list returns to the two-row picker; choosing **Transfers** performs another request so new uploads and removals appear. The instruction row is still selectable because stock firmware does not support non-interactive catalog labels.

On capability-aware/enhanced firmware, the same catalog defaults to a 3×2 cover grid using server-generated native 1-bit BMP thumbnails. Prev/Next footer buttons are hidden and **Refresh** remains centered. Up/Down hardware controls move through the next or previous visible batch; touch devices can use swipe **up** for the next batch and swipe **down** for the previous batch. At a fetched-page boundary, the same control advances to the next or previous catalog page.

Catalog pages and covers use a token-scoped SD cache. The first visit fetches missing data, revisiting a page reuses the cache, **Refresh** bypasses the current page cache, and each newly authorized Send2Ereader reader token gets a separate cache namespace.

## Session lifecycle

The native reader credential is intentionally ephemeral. CrossPoint stores the current catalog response in:

```text
/.pcat_tmp.json
```

The reader token is embedded in that temporary response. Baseline/nightly firmware already removes `/.pcat_tmp.json` when the native catalog flow exits. Enhanced firmware additionally honors `token.persist: false`, clears the ephemeral token on catalog entry/exit, and keeps the active value only in RAM while the catalog remains open—even when page caching moves the scratch response into the cache.

On X3/X4, **Back from the book list returns to the Transfers picker; Back from the picker exits Send2Ereader. Reopening Send2Ereader creates a new QR code and a new anonymous session.**

This is intentional. The native quick-transfer workflow does not persist a reader token for reuse across plugin launches.

The server-side session itself remains available for the lifetime configured by the server administrator (commonly **15 minutes or more**) if its code is still known, but reopening the native plugin starts a fresh reader session rather than reconnecting to the previous one.

## Pagination and the firmware token-file limit

Baseline/nightly firmware reloads the bearer token from `/.pcat_tmp.json` before catalog requests and deletes that scratch file on exit. Enhanced firmware may keep the same explicitly ephemeral token in RAM for the open catalog session so token-scoped caching can safely move the scratch response. Version 0.1.10 uses a 16-item catalog page size while preserving session isolation and filename-extension behavior.

Enhanced layouts may display fewer than 16 books at once depending on the configured grid/list viewport. Swipe navigation advances through those visible batches inside the already fetched page before crossing the boundary to the next or previous catalog page.

## Optional browser settings plugin

`plugin.js` provides the browser/settings-side Send2Ereader controls for configuration and manual session management. The page shows the installed plugin version and checks the latest published GitHub release; an **Update available** label appears only when the published release version is numerically newer than the installed version. On firmware that exposes the newer `api.dir` plugin-directory API, the WebUI reads its own `manifest.json` from its actual runtime directory. Older firmware remains supported by falling back to `/.crosspoint/plugins/send2ereader/manifest.json`. Published Send2Ereader releases now use three-part `MAJOR.MINOR.PATCH` versions. The browser comparator still accepts legacy four-part installed versions so existing `0.1.2.1` installations can upgrade normally to `0.1.3` and later releases, and it quietly falls back to the installed version when GitHub cannot be reached. With a session active, the WebUI also shows the current session books, can refresh the catalog without leaving the page, and can download one book or all listed books directly to the SD card using CrossPoint's streamed `fetchToSd` API. While a book is streaming, the page polls the destination folder and shows the current percentage and transferred bytes. Completed files are detected by filename and expected size, and their per-book control changes to a disabled **Downloaded** button, including after the page is reopened or the catalog is refreshed.

The browser-side **Download folder** setting controls these streamed downloads. Native `device.json` downloads continue to use `/Send2Ereader`, because current firmware does not template `download.dest_dir`.

When the CrossPoint web page is reopened, the plugin validates any saved session before restoring it. Closed, expired, deleted, or otherwise unauthorized saved sessions are cleared locally instead of being shown as active. Session close uses a JSON acknowledgement when the server supports it and verifies closure when older firmware reports an empty successful response as `response truncated`.

Persistent settings are stored at:

```text
/.crosspoint/send2ereader-settings.json
```

The WebUI creates this file automatically when missing. The production server is fixed at `https://send.techy-notes.com`: the Server URL is shown in the WebUI as read-only, and any older settings file containing a different server is normalized back to production with session credentials for the old host cleared. Native CrossPoint authentication, catalog browsing, and downloads do not depend on this settings file, so a fresh plugin install works before WebUI Settings has ever been opened.

The current browser UI does **not** include a Debug Log section or log-management buttons. Internal troubleshooting events are still written in the background to:

```text
/.crosspoint/send2ereader.log
```

Session credentials are redacted from logged server responses.

## Supported transfers

The server accepts its configured Send2Ereader formats. The standard configuration includes EPUB, PDF, KEPUB, CBZ, CBR, and TXT, with optional additional extensions configurable on the server.

## Sending from CrossPoint

This release is receive-focused. The current CrossPoint SD-plugin API can stream a remote book down to the SD card, but it does not expose the reverse streamed SD-card-to-HTTP multipart upload primitive required for safe direct sending from the reader.

Direct sending can be added later if the CrossPoint plugin runtime exposes a suitable streamed upload operation.

## Support

If you find the plugin useful, you can support development here:

<https://buymeacoffee.com/jadehawk>

Tutorials, demos, and project updates are available on YouTube:

<https://youtube.com/jadehawk>
