// Recon scan history persistence.
//
// Kept free of React so the load/save/trim rules can be unit tested directly.
// Every storage access is best-effort: private browsing modes and full quotas
// must never break a scan.

export interface ReconHistoryEntry {
  id: string;
  scanType: string;
  timestamp: string;
  status: 'complete' | 'error';
  executionTimeMs: number;
}

export const RECON_HISTORY_STORAGE_KEY = 'hermes.recon.history';
export const RECON_HISTORY_LIMIT = 50;

/** The subset of the Storage interface we rely on, so tests can pass a stub. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isHistoryEntry(value: unknown): value is ReconHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.scanType === 'string' &&
    typeof entry.timestamp === 'string' &&
    (entry.status === 'complete' || entry.status === 'error') &&
    typeof entry.executionTimeMs === 'number' &&
    Number.isFinite(entry.executionTimeMs)
  );
}

/**
 * Read stored history, discarding anything malformed. Persisted data is user
 * editable, so a corrupt entry must degrade to "no history" rather than throw.
 */
export function loadReconHistory(storage: StorageLike | null = defaultStorage()): ReconHistoryEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECON_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry).slice(0, RECON_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function saveReconHistory(
  entries: ReconHistoryEntry[],
  storage: StorageLike | null = defaultStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(RECON_HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, RECON_HISTORY_LIMIT)));
  } catch {
    // Quota exceeded or storage disabled — history is best-effort only.
  }
}

/** Prepend an entry (newest first) and enforce the retention limit. */
export function pushReconHistory(
  entries: ReconHistoryEntry[],
  entry: ReconHistoryEntry
): ReconHistoryEntry[] {
  return [entry, ...entries].slice(0, RECON_HISTORY_LIMIT);
}
