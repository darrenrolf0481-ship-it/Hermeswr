// Host watch list: the addresses the operator wants re-probed periodically.
//
// Pure and storage-injectable so the rules can be tested without a DOM.

import type { DiscoveredHost } from './topology';
import type { StorageLike } from './reconHistory';

export const WATCH_LIST_STORAGE_KEY = 'hermes.recon.watchlist';
export const WATCH_LIST_LIMIT = 16;
/** How often the watch list is re-probed while the recon panel is open. */
export const WATCH_POLL_INTERVAL_MS = 15_000;

function defaultStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Strict dotted-quad check — the probe endpoint refuses anything else. */
export function normalizeHost(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 4) return null;
  if (!parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return null;
  return trimmed;
}

export function loadWatchList(storage: StorageLike | null = defaultStorage()): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(WATCH_LIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const hosts = parsed
      .map(normalizeHost)
      .filter((host): host is string => host !== null);
    return [...new Set(hosts)].slice(0, WATCH_LIST_LIMIT);
  } catch {
    return [];
  }
}

export function saveWatchList(
  hosts: string[],
  storage: StorageLike | null = defaultStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(WATCH_LIST_STORAGE_KEY, JSON.stringify(hosts.slice(0, WATCH_LIST_LIMIT)));
  } catch {
    // Storage unavailable — the watch list is best-effort.
  }
}

/**
 * Add or remove a host. Adding is a no-op once the list is full, so a stray
 * tap can never silently evict a host the operator is tracking.
 */
export function toggleWatchList(hosts: string[], host: string): string[] {
  const normalized = normalizeHost(host);
  if (!normalized) return hosts;
  if (hosts.includes(normalized)) return hosts.filter((entry) => entry !== normalized);
  if (hosts.length >= WATCH_LIST_LIMIT) return hosts;
  return [...hosts, normalized];
}

export interface WatchStatus {
  host: string;
  online: boolean;
  openPorts: number[];
  /** True until this host has been probed at least once in this session. */
  pending: boolean;
}

/**
 * Project probe results onto the watch list, so hosts that dropped out of a
 * response still render (as pending) instead of vanishing from the panel.
 */
export function mergeWatchStatuses(
  watched: string[],
  probed: DiscoveredHost[] | null | undefined
): WatchStatus[] {
  const byHost = new Map((probed ?? []).map((entry) => [entry.host, entry]));

  return watched.map((host) => {
    const result = byHost.get(host);
    return {
      host,
      online: result?.online ?? false,
      openPorts: result?.openPorts ?? [],
      pending: result === undefined,
    };
  });
}
