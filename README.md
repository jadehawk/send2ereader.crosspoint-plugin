# Send2Ereader for CrossPoint

Send2Ereader for CrossPoint is a native receive plugin for CrossPoint X3/X4 devices. It creates a short-lived anonymous Send2Ereader session on the reader, shows a QR code and six-character session code, and lets a phone or browser upload books into that session for direct download to the SD card.

No Send2Ereader account is required for the normal receive workflow.

## Runtime payload

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
plugin.js
README.md
```

GitHub releases also provide a versioned package such as `send2ereader-0.1.5.zip`. Extracting that archive at the root of the SD card creates:

```text
/plugins/send2ereader/
```

with the four runtime files above inside it.

## Install from the CrossPoint Plugin Store

The easiest installation method is to add the Send2Ereader catalog to the CrossPoint Plugin Store from the device WebUI.

1. Open the CrossPoint device WebUI in a browser.
2. Open **Settings** and find the **Plugin Store** card.
3. Under **Stores**, paste this catalog URL:

```text
https://raw.githubusercontent.com/jadehawk/send2ereader.crosspoint-plugin/main/catalog.json
```

4. Select **Add store**.
5. Select **Save & refresh**.
6. Find **Send2Ereader** in the refreshed catalog and select **Install**.
7. Reconnect to the device or reopen **Settings** if needed. Send2Ereader will then be available from the Plugins UI and under **Settings > System > Plugins**.

Once the Send2Ereader catalog has been added, future catalog refreshes can expose updated plugin versions from the same URL.

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

The native catalog shows **8 books per page**. The picker contains a single neutral row:

```text
Transfers
```

Current CrossPoint firmware uses the selected `browse.lists[]` row as the next catalog page title, so **Transfers** is intentionally both the picker action and the catalog title.

On button-based **X3/X4** devices, **Back** from the book list returns to the Transfers row. Opening it again performs a fresh catalog request, so newly uploaded books appear and books removed from the active web session disappear.

For sessions with **9 or more books**, using **Next page** or **Previous page** also performs a fresh catalog request, so additions and removals are reflected while paging.

### Current touch-device firmware limitation

Current CrossPoint firmware does not expose an on-screen **Back** equivalent inside the generic `PluginCatalogActivity` on touch-only devices such as the **Xteink X4Pro** and **Seeed reTerminal Sticky**. This is a CrossPoint plugin-system limitation, not a Send2Ereader-specific behavior; the same navigation trap can be reproduced in other declarative catalog plugins such as BookFusion.

On those touch devices:

- With **8 or fewer books**, there is no Next/Previous pager row and no touch Back control to return to **Transfers**. To fetch a changed list, exit Send2Ereader and reopen it. Because Send2Ereader sessions are intentionally ephemeral, reopening creates a **new session and QR code**.
- With **9 or more books**, **Next/Previous** remains usable and each page change fetches fresh catalog data, so additions and removals can be observed without reopening the plugin.
- An empty catalog has the same limitation: without a pager row or physical Back button, the user must exit and reopen the plugin.

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

CrossPoint reloads its bearer token from `/.pcat_tmp.json` before fetching another catalog page, and the current firmware limits that token file to 2 KB. Send2Ereader therefore uses a compact CrossPoint-only catalog response.

Each request returns up to 8 visible books plus one hidden look-ahead record used to determine whether **Next page** should be shown. The server keeps the serialized native response below the firmware limit and only shortens unusually long displayed filenames when necessary, preserving the file extension.

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
