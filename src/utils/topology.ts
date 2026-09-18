// Subnet topology modelling for the recon map.
//
// Pure geometry + classification so the map can be tested without a DOM and so
// discovered hosts and the simulated fallback render through the same path.

export interface DiscoveredHost {
  /** IPv4 address of the host, as reported by the scan. */
  host: string;
  /** Ports confirmed open by the TCP probe (empty when unreachable). */
  openPorts: number[];
  online: boolean;
}

export type HostRole = 'gateway' | 'local' | 'hermes' | 'server' | 'offline';

export interface HostRoleStyle {
  badge: string;
  iconBox: string;
  text: string;
  stroke: string;
}

/** Tailwind class tokens per role — kept here so both live and fallback hosts look identical. */
export const HOST_ROLE_STYLES: Record<HostRole, HostRoleStyle> = {
  gateway: {
    badge: 'ONLINE // GATEWAY',
    iconBox: 'bg-cyan-600 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.6)]',
    text: 'text-cyan-300',
    stroke: '#06b6d4',
  },
  local: {
    badge: 'ONLINE // LOCAL',
    iconBox: 'bg-emerald-900/80 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]',
    text: 'text-emerald-300',
    stroke: '#10b981',
  },
  hermes: {
    badge: 'ONLINE // C2 NODE',
    iconBox: 'bg-cyan-900/80 border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]',
    text: 'text-cyan-300',
    stroke: '#06b6d4',
  },
  server: {
    badge: 'ONLINE // SERVICE HOST',
    iconBox: 'bg-amber-900/80 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]',
    text: 'text-amber-300',
    stroke: '#f59e0b',
  },
  offline: {
    badge: 'UNREACHABLE',
    iconBox: 'bg-slate-800/80 border-slate-600 opacity-60',
    text: 'text-slate-400',
    stroke: '#64748b',
  },
};

/**
 * Ports that mark a host as running the Hermes control plane rather than a
 * generic service. 3000 is the app server, 5173 the Vite dev server.
 */
export const HERMES_PORTS = [3000, 5173];

export function isHermesNode(host: DiscoveredHost): boolean {
  return host.openPorts.some((port) => HERMES_PORTS.includes(port));
}

/**
 * Order matters: the local device wins over everything (it is us, whatever
 * ports it answers on), then unreachable hosts, then the gateway heuristic
 * (the .1 address of the subnet), then the Hermes control plane.
 */
export function classifyHost(host: DiscoveredHost, localAddresses: string[] = []): HostRole {
  if (localAddresses.includes(host.host)) return 'local';
  if (!host.online || host.openPorts.length === 0) return 'offline';
  if (host.host.split('.').pop() === '1') return 'gateway';
  if (isHermesNode(host)) return 'hermes';
  return 'server';
}

const KNOWN_HOST_LABELS: Record<string, string> = {
  '192.168.1.1': 'GATEWAY',
  '192.168.1.100': 'HERMES-CLOUD',
  '192.168.1.101': 'BACKUP-SVR',
  '192.168.1.139': 'MOTO G5 STYLUS',
  '192.168.1.200': 'GUEST-DEVICE',
};

export function labelForHost(ip: string): string {
  return KNOWN_HOST_LABELS[ip] ?? ip;
}

export interface LaidOutHost extends DiscoveredHost {
  role: HostRole;
  label: string;
  /** Horizontal centre as a percentage of container width. */
  leftPct: number;
  /** Vertical offset of the node top, in px. */
  topPx: number;
  /** Matching coordinate in the SVG viewBox, for link lines. */
  x: number;
  y: number;
}

export interface TopologyLayout {
  /** The subnet router, anchored at the top of the map. Null when not discovered. */
  gateway: LaidOutHost | null;
  /** Every other host, distributed along the map. */
  hosts: LaidOutHost[];
  /** Hosts answering on at least one port. */
  activeCount: number;
}

export const TOPOLOGY_VIEWBOX = { width: 400, height: 256 };
/** Scan origin / gateway anchor inside the viewBox. */
export const GATEWAY_ANCHOR = { x: 200, y: 45 };
/** Half the height of the gateway node's `w-12 h-12` icon. */
export const GATEWAY_ICON_HALF_HEIGHT = 24;
/** Half the height of a ring node's `w-10 h-10` icon. */
export const RING_ICON_HALF_HEIGHT = 20;

const RING_LEFT_MIN = 15;
const RING_LEFT_SPAN = 70; // 15% .. 85%
/** Icon centre heights for the two staggered rows. */
const RING_ROW_CENTER = [104 + RING_ICON_HALF_HEIGHT, 162 + RING_ICON_HALF_HEIGHT] as const;

/**
 * Position a node from its icon centre, so `topPx` (the DOM offset) and `y`
 * (the viewBox link endpoint) can never disagree about where the icon is.
 */
function place(
  host: DiscoveredHost,
  role: HostRole,
  leftPct: number,
  iconCenterY: number,
  iconHalfHeight: number
): LaidOutHost {
  return {
    ...host,
    role,
    label: labelForHost(host.host),
    leftPct,
    topPx: Math.round(iconCenterY - iconHalfHeight),
    // Left unrounded: 1 viewBox unit can be several screen px on a wide layout,
    // and the link endpoint must land exactly on the node's centre.
    x: (leftPct / 100) * TOPOLOGY_VIEWBOX.width,
    y: iconCenterY,
  };
}

/**
 * Split discovered hosts into a gateway anchor plus a horizontally spread ring,
 * staggering alternate rows so labels never overlap.
 */
export function layoutTopology(
  hosts: DiscoveredHost[],
  localAddresses: string[] = []
): TopologyLayout {
  const gatewayHost = hosts.find((host) => classifyHost(host, localAddresses) === 'gateway');
  // The gateway's icon centre sits on GATEWAY_ANCHOR, which is where the link
  // lines and the radar sweep originate.
  const gateway = gatewayHost
    ? place(
        gatewayHost,
        'gateway',
        (GATEWAY_ANCHOR.x / TOPOLOGY_VIEWBOX.width) * 100,
        GATEWAY_ANCHOR.y,
        GATEWAY_ICON_HALF_HEIGHT
      )
    : null;

  const ring = hosts.filter((host) => host !== gatewayHost);
  const ringHosts = ring.map((host, index) => {
    const ratio = ring.length <= 1 ? 0.5 : index / (ring.length - 1);
    const leftPct = RING_LEFT_MIN + ratio * RING_LEFT_SPAN;
    return place(
      host,
      classifyHost(host, localAddresses),
      leftPct,
      RING_ROW_CENTER[index % 2],
      RING_ICON_HALF_HEIGHT
    );
  });

  return {
    gateway,
    hosts: ringHosts,
    activeCount: hosts.filter((host) => host.online && host.openPorts.length > 0).length,
  };
}

/**
 * Baseline topology shown before any live discovery has run. Port lists are
 * illustrative — they exercise every role style so the map is legible offline.
 */
export const FALLBACK_TOPOLOGY_HOSTS: DiscoveredHost[] = [
  { host: '192.168.1.1', openPorts: [22, 80, 443], online: true },
  { host: '192.168.1.139', openPorts: [22, 3000], online: true },
  { host: '192.168.1.100', openPorts: [22, 443, 3000], online: true },
  { host: '192.168.1.101', openPorts: [22, 80], online: true },
  { host: '192.168.1.200', openPorts: [], online: false },
];

export const FALLBACK_LOCAL_ADDRESSES = ['192.168.1.139'];
