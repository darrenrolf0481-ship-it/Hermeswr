import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WATCH_LIST_LIMIT,
  WATCH_LIST_STORAGE_KEY,
  WATCH_POLL_INTERVAL_MS,
  loadWatchList,
  mergeWatchStatuses,
  normalizeHost,
  saveWatchList,
  toggleWatchList,
} from '../src/utils/watchList';
import type { DiscoveredHost } from '../src/utils/topology';
import type { StorageLike } from '../src/utils/reconHistory';

interface MemoryStorage extends StorageLike {
  data: Record<string, string>;
}

function memoryStorage(seed: Record<string, string> = {}): MemoryStorage {
  const data = { ...seed };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

test('normalizeHost accepts dotted quads and rejects everything else', () => {
  assert.equal(normalizeHost('192.168.1.1'), '192.168.1.1');
  assert.equal(normalizeHost('  10.0.0.7 '), '10.0.0.7');
  assert.equal(normalizeHost('255.255.255.255'), '255.255.255.255');

  for (const bad of ['', 'nope', '192.168.1', '192.168.1.1.1', '192.168.1.256', '256.0.0.1', '1.2.3.-4', 'localhost', 'a.b.c.d', '192.168.1.1;rm -rf /']) {
    assert.equal(normalizeHost(bad), null, `should reject: ${bad}`);
  }
  assert.equal(normalizeHost(undefined), null);
  assert.equal(normalizeHost(12345), null);
});

test('normalizeHost rejects hostnames so a probe can never leave the address space', () => {
  assert.equal(normalizeHost('example.com'), null);
  assert.equal(normalizeHost('scanme.nmap.org'), null);
});

test('loadWatchList returns [] without storage or stored data', () => {
  assert.deepEqual(loadWatchList(null), []);
  assert.deepEqual(loadWatchList(memoryStorage()), []);
});

test('loadWatchList discards corrupt payloads', () => {
  for (const raw of ['not json', '{ broken', '"a string"', '{"hosts":[]}', '42']) {
    assert.deepEqual(loadWatchList(memoryStorage({ [WATCH_LIST_STORAGE_KEY]: raw })), [], `payload: ${raw}`);
  }
});

test('loadWatchList keeps only valid, unique hosts', () => {
  const storage = memoryStorage({
    [WATCH_LIST_STORAGE_KEY]: JSON.stringify([
      '192.168.1.1',
      'not-an-ip',
      '192.168.1.1',
      42,
      null,
      '10.0.0.7',
    ]),
  });

  assert.deepEqual(loadWatchList(storage), ['192.168.1.1', '10.0.0.7']);
});

test('saveWatchList round-trips through loadWatchList', () => {
  const storage = memoryStorage();
  saveWatchList(['192.168.1.1', '10.0.0.7'], storage);

  assert.deepEqual(loadWatchList(storage), ['192.168.1.1', '10.0.0.7']);
});

test('saveWatchList never throws when storage is unavailable or rejecting', () => {
  const failing: StorageLike = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };

  assert.doesNotThrow(() => saveWatchList(['10.0.0.1'], failing));
  assert.doesNotThrow(() => saveWatchList(['10.0.0.1'], null));
});

test('toggleWatchList adds then removes the same host', () => {
  const added = toggleWatchList([], '192.168.1.1');
  assert.deepEqual(added, ['192.168.1.1']);
  assert.deepEqual(toggleWatchList(added, '192.168.1.1'), []);
});

test('toggleWatchList ignores invalid input without touching the list', () => {
  const list = ['192.168.1.1'];
  assert.deepEqual(toggleWatchList(list, 'not-an-ip'), list);
  assert.deepEqual(toggleWatchList(list, '192.168.1.999'), list);
});

test('toggleWatchList never exceeds the limit', () => {
  const full = Array.from({ length: WATCH_LIST_LIMIT }, (_, i) => `192.168.1.${i + 1}`);

  assert.deepEqual(toggleWatchList(full, '10.0.0.1'), full, 'a full list must not evict a host');
  // Removing still works, so the operator can free a slot.
  assert.equal(toggleWatchList(full, full[0]).length, WATCH_LIST_LIMIT - 1);
});

test('toggleWatchList does not mutate the input', () => {
  const list = ['192.168.1.1'];
  toggleWatchList(list, '10.0.0.7');

  assert.deepEqual(list, ['192.168.1.1']);
});

test('mergeWatchStatuses maps probe results onto watched hosts', () => {
  const probes: DiscoveredHost[] = [
    { host: '192.168.1.1', openPorts: [22, 80], online: true },
    { host: '10.0.0.7', openPorts: [], online: false },
  ];

  const rows = mergeWatchStatuses(['192.168.1.1', '10.0.0.7'], probes);

  assert.deepEqual(rows, [
    { host: '192.168.1.1', openPorts: [22, 80], online: true, pending: false },
    { host: '10.0.0.7', openPorts: [], online: false, pending: false },
  ]);
});

test('mergeWatchStatuses keeps hosts that a response omitted, as pending', () => {
  const rows = mergeWatchStatuses(['192.168.1.1', '10.0.0.7'], [
    { host: '192.168.1.1', openPorts: [22], online: true },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].pending, false);
  assert.deepEqual(rows[1], { host: '10.0.0.7', openPorts: [], online: false, pending: true });
});

test('mergeWatchStatuses treats missing probe data as all pending', () => {
  const rows = mergeWatchStatuses(['192.168.1.1'], null);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].pending, true);
  assert.equal(rows[0].online, false);
  assert.deepEqual(rows[0].openPorts, []);
});

test('the poll interval is a sane, documented cadence', () => {
  assert.ok(WATCH_POLL_INTERVAL_MS >= 5000, 'polling faster than 5s would hammer the network');
  assert.ok(WATCH_POLL_INTERVAL_MS <= 60_000, 'polling slower than a minute is not "periodic"');
  assert.equal(WATCH_POLL_INTERVAL_MS % 1000, 0);
});
