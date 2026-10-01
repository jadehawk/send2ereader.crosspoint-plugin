CrossPoint.registerPlugin(async (container, api) => {
  const CONFIG_PATH = '/.crosspoint/send2ereader-settings.json';
  const LOG_PATH = '/.crosspoint/send2ereader.log';
  const DEFAULT_SERVER = 'https://send.techy-notes.com';
  const DEFAULT_DOWNLOAD_DIR = '/Send2Ereader';
  const MAX_LOG_CHARS = 24000;

  container.innerHTML =
    '<h2>Send2Ereader</h2>' +
    '<p id="s2e-status">Loading configuration...</p>' +
    '<div class="setting-row"><span class="setting-name">Server URL</span>' +
    '<span class="setting-control"><input type="text" id="s2e-server"></span></div>' +
    '<div class="setting-row"><span class="setting-name">Download folder</span>' +
    '<span class="setting-control"><input type="text" id="s2e-folder"></span></div>' +
    '<div class="setting-row">' +
    '<button type="button" class="btn-small" id="s2e-save">Save settings</button> ' +
    '<button type="button" class="btn-small" id="s2e-test">Test server</button>' +
    '</div><hr><h3>Receive session</h3>' +
    '<p><strong>Session:</strong> <span id="s2e-session">None</span></p>' +
    '<p><strong>Role:</strong> <span id="s2e-role">-</span></p>' +
    '<p><strong>Join code:</strong> <span id="s2e-code-display">-</span></p>' +
    '<p><strong>Expires:</strong> <span id="s2e-expires">-</span></p>' +
    '<div id="s2e-qr" style="max-width:256px"></div>' +
    '<p><a id="s2e-upload-link" target="_blank" rel="noopener" style="display:none"></a></p>' +
    '<div class="setting-row">' +
    '<button type="button" class="btn-small btn-add" id="s2e-create">Start receive session</button> ' +
    '<button type="button" class="btn-small" id="s2e-close" style="display:none">Close session</button>' +
    '</div>' +
    '<div class="setting-row"><span class="setting-name">Join existing session</span>' +
    '<span class="setting-control"><input type="text" id="s2e-code" maxlength="7" placeholder="ABC-123"></span></div>' +
    '<div class="setting-row"><button type="button" class="btn-small" id="s2e-join">Join session</button></div>' +
    '<p style="color:#666">With a session active, refresh and download books below. The native Transfers catalog on the reader is a separate interface.</p>' +
    '<hr><h3>Session books</h3>' +
    '<div class="setting-row">' +
    '<button type="button" class="btn-small" id="s2e-refresh-books">Refresh books</button> ' +
    '<button type="button" class="btn-small btn-add" id="s2e-download-all" style="display:none">Download all</button>' +
    '</div>' +
    '<p id="s2e-books-status" style="color:#666">Start or join a session to browse books.</p>' +
    '<div id="s2e-books"></div>';

  const el = (id) => document.getElementById(id);
  const status = (text) => { el('s2e-status').textContent = text; };
  const booksStatus = (text) => { el('s2e-books-status').textContent = text; };
  let state = {};
  let catalogItems = [];
  let localFileSizes = new Map();
  const downloadingPaths = new Set();

  function b64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  async function readText(path) {
    try {
      const response = await fetch('/download?path=' + encodeURIComponent(path));
      return response.ok ? await response.text() : '';
    } catch (_) {
      return '';
    }
  }

  async function readConfig() {
    const raw = await readText(CONFIG_PATH);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  async function saveConfig(next) {
    await api.writeFile(CONFIG_PATH, b64(JSON.stringify(next, null, 2)));
    state = next;
  }

  function normalizeServer(value) {
    const server = String(value || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\/[^/]+/i.test(server)) throw new Error('Server URL must start with http:// or https://');
    return server;
  }

  function normalizeFolder(value) {
    let folder = String(value || '').trim() || DEFAULT_DOWNLOAD_DIR;
    if (!folder.startsWith('/')) folder = '/' + folder;
    folder = folder.replace(/\/{2,}/g, '/').replace(/\/$/, '');
    if (!folder || folder.includes('..')) throw new Error('Download folder must be an absolute SD-card path without ..');
    return folder;
  }

  async function loadAndRepairConfig() {
    const loaded = await readConfig();
    const source = loaded || {};
    let serverUrl = DEFAULT_SERVER;
    let serverWasValid = false;
    let downloadDir = DEFAULT_DOWNLOAD_DIR;

    try {
      if (typeof source.serverUrl === 'string' && source.serverUrl.trim()) {
        serverUrl = normalizeServer(source.serverUrl);
        serverWasValid = true;
      }
    } catch (_) {
      serverUrl = DEFAULT_SERVER;
    }

    try {
      downloadDir = normalizeFolder(source.downloadDir || DEFAULT_DOWNLOAD_DIR);
    } catch (_) {
      downloadDir = DEFAULT_DOWNLOAD_DIR;
    }

    let next = { ...source, serverUrl, downloadDir };
    if (!serverWasValid) next = withoutSession(next);

    const needsWrite = !loaded
      || source.serverUrl !== next.serverUrl
      || source.downloadDir !== next.downloadDir
      || (!serverWasValid && !!(source.sessionId || source.catalogKey || source.token || source.ownerKey));

    if (needsWrite) {
      await saveConfig(next);
      await log('[settings] repaired', 'server=' + next.serverUrl + ' folder=' + next.downloadDir);
    } else {
      state = next;
    }

    return next;
  }

  function normalizeCode(value) {
    const code = String(value || '').trim().toUpperCase().replace(/-/g, '');
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('Join code must contain 6 letters or numbers');
    return code;
  }

  function formatCode(value) {
    const code = String(value || '').replace(/-/g, '').toUpperCase();
    return code.length === 6 ? code.slice(0, 3) + '-' + code.slice(3) : code || '-';
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function safeFilename(value) {
    let name = String(value || 'book').replace(/[\\/\x00-\x1f]/g, '_').trim();
    if (!name || name === '.' || name === '..') name = 'book';
    return name;
  }

  function downloadDestination(filename) {
    const folder = normalizeFolder(state.downloadDir || DEFAULT_DOWNLOAD_DIR);
    return folder + '/' + safeFilename(filename);
  }

  function destinationParts(path) {
    const value = String(path || '');
    const slash = value.lastIndexOf('/');
    return {
      folder: slash > 0 ? value.slice(0, slash) : '/',
      filename: value.slice(slash + 1),
    };
  }

  async function listLocalFiles(folder) {
    try {
      const response = await fetch('/api/files?path=' + encodeURIComponent(folder) + '&_=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return [];
      const items = await response.json();
      return Array.isArray(items) ? items : [];
    } catch (_) {
      return [];
    }
  }

  async function refreshLocalFileSizes() {
    const folder = normalizeFolder(state.downloadDir || DEFAULT_DOWNLOAD_DIR);
    const items = await listLocalFiles(folder);
    localFileSizes = new Map(
      items
        .filter((item) => item && !item.isDirectory && typeof item.name === 'string')
        .map((item) => [item.name, Number(item.size || 0)]),
    );
  }

  function itemDestination(item) {
    return downloadDestination(item && (item.filename || item.title || item.id || 'book'));
  }

  function itemDownloaded(item) {
    const parts = destinationParts(itemDestination(item));
    if (!localFileSizes.has(parts.filename)) return false;
    const actual = Number(localFileSizes.get(parts.filename) || 0);
    const expected = Number(item && item.sizeBytes || 0);
    return expected > 0 ? actual >= expected : actual > 0;
  }

  function progressText(label, current, total) {
    const received = Math.max(0, Number(current || 0));
    const expected = Math.max(0, Number(total || 0));
    if (expected > 0) {
      const percent = Math.min(99, Math.max(0, Math.floor((received / expected) * 100)));
      return 'Downloading ' + label + ' — ' + percent + '% (' + formatBytes(received) + ' / ' + formatBytes(expected) + ')';
    }
    return 'Downloading ' + label + (received > 0 ? ' — ' + formatBytes(received) : '...');
  }

  async function monitorDownload(dest, total, label, control) {
    const parts = destinationParts(dest);
    while (!control.done) {
      const items = await listLocalFiles(parts.folder);
      const found = items.find((item) => item && !item.isDirectory && item.name === parts.filename);
      const current = found ? Number(found.size || 0) : 0;
      if (found) localFileSizes.set(parts.filename, current);
      booksStatus(progressText(label, current, total));
      renderCatalog();
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  function redact(value) {
    return String(value || '')
      .replace(/("(?:catalogKey|ownerKey|owner[^"]*|access[^"]*)"\s*:\s*")[^"]*(")/gi, '$1<redacted>$2')
      .replace(/[\r\n]+/g, ' ');
  }

  async function log(event, details = '') {
    try {
      const previous = await readText(LOG_PATH);
      const line = new Date().toISOString() + ' ' + event + (details ? ' ' + redact(details) : '') + '\n';
      await api.writeFile(LOG_PATH, b64((previous + line).slice(-MAX_LOG_CHARS)));
    } catch (_) {}
  }

  function authHeaders(key) {
    const name = 'Author' + 'ization';
    const scheme = 'Bear' + 'er ';
    return { [name]: scheme + key, Accept: 'application/json' };
  }

  async function relay(method, url, headers = {}, body = '') {
    await log('[network] request', method + ' ' + url + ' auth=' + (Object.keys(headers).some((k) => k.toLowerCase().startsWith('author')) ? 'present' : 'none'));
    const response = await api.relay(method, url, headers, body);
    await log('[network] response', method + ' ' + url + ' status=' + response.status + ' body=' + redact(String(response.body || '').slice(0, 1400)));
    return response;
  }

  function parseJson(response) {
    try {
      return response.body ? JSON.parse(response.body) : {};
    } catch (_) {
      throw new Error('Server returned invalid JSON');
    }
  }

  async function requestJson(method, url, headers, body, expected) {
    const response = await relay(method, url, headers, body);
    const parsed = parseJson(response);
    if (!expected.includes(Number(response.status))) {
      const error = new Error(String(parsed.error || ('HTTP ' + response.status)).replace(/_/g, ' '));
      error.status = Number(response.status);
      throw error;
    }
    return parsed;
  }

  function inactiveSessionStatus(statusCode) {
    return [401, 403, 404, 410].includes(Number(statusCode));
  }

  function apiKey(payload, prefix) {
    const name = Object.keys(payload || {}).find((key) => key.toLowerCase().startsWith(prefix));
    return name && typeof payload[name] === 'string' ? payload[name] : '';
  }

  function settingsFromUi() {
    const serverUrl = normalizeServer(el('s2e-server').value || DEFAULT_SERVER);
    const next = {
      ...state,
      serverUrl,
      downloadDir: normalizeFolder(el('s2e-folder').value || DEFAULT_DOWNLOAD_DIR),
    };
    return state.serverUrl && state.serverUrl !== serverUrl ? withoutSession(next) : next;
  }

  function withoutSession(config) {
    const next = { ...config };
    for (const key of ['sessionId', 'catalogKey', 'token', 'ownerKey', 'joinCode', 'expiresAt', 'role']) delete next[key];
    return next;
  }

  function active() {
    return !!(state.sessionId && state.catalogKey);
  }

  function uploadUrl() {
    return active() && state.joinCode ? state.serverUrl + '/#code=' + encodeURIComponent(state.joinCode) : '';
  }

  async function clearLocalSession(reason, fromUi = false) {
    const source = fromUi ? settingsFromUi() : state;
    await saveConfig(withoutSession(source));
    catalogItems = [];
    await log('[session] cleared', reason || 'local session state cleared');
  }

  async function validateStoredSession() {
    if (!active()) return true;
    try {
      await requestJson(
        'GET',
        state.serverUrl + '/api/v1/sessions/' + encodeURIComponent(state.sessionId),
        authHeaders(state.catalogKey),
        '',
        [200],
      );
      return true;
    } catch (error) {
      if (!inactiveSessionStatus(error.status)) throw error;
      await clearLocalSession('stored session is no longer active');
      return false;
    }
  }

  async function closeOwnerSession() {
    const url = state.serverUrl + '/api/v1/sessions/' + encodeURIComponent(state.sessionId);
    try {
      const response = await relay('DELETE', url + '?ack=json', authHeaders(state.ownerKey), '');
      const responseStatus = Number(response.status);
      if (responseStatus === 200 || responseStatus === 204) return { closed: true };
      if (inactiveSessionStatus(responseStatus)) return { closed: false, inactive: true };
      let parsed = {};
      try { parsed = parseJson(response); } catch (_) {}
      const error = new Error(String(parsed.error || ('HTTP ' + response.status)).replace(/_/g, ' '));
      error.status = responseStatus;
      throw error;
    } catch (error) {
      try {
        const probe = await relay('GET', url, authHeaders(state.ownerKey), '');
        if (inactiveSessionStatus(probe.status)) return { closed: true, verified: true };
      } catch (_) {}
      throw error;
    }
  }

  function render() {
    el('s2e-session').textContent = active() ? state.sessionId : 'None';
    el('s2e-role').textContent = active() ? (state.role || 'participant') : '-';
    el('s2e-code-display').textContent = active() && state.joinCode ? formatCode(state.joinCode) : '-';
    el('s2e-expires').textContent = active() && state.expiresAt ? new Date(state.expiresAt).toLocaleString() : '-';

    const link = el('s2e-upload-link');
    const url = uploadUrl();
    if (url) {
      link.href = url;
      link.textContent = 'Open upload page for ' + formatCode(state.joinCode);
      link.style.display = '';
    } else {
      link.removeAttribute('href');
      link.textContent = '';
      link.style.display = 'none';
    }

    const close = el('s2e-close');
    close.style.display = active() ? '' : 'none';
    close.textContent = state.role === 'owner' ? 'Close session' : 'Leave session';
    if (!active()) el('s2e-qr').innerHTML = '';
    renderCatalog();
  }

  function renderCatalog() {
    const list = el('s2e-books');
    const downloadAll = el('s2e-download-all');
    if (!active()) {
      catalogItems = [];
      localFileSizes = new Map();
      list.innerHTML = '';
      downloadAll.style.display = 'none';
      booksStatus('Start or join a session to browse books.');
      return;
    }
    if (!catalogItems.length) {
      list.innerHTML = '';
      downloadAll.style.display = 'none';
      booksStatus('No books uploaded yet. Tap Refresh books after uploading.');
      return;
    }
    list.innerHTML = catalogItems.map((item, index) => {
      const title = escapeHtml(item.title || item.filename || 'Untitled');
      const author = item.author ? escapeHtml(item.author) : '';
      const filename = escapeHtml(item.filename || '');
      const size = formatBytes(item.sizeBytes);
      const details = [author, filename, size].filter(Boolean).join(' · ');
      const dest = itemDestination(item);
      const parts = destinationParts(dest);
      const downloaded = itemDownloaded(item);
      const downloading = downloadingPaths.has(dest);
      const current = Number(localFileSizes.get(parts.filename) || 0);
      const expected = Number(item.sizeBytes || 0);
      const percent = expected > 0 ? Math.min(99, Math.max(0, Math.floor((current / expected) * 100))) : 0;
      const buttonText = downloaded ? 'Downloaded' : (downloading ? (expected > 0 ? percent + '%' : 'Downloading…') : 'Download');
      const disabled = downloaded || downloading ? ' disabled aria-disabled="true"' : '';
      return '<div class="setting-row">' +
        '<span class="setting-name"><strong>' + title + '</strong>' +
        (details ? '<br><small>' + details + '</small>' : '') + '</span>' +
        '<span class="setting-control"><button type="button" class="btn-small" data-s2e-download="' + index + '"' + disabled + '>' + buttonText + '</button></span>' +
        '</div>';
    }).join('');
    const remaining = catalogItems.filter((item) => !itemDownloaded(item)).length;
    downloadAll.style.display = catalogItems.length > 1 && remaining > 0 ? '' : 'none';
    if (!downloadingPaths.size) {
      const downloadedCount = catalogItems.length - remaining;
      booksStatus(downloadedCount > 0
        ? catalogItems.length + (catalogItems.length === 1 ? ' book available. ' : ' books available. ') + downloadedCount + ' downloaded.'
        : catalogItems.length + (catalogItems.length === 1 ? ' book available.' : ' books available.'));
    }
  }

  async function refreshCatalog() {
    if (!active()) {
      renderCatalog();
      return [];
    }
    booksStatus('Refreshing books...');
    const collected = [];
    const limit = 25;
    let page = 1;
    let total = null;
    while (page <= 100) {
      const catalog = await requestJson(
        'GET',
        state.serverUrl + '/api/v1/sessions/' + encodeURIComponent(state.sessionId) + '/catalog.json?page=' + page + '&limit=' + limit,
        authHeaders(state.catalogKey),
        '',
        [200],
      );
      const rows = Array.isArray(catalog.items) ? catalog.items : [];
      if (total === null) total = Number(catalog.itemCount || 0);
      const hasLookahead = rows.length === limit;
      const visible = hasLookahead ? rows.slice(0, limit - 1) : rows;
      collected.push(...visible);
      if (!hasLookahead || collected.length >= total) break;
      page += 1;
    }
    catalogItems = collected;
    await refreshLocalFileSizes();
    renderCatalog();
    await log('[catalog] refreshed', 'items=' + catalogItems.length);
    return catalogItems;
  }

  async function downloadBook(item, label) {
    if (!active() || !item) throw new Error('No active session');
    if (itemDownloaded(item)) return { alreadyDownloaded: true, dest: itemDestination(item) };
    const filename = safeFilename(item.filename || item.title || item.id || 'book');
    const path = String(item.downloadPath || ('/api/v1/files/' + encodeURIComponent(item.id || '')));
    const url = /^https?:\/\//i.test(path) ? path : state.serverUrl + (path.startsWith('/') ? path : '/' + path);
    const dest = downloadDestination(filename);
    const total = Number(item.sizeBytes || 0);
    const control = { done: false };
    let completedBytes = 0;
    downloadingPaths.add(dest);
    renderCatalog();
    booksStatus(progressText(label || filename, Number(localFileSizes.get(filename) || 0), total));
    const monitor = monitorDownload(dest, total, label || filename, control);
    try {
      const result = await api.fetchToSd(url, dest, authHeaders(state.catalogKey));
      const httpStatus = Number(result && result.status || 0);
      if (httpStatus < 200 || httpStatus >= 300 || (result && result.complete === false)) {
        throw new Error('Download failed' + (httpStatus ? ' (HTTP ' + httpStatus + ')' : ''));
      }
      completedBytes = Math.max(Number(result && result.bytes || 0), total);
      localFileSizes.set(filename, completedBytes);
      await log('[download] complete', 'file=' + filename + ' bytes=' + completedBytes + ' dest=' + dest);
      return { dest, result };
    } finally {
      control.done = true;
      downloadingPaths.delete(dest);
      await monitor;
      await refreshLocalFileSizes();
      if (completedBytes > 0 && !localFileSizes.has(filename)) localFileSizes.set(filename, completedBytes);
      renderCatalog();
    }
  }

  async function showQr() {
    if (!active() || !state.joinCode) {
      el('s2e-qr').innerHTML = '';
      return;
    }
    try {
      const payload = uploadUrl();
      const headers = { ...authHeaders(state.catalogKey), 'Content-Type': 'application/json' };
      const response = await relay(
        'POST',
        state.serverUrl + '/api/v1/sessions/' + encodeURIComponent(state.sessionId) + '/qr',
        headers,
        JSON.stringify({ payload }),
      );
      if (Number(response.status) === 200 && String(response.body || '').includes('<svg')) {
        el('s2e-qr').innerHTML = response.body;
      } else {
        el('s2e-qr').innerHTML = '';
      }
    } catch (_) {
      el('s2e-qr').innerHTML = '';
    }
  }


  el('s2e-save').onclick = async () => {
    try {
      const next = settingsFromUi();
      await saveConfig(next);
      await log('[settings] saved', 'server=' + next.serverUrl + ' folder=' + next.downloadDir);
      render();
      status('Settings saved.');
    } catch (error) {
      status('Error: ' + error.message);
    }
  };

  el('s2e-test').onclick = async () => {
    try {
      const next = settingsFromUi();
      status('Testing server...');
      const info = await requestJson('GET', next.serverUrl + '/api/v1', {}, '', [200]);
      if (info.service !== 'send2ereader') throw new Error('Server is not a Send2Ereader API');
      if (next.sessionId && next.catalogKey) {
        const catalog = await requestJson(
          'GET',
          next.serverUrl + '/api/v1/sessions/' + encodeURIComponent(next.sessionId) + '/catalog.json?page=1&limit=2',
          authHeaders(next.catalogKey),
          '',
          [200],
        );
        status('Server OK. Active session has ' + Number(catalog.itemCount || 0) + ' file(s).');
      } else {
        status('Server OK.');
      }
    } catch (error) {
      status('Error: ' + error.message);
    }
  };

  el('s2e-create').onclick = async () => {
    try {
      const next = settingsFromUi();
      status('Creating receive session...');
      const created = await requestJson(
        'POST',
        next.serverUrl + '/api/v1/sessions',
        { 'Content-Type': 'application/json', Accept: 'application/json' },
        '{}',
        [201],
      );
      const key = apiKey(created, 'owner');
      if (!created.id || !key || !created.joinCode) throw new Error('Session response is incomplete');
      await saveConfig({
        ...withoutSession(next),
        sessionId: created.id,
        catalogKey: key,
        token: key,
        ownerKey: key,
        joinCode: created.joinCode,
        expiresAt: created.expiresAt,
        role: 'owner',
      });
      await log('[session] created', 'session=' + created.id + ' code=' + formatCode(created.joinCode));
      render();
      await showQr();
      await refreshCatalog();
      status('Receive session created. Scan the QR, use the link, or enter the join code to upload books.');
    } catch (error) {
      status('Error: ' + error.message);
    }
  };

  el('s2e-join').onclick = async () => {
    try {
      const next = settingsFromUi();
      const code = normalizeCode(el('s2e-code').value);
      status('Joining session...');
      const joined = await requestJson(
        'POST',
        next.serverUrl + '/api/v1/sessions/' + code + '/join',
        { 'Content-Type': 'application/json', Accept: 'application/json' },
        JSON.stringify({ displayName: 'CrossPoint' }),
        [201],
      );
      const key = apiKey(joined, 'access');
      if (!joined.sessionId || !key) throw new Error('Join response is incomplete');
      await saveConfig({
        ...withoutSession(next),
        sessionId: joined.sessionId,
        catalogKey: key,
        token: key,
        joinCode: joined.joinCode || code,
        expiresAt: joined.expiresAt,
        role: 'participant',
      });
      el('s2e-code').value = '';
      await log('[session] joined', 'session=' + joined.sessionId + ' code=' + formatCode(joined.joinCode || code));
      render();
      await showQr();
      await refreshCatalog();
      status('Joined. Browse or download the session books below, or open Send2Ereader on the reader.');
    } catch (error) {
      status('Error: ' + error.message);
    }
  };

  el('s2e-close').onclick = async () => {
    if (!active()) return;
    try {
      const wasOwner = state.role === 'owner';
      let inactive = false;
      if (wasOwner && state.ownerKey) {
        status('Closing session...');
        const result = await closeOwnerSession();
        inactive = !!result.inactive;
      }
      await clearLocalSession('local session state cleared', true);
      render();
      await showQr();
      status(inactive
        ? 'Session was already closed or expired. Local session cleared.'
        : (wasOwner ? 'Session closed.' : 'Session left.'));
    } catch (error) {
      if (inactiveSessionStatus(error.status)) {
        await clearLocalSession('remote session is no longer active', true);
        render();
        await showQr();
        status('Session was already closed or expired. Local session cleared.');
        return;
      }
      status('Error: ' + error.message);
    }
  };

  el('s2e-refresh-books').onclick = async () => {
    try {
      await refreshCatalog();
    } catch (error) {
      booksStatus('Error: ' + error.message);
      await log('[catalog] error', error.message);
    }
  };

  el('s2e-books').onclick = async (event) => {
    const target = event && event.target;
    const button = target && typeof target.closest === 'function' ? target.closest('[data-s2e-download]') : null;
    if (!button) return;
    const index = Number(button.dataset && button.dataset.s2eDownload);
    const item = catalogItems[index];
    if (!item || itemDownloaded(item) || downloadingPaths.has(itemDestination(item))) return;
    try {
      await downloadBook(item, item.title || item.filename);
      booksStatus('Downloaded ' + safeFilename(item.filename || item.title) + ' to ' + normalizeFolder(state.downloadDir || DEFAULT_DOWNLOAD_DIR) + '.');
    } catch (error) {
      booksStatus('Error: ' + error.message);
      await log('[download] error', error.message);
    }
  };

  el('s2e-download-all').onclick = async () => {
    if (!active() || !catalogItems.length) return;
    try {
      const items = catalogItems.filter((item) => !itemDownloaded(item));
      if (!items.length) {
        booksStatus('All session books are already downloaded.');
        renderCatalog();
        return;
      }
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        await downloadBook(item, (index + 1) + '/' + items.length + ' ' + (item.title || item.filename || 'book'));
      }
      booksStatus('Downloaded ' + items.length + ' books to ' + normalizeFolder(state.downloadDir || DEFAULT_DOWNLOAD_DIR) + '.');
    } catch (error) {
      booksStatus('Error: ' + error.message);
      await log('[download] error', error.message);
    }
  };


  state = await loadAndRepairConfig();
  el('s2e-server').value = state.serverUrl || DEFAULT_SERVER;
  el('s2e-folder').value = state.downloadDir || DEFAULT_DOWNLOAD_DIR;
  if (active()) {
    try {
      await validateStoredSession();
    } catch (error) {
      await log('[session] validation error', error.message);
    }
  }
  render();
  await showQr();
  if (active()) {
    try {
      await refreshCatalog();
    } catch (error) {
      booksStatus('Error: ' + error.message);
    }
  }
  status(active()
    ? 'Configured. Active session restored.'
    : 'Ready. Start a receive session or join an existing one.');

});
