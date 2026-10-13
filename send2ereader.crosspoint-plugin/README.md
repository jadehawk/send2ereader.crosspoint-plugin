# Send2Ereader for CrossPoint

Send2Ereader for CrossPoint is a native receive plugin for supported CrossPoint devices. It creates a short-lived anonymous Send2Ereader session on the reader, shows a QR code and six-character session code, and lets a phone or browser upload books into that session for direct download to the SD card.

No Send2Ereader account is required for the normal receive workflow.

## Dual-mode compatibility

Version **0.1.7** is one Plugin Hub package that adapts to the capabilities exposed by the installed firmware; there is no separate Razor-Crest plugin build.

- **Baseline plugin firmware:** keeps the core native receive flow: create a session, show the QR/session code, browse transferred books in the standard list UI, page through the catalog, and download books to `/Send2Ereader`.
- **Capability-aware/enhanced firmware:** the same package automatically enables 16-item catalog pages, list or grid layouts, book-cover thumbnails, configurable grid dimensions and row highlighting, an explicit **Refresh** action, and improved QR/manual-join presentation.
- **Touch-capable enhanced devices:** expose the touch-only **Hide pagination buttons** setting. When pagination is hidden, vertical swipes move by the next or previous visible batch; crossing the end or beginning of the fetched page advances to Next or Previous. **Refresh remains available**, and physical-button navigation is unchanged.
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
```

GitHub releases also provide a versioned package such as `send2ereader-0.1.7.zip`. Extracting that archive at the root of the SD card creates:

```text
/plugins/send2ereader/
```

with the five runtime files above inside it.

## Install with Plugin Hub

Plugin Hub is the preferred installation and update path.

1. Enable the device plugin system if it is not already enabled.
2. Open **Plugins** and launch **Plugin Hub**.
3. Open the Community catalog and refresh it if needed.
4. Find **Send2Ereader v0.1.7** and choose **Install** or **Update**.
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
7. The reader opens a single **Transfers** row. Upload, add, or remove books from the phone/browser as needed.
8. Open **Transfers** to fetch the current book catalog and select a book to download. Current CrossPoint firmware also uses the selected list-row title as the next catalog page title, so the neutral **Transfers** label is intentional.

The one-time device code, the CrossPoint reader token, the browser uploader token, and the hidden session-owner token are separate credentials. The one-time device code is never reused as the catalog/download credential.

## Catalog and refresh behavior

The Send2Ereader picker contains a single neutral **Transfers** row. Opening it fetches the current session catalog. Version 0.1.7 requests up to **16 books per catalog page**.

```text
Transfers
```



On baseline firmware, the standard native list and normal pagination remain available. Re-entering **Transfers** or changing catalog pages performs another request, so additions and removals from the active web session can be reflected without changing the plugin package.

On capability-aware/enhanced firmware, the same catalog can be shown as a list or grid with book covers. The footer provides **Refresh** independently of Prev/Next pagination, and refresh keeps the current browse context while fetching current session contents.

On touch-capable enhanced devices, **Hide pagination buttons** appears only when the firmware reports touch capability. With pagination hidden, swipe **up** moves to the next visible batch and swipe **down** moves to the previous visible batch. At a fetched-page boundary, the same gesture advances to Next or Previous. This is viewport scrolling, not cover-by-cover focus movement. Physical-button behavior is unchanged.

## Session lifecycle

The native reader credential is intentionally ephemeral. CrossPoint stores the current catalog response in:

```text
/.pcat_tmp.json
```

The reader token is embedded in that temporary response and is removed by the firmware when the native catalog/plugin flow is exited.

On X3/X4, **Back from the book list returns to Transfers; Back from the Transfers picker exits Send2Ereader. Reopening Send2Ereader creates a new QR code and a new anonymous session.**

This is intentional. The native quick-transfer workflow does not persist a reader token for reuse across plugin launches.

The server-side session itself remains available for the lifetime configured by the server administrator (commonly **15 minutes or more**) if its code is still known, but reopening the native plugin starts a fresh reader session rather than reconnecting to the previous one.

## Pagination and the firmware token-file limit

CrossPoint reloads its bearer token from `/.pcat_tmp.json` before catalog requests, so Send2Ereader keeps the native response compact. Version 0.1.7 uses a 16-item catalog page size while preserving the session-scoped token and filename-extension behavior.

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
