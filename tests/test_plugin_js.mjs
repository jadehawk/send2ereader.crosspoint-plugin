import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../plugin.js', import.meta.url), 'utf8');

function fakeDocument() {
  const elements = new Map();
  return {
    elements,
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          id,
          textContent: '',
          innerHTML: '',
          value: '',
          href: '',
          style: {},
          disabled: false,
          onclick: null,
          removeAttribute(name) {
            if (name === 'href') this.href = '';
          },
        });
      }
      return elements.get(id);
    },
  };
}

async function runPlugin(apiDir) {
  let renderPlugin;
  const document = fakeDocument();
  const downloadPaths = [];
  const writes = [];

  const fetch = async (url) => {
    if (String(url).startsWith('/download?path=')) {
      const path = new URL(url, 'http://device').searchParams.get('path');
      downloadPaths.push(path);

      if (path === '/.crosspoint/send2ereader-settings.json') {
        return {
          ok: true,
          async text() {
            return JSON.stringify({
              serverUrl: 'https://send.techy-notes.com',
              downloadDir: '/Send2Ereader',
            });
          },
        };
      }

      const expectedManifest = apiDir
        ? apiDir.replace(/\/+$/, '') + '/manifest.json'
        : '/.crosspoint/plugins/send2ereader/manifest.json';
      if (path === expectedManifest) {
        return {
          ok: true,
          async text() {
            return JSON.stringify({ version: '0.1.4' });
          },
        };
      }

      if (path === '/.crosspoint/send2ereader.log') {
        return { ok: false, async text() { return ''; } };
      }

      return { ok: false, async text() { return ''; } };
    }

    throw new Error('unexpected fetch: ' + url);
  };

  const context = vm.createContext({
    CrossPoint: {
      registerPlugin(fn) {
        renderPlugin = fn;
      },
    },
    document,
    fetch,
    URL,
    TextEncoder,
    Map,
    Set,
    Array,
    String,
    Number,
    Object,
    Promise,
    JSON,
    Date,
    Math,
    encodeURIComponent,
    setTimeout,
    clearTimeout,
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  });

  vm.runInContext(source, context, { filename: 'plugin.js' });
  assert.equal(typeof renderPlugin, 'function');

  const api = {
    ...(apiDir ? { dir: apiDir } : {}),
    async writeFile(path, data) {
      writes.push({ path, data });
      return { ok: true };
    },
    async relay(method, url) {
      assert.equal(method, 'GET');
      assert.match(url, /send2ereader\.crosspoint-plugin\/releases\/latest$/);
      return { status: 200, body: JSON.stringify({ tag_name: 'v0.1.4' }) };
    },
    async fetchToSd() {
      return { status: 200 };
    },
  };

  await renderPlugin({ innerHTML: '' }, api);
  return { document, downloadPaths, writes };
}

test('legacy firmware keeps the historical manifest path', async () => {
  const result = await runPlugin();
  assert.ok(result.downloadPaths.includes('/.crosspoint/plugins/send2ereader/manifest.json'));
  assert.ok(result.downloadPaths.includes('/.crosspoint/send2ereader-settings.json'));
  assert.equal(result.document.elements.get('s2e-version').textContent, 'Version: v0.1.4');
});

test('api.dir firmware reads the manifest from the actual plugin directory', async () => {
  const result = await runPlugin('/plugins/send2ereader/');
  assert.ok(result.downloadPaths.includes('/plugins/send2ereader/manifest.json'));
  assert.ok(!result.downloadPaths.includes('/.crosspoint/plugins/send2ereader/manifest.json'));
  assert.ok(result.downloadPaths.includes('/.crosspoint/send2ereader-settings.json'));
  assert.equal(result.document.elements.get('s2e-version').textContent, 'Version: v0.1.4');
});
