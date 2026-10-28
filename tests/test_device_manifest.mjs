import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const device = JSON.parse(
  await readFile(new URL('../send2ereader.crosspoint-plugin/device.json', import.meta.url), 'utf8'),
);

test('baseline firmware retains both list-picker rows for manual refresh', () => {
  const lists = device.browse.lists;
  assert.equal(lists.length, 2);
  assert.equal(lists[0].title, 'Transfers');
  assert.equal(lists[1].title, 'Select Transfers to refresh');

  // Both entries inherit the same catalog request, so selecting either is safe.
  assert.ok(lists.every((entry) => !('url' in entry) && !('body' in entry)));
  assert.match(device.browse.url, /\/api\/v1\/crosspoint\/catalog\.json/);
  assert.equal(device.token.persist, false);
});

test('the fallback label is hidden only with native catalog refresh', () => {
  const lists = device.browse.lists;
  assert.equal(lists[1].hide_if.plugin_capability, 'catalog.refresh');

  const visible = (capabilities) =>
    lists.filter(({ hide_if: hide }) => !hide?.plugin_capability ||
      !capabilities.includes(hide.plugin_capability));

  assert.deepEqual(visible([]).map((item) => item.title), [
    'Transfers',
    'Select Transfers to refresh',
  ]);
  assert.deepEqual(visible(['catalog.refresh']).map((item) => item.title), ['Transfers']);
});
