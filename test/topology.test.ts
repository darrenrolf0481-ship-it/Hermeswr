import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FALLBACK_LOCAL_ADDRESSES,
  FALLBACK_TOPOLOGY_HOSTS,
  GATEWAY_ANCHOR,
  GATEWAY_ICON_HALF_HEIGHT,
  RING_ICON_HALF_HEIGHT,
  TOPOLOGY_VIEWBOX,
  classifyHost,
  isHermesNode,
  labelForHost,
  layoutTopology,
} from '../src/utils/topology';
import type { DiscoveredHost } from '../src/utils/topology';

function host(overrides: Partial<DiscoveredHost> = {}): DiscoveredHost {
  return { host: '192.168.1.50', openPorts: [22], online: true, ...overrides };
}

test('classifyHost treats a local interface address as the local node', () => {
  const local = host({ host: '10.0.0.7', openPorts: [22, 3000] });

  assert.equal(classifyHost(local, ['10.0.0.7']), 'local');
  assert.equal(classifyHost(local, ['10.0.0.8']), 'hermes');
});

test('the local node wins even when the host is unreachable', () => {
  const local = host({ host: '10.0.0.7', openPorts: [], online: false });

  assert.equal(classifyHost(local, ['10.0.0.7']), 'local');
});

test('classifyHost marks unreachable hosts offline', () => {
  assert.equal(classifyHost(host({ openPorts: [], online: false })), 'offline');
  assert.equal(classifyHost(host({ openPorts: [], online: true })), 'offline');
});

test('classifyHost identifies the .1 address as the gateway', () => {
  assert.equal(classifyHost(host({ host: '192.168.1.1', openPorts: [22, 80, 443] })), 'gateway');
  assert.equal(classifyHost(host({ host: '10.0.0.1', openPorts: [80] })), 'gateway');
  // Only the final octet counts — .11 must not be mistaken for the gateway.
  assert.equal(classifyHost(host({ host: '192.168.1.11', openPorts: [22] })), 'server');
});

test('classifyHost recognises Hermes control-plane ports', () => {
  assert.ok(isHermesNode(host({ openPorts: [3000] })));
  assert.ok(isHermesNode(host({ openPorts: [22, 5173] })));
  assert.equal(classifyHost(host({ host: '192.168.1.100', openPorts: [22, 3000] })), 'hermes');
});

test('classifyHost falls back to a generic service host', () => {
  assert.equal(classifyHost(host({ host: '192.168.1.101', openPorts: [22, 80] })), 'server');
});

test('labelForHost names known hosts and passes unknown IPs through', () => {
  assert.equal(labelForHost('192.168.1.1'), 'GATEWAY');
  assert.equal(labelForHost('192.168.1.139'), 'MOTO G5 STYLUS');
  assert.equal(labelForHost('192.168.44.9'), '192.168.44.9');
});

test('layoutTopology anchors the gateway and spreads the rest across the ring', () => {
  const hosts = [
    host({ host: '192.168.1.1', openPorts: [22, 80] }),
    host({ host: '192.168.1.50', openPorts: [443] }),
    host({ host: '192.168.1.51', openPorts: [443] }),
    host({ host: '192.168.1.52', openPorts: [443] }),
  ];

  const layout = layoutTopology(hosts);

  assert.ok(layout.gateway);
  assert.equal(layout.gateway?.host, '192.168.1.1');
  assert.equal(layout.gateway?.role, 'gateway');
  assert.equal(layout.gateway?.leftPct, 50);
  assert.equal(layout.hosts.length, 3);
  assert.equal(layout.activeCount, 4);
});

test('layoutTopology leaves the gateway unset when none was discovered', () => {
  const layout = layoutTopology([host({ host: '192.168.1.50' })]);

  assert.equal(layout.gateway, null);
  assert.equal(layout.hosts.length, 1);
});

test('ring hosts stay inside the map bounds and alternate rows', () => {
  const hosts = Array.from({ length: 6 }, (_, i) => host({ host: `192.168.1.${10 + i}`, openPorts: [22] }));

  const layout = layoutTopology(hosts);
  const lefts = layout.hosts.map((h) => h.leftPct);

  assert.equal(layout.hosts.length, 6);
  assert.equal(Math.min(...lefts), 15);
  assert.equal(Math.max(...lefts), 85);

  // Ascending left-to-right, and consecutive nodes land on different rows.
  for (let i = 1; i < lefts.length; i++) {
    assert.ok(lefts[i] > lefts[i - 1], 'hosts must be laid out left to right');
  }
  for (let i = 1; i < layout.hosts.length; i++) {
    assert.notEqual(layout.hosts[i].topPx, layout.hosts[i - 1].topPx);
  }
});

