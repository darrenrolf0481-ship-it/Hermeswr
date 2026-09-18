import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOST_ROLES,
  buildReconExport,
  buildReconReport,
  buildTopologyExport,
  reportFileName,
} from '../src/utils/reconExport';
import type { DiscoveredHost } from '../src/utils/topology';
import type { ReconHistoryEntry } from '../src/utils/reconHistory';

const HOSTS: DiscoveredHost[] = [
  { host: '192.168.1.1', openPorts: [80, 22], online: true },
  { host: '192.168.1.139', openPorts: [22, 3000], online: true },
  { host: '192.168.1.200', openPorts: [], online: false },
];

const LOCAL = ['192.168.1.139'];

const history: ReconHistoryEntry[] = [
  { id: 'b', scanType: 'port', timestamp: '2026-09-18T10:01:00.000Z', status: 'complete', executionTimeMs: 120 },
  { id: 'a', scanType: 'network', timestamp: '2026-09-18T10:00:00.000Z', status: 'error', executionTimeMs: 900 },
];

const currentScan = {
  scanType: 'network-map',
  results: '--- LIVE PROBE (real TCP connect checks) ---\n  192.168.1.1: 22/tcp OPEN (live probe)',
  timestamp: '2026-09-18T10:02:00.000Z',
  status: 'complete',
};

test('buildTopologyExport classifies hosts and summarises them', () => {
  const exported = buildTopologyExport(HOSTS, LOCAL, {
    generatedAt: '2026-09-18T10:00:00.000Z',
    watchedHosts: ['192.168.1.1'],
  });

  assert.equal(exported.source, 'live');
  assert.equal(exported.summary.watched, 1);
  assert.equal(exported.watchedNotDiscovered.length, 0);
  assert.equal(exported.generatedAt, '2026-09-18T10:00:00.000Z');
  assert.equal(exported.summary.total, 3);
  assert.equal(exported.summary.active, 2);
  assert.equal(exported.summary.byRole.gateway, 1);
  assert.equal(exported.summary.byRole.local, 1);
  assert.equal(exported.summary.byRole.offline, 1);
  assert.equal(exported.summary.byRole.hermes, 0);
  assert.equal(exported.localAddresses.length, 1);

  const gateway = exported.hosts.find((host) => host.address === '192.168.1.1');
  assert.equal(gateway?.role, 'gateway');
  assert.equal(gateway?.label, 'GATEWAY');
  assert.equal(gateway?.online, true);
});

test('byRole always reports every role so consumers can render a zeroed table', () => {
  const exported = buildTopologyExport([], []);

  assert.deepEqual(Object.keys(exported.summary.byRole).sort(), [...HOST_ROLES].sort());
  assert.equal(exported.summary.total, 0);
  assert.equal(exported.summary.active, 0);
  assert.equal(exported.summary.watched, 0);
  assert.deepEqual(exported.watchedNotDiscovered, []);
});

test('exported port lists are sorted and copied, not shared with the input', () => {
  const hosts: DiscoveredHost[] = [{ host: '192.168.1.1', openPorts: [443, 22, 80], online: true }];

  const exported = buildTopologyExport(hosts, []);

  assert.deepEqual(exported.hosts[0].openPorts, [22, 80, 443], 'exported ports must be sorted');

  // Mutating the export must not reach back into the scan results.
  exported.hosts[0].openPorts.push(9999);
  assert.deepEqual(exported.hosts[0].openPorts, [22, 80, 443, 9999]);
  assert.deepEqual(hosts[0].openPorts, [443, 22, 80]);
});

test('buildTopologyExport marks the baseline source when asked', () => {
  assert.equal(buildTopologyExport(HOSTS, [], { source: 'baseline' }).source, 'baseline');
});

test('buildReconExport bundles the current scan, topology and history', () => {
  const topology = buildTopologyExport(HOSTS, LOCAL, { generatedAt: '2026-09-18T10:00:00.000Z' });
  const exported = buildReconExport({
    currentScan,
    topology,
    history,
    exportedAt: '2026-09-18T10:05:00.000Z',
  });

  assert.equal(exported.exportedAt, '2026-09-18T10:05:00.000Z');
  assert.equal(exported.currentScan.scanType, 'network-map');
  assert.equal(exported.topology.hosts.length, 3);
  assert.equal(exported.history.length, 2);
  assert.ok(JSON.parse(JSON.stringify(exported)), 'payload must be JSON serialisable');
});

