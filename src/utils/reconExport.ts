// Export builders for recon results.
//
// Pure functions so the exported shape and the human-readable report can be
// verified without touching the DOM.

import { classifyHost, labelForHost } from './topology';
import type { DiscoveredHost, HostRole } from './topology';
import type { ReconHistoryEntry } from './reconHistory';

export const HOST_ROLES: HostRole[] = ['gateway', 'local', 'hermes', 'server', 'offline'];

export interface TopologyExportHost {
  address: string;
  label: string;
  role: HostRole;
  online: boolean;
  openPorts: number[];
  /** True when the operator has this host on the re-probe watch list. */
  watched: boolean;
}

export interface TopologyExport {
  source: 'live' | 'baseline';
  generatedAt: string;
  localAddresses: string[];
  summary: {
    total: number;
    active: number;
    watched: number;
    byRole: Record<HostRole, number>;
  };
  hosts: TopologyExportHost[];
  /** Watched addresses this scan did not discover, so they are not on the map. */
  watchedNotDiscovered: string[];
}

export interface ReconExportPayload {
  exportedAt: string;
  currentScan: {
    scanType: string;
    results: string;
    timestamp: string;
    status: string;
  };
  topology: TopologyExport;
  history: ReconHistoryEntry[];
}

function emptyRoleCounts(): Record<HostRole, number> {
  return HOST_ROLES.reduce((acc, role) => {
    acc[role] = 0;
    return acc;
  }, {} as Record<HostRole, number>);
}

export function buildTopologyExport(
  hosts: DiscoveredHost[],
  localAddresses: string[],
  options: { source?: 'live' | 'baseline'; generatedAt?: string; watchedHosts?: string[] } = {}
): TopologyExport {
  const watched = new Set(options.watchedHosts ?? []);
  const byRole = emptyRoleCounts();
  const exportHosts = hosts.map((host) => {
    const role = classifyHost(host, localAddresses);
    byRole[role] += 1;
    return {
      address: host.host,
      label: labelForHost(host.host),
      role,
      online: host.online,
      openPorts: [...host.openPorts].sort((a, b) => a - b),
      watched: watched.has(host.host),
    };
  });

  const discovered = new Set(exportHosts.map((host) => host.address));

  return {
    source: options.source ?? 'live',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    localAddresses: [...localAddresses],
    summary: {
      total: exportHosts.length,
      active: exportHosts.filter((host) => host.online && host.openPorts.length > 0).length,
      watched: exportHosts.filter((host) => host.watched).length,
      byRole,
    },
    hosts: exportHosts,
    watchedNotDiscovered: [...watched].filter((address) => !discovered.has(address)),
  };
}

export function buildReconExport(input: {
  currentScan: ReconExportPayload['currentScan'];
  topology: TopologyExport;
  history: ReconHistoryEntry[];
  exportedAt?: string;
}): ReconExportPayload {
  return {
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    currentScan: input.currentScan,
    topology: input.topology,
    history: input.history,
  };
}

const COLUMNS = { address: 16, label: 18, role: 10, state: 8, watch: 6 } as const;

function pad(value: string, width: number): string {
  return value.length >= width ? value : value.padEnd(width, ' ');
}

function hostTable(topology: TopologyExport): string[] {
  if (topology.hosts.length === 0) return ['  (no hosts discovered)'];

  const header = `  ${pad('ADDRESS', COLUMNS.address)}${pad('LABEL', COLUMNS.label)}${pad('ROLE', COLUMNS.role)}${pad('STATE', COLUMNS.state)}${pad('WATCH', COLUMNS.watch)}PORTS`;
  const rows = topology.hosts.map((host) => {
    const ports = host.openPorts.length > 0 ? host.openPorts.map((port) => `${port}/tcp`).join(', ') : '-';
    const state = host.online && host.openPorts.length > 0 ? 'ONLINE' : 'OFFLINE';
    const watch = host.watched ? 'yes' : '-';
    return `  ${pad(host.address, COLUMNS.address)}${pad(host.label, COLUMNS.label)}${pad(host.role, COLUMNS.role)}${pad(state, COLUMNS.state)}${pad(watch, COLUMNS.watch)}${ports}`;
  });

  return [header, `  ${'-'.repeat(header.length - 2)}`, ...rows];
}

/** Watch list section: which watched hosts the current scan actually saw. */
function watchTable(topology: TopologyExport): string[] {
  const watchedOnMap = topology.hosts.filter((host) => host.watched).map((host) => host.address);
  const rows = [
    ...watchedOnMap.map((address) => `  ${pad(address, COLUMNS.address)}DISCOVERED`),
    ...topology.watchedNotDiscovered.map((address) => `  ${pad(address, COLUMNS.address)}NOT DISCOVERED`),
  ];

  return rows.length > 0 ? rows : ['  (no hosts watched)'];
}

function historyTable(history: ReconHistoryEntry[]): string[] {
  if (history.length === 0) return ['  (no scans recorded)'];

  const header = `  ${pad('TIMESTAMP', 26)}${pad('TYPE', 12)}${pad('STATUS', 10)}DURATION`;
  const rows = history.map(
    (entry) =>
      `  ${pad(entry.timestamp, 26)}${pad(entry.scanType, 12)}${pad(entry.status, 10)}${entry.executionTimeMs}ms`
  );

  return [header, `  ${'-'.repeat(header.length - 2)}`, ...rows];
}

/** Human-readable companion to the JSON export, suitable for pasting into a report. */
export function buildReconReport(input: {
  currentScan: ReconExportPayload['currentScan'];
  topology: TopologyExport;
  history: ReconHistoryEntry[];
  generatedAt?: string;
}): string {
  const { currentScan, topology, history } = input;
  const generatedAt = input.generatedAt ?? topology.generatedAt;

  const lines: string[] = [
    'HERMES TACTICAL RECON REPORT',
    '='.repeat(60),
    `Generated:      ${generatedAt}`,
    `Scan type:      ${currentScan.scanType || 'none'}`,
    `Scan status:    ${currentScan.status}`,
    `Scan timestamp: ${currentScan.timestamp || 'n/a'}`,
    '',
    `SUBNET TOPOLOGY (${topology.source.toUpperCase()})`,
    '-'.repeat(60),
    `Hosts:           ${topology.summary.total} discovered // ${topology.summary.active} active // ${topology.summary.watched} watched`,
    `Local devices:   ${topology.localAddresses.length > 0 ? topology.localAddresses.join(', ') : 'unknown'}`,
    `Roles:           ${HOST_ROLES.map((role) => `${role}=${topology.summary.byRole[role]}`).join('  ')}`,
    '',
    ...hostTable(topology),
    '',
    `WATCH LIST (${topology.summary.watched + topology.watchedNotDiscovered.length})`,
    '-'.repeat(60),
    ...watchTable(topology),
    '',
    `SCAN HISTORY (${history.length})`,
    '-'.repeat(60),
    ...historyTable(history),
    '',
    'RAW SCAN OUTPUT',
    '-'.repeat(60),
    currentScan.results || '(no output captured)',
    '',
    'END OF REPORT',
  ];

  return lines.join('\n');
}

/** Wraps the payload in a filename-safe timestamp, e.g. recon-report-2026-09-18T10-00-00-000Z. */
export function reportFileName(prefix: string, timestamp: string): string {
  return `${prefix}-${timestamp.replace(/[:.]/g, '-')}.txt`;
}