test('each node’s link endpoint sits on its icon centre', () => {
  const hosts = [
    host({ host: '192.168.1.1', openPorts: [80] }),
    host({ host: '192.168.1.50', openPorts: [22] }),
    host({ host: '192.168.1.51', openPorts: [22] }),
  ];

  const layout = layoutTopology(hosts);

  // Gateway: 48px icon (half height 24) centred on the anchor.
  assert.equal(layout.gateway?.y, GATEWAY_ANCHOR.y);
  assert.equal(layout.gateway?.topPx, GATEWAY_ANCHOR.y - GATEWAY_ICON_HALF_HEIGHT);

  // Ring hosts: 40px icon, so the endpoint is topPx + half height.
  for (const node of layout.hosts) {
    assert.equal(node.y, node.topPx + RING_ICON_HALF_HEIGHT);
  }
});

test('a single ring host is centred', () => {
  const layout = layoutTopology([host({ host: '192.168.1.1', openPorts: [80] }), host({ host: '192.168.1.50' })]);

  assert.equal(layout.hosts[0].leftPct, 50);
});

test('viewBox coordinates track the percentage position and stay in range', () => {
  const hosts = Array.from({ length: 4 }, (_, i) => host({ host: `192.168.1.${10 + i}`, openPorts: [22] }));
  const layout = layoutTopology(hosts);

  for (const node of layout.hosts) {
    // Exact, not rounded: the link layer is stretched to the container, so a
    // rounding error here shows up as a visible offset from the node.
    assert.ok(
      Math.abs(node.x - (node.leftPct / 100) * TOPOLOGY_VIEWBOX.width) < 1e-9,
      `x must track leftPct exactly: ${node.x}`
    );
    assert.ok(node.x >= 0 && node.x <= TOPOLOGY_VIEWBOX.width, `x out of range: ${node.x}`);
    assert.ok(node.y <= TOPOLOGY_VIEWBOX.height, `y out of range: ${node.y}`);
  }

  assert.ok(GATEWAY_ANCHOR.x > 0 && GATEWAY_ANCHOR.x < TOPOLOGY_VIEWBOX.width);
  assert.ok(GATEWAY_ANCHOR.y > 0 && GATEWAY_ANCHOR.y < TOPOLOGY_VIEWBOX.height);
});

test('layoutTopology never mutates the hosts it is given', () => {
  const hosts = [host({ host: '192.168.1.1', openPorts: [80] }), host({ host: '192.168.1.50' })];
  const snapshot = JSON.parse(JSON.stringify(hosts));

  layoutTopology(hosts);

  assert.deepEqual(hosts, snapshot);
});

test('the fallback profile renders the baseline map before any live discovery', () => {
  const layout = layoutTopology(FALLBACK_TOPOLOGY_HOSTS, FALLBACK_LOCAL_ADDRESSES);

  assert.equal(layout.gateway?.host, '192.168.1.1');
  assert.equal(layout.hosts.length, FALLBACK_TOPOLOGY_HOSTS.length - 1);
  // 4 reachable + the unreachable guest device = 4 active.
  assert.equal(layout.activeCount, 4);
  assert.equal(layout.hosts.find((h) => h.host === '192.168.1.139')?.role, 'local');
  assert.equal(layout.hosts.find((h) => h.host === '192.168.1.100')?.role, 'hermes');
  assert.equal(layout.hosts.find((h) => h.host === '192.168.1.200')?.role, 'offline');
});

test('live discovery replaces the fallback host set', () => {
  const discovered = [
    host({ host: '10.0.0.1', openPorts: [80] }),
    host({ host: '10.0.0.7', openPorts: [3000] }),
  ];

  const layout = layoutTopology(discovered, ['10.0.0.7']);

  assert.equal(layout.gateway?.host, '10.0.0.1');
  assert.deepEqual(layout.hosts.map((h) => h.host), ['10.0.0.7']);
  assert.equal(layout.hosts[0].role, 'local');
});
