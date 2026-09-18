import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Scan, 
  Map, 
  Wifi, 
  Shield, 
  Radio, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw, 
  ChevronRight,
  Layers,
  Activity,
  Eye,
  EyeOff,
  Zap,
  Cpu,
  HardDrive,
  Database,
  Download,
  FileText,
  Star,
  Trash2
} from 'lucide-react';
import { AgentDeployment, CommChannel, AgentTask } from '../types';
import { sound } from '../utils/audio';
import { ReconHistoryEntry } from '../utils/reconHistory';
import {
  buildReconExport,
  buildReconReport,
  buildTopologyExport,
  reportFileName,
} from '../utils/reconExport';
import {
  DiscoveredHost,
  HostRole,
  HOST_ROLE_STYLES,
  GATEWAY_ANCHOR,
  TOPOLOGY_VIEWBOX,
  LaidOutHost,
  FALLBACK_TOPOLOGY_HOSTS,
  FALLBACK_LOCAL_ADDRESSES,
  layoutTopology,
  classifyHost,
} from '../utils/topology';
import {
  WATCH_POLL_INTERVAL_MS,
  WATCH_LIST_LIMIT,
  mergeWatchStatuses,
} from '../utils/watchList';

const HOST_ROLE_ICONS: Record<HostRole, React.ComponentType<{ className?: string }>> = {
  gateway: Radio,
  local: HardDrive,
  hermes: Database,
  server: Cpu,
  offline: Zap,
};

interface ReconViewProps {
  agents: AgentDeployment[];
  channels: CommChannel[];
  tasks: AgentTask[];
  reconResults: {
    scanType: string;
    results: string;
    timestamp: string;
    status: 'idle' | 'scanning' | 'complete' | 'error';
  };
  reconHistory: ReconHistoryEntry[];
  /** Hosts discovered by the most recent live probe. Empty until a scan reports some. */
  reconHosts: DiscoveredHost[];
  /** Interface addresses of the scanning device, used to tag the local node. */
  reconLocalAddresses: string[];
  /** Hosts the operator asked to re-probe on a timer. */
  watchedHosts: string[];
  /** Latest probe results for the watch list; hosts missing here render as pending. */
  watchProbes: DiscoveredHost[];
  watchProbedAt: string | null;
  onToggleWatch: (host: string) => void;
  onProbeWatched: () => void;
  onRunScan: (scanType: string) => Promise<void>;
  onRefreshScan: () => Promise<void>;
}

type ScanType = 'network' | 'port' | 'process' | 'network-map';

const SCAN_TYPE_IDS: ScanType[] = ['network', 'port', 'process', 'network-map'];

function toScanType(value: string): ScanType {
  return SCAN_TYPE_IDS.find((type) => type === value) ?? 'network';
}

const SCAN_TYPES: { id: ScanType; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { id: 'network', label: 'NETWORK', icon: Wifi, description: 'WiFi link quality, signal strength, gateway info' },
  { id: 'port', label: 'PORT MAP', icon: Shield, description: 'Open ports, listening services, ingress vectors' },
  { id: 'process', label: 'PROCESS', icon: Activity, description: 'Running daemons, CPU/RAM footprint, PID tree' },
  { id: 'network-map', label: 'NET MAP', icon: Map, description: 'Subnet topology with discovered hosts' },
];

