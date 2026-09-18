// End-to-end contract test for POST /api/recon/scan.
//
// Boots the real server as a child process (the same entrypoint `npm run dev`
// uses) and talks to it over HTTP, so the express wiring, JSON parsing, live
// probing and response shape are all exercised for real.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';

const PORT = 3481;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TSX_CLI = path.join('node_modules', 'tsx', 'dist', 'cli.mjs');

let server: ReturnType<typeof spawn> | null = null;
let serverLog = '';

async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms.\n--- output ---\n${serverLog}`);
}

async function scan(body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE_URL}/api/recon/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

before(async () => {
  server = spawn(process.execPath, [TSX_CLI, 'server.ts'], {
    cwd: process.cwd(),
    // Production mode skips the Vite dev middleware; the recon route is identical
    // and the API surface is all this suite needs.
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (chunk) => {
    serverLog += chunk.toString();
  });
  server.stderr?.on('data', (chunk) => {
    serverLog += chunk.toString();
  });

  await waitForServer();
});

after(() => {
  server?.kill('SIGTERM');
  server = null;
});

test('process scans return the full response contract', async () => {
  const { status, json } = await scan({ scanType: 'process' });

  assert.equal(status, 200);
  assert.equal(json.scanType, 'process');
  assert.equal(json.status, 'complete');
  assert.equal(typeof json.results, 'string');
  assert.ok(json.results.length > 0, 'results must not be empty');
  assert.match(json.results, /PROCESS/);
  assert.ok(Array.isArray(json.hosts), 'hosts must always be an array');
  assert.ok(Array.isArray(json.localAddresses), 'localAddresses must always be an array');
  assert.equal(typeof json.executionTimeMs, 'number');
  assert.ok(Number.isFinite(json.executionTimeMs));
  assert.ok(!Number.isNaN(Date.parse(json.timestamp)), 'timestamp must be an ISO date');
});

test('every host is shaped for the topology map', async () => {
  const { json } = await scan({ scanType: 'network-map' });

  assert.ok(json.hosts.length > 0, 'a subnet map must report the hosts it probed');
  for (const host of json.hosts) {
    assert.equal(typeof host.host, 'string');
    assert.match(host.host, /^\d+\.\d+\.\d+\.\d+$/, `unexpected host address: ${host.host}`);
    assert.ok(Array.isArray(host.openPorts), 'openPorts must be an array');
    assert.equal(typeof host.online, 'boolean');
    // online is derived from the probe, so the two must agree.
    assert.equal(host.online, host.openPorts.length > 0);
  }
});

test('the probed host set includes this device so it can be tagged local', async () => {
  const { json } = await scan({ scanType: 'network-map' });

  for (const address of json.localAddresses) {
    assert.ok(
      json.hosts.some((host: { host: string }) => host.host === address),
      `local address ${address} should have been probed`
    );
  }
});

test('hosts are only reported for scans that enumerate the network', async () => {
  const process = await scan({ scanType: 'process' });
  const port = await scan({ scanType: 'port' });

  // A process scan is not a network sweep, so the client keeps its previous map.
  assert.deepEqual(process.json.hosts, []);
  assert.ok(port.json.hosts.length > 0, 'a port scan should report the probed host');
});

test('the report appends live probe output when probing succeeded', async () => {
  const { json } = await scan({ scanType: 'port' });

  assert.match(json.results, /PORT SCAN/);
  assert.match(json.results, /LIVE PROBE \(real TCP connect checks\)/);
});

test('a missing scanType is rejected without running a scan', async () => {
  const { status, json } = await scan({});

  assert.equal(status, 400);
  assert.match(json.error, /scanType/);
});

test('an unknown scanType is reported rather than failing', async () => {
  const { status, json } = await scan({ scanType: 'launch-missiles' });

  assert.equal(status, 200);
  assert.match(json.results, /Unknown scan type: launch-missiles/);
  assert.deepEqual(json.hosts, []);
});

async function probe(body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE_URL}/api/recon/probe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

test('the watch probe endpoint reports a status per host', async () => {
  const { status, json } = await probe({ hosts: ['127.0.0.1', '192.0.2.1'] });

  assert.equal(status, 200);
  assert.ok(Array.isArray(json.hosts), 'hosts must be an array');
  assert.equal(json.hosts.length, 2, 'every requested host must get a result');
  assert.ok(Array.isArray(json.ports), 'the probed port set is echoed back');
  assert.ok(!Number.isNaN(Date.parse(json.probedAt)), 'probedAt must be an ISO date');

  for (const host of json.hosts) {
    assert.equal(typeof host.host, 'string');
    assert.equal(typeof host.online, 'boolean');
    assert.equal(host.online, host.openPorts.length > 0);
  }
});

test('the watch probe deduplicates hosts', async () => {
  const { json } = await probe({ hosts: ['127.0.0.1', '127.0.0.1', '127.0.0.1'] });

  assert.equal(json.hosts.length, 1);
});

test('the watch probe accepts an explicit port list', async () => {
  const { json } = await probe({ hosts: ['127.0.0.1'], ports: [22, 80] });

  assert.deepEqual(json.ports, [22, 80]);
});

test('the watch probe rejects input it should not act on', async () => {
  const empty = await probe({ hosts: [] });
  assert.equal(empty.status, 400);
  assert.match(empty.json.error, /non-empty/);

  const missing = await probe({});
  assert.equal(missing.status, 400);

  // Hostnames are refused so a probe request can never target arbitrary DNS.
  const hostname = await probe({ hosts: ['example.com'] });
  assert.equal(hostname.status, 400);
  assert.match(hostname.json.error, /Invalid host address/);

  const outOfRange = await probe({ hosts: ['192.168.1.999'] });
  assert.equal(outOfRange.status, 400);

  const tooMany = await probe({ hosts: Array.from({ length: 17 }, (_, i) => `10.0.0.${i + 1}`) });
  assert.equal(tooMany.status, 400);
  assert.match(tooMany.json.error, /At most 16/);
});

test('the watch probe caps out at the documented host limit', async () => {
  const atLimit = await probe({ hosts: Array.from({ length: 16 }, (_, i) => `10.255.255.${i + 1}`) });

  assert.equal(atLimit.status, 200);
  assert.equal(atLimit.json.hosts.length, 16);
});

test('repeated scans stay independent', async () => {
  const first = await scan({ scanType: 'network' });
  const second = await scan({ scanType: 'process' });

  assert.equal(first.json.scanType, 'network');
  assert.equal(second.json.scanType, 'process');
  assert.notEqual(first.json.hosts.length, 0);
  assert.deepEqual(second.json.hosts, []);
});
