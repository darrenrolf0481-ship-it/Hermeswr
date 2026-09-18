import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RECON_HISTORY_LIMIT,
  RECON_HISTORY_STORAGE_KEY,
  loadReconHistory,
  pushReconHistory,
  saveReconHistory,
} from '../src/utils/reconHistory';
import type { ReconHistoryEntry, StorageLike } from '../src/utils/reconHistory';

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

function entry(overrides: Partial<ReconHistoryEntry> = {}): ReconHistoryEntry {
  return {
    id: 'scan-1',
    scanType: 'network',
    timestamp: '2026-09-18T10:00:00.000Z',
    status: 'complete',
    executionTimeMs: 42,
    ...overrides,
  };
}

test('loadReconHistory returns [] when storage is unavailable', () => {
  assert.deepEqual(loadReconHistory(null), []);
});

test('loadReconHistory returns [] when nothing was stored', () => {
  assert.deepEqual(loadReconHistory(memoryStorage()), []);
});

test('loadReconHistory round-trips what saveReconHistory wrote', () => {
  const storage = memoryStorage();
  const entries = [entry({ id: 'a' }), entry({ id: 'b', status: 'error', scanType: 'port' })];

  saveReconHistory(entries, storage);

  assert.deepEqual(loadReconHistory(storage), entries);
});

test('loadReconHistory degrades to [] for corrupt payloads', () => {
  const cases = ['not json at all', '{ broken', '"a string"', '42', '{"entries":[]}'];

  for (const raw of cases) {
    const storage = memoryStorage({ [RECON_HISTORY_STORAGE_KEY]: raw });
    assert.deepEqual(loadReconHistory(storage), [], `expected [] for payload: ${raw}`);
  }
});

test('loadReconHistory discards malformed entries but keeps valid ones', () => {
  const storage = memoryStorage({
    [RECON_HISTORY_STORAGE_KEY]: JSON.stringify([
      entry({ id: 'good' }),
      null,
      'nope',
      { id: 'no-status', scanType: 'port', timestamp: 'x', executionTimeMs: 1 },
      { id: 'bad-status', scanType: 'port', timestamp: 'x', status: 'pending', executionTimeMs: 1 },
      { id: 'bad-time', scanType: 'port', timestamp: 'x', status: 'complete', executionTimeMs: '12' },
      { id: 'bad-nan', scanType: 'port', timestamp: 'x', status: 'complete', executionTimeMs: Number.NaN },
      entry({ id: 'also-good', scanType: 'process', status: 'error' }),
    ]),
  });

  assert.deepEqual(
    loadReconHistory(storage).map((e) => e.id),
    ['good', 'also-good']
  );
});

test('saving and loading trims history to the retention limit', () => {
  const storage = memoryStorage();
  const many = Array.from({ length: RECON_HISTORY_LIMIT + 15 }, (_, i) => entry({ id: `scan-${i}` }));

  saveReconHistory(many, storage);
  const loaded = loadReconHistory(storage);

  assert.equal(loaded.length, RECON_HISTORY_LIMIT);
  assert.equal(loaded[0].id, 'scan-0');
});

test('an oversized stored payload is trimmed on read', () => {
  const storage = memoryStorage({
    [RECON_HISTORY_STORAGE_KEY]: JSON.stringify(
      Array.from({ length: RECON_HISTORY_LIMIT + 10 }, (_, i) => entry({ id: `scan-${i}` }))
    ),
  });

  assert.equal(loadReconHistory(storage).length, RECON_HISTORY_LIMIT);
});

test('saveReconHistory never throws when storage rejects the write', () => {
  const failing: StorageLike = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };

  assert.doesNotThrow(() => saveReconHistory([entry()], failing));
  assert.doesNotThrow(() => saveReconHistory([entry()], null));
});

test('a throwing read is treated as no history', () => {
  const failing: StorageLike = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {},
  };

  assert.deepEqual(loadReconHistory(failing), []);
});

test('pushReconHistory prepends the newest entry', () => {
  const result = pushReconHistory([entry({ id: 'old' })], entry({ id: 'new' }));

  assert.deepEqual(
    result.map((e) => e.id),
    ['new', 'old']
  );
});

test('pushReconHistory caps the list at the retention limit', () => {
  const existing = Array.from({ length: RECON_HISTORY_LIMIT }, (_, i) => entry({ id: `scan-${i}` }));
  const result = pushReconHistory(existing, entry({ id: 'newest' }));

  assert.equal(result.length, RECON_HISTORY_LIMIT);
  assert.equal(result[0].id, 'newest');
  assert.equal(result[RECON_HISTORY_LIMIT - 1].id, `scan-${RECON_HISTORY_LIMIT - 2}`);
});

test('pushReconHistory does not mutate the input list', () => {
  const existing = [entry({ id: 'old' })];
  pushReconHistory(existing, entry({ id: 'new' }));

  assert.deepEqual(existing.map((e) => e.id), ['old']);
});