export const ReconView: React.FC<ReconViewProps> = ({
  agents,
  channels,
  tasks,
  reconResults,
  reconHistory,
  reconHosts,
  reconLocalAddresses,
  watchedHosts,
  watchProbes,
  watchProbedAt,
  onToggleWatch,
  onProbeWatched,
  onRunScan,
  onRefreshScan,
}) => {
  // Open on whatever was scanned last so the panel restores context across mounts.
  const [selectedScan, setSelectedScan] = useState<ScanType>(() => toScanType(reconResults.scanType));
  const [isTopologyVisible, setIsTopologyVisible] = useState(true);
  /** Set once the operator picks a scan type, so automatic scans stop steering the view. */
  const userSelectedScan = useRef(false);

  // The server-reported status is the single source of truth for the busy state,
  // so the panel can never get stuck showing "SCANNING" after a run finishes.
  const isScanning = reconResults.status === 'scanning';
  const activeScanType = (isScanning ? reconResults.scanType : '') || selectedScan;

  // Keyboard shortcuts for recon scans
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;

      // Never shadow the operator while they are typing, and leave browser and
      // OS chords alone.
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Enter and Space belong to whatever control has focus. Claiming them here
      // would fire the scan twice: once from this handler, once from the button
      // the operator activated.
      if (key === 'enter' || key === ' ') {
        if (target?.closest('button, a, select, [role="button"], [contenteditable="true"]')) return;
        e.preventDefault();
        handleRun();
        return;
      }

      switch (key) {
        case '1':
          sound.click();
          setSelectedScan('network');
          break;
        case '2':
          sound.click();
          setSelectedScan('port');
          break;
        case '3':
          sound.click();
          setSelectedScan('process');
          break;
        case '4':
          sound.click();
          setSelectedScan('network-map');
          break;
        case 't':
          sound.click();
          setIsTopologyVisible(!isTopologyVisible);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // Re-register when the values handleRun() reads change, otherwise Enter would
    // re-run a stale scan type from a previous render.
  }, [isTopologyVisible, selectedScan, isScanning]);

  const handleSelectScan = (scan: ScanType) => {
    sound.click();
    userSelectedScan.current = true;
    setSelectedScan(scan);
  };

  const handleRun = () => {
    if (isScanning) return;
    sound.dispatch();
    onRunScan(selectedScan);
  };

  const scanIcon = SCAN_TYPES.find(t => t.id === selectedScan)?.icon || Wifi;

  const handleReplayScan = (scanType: ScanType) => {
    sound.click();
    userSelectedScan.current = true;
    setSelectedScan(scanType);
    onRunScan(scanType);
  };

  // Show what the automatic scan produced (the topology map) instead of leaving
  // the panel on a stale default — but never override a deliberate selection.
  useEffect(() => {
    if (userSelectedScan.current) return;
    if (reconResults.status !== 'complete' || !reconResults.scanType) return;
    setSelectedScan(toScanType(reconResults.scanType));
  }, [reconResults.status, reconResults.scanType]);

  // Live discovery wins; before the first probe the baseline profile is drawn
  // through the same layout path so both views stay consistent.
  const usingLiveHosts = reconHosts.length > 0;
  const topology = useMemo(
    () =>
      layoutTopology(
        usingLiveHosts ? reconHosts : FALLBACK_TOPOLOGY_HOSTS,
        usingLiveHosts ? reconLocalAddresses : FALLBACK_LOCAL_ADDRESSES
      ),
    [usingLiveHosts, reconHosts, reconLocalAddresses]
  );
  const totalHosts = topology.hosts.length + (topology.gateway ? 1 : 0);
  /** One row per watched host — newly added hosts show as pending until probed. */
  const watchRows = mergeWatchStatuses(watchedHosts, watchProbes);
  const watchListFull = watchedHosts.length >= WATCH_LIST_LIMIT;
  // Draw links from the gateway when one was discovered, otherwise from the scan origin.
  const linkOrigin = topology.gateway ? { x: topology.gateway.x, y: topology.gateway.y } : GATEWAY_ANCHOR;

  /** The exact host set and roles currently drawn on the map. */
  const topologySnapshot = () =>
    buildTopologyExport(
      usingLiveHosts ? reconHosts : FALLBACK_TOPOLOGY_HOSTS,
      usingLiveHosts ? reconLocalAddresses : FALLBACK_LOCAL_ADDRESSES,
      { source: usingLiveHosts ? 'live' : 'baseline', watchedHosts }
    );

  const download = (contents: string, filename: string, contentType: string) => {
    const blob = new Blob([contents], { type: contentType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    sound.click();
    download(
      JSON.stringify(
        buildReconExport({
          currentScan: reconResults,
          topology: topologySnapshot(),
          history: reconHistory,
        }),
        null,
        2
      ),
      `recon-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      'application/json'
    );
  };

  const handleExportReport = () => {
    sound.click();
    const generatedAt = new Date().toISOString();
    download(
      buildReconReport({
        currentScan: reconResults,
        topology: topologySnapshot(),
        history: reconHistory,
        generatedAt,
      }),
      reportFileName('recon-report', generatedAt),
      'text/plain'
    );
  };

  const renderNode = (node: LaidOutHost, isGateway: boolean) => {
    const style = HOST_ROLE_STYLES[node.role];
    const Icon = HOST_ROLE_ICONS[node.role];
    const isWatched = watchedHosts.includes(node.host);
    const watchLabel = isWatched ? `Stop watching ${node.host}` : `Watch ${node.host}`;
    return (
      <div
        key={node.host}
        className="absolute -translate-x-1/2"
        style={{ left: `${node.leftPct}%`, top: `${node.topPx}px` }}
        title={`${node.host}${node.openPorts.length ? ` // ports ${node.openPorts.join(', ')}` : ''}${isWatched ? ' // WATCHED' : ''}`}
      >
        <div className={`flex flex-col items-center ${isGateway ? 'animate-pulse' : ''}`}>
          <div className="relative">
            {/* Watched hosts get a halo so the operator can spot them at a glance. */}
            {isWatched && (
              <div
                data-testid="watch-halo"
                aria-hidden="true"
                className="absolute -inset-1.5 rounded-full border-2 border-amber-400/80 animate-pulse"
              />
            )}
            <div
              className={`${isGateway ? 'w-12 h-12 rounded-full' : 'w-10 h-10 rounded-lg'} border-2 flex items-center justify-center ${style.iconBox}`}
            >
              <Icon className={`${isGateway ? 'w-6 h-6 text-white animate-pulse' : 'w-4 h-4'} ${isGateway ? '' : style.text}`} />
            </div>
            {/* Absolutely positioned so starring a node never resizes it. */}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleWatch(node.host);
              }}
              className={`absolute -top-1.5 -right-1.5 z-10 p-1.5 rounded-full border transition-colors ${
                isWatched
                  ? 'bg-amber-500 border-amber-300 text-black'
                  : 'bg-slate-900/90 border-slate-600 text-slate-400 hover:border-amber-400 hover:text-amber-300'
              }`}
              title={watchLabel}
              aria-label={watchLabel}
              aria-pressed={isWatched}
            >
              <Star className="w-2.5 h-2.5" fill={isWatched ? 'currentColor' : 'none'} />
            </button>
            {isGateway && <div className="absolute -inset-1 rounded-full border border-cyan-400/30 animate-tactical-ring" />}
            {node.role === 'local' && (
              <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-emerald-500 rounded-full" />
            )}
          </div>
          <span className={`text-[10px] font-mono font-bold mt-1 max-w-[96px] truncate ${style.text}`}>
            {node.label}
          </span>
          <span className="text-[9px] text-slate-500">{node.host}</span>
          <span className="text-[8px] mt-0.5 block opacity-80">{style.badge}</span>
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid="recon-panel"
      className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-[#080a0f] text-slate-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-mono font-bold text-cyan-300 flex items-center gap-2">
            <Scan className="w-5 h-5 text-cyan-400" />
            TACTICAL RECONNAISSANCE
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Network enumeration and environment intelligence gathering
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            className="p-2 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 transition-colors"
            title="Export scan results as JSON"
            aria-label="Export scan results as JSON"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportReport}
            className="p-2 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 transition-colors"
            title="Export recon report (topology + raw output)"
            aria-label="Export recon report as text"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              sound.click();
              // Nothing to re-run before the first scan, so fall back to the selected type.
              if (reconResults.scanType) onRefreshScan();
              else onRunScan(selectedScan);
            }}
            className="p-2 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 disabled:opacity-40 transition-colors"
            disabled={isScanning}
            title="Refresh scan"
            aria-label="Re-run the last scan"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Scan Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SCAN_TYPES.map((scan) => {
          const Icon = scan.icon;
          const isActive = selectedScan === scan.id;
          return (
            <button
              key={scan.id}
              onClick={() => handleSelectScan(scan.id)}
              aria-pressed={isActive}
              className={`p-3 rounded-xl border text-left transition-all ${
                isActive
                  ? 'bg-cyan-950/80 border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'bg-[#0f1420] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span className={`text-xs font-mono font-bold ${isActive ? 'text-cyan-300' : 'text-slate-400'}`}>
                  {scan.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">{scan.description}</p>
            </button>
          );
        })}
      </div>

      {/* Run Scan Button */}
      <button
        onClick={handleRun}
        disabled={isScanning}
        className={`w-full py-3 px-4 rounded-xl font-mono font-bold text-sm flex items-center justify-center gap-2 transition-all ${
          isScanning
            ? 'bg-amber-950/60 text-amber-400 border border-amber-700/50'
            : 'bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-black shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-[0.98]'
        }`}
      >
        {isScanning ? (
          <>
            <Activity className="w-4 h-4 animate-pulse" />
            <span>SCANNING {activeScanType.toUpperCase()}...</span>
          </>
        ) : (
          <>
            <Scan className="w-4 h-4" />
            <span>EXECUTE {selectedScan.toUpperCase()} SCAN</span>
          </>
        )}
      </button>

      {/* Results Panel */}
      <div className="rounded-xl bg-[#0f1420] border border-cyan-900/60 overflow-hidden">
        {/* Results Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-950/80 bg-[#0a0e17]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
              RECONNAISSANCE RESULTS
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {selectedScan.toUpperCase()} // TERMUX-AARCH64
          </span>
        </div>

        {/* Results Content */}
        <div className="p-4 font-mono text-xs leading-relaxed overflow-x-auto">
          {isScanning ? (
            <div className="space-y-3 text-slate-400" role="status" aria-live="polite">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" aria-hidden="true" />
                <span className="text-cyan-300">INITIATING {activeScanType.toUpperCase()} SCAN...</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Target: 192.168.1.0/24 (wlan0)</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-gradient-to-r from-cyan-600 to-cyan-400 animate-pulse rounded-full" />
              </div>
              <div className="text-[10px] text-slate-500">
                Hermes recon engine active // Awaiting telemetry packets...
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-slate-300">
              {/* Real output returned by /api/recon/scan (includes live TCP probes) */}
              {reconResults.status === 'error' && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold">SCAN FAILED</div>
                    <div className="text-[11px] mt-1 whitespace-pre-wrap">{reconResults.results}</div>
                  </div>
                </div>
              )}

              {reconResults.status === 'complete' && reconResults.results && (
                <div className="p-3 rounded-lg bg-[#070b12] border border-emerald-900/50">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-emerald-400 font-bold text-[11px] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      LIVE SCAN OUTPUT // {(reconResults.scanType || selectedScan).toUpperCase()}
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(reconResults.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-[11px] text-slate-300 whitespace-pre-wrap font-mono max-h-72 overflow-y-auto">
                    {reconResults.results}
                  </pre>
                </div>
              )}

              {/* Structured scan summary */}
              {selectedScan === 'network' && (
                <>
                  <div className="p-3 rounded-lg bg-[#070b12] border border-slate-800">
                    <div className="text-cyan-400 font-bold mb-2">INTERFACE: wlan0</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-400">
                      <span>SSID:</span>
                      <span className="text-slate-200 text-right">WAR_ROOM_SECURE_5G</span>
                      <span>BSSID:</span>
                      <span className="text-slate-200 text-right font-mono">68:d7:9a:31:ec:04</span>
                      <span>Frequency:</span>
                      <span className="text-slate-200 text-right">5745 MHz (5GHz)</span>
                      <span>Signal:</span>
                      <span className="text-emerald-400 text-right">-48 dBm (Excellent)</span>
                      <span>Link Speed:</span>
                      <span className="text-slate-200 text-right">866 Mbps</span>
                      <span>IP Address:</span>
                      <span className="text-cyan-300 text-right font-mono">192.168.1.139</span>
                      <span>Gateway:</span>
                      <span className="text-slate-200 text-right font-mono">192.168.1.1</span>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-[#070b12] border border-slate-800">
                    <div className="text-cyan-400 font-bold mb-2">WIRELESS SECURITY</div>
                    <div className="space-y-1 text-slate-400">
                      <div>Protocol: <span className="text-emerald-400">WPA3-SAE (Secured)</span></div>
                      <div>Encryption: <span className="text-emerald-400">AES-256-GCM</span></div>
                      <div>Status: <span className="text-emerald-400">COMPLETED (Authenticated)</span></div>
                    </div>
                  </div>
                </>
              )}

              {selectedScan === 'port' && (
                <>
                  <div className="p-3 rounded-lg bg-[#070b12] border border-slate-800">
                    <div className="text-cyan-400 font-bold mb-2">PORT SCAN: 192.168.1.1</div>
                    <div className="space-y-2 text-sm">
                      {[
                        { port: '22/tcp', state: 'open', service: 'ssh', info: 'Hermes Secure Drop' },
                        { port: '80/tcp', state: 'open', service: 'http', info: 'Gateway Web Interface' },
                        { port: '443/tcp', state: 'open', service: 'https', info: 'Encrypted Gateway' },
                        { port: '3000/tcp', state: 'open', service: 'hermes-c2', info: 'Encrypted Telemetry Stream' },
                        { port: '5173/tcp', state: 'open', service: 'vite-dev', info: 'Development Server' },
                      ].map((p) => (
                        <div key={p.port} className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
                          <div className="flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="font-mono text-cyan-300">{p.port}</span>
                            <span className="text-slate-500">{p.service}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/60">
                              {p.state.toUpperCase()}
                            </span>
                            <span className="text-slate-400 text-[10px]">{p.info}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-500">
                      Nmap scan completed in 1.42s // 1 host up, 5 ports open
                    </div>
                  </div>
                </>
              )}

              {selectedScan === 'process' && (
                <>
                  <div className="p-3 rounded-lg bg-[#070b12] border border-slate-800">
                    <div className="text-cyan-400 font-bold mb-2">PROCESS TABLE (ps aux)</div>
                    <div className="text-[11px] leading-relaxed overflow-x-auto">
                      <pre className="text-slate-300 whitespace-pre-wrap font-mono">
{`
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
u0_a248   4120  2.1  1.4  42100 12040 pts/0    S+   18:40   0:04 hermes-daemon
u0_a248   4129  0.8  0.9  31800  7420 pts/0    S    18:41   0:01 termux-node-proxy
u0_a248   4150  1.4  1.8  55400 15120 pts/1    S+   18:42   0:02 python3 -m recon
u0_a248   4201  0.0  0.2   8900  1820 pts/0    R+   19:01   0:00 ps aux
                       `}
                      </pre>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
                      <span>Total processes: 14 active</span>
                      <span>Termux user: u0_a248</span>
                    </div>
                  </div>
                </>
              )}

              {selectedScan === 'network-map' && (
                <>
                  <div className="p-3 rounded-lg bg-[#070b12] border border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-cyan-400 font-bold">SUBNET TOPOLOGY: 192.168.1.0/24</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${
                          usingLiveHosts
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60'
                            : 'bg-slate-900 text-slate-500 border-slate-700'
                        }`}>
                          {usingLiveHosts ? 'LIVE DISCOVERY' : 'BASELINE'}
                        </span>
                        <button
                          onClick={() => setIsTopologyVisible(!isTopologyVisible)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isTopologyVisible ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}
                          title="Toggle Topology View"
                          aria-label={isTopologyVisible ? 'Hide topology map' : 'Show topology map'}
                          aria-pressed={isTopologyVisible}
                        >
                          {isTopologyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 font-bold">T</kbd> to toggle
                        </span>
                      </div>
                    </div>
                    
                    {isTopologyVisible ? (
                      <>
                        {/* Enhanced Interactive Network Map */}
                        <div
                          data-testid="topology-map"
                          className="relative h-64 bg-[#05070a] rounded-lg border border-cyan-900/40 overflow-hidden"
                        >
                          {/* Tactical grid background */}
                          <div className="absolute inset-0" 
                            style={{
                              backgroundImage: `
                                linear-gradient(rgba(6,182,212,0.15) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(6,182,212,0.15) 1px, transparent 1px)
                              `,
                              backgroundSize: '24px 24px'
                            }}
                          />
                          
                          {/* Host links. Stretched to fill the container (preserveAspectRatio="none")
                              so each endpoint lands exactly where the node is positioned, since nodes
                              are placed as percentages of the container's width. */}
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox={`0 0 ${TOPOLOGY_VIEWBOX.width} ${TOPOLOGY_VIEWBOX.height}`}
                            preserveAspectRatio="none"
                            aria-hidden="true"
                          >
                            {topology.hosts.map((node) => (
                              <line
                                key={`link-${node.host}`}
                                x1={linkOrigin.x}
                                y1={linkOrigin.y}
                                x2={node.x}
                                y2={node.y}
                                stroke={HOST_ROLE_STYLES[node.role].stroke}
                                strokeWidth={node.role === 'offline' ? 1 : 1.5}
                                strokeDasharray={node.role === 'offline' ? '4 4' : '6 3'}
                                opacity={node.role === 'offline' ? 0.35 : 0.6}
                                vectorEffect="non-scaling-stroke"
                              />
                            ))}
                          </svg>

                          {/* Animated Radar Sweep. Uniform scale, so the rings stay circular. */}
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox={`0 0 ${TOPOLOGY_VIEWBOX.width} ${TOPOLOGY_VIEWBOX.height}`}
                            aria-hidden="true"
                          >
                            <defs>
                              <radialGradient id="scanGrad" cx="50%" cy="15%" r="40%">
                                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3"/>
                                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/>
                              </radialGradient>
                              <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0"/>
                                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8"/>
                              </linearGradient>
                            </defs>
                            <circle cx={GATEWAY_ANCHOR.x} cy={GATEWAY_ANCHOR.y} r="120" fill="url(#scanGrad)" className="animate-pulse" />
                            
                            
                            {/* Rotating radar sweep line */}
                            <g className="animate-spin-slow" style={{ transformOrigin: `${GATEWAY_ANCHOR.x}px ${GATEWAY_ANCHOR.y}px` }}>
                              <line x1={GATEWAY_ANCHOR.x} y1={GATEWAY_ANCHOR.y} x2={GATEWAY_ANCHOR.x} y2={GATEWAY_ANCHOR.y - 50} stroke="#06b6d4" strokeWidth="2" opacity="0.8" />
                              <circle cx={GATEWAY_ANCHOR.x} cy={GATEWAY_ANCHOR.y} r="4" fill="#06b6d4" />
                            </g>
                            
                            {/* Concentric scan rings */}
                            <circle cx={GATEWAY_ANCHOR.x} cy={GATEWAY_ANCHOR.y} r="40" fill="none" stroke="#06b6d4" strokeWidth="0.5" opacity="0.2" />
                            <circle cx={GATEWAY_ANCHOR.x} cy={GATEWAY_ANCHOR.y} r="80" fill="none" stroke="#06b6d4" strokeWidth="0.5" opacity="0.15" />
                            <circle cx={GATEWAY_ANCHOR.x} cy={GATEWAY_ANCHOR.y} r="120" fill="none" stroke="#06b6d4" strokeWidth="0.5" opacity="0.1" />
                          </svg>
                          
                          {/* Discovered nodes, positioned by the topology layout */}
                          {topology.gateway && renderNode(topology.gateway, true)}
                          {topology.hosts.map((node) => renderNode(node, false))}
                          

                          

                          

                          

                          
                          {/* Legend */}
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[9px] font-mono">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                                <span className="text-cyan-400">SCAN</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-emerald-400">L2 LINK</span>
                              </div>
                              {watchedHosts.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full border-2 border-amber-400" />
                                  <span className="text-amber-300">WATCHED</span>
                                </div>
                              )}
                              <span className="text-slate-500">|</span>
                              <span className="text-slate-500">1 Gbps</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">RPS: 240</span>
                              <span className="text-slate-500">|</span>
                              <span className="text-slate-500">SNR: 48dB</span>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-64 bg-[#05070a] rounded-lg border border-cyan-900/40 flex items-center justify-center">
                        <div className="text-center text-slate-500">
                          <EyeOff className="w-8 h-8 text-cyan-900/60 mx-auto mb-2" />
                          <p className="text-xs">Topology view hidden</p>
                          <p className="text-[10px] mt-1">Press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 font-bold">T</kbd> to show</p>
                        </div>
                      </div>
                    )}                    <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
                      <span>
                        {totalHosts} hosts // {topology.activeCount} active
                        {watchedHosts.length > 0 ? ` // ${watchedHosts.length} watched` : ''} //{' '}
                        <span className={usingLiveHosts ? 'text-emerald-400' : 'text-slate-400'}>
                          {usingLiveHosts ? 'LIVE PROBE' : 'BASELINE PROFILE'}
                        </span>
                      </span>
                      <span className={`flex items-center gap-1 ${topology.activeCount > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${topology.activeCount > 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        {topology.activeCount > 0 ? 'Mesh connected' : 'No live peers'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scan History Panel */}
      <div className="rounded-xl bg-[#0f1420] border border-cyan-900/60 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-950/80 bg-[#0a0e17]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
              SCAN HISTORY ({reconHistory.length})
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">click to re-run</span>
        </div>
        <div className="p-2">
          {reconHistory.length === 0 ? (
            <div className="p-3 text-center text-[11px] font-mono text-slate-500">
              No scans recorded in this session. Execute a scan to build history.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {reconHistory.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleReplayScan(entry.scanType as ScanType)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-[#070b12] border border-slate-800 hover:border-cyan-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      entry.status === 'complete' ? 'bg-emerald-400' : 'bg-red-400'
                    }`} />
                    <span className="text-[11px] font-mono font-bold text-cyan-300 uppercase">
                      {entry.scanType}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                      entry.status === 'complete'
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60'
                        : 'bg-red-950/80 text-red-400 border-red-700/60'
                    }`}>
                      {entry.status.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {entry.executionTimeMs}ms
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Watch List Panel */}
      <div className="rounded-xl bg-[#0f1420] border border-amber-900/60 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-amber-950/80 bg-[#0a0e17]">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
              WATCH LIST ({watchedHosts.length}/{WATCH_LIST_LIMIT})
            </span>
          </div>
          {watchedHosts.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500">
                every {Math.round(WATCH_POLL_INTERVAL_MS / 1000)}s
                {watchProbedAt ? ` // last ${new Date(watchProbedAt).toLocaleTimeString()}` : ''}
              </span>
              <button
                onClick={() => {
                  sound.click();
                  onProbeWatched();
                }}
                className="p-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-700/60 text-amber-300 transition-colors"
                title="Re-probe watched hosts now"
                aria-label="Re-probe watched hosts now"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="p-2">
          {watchedHosts.length === 0 ? (
            <div className="p-3 text-center text-[11px] font-mono text-slate-500">
              No hosts watched. Star a node on the NET MAP to re-probe it on a timer.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {watchRows.map((status) => {
                const role = classifyHost(
                  { host: status.host, openPorts: status.openPorts, online: status.online },
                  reconLocalAddresses
                );
                const style = HOST_ROLE_STYLES[role];
                return (
                  <div
                    key={status.host}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#070b12] border border-slate-800"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          status.pending ? 'bg-slate-500' : status.online ? 'bg-emerald-400' : 'bg-red-400'
                        }`}
                      />
                      <span className="text-[11px] font-mono font-bold text-slate-200">{status.host}</span>
                      <span className={`text-[10px] font-mono ${style.text}`}>{style.badge}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-slate-500">
                        {status.pending
                          ? 'PENDING'
                          : status.openPorts.length > 0
                            ? status.openPorts.map((port) => `${port}/tcp`).join(', ')
                            : 'NO RESPONSE'}
                      </span>
                      <button
                        onClick={() => onToggleWatch(status.host)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950 border border-slate-700 hover:border-red-700 text-slate-400 hover:text-red-300 transition-colors"
                        title={`Remove ${status.host} from watch list`}
                        aria-label={`Remove ${status.host} from watch list`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {watchListFull && (
            <div className="px-2 py-1 text-[10px] font-mono text-amber-500/80">
              Watch list full — remove a host to track another.
            </div>
          )}
        </div>
      </div>

      {/* Agent & Channel Intelligence Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Active Agents for Recon */}
        <div className="rounded-xl bg-[#0f1420] border border-cyan-900/60 p-3">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
              RECON ASSETS
            </span>
          </div>
          <div className="space-y-2">
            {agents.filter(a => a.specialty.toLowerCase().includes('recon') || a.status === 'ENGAGED' || a.status === 'ONLINE').map((agent) => (
              <div key={agent.id} className="flex items-center justify-between p-2 rounded-lg bg-[#070b12] border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    agent.status === 'ENGAGED' ? 'bg-amber-400 animate-ping' :
                    agent.status === 'ONLINE' ? 'bg-emerald-400' :
                    'bg-cyan-400'
                  }`} />
                  <div>
                    <div className="text-xs font-mono font-bold text-slate-200">{agent.callsign}</div>
                    <div className="text-[10px] text-slate-500">{agent.specialty}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">{agent.status}</div>
                  <div className="text-[10px] text-cyan-400">{agent.health}% health</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Comms Channels */}
        <div className="rounded-xl bg-[#0f1420] border border-cyan-900/60 p-3">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
              COMMS INTELLIGENCE
            </span>
          </div>
          <div className="space-y-2">
            {channels.slice(0, 4).map((channel) => (
              <div key={channel.id} className="flex items-center justify-between p-2 rounded-lg bg-[#070b12] border border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronRight className="w-3 h-3 text-cyan-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-bold text-slate-200 truncate">{channel.name}</div>
                    <div className="text-[10px] text-slate-500 capitalize">{channel.type.toLowerCase()}</div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="text-[10px] text-cyan-400">{channel.throughputKbps} KB/s</div>
                  <div className="text-[9px] text-slate-500">{channel.latencyMs}ms latency</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
