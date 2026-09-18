// Render-contract tests for the recon panel.
//
// Rendered to static markup so no DOM environment is needed: these assert that
// the panel's busy state follows the server-reported status (the bug where it
// stayed stuck on "SCANNING" forever) and that the payload returned by
// /api/recon/scan is actually surfaced to the operator.

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ReconView } from '../src/components/ReconView';
import type { ReconHistoryEntry } from '../src/utils/reconHistory';
import type { DiscoveredHost } from '../src/utils/topology';

type ReconStatus = 'idle' | 'scanning' | 'complete' | 'error';

interface ReconResults {
  scanType: string;
  results: string;
  timestamp: string;
  status: ReconStatus;
}

const LIVE_PAYLOAD = [
  '=== PORT SCAN ===',
  'Target: 192.168.1.1',
  'Scan duration: 1118ms',
  '',
  '--- LIVE PROBE (real TCP connect checks) ---',
  '  192.168.1.1: 22/tcp, 80/tcp OPEN (live probe)',
].join('\n');

function results(status: ReconStatus, overrides: Partial<ReconResults> = {}): ReconResults {
  return {
    scanType: 'port',
    results: '',
    timestamp: '2026-09-18T10:00:00.000Z',
    status,
    ...overrides,
  };
}

function render(
  reconResults: ReconResults,
  extras: {
    reconHistory?: ReconHistoryEntry[];
    reconHosts?: DiscoveredHost[];
    reconLocalAddresses?: string[];
    watchedHosts?: string[];
    watchProbes?: DiscoveredHost[];
    watchProbedAt?: string | null;
  } = {}
): string {
  return renderToStaticMarkup(
    <ReconView
      agents={[]}
      channels={[]}
      tasks={[]}
      reconResults={reconResults}
      reconHistory={extras.reconHistory ?? []}
      reconHosts={extras.reconHosts ?? []}
      reconLocalAddresses={extras.reconLocalAddresses ?? []}
      watchedHosts={extras.watchedHosts ?? []}
      watchProbes={extras.watchProbes ?? []}
      watchProbedAt={extras.watchProbedAt ?? null}
      onToggleWatch={() => {}}
      onProbeWatched={() => {}}
      onRunScan={async () => {}}
      onRefreshScan={async () => {}}
    />
  );
}

test('shows the busy state while the server reports a running scan', () => {
  const html = render(results('scanning'));

  assert.match(html, /SCANNING PORT/);
  assert.match(html, /INITIATING PORT SCAN/);
  // Both action buttons are locked out mid-scan.
  assert.ok(html.includes('disabled=""'), 'scan actions should be disabled while scanning');
});

test('leaves the busy state once the server reports the scan finished', () => {
  const html = render(results('complete', { results: LIVE_PAYLOAD }));

  // Regression guard: the panel used to stay on "SCANNING" forever because the
  // busy flag came from local state that was never cleared.
  assert.ok(!html.includes('SCANNING'), 'finished scans must not still read as scanning');
  assert.ok(!html.includes('INITIATING'), 'finished scans must not show the initiating placeholder');
  assert.ok(!html.includes('disabled=""'), 'scan actions should be usable again');
});

test('renders the payload returned by the scan endpoint', () => {
  const html = render(results('complete', { results: LIVE_PAYLOAD }));

  assert.match(html, /LIVE SCAN OUTPUT \/\/ PORT/);
  assert.match(html, /LIVE PROBE \(real TCP connect checks\)/);
  assert.match(html, /192\.168\.1\.1: 22\/tcp, 80\/tcp OPEN/);
});

test('surfaces the failure reason when a scan errors', () => {
  const html = render(results('error', { results: 'Missing scanType parameter' }));

  assert.match(html, /SCAN FAILED/);
  assert.match(html, /Missing scanType parameter/);
  assert.ok(!html.includes('SCANNING'), 'a failed scan must not still read as scanning');
});

test('the raw output panel stays hidden before any scan has run', () => {
  const html = render(results('idle'));

  assert.ok(!html.includes('LIVE SCAN OUTPUT'));
  assert.ok(!html.includes('SCAN FAILED'));
  assert.match(html, /EXECUTE PORT SCAN/);
});

test('renders recorded scan history, newest first', () => {
  const history: ReconHistoryEntry[] = [
    { id: 'b', scanType: 'port', timestamp: '2026-09-18T10:01:00.000Z', status: 'complete', executionTimeMs: 120 },
    { id: 'a', scanType: 'network', timestamp: '2026-09-18T10:00:00.000Z', status: 'error', executionTimeMs: 900 },
  ];

  const html = render(results('complete', { results: LIVE_PAYLOAD }), { reconHistory: history });

  assert.match(html, /SCAN HISTORY \(2\)/);
  assert.match(html, /120ms/);
  assert.match(html, /900ms/);

  // Scope the ordering check to the history list — the scan-type buttons above
  // also mention port and network.
  const historySection = html.slice(html.indexOf('SCAN HISTORY (2)'));
  assert.ok(
    historySection.indexOf('port') < historySection.indexOf('network'),
    'newest entry should render first'
  );
});