test('the report names the scan and its source', () => {
  const report = buildReconReport({
    currentScan,
    topology: buildTopologyExport(HOSTS, LOCAL, {
      source: 'live',
      generatedAt: '2026-09-18T10:00:00.000Z',
      watchedHosts: ['192.168.1.1'],
    }),
    history,
    generatedAt: '2026-09-18T10:05:00.000Z',
  });

  assert.match(report, /HERMES TACTICAL RECON REPORT/);
  assert.match(report, /Generated: {6}2026-09-18T10:05:00.000Z/);
  assert.match(report, /Scan type: {6}network-map/);
  assert.match(report, /SUBNET TOPOLOGY \(LIVE\)/);
  assert.match(report, /Hosts: {11}3 discovered \/\/ 2 active \/\/ 1 watched/);
  assert.match(report, /Local devices: {3}192\.168\.1\.139/);
  assert.match(report, /END OF REPORT/);
});

test('the report tabulates every host with its role, state and ports', () => {
  const report = buildReconReport({
    currentScan,
    topology: buildTopologyExport(HOSTS, LOCAL),
    history,
  });

  assert.match(report, /ADDRESS\s+LABEL\s+ROLE\s+STATE\s+WATCH\s+PORTS/);
  assert.match(report, /192\.168\.1\.1\s+GATEWAY\s+gateway\s+ONLINE\s+-\s+22\/tcp, 80\/tcp/);
  assert.match(report, /192\.168\.1\.139\s+MOTO G5 STYLUS\s+local\s+ONLINE\s+-\s+22\/tcp, 3000\/tcp/);
  assert.match(report, /192\.168\.1\.200\s+GUEST-DEVICE\s+offline\s+OFFLINE\s+-\s+-/);
});

test('the report marks watched hosts in the table', () => {
  const topology = buildTopologyExport(HOSTS, LOCAL, { watchedHosts: ['192.168.1.1'] });
  const report = buildReconReport({ currentScan, topology, history });

  assert.equal(topology.hosts.find((host) => host.address === '192.168.1.1')?.watched, true);
  assert.equal(topology.hosts.find((host) => host.address === '192.168.1.200')?.watched, false);
  assert.equal(topology.summary.watched, 1);
  assert.match(report, /192\.168\.1\.1\s+GATEWAY\s+gateway\s+ONLINE\s+yes\s+22\/tcp, 80\/tcp/);
});

test('the report lists watched hosts and flags ones the scan did not see', () => {
  const topology = buildTopologyExport(HOSTS, LOCAL, {
    watchedHosts: ['192.168.1.1', '192.168.44.9'],
  });
  const report = buildReconReport({ currentScan, topology, history });

  assert.deepEqual(topology.watchedNotDiscovered, ['192.168.44.9']);

  const watchSection = report.slice(report.indexOf('WATCH LIST ('));
  assert.match(watchSection, /WATCH LIST \(2\)/);
  assert.match(watchSection, /192\.168\.1\.1\s+DISCOVERED/);
  assert.match(watchSection, /192\.168\.44\.9\s+NOT DISCOVERED/);
});

test('the watch list section explains itself when empty', () => {
  const report = buildReconReport({ currentScan, topology: buildTopologyExport(HOSTS, LOCAL), history });

  assert.match(report, /WATCH LIST \(0\)/);
  assert.match(report, /\(no hosts watched\)/);
});

test('watched hosts never inflate the discovered host count', () => {
  const topology = buildTopologyExport(HOSTS, LOCAL, { watchedHosts: ['10.9.9.9', '10.9.9.10'] });

  assert.equal(topology.summary.total, 3);
  assert.equal(topology.summary.watched, 0, 'undiscovered hosts are not counted as watched map nodes');
  assert.deepEqual(topology.watchedNotDiscovered, ['10.9.9.9', '10.9.9.10']);
});

test('the report includes the scan history and the raw output', () => {
  const report = buildReconReport({ currentScan, topology: buildTopologyExport(HOSTS, LOCAL), history });

  assert.match(report, /SCAN HISTORY \(2\)/);
  assert.match(report, /2026-09-18T10:01:00\.000Z\s+port\s+complete\s+120ms/);
  assert.match(report, /2026-09-18T10:00:00\.000Z\s+network\s+error\s+900ms/);
  assert.match(report, /RAW SCAN OUTPUT/);
  assert.match(report, /LIVE PROBE \(real TCP connect checks\)/);
});

test('the report degrades gracefully with nothing to report', () => {
  const report = buildReconReport({
    currentScan: { scanType: '', results: '', timestamp: '', status: 'idle' },
    topology: buildTopologyExport([], []),
    history: [],
  });

  assert.match(report, /\(no hosts discovered\)/);
  assert.match(report, /\(no scans recorded\)/);
  assert.match(report, /\(no output captured\)/);
  assert.match(report, /Local devices:\s+unknown/);
});

test('reportFileName produces a filename-safe timestamp', () => {
  const name = reportFileName('recon-report', '2026-09-18T10:05:00.000Z');

  assert.equal(name, 'recon-report-2026-09-18T10-05-00-000Z.txt');
  assert.ok(!/[:.]/.test(name.replace(/\.txt$/, '').replace('recon-report-', '')));
});