test('invites the operator to scan when no history exists', () => {
  const html = render(results('idle'));

  assert.match(html, /SCAN HISTORY \(0\)/);
  assert.match(html, /No scans recorded in this session/);
});

test('the topology map renders the hosts the scan discovered', () => {
  const reconHosts: DiscoveredHost[] = [
    { host: '10.0.0.1', openPorts: [80], online: true },
    { host: '10.0.0.7', openPorts: [22, 3000], online: true },
    { host: '10.0.0.9', openPorts: [], online: false },
  ];

  const html = render(results('complete', { scanType: 'network-map', results: LIVE_PAYLOAD }), {
    reconHosts,
    reconLocalAddresses: ['10.0.0.7'],
  });

  assert.match(html, /SUBNET TOPOLOGY/);
  assert.match(html, /LIVE DISCOVERY/);
  assert.match(html, /10\.0\.0\.7/);
  assert.match(html, /10\.0\.0\.9/);
  assert.match(html, /3 hosts \/\/ 2 active/);
  // Baseline-only nodes must not leak into a live map.
  assert.ok(!html.includes('GUEST-DEVICE'), 'baseline nodes must not appear alongside live discovery');
});

test('watched hosts are marked on the map', () => {
  const html = render(results('complete', { scanType: 'network-map', results: LIVE_PAYLOAD }), {
    watchedHosts: ['192.168.1.1'],
  });

  assert.equal((html.match(/data-testid="watch-halo"/g) ?? []).length, 1, 'exactly the watched node is haloed');
  assert.match(html, /WATCHED/);
  assert.match(html, /\/\/ WATCHED/, 'the node tooltip names the watch state');
  assert.match(html, /1 watched/, 'the map footer counts watched hosts');
});

test('no watch markers are drawn when nothing is watched', () => {
  const html = render(results('complete', { scanType: 'network-map', results: LIVE_PAYLOAD }));

  assert.equal((html.match(/data-testid="watch-halo"/g) ?? []).length, 0);
  assert.ok(!html.includes('WATCHED'), 'the map legend stays clean with an empty watch list');
});

test('the topology map falls back to the baseline profile before live discovery', () => {
  const html = render(results('complete', { scanType: 'network-map', results: LIVE_PAYLOAD }));

  assert.match(html, /BASELINE/);
  assert.match(html, /MOTO G5 STYLUS/);
  assert.match(html, /GUEST-DEVICE/);
  assert.match(html, /5 hosts \/\/ 4 active/);
});

test('the watch list invites the operator to star a node when empty', () => {
  const html = render(results('idle'));

  assert.match(html, /WATCH LIST \(0\/16\)/);
  assert.match(html, /No hosts watched/);
});

test('watched hosts render with their latest probe result', () => {
  const html = render(results('idle'), {
    watchedHosts: ['192.168.1.1', '10.0.0.7'],
    watchProbes: [
      { host: '192.168.1.1', openPorts: [22, 80], online: true },
      { host: '10.0.0.7', openPorts: [], online: false },
    ],
    watchProbedAt: '2026-09-18T10:00:00.000Z',
  });

  assert.match(html, /WATCH LIST \(2\/16\)/);
  assert.match(html, /192\.168\.1\.1/);
  assert.match(html, /22\/tcp, 80\/tcp/);
  assert.match(html, /10\.0\.0\.7/);
  assert.match(html, /NO RESPONSE/);
  // The poll cadence is surfaced so the operator knows the data is live.
  assert.match(html, /every 15s/);
});

test('a watched host with no probe result yet renders as pending', () => {
  const html = render(results('idle'), { watchedHosts: ['192.168.1.50'] });

  assert.match(html, /WATCH LIST \(1\/16\)/);
  assert.match(html, /192\.168\.1\.50/);
  assert.match(html, /PENDING/);
});

test('every watched host gets a remove control', () => {
  const html = render(results('idle'), { watchedHosts: ['192.168.1.1', '192.168.1.9'] });

  // Matched on the accessible name, since both title and aria-label carry the text.
  assert.equal((html.match(/aria-label="Remove 192\.168\.1\.\d+ from watch list"/g) ?? []).length, 2);
});

test('a full watch list explains why nothing else can be added', () => {
  const full = Array.from({ length: 16 }, (_, i) => `192.168.1.${100 + i}`);
  const html = render(results('idle'), { watchedHosts: full });

  assert.match(html, /WATCH LIST \(16\/16\)/);
  assert.match(html, /Watch list full/);
});

test('the map offers a watch toggle for every node', () => {
  const html = render(results('complete', { scanType: 'network-map', results: LIVE_PAYLOAD }), {
    watchedHosts: ['192.168.1.1'],
  });

  const watchToggles = html.match(/aria-label="(?:Watch|Stop watching) [\d.]+/g) ?? [];
  // 5 baseline nodes, each with a star control.
  assert.equal(watchToggles.length, 5);
  assert.ok(watchToggles.some((label) => label.includes('Stop watching 192.168.1.1')), 'the watched node shows as active');
});

test('a non-map scan does not render the topology map', () => {
  const html = render(results('complete', { scanType: 'process', results: LIVE_PAYLOAD }));

  assert.ok(!html.includes('SUBNET TOPOLOGY'));
  assert.match(html, /PROCESS TABLE/);
});
