import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  WarRoomTab, 
  AgentState, 
  AgentMessage, 
  DeviceTelemetry, 
  LogEntry, 
  SubAgentInfo, 
  MemoryItem,
  AgentDeployment,
  AgentTask,
  CommChannel,
  TuningConfig,
  AgentStateTransition,
  AgentMetrics,
  TacticalCorrectionRecommendation,
  TacticalCorrectionConfig
} from './types';
import { TacticalHeader } from './components/TacticalHeader';
import { ReconView } from './components/ReconView';
import { NavigationDock } from './components/NavigationDock';
import { WarRoomFeed } from './components/WarRoomFeed';
import { TelemetryDashboard } from './components/TelemetryDashboard';
import { TermuxTerminal } from './components/TermuxTerminal';
import { StylusCanvas } from './components/StylusCanvas';
import { HermesMatrix } from './components/HermesMatrix';
import { AgentDeploymentView } from './components/AgentDeploymentView';
import { TaskManagerView } from './components/TaskManagerView';
import { CommChannelsView } from './components/CommChannelsView';
import { PerformanceTuningView } from './components/PerformanceTuningView';
import { DiscoveredHost } from './utils/topology';
import {
  ReconHistoryEntry,
  loadReconHistory,
  pushReconHistory,
  saveReconHistory,
} from './utils/reconHistory';
import {
  WATCH_POLL_INTERVAL_MS,
  loadWatchList,
  saveWatchList,
  toggleWatchList,
} from './utils/watchList';
import { TacticalCorrectionPanel } from './components/TacticalCorrectionPanel';
import { sound } from './utils/audio';

export default function App() {
  const [activeTab, setActiveTab] = useState<WarRoomTab>('command');
  const [agentState, setAgentState] = useState<AgentState>('IDLE');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [activePersona, setActivePersona] = useState<string>('Tactical Ops');
  const [temperature, setTemperature] = useState<number>(0.7);

  // Tactical Correction Service State
  const [tacticalRecommendations, setTacticalRecommendations] = useState<TacticalCorrectionRecommendation[]>([]);
  const [tacticalMetrics, setTacticalMetrics] = useState<AgentMetrics[]>([]);
  const [tacticalConfig, setTacticalConfig] = useState<TacticalCorrectionConfig>({
    failureThresholdPct: 75,
    minTasksForEvaluation: 2,
    autoApplyEnabled: false,
    autoRetryFailedTasks: true,
    coolDownPeriodSec: 30,
  });

  // Sub-agents registry
  const [subAgents, setSubAgents] = useState<SubAgentInfo[]>([
    { id: 'alpha', name: 'Alpha', callsign: 'HERMES-ALPHA', specialty: 'Recon & Network', status: 'STANDBY', tasksCompleted: 14, health: 98 },
    { id: 'bravo', name: 'Bravo', callsign: 'HERMES-BRAVO', specialty: 'Python & Exploit', status: 'STANDBY', tasksCompleted: 23, health: 100 },
    { id: 'delta', name: 'Delta', callsign: 'HERMES-DELTA', specialty: 'Log & Subsystem', status: 'STANDBY', tasksCompleted: 9, health: 95 },
  ]);

  // Comprehensive Hermes Deployment Fleet
  const [deployedAgents, setDeployedAgents] = useState<AgentDeployment[]>([
    {
      id: 'agent-alpha',
      name: 'Alpha',
      callsign: 'HERMES-ALPHA',
      model: 'Hermes-3-8B-Q4',
      modelProvider: 'hermes',
      specialty: 'Recon & Network Mapping',
      codingSpecialty: 'Python Termux Daemons & Async Sockets',
      status: 'STANDBY',
      environment: 'Termux aarch64',
      health: 98,
      uptimeSec: 4230,
      tasksCompleted: 14,
      memoryUsageMb: 480,
      cpuQuotaPct: 25,
      deployedAt: '2026-09-13T18:00:00Z',
      priority: 'P0',
    },
    {
      id: 'agent-bravo',
      name: 'Bravo',
      callsign: 'HERMES-BRAVO',
      model: 'openrouter/nousresearch/hermes-3-llama-3.1-70b',
      modelProvider: 'openrouter',
      specialty: 'Python & Exploit Synthesis',
      codingSpecialty: 'Full-Stack Web & TypeScript Architecture',
      status: 'ENGAGED',
      environment: 'Cloud Sandbox',
      health: 100,
      uptimeSec: 5120,
      tasksCompleted: 23,
      currentTask: 'Vector Memory Index Compression',
      memoryUsageMb: 1840,
      cpuQuotaPct: 45,
      deployedAt: '2026-09-13T17:45:00Z',
      priority: 'P0',
    },
    {
      id: 'agent-delta',
      name: 'Delta',
      callsign: 'HERMES-DELTA',
      model: 'ollama/qwen2.5-coder:32b',
      modelProvider: 'ollama',
      specialty: 'Subsystem & Thermal Audit',
      codingSpecialty: 'Bash & POSIX Automation Scripts',
      status: 'ONLINE',
      environment: 'Termux aarch64',
      health: 95,
      uptimeSec: 3100,
      tasksCompleted: 9,
      memoryUsageMb: 320,
      cpuQuotaPct: 15,
      deployedAt: '2026-09-13T18:15:00Z',
      priority: 'P1',
    },
  ]);

  // Tasks pipeline
  const [tasks, setTasks] = useState<AgentTask[]>([
    {
      id: 'task-101',
      title: 'Subnet Recon & Port Map wlan0',
      description: 'Perform comprehensive port scan on 192.168.1.0/24 subnet and identify listening daemons.',
      priority: 'P0_CRITICAL',
      status: 'COMPLETED',
      assignedAgentId: 'agent-alpha',
      assignedAgentName: 'HERMES-ALPHA',
      progressPct: 100,
      toolChain: ['termux_shell', 'nmap'],
      steps: [
        { id: 's1', name: 'Query wlan0 connection info', status: 'done', detail: 'SSID: WAR_ROOM_SECURE_5G (192.168.1.139)' },
        { id: 's2', name: 'Execute nmap port probe', status: 'done', detail: 'Ports 22, 80, 443, 3000 mapped' },
        { id: 's3', name: 'Document listening sockets', status: 'done', detail: 'Telemetry secured' },
      ],
      createdAt: '2026-09-13T18:40:00Z',
      completedAt: '2026-09-13T18:42:15Z',
      executionTimeMs: 2150,
    },
    {
      id: 'task-102',
      title: 'Vector Memory Index Compression',
      description: 'Re-index embeddings in sqlite-vec vector store and compress embeddings for low RAM footprint.',
      priority: 'P1_HIGH',
      status: 'RUNNING',
      assignedAgentId: 'agent-bravo',
      assignedAgentName: 'HERMES-BRAVO',
      progressPct: 68,
      toolChain: ['code_interpreter', 'vector_memory'],
      steps: [
        { id: 's1', name: 'Read active vector memory partitions', status: 'done', detail: '768-dim embeddings loaded' },
        { id: 's2', name: 'Quantize vector weights to INT8', status: 'running', detail: 'Compressing partition 2/3' },
        { id: 's3', name: 'Validate semantic similarity recall', status: 'pending', detail: 'Waiting for step 2' },
      ],
      createdAt: '2026-09-13T18:55:00Z',
      executionTimeMs: 1420,
    },
    {
      id: 'task-103',
      title: 'Termux Thermal Envelope & Battery Audit',
      description: 'Monitor Snapdragon 5000mAh thermal trends across continuous 60fps digitizer sampling.',
      priority: 'P2_NORMAL',
      status: 'COMPLETED',
      assignedAgentId: 'agent-delta',
      assignedAgentName: 'HERMES-DELTA',
      progressPct: 100,
      toolChain: ['termux_shell'],
      steps: [
        { id: 's1', name: 'Read battery driver stats', status: 'done', detail: '34.6°C (Optimal)' },
        { id: 's2', name: 'Check frequency governor status', status: 'done', detail: 'Schedutil governor active' },
      ],
      createdAt: '2026-09-13T18:50:00Z',
      completedAt: '2026-09-13T18:51:30Z',
      executionTimeMs: 980,
    },
    {
      id: 'task-104',
      title: 'Audit SSH Authorized Keys & Permissions',
      description: 'Inspect ~/.ssh/authorized_keys permissions in Termux sandbox for unauthorized credentials.',
      priority: 'P1_HIGH',
      status: 'QUEUED',
      assignedAgentId: 'agent-alpha',
      assignedAgentName: 'HERMES-ALPHA',
      progressPct: 0,
      toolChain: ['termux_shell'],
      steps: [
        { id: 's1', name: 'Verify file permissions (0600)', status: 'pending' },
        { id: 's2', name: 'Hash key fingerprints with sha256', status: 'pending' },
      ],
      createdAt: '2026-09-13T19:00:00Z',
    },
    {
      id: 'task-105',
      title: 'Verify Termux Proxy IPC Socket Integrity',
      description: 'Stress test IPC message bus between Node dev server and Termux aarch64 background daemon.',
      priority: 'P0_CRITICAL',
      status: 'RUNNING',
      assignedAgentId: 'agent-alpha',
      assignedAgentName: 'HERMES-ALPHA',
      progressPct: 45,
      toolChain: ['termux_shell', 'code_interpreter'],
      steps: [
        { id: 's1', name: 'Establish unix domain socket connection', status: 'done', detail: 'Socket pts/0 verified' },
        { id: 's2', name: 'Inject 1000 zero-copy telemetry packets', status: 'running', detail: 'Transmitted 450/1000 packets' },
        { id: 's3', name: 'Verify packet sequence and checksums', status: 'pending' },
      ],
      createdAt: '2026-09-13T19:02:00Z',
    },
  ]);

  // Communication channels
  const [channels, setChannels] = useState<CommChannel[]>([
    {
      id: 'chan-c2',
      name: '#c2-telemetry-pipe',
      type: 'TELEMETRY',
      description: 'Encrypted WebSocket uplink for real-time telemetry streaming and operator directives.',
      throughputKbps: 42.4,
      packetsPerSec: 32,
      latencyMs: 4,
      status: 'NOMINAL',
      activeListeners: 12,
      recentPackets: [
        { id: 'p1', from: 'HERMES-CORE', to: 'OPERATOR', channelId: 'chan-c2', payloadSnippet: 'HEARTBEAT: thermal 34.6C, tok/s 52.4', timestamp: '19:05:12', sizeBytes: 256 },
        { id: 'p2', from: 'OPERATOR', to: 'HERMES-CORE', channelId: 'chan-c2', payloadSnippet: 'DIRECTIVE_ACK: sub-agent Alpha active', timestamp: '19:05:14', sizeBytes: 128 },
      ],
    },
    {
      id: 'chan-ipc',
      name: '#termux-ipc-socket',
      type: 'IPC',
      description: 'Zero-latency Unix domain socket connecting Termux aarch64 processes to Node backend.',
      throughputKbps: 28.1,
      packetsPerSec: 48,
      latencyMs: 1,
      status: 'NOMINAL',
      activeListeners: 8,
      recentPackets: [
        { id: 'p3', from: 'TERMUX-PTS0', to: 'HERMES-CORE', channelId: 'chan-ipc', payloadSnippet: 'EXEC_RET: exit_code 0 (nmap scan done)', timestamp: '19:05:15', sizeBytes: 512 },
      ],
    },
    {
      id: 'chan-mesh',
      name: '#inter-agent-mesh',
      type: 'AGENT_MESH',
      description: 'P2P coordination bus between Hermes Alpha (Recon), Bravo (Exploit), and Delta (Audit).',
      throughputKbps: 35.7,
      packetsPerSec: 22,
      latencyMs: 12,
      status: 'NOMINAL',
      activeListeners: 5,
      recentPackets: [
        { id: 'p4', from: 'HERMES-ALPHA', to: 'HERMES-BRAVO', channelId: 'chan-mesh', payloadSnippet: 'PAYLOAD_TRANSFER: open_ports=[22,80,443]', timestamp: '19:05:18', sizeBytes: 1024 },
        { id: 'p5', from: 'HERMES-BRAVO', to: 'HERMES-DELTA', channelId: 'chan-mesh', payloadSnippet: 'AUDIT_REQUEST: verify_integrity(vector_db)', timestamp: '19:05:20', sizeBytes: 384 },
      ],
    },
    {
      id: 'chan-drop',
      name: '#secure-recon-drop',
      type: 'RECON_DROP',
      description: 'Encrypted memory dropzone for exfiltrated tactical telemetry and stylus schematics.',
      throughputKbps: 8.2,
      packetsPerSec: 6,
      latencyMs: 24,
      status: 'NOMINAL',
      activeListeners: 3,
      recentPackets: [
        { id: 'p6', from: 'MOTO-STYLUS-DIGITIZER', to: 'HERMES-VISION', channelId: 'chan-drop', payloadSnippet: 'IMAGE_RAW: 240Hz pressure vector sketch (42KB)', timestamp: '19:05:22', sizeBytes: 42800 },
      ],
    },
    {
      id: 'chan-uplink',
      name: '#operator-uplink',
      type: 'UPLINK',
      description: 'High-priority emergency bypass and panic killswitch channel.',
      throughputKbps: 14.9,
      packetsPerSec: 10,
      latencyMs: 18,
      status: 'NOMINAL',
      activeListeners: 2,
      recentPackets: [
        { id: 'p7', from: 'OPERATOR', to: 'ALL-AGENTS', channelId: 'chan-uplink', payloadSnippet: 'STATUS_PING: All agents operational', timestamp: '19:05:25', sizeBytes: 64 },
      ],
    },
  ]);

  // Recon scan results
  const [reconResults, setReconResults] = useState<{
    scanType: string;
    results: string;
    timestamp: string;
    status: 'idle' | 'scanning' | 'complete' | 'error';
  }>({ scanType: '', results: '', timestamp: '', status: 'idle' });

  // Hosts discovered by the last live probe, used to draw the topology map
  const [reconHosts, setReconHosts] = useState<DiscoveredHost[]>([]);
  const [reconLocalAddresses, setReconLocalAddresses] = useState<string[]>([]);

  // Scan history log (most recent first), restored from the previous session
  const [reconHistory, setReconHistory] = useState<ReconHistoryEntry[]>(() => loadReconHistory());

  useEffect(() => {
    saveReconHistory(reconHistory);
  }, [reconHistory]);

  const handleRunReconScan = async (scanType: string) => {
    sound.dispatch();
    const startedAt = Date.now();
    setReconResults({ scanType, results: '', timestamp: new Date().toISOString(), status: 'scanning' });

    const record = (status: 'complete' | 'error', executionTimeMs = Date.now() - startedAt) => {
      setReconHistory((prev) =>
        pushReconHistory(prev, {
          id: `scan-${Date.now()}`,
          scanType,
          timestamp: new Date().toISOString(),
          status,
          executionTimeMs,
        })
      );
    };

    try {
      const res = await fetch('/api/recon/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanType }),
      });
      const data = await res.json();
      if (res.ok) {
        setReconResults({ scanType, results: data.results || data.output || 'Scan completed.', timestamp: new Date().toISOString(), status: 'complete' });
        // Only the subnet-map scan owns the topology map. Narrower scans probe a
        // handful of hosts (a port scan touches one), and letting them replace the
        // map would silently shrink a discovered subnet down to that handful.
        if (scanType === 'network-map' && Array.isArray(data.hosts) && data.hosts.length > 0) {
          setReconHosts(data.hosts);
          setReconLocalAddresses(Array.isArray(data.localAddresses) ? data.localAddresses : []);
        }
        record('complete', data.executionTimeMs);
        addLog('TACTICAL', 'RECON', `Scan executed: ${scanType}`);
      } else {
        setReconResults({ scanType, results: data.error || 'Scan failed.', timestamp: new Date().toISOString(), status: 'error' });
        record('error');
      }
    } catch {
      setReconResults({ scanType, results: 'Network error during scan.', timestamp: new Date().toISOString(), status: 'error' });
      record('error');
    }
  };

  const fetchReconResults = async () => {
    // Re-run last scan type if exists
    if (reconResults.scanType) {
      await handleRunReconScan(reconResults.scanType);
    }
  };

  // Watch list: hosts the operator wants re-probed on a timer
  const [watchedHosts, setWatchedHosts] = useState<string[]>(() => loadWatchList());
  // Raw probe results; the panel derives per-host status from them.
  const [watchProbes, setWatchProbes] = useState<DiscoveredHost[]>([]);
  const [watchProbedAt, setWatchProbedAt] = useState<string | null>(null);

  useEffect(() => {
    saveWatchList(watchedHosts);
  }, [watchedHosts]);

  const toggleWatchedHost = (host: string) => {
    sound.click();
    setWatchedHosts((prev) => toggleWatchList(prev, host));
    addLog('TACTICAL', 'RECON', `${watchedHosts.includes(host) ? 'Stopped watching' : 'Now watching'} ${host}`);
  };

  const probeWatchedHosts = useCallback(async () => {
    if (watchedHosts.length === 0) {
      setWatchProbes([]);
      return;
    }
    try {
      const res = await fetch('/api/recon/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hosts: watchedHosts }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setWatchProbes(Array.isArray(data.hosts) ? data.hosts : []);
      setWatchProbedAt(data.probedAt ?? new Date().toISOString());
    } catch {
      // Keep the previous statuses; the next tick retries.
    }
  }, [watchedHosts]);

  // Poll only while the recon panel is open, so watching hosts never generates
  // background traffic the operator cannot see.
  useEffect(() => {
    if (activeTab !== 'recon' || watchedHosts.length === 0) return;
    void probeWatchedHosts();
    const timer = setInterval(() => void probeWatchedHosts(), WATCH_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [activeTab, watchedHosts.length, probeWatchedHosts]);

  // Discover the local subnet the first time RECON is opened, so the topology
  // map is populated without the operator having to run a scan by hand.
  const reconAutoScanned = useRef(false);
  useEffect(() => {
    if (activeTab !== 'recon' || reconAutoScanned.current) return;
    reconAutoScanned.current = true;
    void handleRunReconScan('network-map');
    // Only ever fires once per session; handleRunReconScan is stable enough for this.
  }, [activeTab]);

  // Tuning Configuration
  const [tuningConfig, setTuningConfig] = useState<TuningConfig>({
    temperature: 0.7,
    topP: 0.95,
    maxReasoningSteps: 6,
    contextLimitTokens: 8192,
    nicePriority: -5,
    batteryProfile: 'BALANCED_TACTICAL',
    toolTimeoutMs: 15000,
    autoRetryAttempts: 3,
    kvCachePolicy: 'STANDARD',
    activePreset: 'Balanced Tactical',
  });

  const [throughputHistory, setThroughputHistory] = useState<
    { time: string; c2Telemtry: number; termuxIpc: number; agentMesh: number; uplink: number }[]
  >([]);

  // Historical agent state transitions for post-mission forensic analysis
  const [transitions, setTransitions] = useState<AgentStateTransition[]>([
    {
      id: "trans-101",
      agentId: "agent-alpha",
      agentCallsign: "HERMES-ALPHA",
      agentName: "Alpha",
      fromStatus: "INITIALIZING",
      toStatus: "ONLINE",
      timestamp: "18:00:12",
      reason: "Provisioned in Termux aarch64 environment. Hardware sensor interfaces linked.",
      triggeredBy: "OPERATOR",
      contextSnapshot: { cpuLoad: 18, ramUsedMb: 420, batteryTempC: 32.8 }
    },
    {
      id: "trans-102",
      agentId: "agent-alpha",
      agentCallsign: "HERMES-ALPHA",
      agentName: "Alpha",
      fromStatus: "ONLINE",
      toStatus: "ENGAGED",
      timestamp: "18:40:02",
      reason: "Dispatched directive: Subnet Recon & Port Map wlan0 (task-101). Spawning nmap child socket.",
      triggeredBy: "TASK_PIPELINE",
      contextSnapshot: { cpuLoad: 46, ramUsedMb: 510, activeTask: "Subnet Recon & Port Map wlan0", batteryTempC: 34.2 }
    },
    {
      id: "trans-103",
      agentId: "agent-alpha",
      agentCallsign: "HERMES-ALPHA",
      agentName: "Alpha",
      fromStatus: "ENGAGED",
      toStatus: "STANDBY",
      timestamp: "18:42:16",
      reason: "Completed directive task-101 with exit code 0. Telemetry cached, agent returned to standby listening loop.",
      triggeredBy: "TASK_PIPELINE",
      contextSnapshot: { cpuLoad: 24, ramUsedMb: 480, batteryTempC: 34.0 }
    },
    {
      id: "trans-104",
      agentId: "agent-bravo",
      agentCallsign: "HERMES-BRAVO",
      agentName: "Bravo",
      fromStatus: "INITIALIZING",
      toStatus: "ONLINE",
      timestamp: "17:45:10",
      reason: "Cloud Sandbox instance provisioned. Hermes-3-70B model weights loaded in VRAM.",
      triggeredBy: "SYSTEM_SUPERVISOR",
      contextSnapshot: { cpuLoad: 30, ramUsedMb: 1200, batteryTempC: 31.5 }
    },
    {
      id: "trans-105",
      agentId: "agent-bravo",
      agentCallsign: "HERMES-BRAVO",
      agentName: "Bravo",
      fromStatus: "ONLINE",
      toStatus: "ENGAGED",
      timestamp: "18:55:00",
      reason: "Executing intensive vector store compaction: Vector Memory Index Compression (task-102).",
      triggeredBy: "TASK_PIPELINE",
      contextSnapshot: { cpuLoad: 72, ramUsedMb: 1840, activeTask: "Vector Memory Index Compression", batteryTempC: 35.1 }
    },
    {
      id: "trans-106",
      agentId: "agent-delta",
      agentCallsign: "HERMES-DELTA",
      agentName: "Delta",
      fromStatus: "INITIALIZING",
      toStatus: "ONLINE",
      timestamp: "18:15:02",
      reason: "Thermal audit background daemon attached to Snapdragon SoC sensors.",
      triggeredBy: "OPERATOR",
      contextSnapshot: { cpuLoad: 12, ramUsedMb: 310, batteryTempC: 33.0 }
    },
    {
      id: "trans-107",
      agentId: "agent-delta",
      agentCallsign: "HERMES-DELTA",
      agentName: "Delta",
      fromStatus: "ONLINE",
      toStatus: "ENGAGED",
      timestamp: "18:50:00",
      reason: "Running thermal profiling: Termux Thermal Envelope & Battery Audit (task-103).",
      triggeredBy: "TASK_PIPELINE",
      contextSnapshot: { cpuLoad: 38, ramUsedMb: 350, activeTask: "Termux Thermal Envelope & Battery Audit", batteryTempC: 34.6 }
    },
    {
      id: "trans-108",
      agentId: "agent-delta",
      agentCallsign: "HERMES-DELTA",
      agentName: "Delta",
      fromStatus: "ENGAGED",
      toStatus: "ONLINE",
      timestamp: "18:51:30",
      reason: "Thermal audit verification passed within normal thresholds (34.6°C). Returned to active telemetry listener.",
      triggeredBy: "TASK_PIPELINE",
      contextSnapshot: { cpuLoad: 14, ramUsedMb: 320, batteryTempC: 34.1 }
    }
  ]);

  // Telemetry real-time state
  const [telemetry, setTelemetry] = useState<DeviceTelemetry>({
    timestamp: Date.now(),
    cpuLoad: 34.2,
    ramUsedMb: 4890,
    ramTotalMb: 8192,
    batteryPct: 84,
    batteryTempC: 34.6,
    tokensPerSec: 52.4,
    networkLatencyMs: 24,
    termuxProcsCount: 14,
    storageUsedGb: 48.2,
    storageTotalGb: 128.0,
  });

  const [telemetryHistory, setTelemetryHistory] = useState<
    { time: string; tokensPerSec: number; cpuLoad: number; memoryPct: number }[]
  >([]);

  // Tool stats for chart
  const [toolStats, setToolStats] = useState([
    { name: 'termux_shell', count: 18, color: '#06b6d4' },
    { name: 'code_interpreter', count: 12, color: '#10b981' },
    { name: 'vector_memory', count: 9, color: '#8b5cf6' },
    { name: 'multimodal_vision', count: 6, color: '#f59e0b' },
  ]);

  // Initial messages demonstrating Nous Hermes structured scratchpad
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'msg-init',
      role: 'assistant',
      content: `Hermes Autonomous War Room online and operational on Motorola Moto G5 Stylus 2025.
Termux aarch64 runtime linked to command bus.
Three specialized sub-agents (Alpha, Bravo, Delta) standing by.
Stylus digitizer calibrated for tactical schematics and architectural flowcharts.
Awaiting operator directives.`,
      scratchpad: `- Objective: Initialize War Room C2 on Motorola Moto G5 Stylus 2025.
- Environment: Termux (Android 15, aarch64, 8GB RAM, Snapdragon Octa-Core).
- Subsystems Verified:
  * Termux Socket Proxy: OPEN
  * Battery Thermal Envelope: OPTIMAL (34.6°C)
  * Vector Memory Bank: SYNCHRONIZED
  * Digitizer Pressure Sampling: 240Hz READY`,
      toolsUsed: [
        {
          id: 'init-tool-1',
          tool: 'termux_shell',
          args: { command: 'termux-battery-status' },
          output: `{ "health": "GOOD", "percentage": 84, "temperature": 34.6, "plugged": "UNPLUGGED" }`,
          status: 'success',
          executionTimeMs: 42,
          timestamp: '19:01:49',
        },
      ],
      timestamp: new Date().toISOString(),
      model: 'hermes-3-autonomous',
      tokens: {
        prompt: 142,
        completion: 96,
        total: 238,
        speedTokPerSec: 54.2,
      },
    },
  ]);

  // Tactical Logs
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'log-1',
      timestamp: '19:01:48',
      level: 'INFO',
      source: 'KERNEL',
      message: 'Termux aarch64 subsystem attached to pts/0.',
    },
    {
      id: 'log-2',
      timestamp: '19:01:49',
      level: 'TACTICAL',
      source: 'HERMES-C2',
      message: 'War room telemetry pipeline synchronized. Battery 84% (34.6°C).',
    },
    {
      id: 'log-3',
      timestamp: '19:01:50',
      level: 'TOOL',
      source: 'TERMUX_EXEC',
      message: 'Registered termux_shell and code_interpreter tools.',
    },
  ]);

  // Vector Memories
  const [memories, setMemories] = useState<MemoryItem[]>([
    {
      id: 'mem-1',
      key: 'DEVICE_PROFILE',
      category: 'DEVICE',
      value: 'Motorola Moto G5 Stylus (2025), Snapdragon Octa-Core, 8GB RAM, 5000mAh',
      updatedAt: '19:01:49',
    },
    {
      id: 'mem-2',
      key: 'DEFAULT_GATEWAY',
      category: 'ENVIRONMENT',
      value: '192.168.1.1 on wlan0 (Hermes encrypted tunnel active)',
      updatedAt: '19:01:49',
    },
    {
      id: 'mem-3',
      key: 'MISSION_POSTURE',
      category: 'TACTICAL',
      value: 'High readiness, autonomous reconnaissance & real-time telemetry surveillance',
      updatedAt: '19:01:50',
    },
  ]);

  // Latest stylus sketch URL
  const [latestSketchDataUrl, setLatestSketchDataUrl] = useState<string | null>(null);

  // Poll Telemetry & Analytics every 2.5s for real-time visualization
  const fetchTelemetry = async () => {
    try {
      const [telRes, analyticsRes, transRes] = await Promise.allSettled([
        fetch('/api/telemetry/live'),
        fetch('/api/analytics/realtime'),
        fetch('/api/agents/transitions'),
      ]);

      if (telRes.status === 'fulfilled' && telRes.value.ok) {
        const ct = telRes.value.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          const data: DeviceTelemetry = await telRes.value.json();
          setTelemetry(data);

          const timeLabel = new Date(data.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          setTelemetryHistory((prev) => {
            const next = [
              ...prev,
              {
                time: timeLabel,
                tokensPerSec: data.tokensPerSec,
                cpuLoad: data.cpuLoad,
                memoryPct: Math.round((data.ramUsedMb / data.ramTotalMb) * 100),
              },
            ];
            return next.slice(-20); // keep last 20 ticks
          });
        }
      }

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.ok) {
        const ct = analyticsRes.value.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          const aData = await analyticsRes.value.json();
          if (aData.communicationThroughputHistory) {
            setThroughputHistory(aData.communicationThroughputHistory);
          }
        }
      }

      if (transRes.status === 'fulfilled' && transRes.value.ok) {
        const ct = transRes.value.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          const tData: AgentStateTransition[] = await transRes.value.json();
          if (Array.isArray(tData) && tData.length > 0) {
            setTransitions(tData);
          }
        }
      }
    } catch {
      // Ignore background polling glitches
    }
  };

  useEffect(() => {
    fetchTelemetry();
    fetchTacticalCorrections();
    const interval = setInterval(() => {
      fetchTelemetry();
      fetchTacticalCorrections();
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const ct = res.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          const data = await res.json();
          setDeployedAgents(data);
        }
      }
    } catch {}
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const ct = res.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          const data = await res.json();
          setTasks(data);
        }
      }
    } catch {}
  };

  const fetchTacticalCorrections = async () => {
    try {
      const res = await fetch('/api/tactical-corrections');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) return;
      const data = await res.json();
      if (Array.isArray(data.recommendations)) {
        setTacticalRecommendations(data.recommendations);
      }
      if (Array.isArray(data.agentMetrics)) {
        setTacticalMetrics(data.agentMetrics);
      }
      if (data.config) {
        setTacticalConfig(data.config);
      }
    } catch {
      // Ignore background polling glitches
    }
  };

  const handleApplyCorrection = async (recommendationId: string) => {
    try {
      sound.dispatch();
      const res = await fetch('/api/tactical-corrections/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId }),
      });
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        sound.alert();
        addLog('CRITICAL', 'RECONFIG_ERR', 'Server returned invalid response');
        return;
      }
      const data = await res.json();
      if (res.ok && data.success) {
        sound.toolSuccess();
        addLog('TACTICAL', 'RECONFIG_APPLIED', `Tactical Reconfiguration applied for agent ${data.applied?.agentCallsign}: toolchain updated to [${data.applied?.reconfiguredToolchain?.join(', ')}]`);
        await Promise.all([fetchTacticalCorrections(), fetchAgents(), fetchTasks()]);
      } else {
        sound.alert();
        addLog('CRITICAL', 'RECONFIG_ERR', data.error || 'Failed to apply tactical reconfiguration');
      }
    } catch (err: any) {
      sound.alert();
      addLog('CRITICAL', 'RECONFIG_ERR', err.message || 'Network error applying reconfiguration');
    }
  };

  const handleDismissCorrection = async (recommendationId: string) => {
    try {
      sound.click();
      const res = await fetch('/api/tactical-corrections/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId }),
      });
      if (res.ok) {
        addLog('INFO', 'TACTICAL', `Dismissed correction recommendation: ${recommendationId}`);
        await fetchTacticalCorrections();
      }
    } catch (err: any) {
      addLog('CRITICAL', 'TACTICAL_ERR', err.message || 'Error dismissing recommendation');
    }
  };

  const handleTriggerEvaluation = async () => {
    try {
      sound.click();
      const res = await fetch('/api/tactical-corrections/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        addLog('TACTICAL', 'C2_EVAL', `Autonomous evaluation complete: ${data.generatedCount || 0} recommendation(s) generated.`);
        await fetchTacticalCorrections();
      }
    } catch (err: any) {
      addLog('CRITICAL', 'EVAL_ERR', err.message || 'Error triggering autonomous evaluation');
    }
  };

  const handleUpdateTacticalConfig = async (newConfig: Partial<TacticalCorrectionConfig>) => {
    try {
      sound.click();
      const res = await fetch('/api/tactical-corrections/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      const data = await res.json();
      if (res.ok && data.config) {
        setTacticalConfig(data.config);
        addLog('TACTICAL', 'CONFIG_UPDATE', `Tactical Correction threshold adjusted to ${data.config.failureThresholdPct}%.`);
        await fetchTacticalCorrections();
      }
    } catch (err: any) {
      addLog('CRITICAL', 'CONFIG_ERR', err.message || 'Error updating configuration');
    }
  };

  const handleSimulateFailure = async (agentId?: string, failureType?: string) => {
    try {
      sound.alert();
      const res = await fetch('/api/tactical-corrections/simulate-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, failureType }),
      });
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) return;
      const data = await res.json();
      if (res.ok && data.success) {
        addLog('CRITICAL', 'SIMULATOR', `Simulated failure injected on task ${data.taskId} (${data.agentId}). Tactical Correction triggered.`);
        await Promise.all([fetchTacticalCorrections(), fetchTasks(), fetchAgents()]);
      }
    } catch (err: any) {
      addLog('CRITICAL', 'SIM_ERR', err.message || 'Error simulating failure');
    }
  };

  // Fleet & Task API Handlers
  const handleDeployAgent = async (agentData: Partial<AgentDeployment>) => {
    try {
      const res = await fetch('/api/agents/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData),
      });
      const data = await res.json();
      if (data.agent) {
        setDeployedAgents((prev) => [data.agent, ...prev]);
        addLog('TACTICAL', 'FLEET_DEPLOY', `Agent ${data.agent.callsign} (${data.agent.model}) deployed to ${data.agent.environment}.`);
      }
    } catch (err: any) {
      addLog('CRITICAL', 'DEPLOY_ERR', `Failed to deploy agent: ${err.message}`);
    }
  };

  const handleAgentAction = async (agentId: string, action: 'pause' | 'resume' | 'terminate' | 'recalibrate') => {
    try {
      const res = await fetch(`/api/agents/${agentId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.agent) {
        setDeployedAgents((prev) => prev.map((a) => (a.id === agentId ? data.agent : a)));
        addLog('TACTICAL', 'AGENT_MGR', `Agent ${data.agent.callsign} action executed: ${action.toUpperCase()}`);
      }
    } catch (err: any) {
      addLog('CRITICAL', 'AGENT_ERR', `Agent action failed: ${err.message}`);
    }
  };

  const handleUpdateAgentModel = async (agentId: string, model: string, modelProvider?: 'hermes' | 'openrouter' | 'ollama') => {
    try {
      const res = await fetch(`/api/agents/${agentId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_model', model, modelProvider }),
      });
      const data = await res.json();
      if (data.agent) {
        setDeployedAgents((prev) => prev.map((a) => (a.id === agentId ? data.agent : a)));
        if (data.transition) {
          setTransitions((prev) => [data.transition, ...prev]);
        }
        addLog('TACTICAL', 'MODEL_RECONFIG', `Agent ${data.agent.callsign} model reconfigured to: ${model}`);
      }
    } catch (err: any) {
      addLog('CRITICAL', 'MODEL_ERR', `Failed to update agent model: ${err.message}`);
    }
  };

  const handleCreateTask = async (taskData: Partial<AgentTask>) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      const data = await res.json();
      if (data.task) {
        setTasks((prev) => [data.task, ...prev]);
        addLog('TACTICAL', 'TASK_PIPELINE', `Directive "${data.task.title}" queued for ${data.task.assignedAgentName}.`);
      }
    } catch (err: any) {
      addLog('CRITICAL', 'TASK_ERR', `Failed to create task: ${err.message}`);
    }
  };

  const handleTaskAction = async (taskId: string, action: 'run' | 'pause' | 'retry' | 'abort' | 'fail') => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
        addLog('TACTICAL', 'TASK_MGR', `Task ${data.task.id} (${action}): status now ${data.task.status}.`);
        await fetchTacticalCorrections();
      }
    } catch (err: any) {
      addLog('CRITICAL', 'TASK_ERR', `Task action failed: ${err.message}`);
    }
  };

  const handleBroadcastPacket = async (channelId: string, payload: string, from?: string, to?: string) => {
    try {
      const res = await fetch('/api/comms/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, payload, from, to }),
      });
      const data = await res.json();
      if (data.packet) {
        setChannels((prev) =>
          prev.map((c) =>
            c.id === channelId
              ? {
                  ...c,
                  recentPackets: [data.packet, ...c.recentPackets.slice(0, 19)],
                }
              : c
          )
        );
        addLog('TOOL', 'COMMS_MESH', `Injected packet to ${data.channel}: [${from} -> ${to}]`);
      }
    } catch (err: any) {
      addLog('CRITICAL', 'COMMS_ERR', `Broadcast packet error: ${err.message}`);
    }
  };

  const handleRefreshChannels = async () => {
    try {
      const res = await fetch('/api/comms/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
        addLog('INFO', 'COMMS_POLL', 'Updated communication channels telemetry.');
      }
    } catch {
      // Ignore
    }
  };

  const handleUpdateTuning = async (updates: Partial<TuningConfig>) => {
    try {
      const res = await fetch('/api/tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.config) {
        setTuningConfig(data.config);
        if (updates.temperature !== undefined) setTemperature(updates.temperature);
        addLog('TACTICAL', 'TUNING', `Calibrated engine parameters (${data.config.activePreset}).`);
      }
    } catch (err: any) {
      addLog('CRITICAL', 'TUNING_ERR', `Failed to update engine config: ${err.message}`);
    }
  };

  const handleFlushCache = () => {
    setMemories([]);
    addLog('INFO', 'CACHE_FLUSH', 'Flushed active Hermes vector cache & KV token buffers.');
  };

  const addLog = (level: LogEntry['level'], source: string, message: string) => {
    setLogs((prev) => [
      {
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        level,
        source,
        message,
      },
      ...prev.slice(0, 99),
    ]);
  };

  const handleToggleSound = () => {
    sound.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
  };

  const handleEmergencyStop = () => {
    setAgentState('IDLE');
    setSubAgents((prev) => prev.map((a) => ({ ...a, status: 'STANDBY', currentTask: undefined })));
    addLog('CRITICAL', 'OPERATOR', 'Emergency stop sequence initiated. All active agent processes halted.');
  };

  // Dispatch message to Hermes
  const handleSendMessage = async (prompt: string, attachedSketch?: string) => {
    const userMsgId = `user-${Date.now()}`;
    const newUserMsg: AgentMessage = {
      id: userMsgId,
      role: 'user',
      content: prompt,
      sketchUrl: attachedSketch,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setAgentState('PERCEIVING');
    addLog('TACTICAL', 'OPERATOR', `Directive received: "${prompt.slice(0, 50)}..."`);

    // Animate through Hermes reasoning loop
    setTimeout(() => {
      setAgentState('REASONING');
      setSubAgents((prev) => [
        { ...prev[0], status: 'RECON', currentTask: 'Mapping ingress vectors' },
        { ...prev[1], status: 'ENGAGED', currentTask: 'Compiling tool payload' },
        prev[2],
      ]);
      addLog('TACTICAL', 'HERMES-3', 'Populating <scratchpad> cognitive step graph.');
    }, 600);

    try {
      let analysisFromSketch = '';
      if (attachedSketch) {
        // If sketch attached, analyze via multimodal vision endpoint
        try {
          const visRes = await fetch('/api/stylus/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: attachedSketch, prompt }),
          });
          const visData = await visRes.json();
          analysisFromSketch = visData.analysis || '';
        } catch {
          // Ignore
        }
      }

      // Call Hermes Prompt Endpoint
      const res = await fetch('/api/agent/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: analysisFromSketch ? `${prompt}\n[Tactical Sketch Insights: ${analysisFromSketch}]` : prompt,
          persona: activePersona,
          temperature,
        }),
      });

      const data = await res.json();
      const rawText: string = data.rawText || '';

      // Extract scratchpad <scratchpad>...</scratchpad>
      let scratchpadText = '';
      const scratchMatch = rawText.match(/<scratchpad>([\s\S]*?)<\/scratchpad>/i);
      if (scratchMatch) {
        scratchpadText = scratchMatch[1].trim();
      }

      // Extract tool call <tool_call>...</tool_call>
      let toolCallJson: any = null;
      const toolMatch = rawText.match(/<tool_call>([\s\S]*?)<\/tool_call>/i);
      if (toolMatch) {
        try {
          toolCallJson = JSON.parse(toolMatch[1].trim());
        } catch {
          // fallback string
          toolCallJson = { tool: 'termux_shell', args: { command: 'termux-battery-status' } };
        }
      }

      // Extract remaining synthesis
      let cleanContent = rawText
        .replace(/<scratchpad>[\s\S]*?<\/scratchpad>/gi, '')
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
        .trim();

      if (!cleanContent) {
        cleanContent = 'Tactical directive executed within operational parameters.';
      }

      // Execute tool if parsed
      const toolsUsedList: any[] = [];
      if (toolCallJson) {
        setAgentState('EXECUTING_TOOL');
        addLog('TOOL', 'HERMES_CORE', `Invoking tool: ${toolCallJson.tool}`);

        // Update tool stats
        setToolStats((prev) =>
          prev.map((t) => (t.name === toolCallJson.tool ? { ...t, count: t.count + 1 } : t))
        );

        // Execute via server termux exec
        const toolRes = await fetch('/api/termux/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: toolCallJson.args?.command || `${toolCallJson.tool} --status`,
          }),
        });
        const toolData = await toolRes.json();

        toolsUsedList.push({
          id: `tool-${Date.now()}`,
          tool: toolCallJson.tool,
          args: toolCallJson.args || {},
          output: toolData.output,
          status: 'success',
          executionTimeMs: toolData.executionTimeMs || 65,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });

        sound.toolSuccess();
      }

      setAgentState('SYNTHESIZING');

      setTimeout(() => {
        const assistantMsg: AgentMessage = {
          id: `hermes-${Date.now()}`,
          role: 'assistant',
          content: cleanContent,
          scratchpad: scratchpadText || undefined,
          toolsUsed: toolsUsedList.length > 0 ? toolsUsedList : undefined,
          timestamp: new Date().toISOString(),
          model: data.model || 'hermes-3-autonomous',
          tokens: {
            prompt: Math.floor(prompt.length / 3) + 80,
            completion: Math.floor(rawText.length / 3) + 40,
            total: Math.floor((prompt.length + rawText.length) / 3) + 120,
            speedTokPerSec: data.tokSpeed || 52.4,
          },
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setAgentState('IDLE');
        setSubAgents((prev) =>
          prev.map((a) => ({
            ...a,
            status: 'STANDBY',
            tasksCompleted: a.tasksCompleted + 1,
            currentTask: undefined,
          }))
        );

        addLog('TACTICAL', 'HERMES-3', `Response synthesized (${assistantMsg.tokens?.speedTokPerSec} tok/s).`);
      }, 500);
    } catch (err: any) {
      setAgentState('ERROR');
      addLog('CRITICAL', 'HERMES_ERR', `Execution failed: ${err.message}`);
      setTimeout(() => setAgentState('IDLE'), 1500);
    }
  };

  // Dispatch from Stylus Canvas directly to War Room
  const handleSendSketchToWarRoom = (dataUrl: string, analysisText?: string) => {
    setLatestSketchDataUrl(dataUrl);
    setActiveTab('command');
    handleSendMessage(
      analysisText
        ? `Operator dispatched sketch schematic with vision findings: ${analysisText.slice(0, 100)}...`
        : 'Analyze attached Moto G5 Stylus tactical schematic.',
      dataUrl
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080a0f] text-slate-100 overflow-hidden font-sans select-none">
      {/* Tactical War Room Top Header */}
      <TacticalHeader
        agentState={agentState}
        telemetry={telemetry}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onEmergencyStop={handleEmergencyStop}
        activeModelName="Hermes-3-Alpha"
        isProcessing={agentState !== 'IDLE' || tasks.some((t) => t.status === 'RUNNING')}
        activeTasksCount={tasks.filter((t) => t.status === 'RUNNING').length}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'command' && (
          <WarRoomFeed
            messages={messages}
            agentState={agentState}
            onSendMessage={handleSendMessage}
            subAgents={subAgents}
            latestSketchDataUrl={latestSketchDataUrl}
            activePersona={activePersona}
          />
        )}

        {activeTab === 'telemetry' && (
          <TelemetryDashboard
            currentTelemetry={telemetry}
            history={telemetryHistory}
            logs={logs}
            toolStats={toolStats}
            agents={deployedAgents}
            tasks={tasks}
            channels={channels}
            throughputHistory={throughputHistory}
            transitions={transitions}
            onClearLogs={() => setLogs([])}
            onRefreshData={fetchTelemetry}
          />
        )}

        {activeTab === 'agents' && (
          <AgentDeploymentView
            agents={deployedAgents}
            onDeployAgent={handleDeployAgent}
            onAgentAction={handleAgentAction}
            onUpdateAgentModel={handleUpdateAgentModel}
            agentMetrics={tacticalMetrics}
            recommendations={tacticalRecommendations}
            onApplyCorrection={handleApplyCorrection}
            onOpenCorrectionsTab={() => setActiveTab('corrections')}
          />
        )}

        {activeTab === 'tasks' && (
          <TaskManagerView
            tasks={tasks}
            agents={deployedAgents}
            onCreateTask={handleCreateTask}
            onTaskAction={handleTaskAction}
            recommendations={tacticalRecommendations}
            onApplyCorrection={handleApplyCorrection}
            onOpenCorrectionsTab={() => setActiveTab('corrections')}
          />
        )}

        {activeTab === 'corrections' && (
          <TacticalCorrectionPanel
            recommendations={tacticalRecommendations}
            agentMetrics={tacticalMetrics}
            config={tacticalConfig}
            agents={deployedAgents}
            onApplyCorrection={handleApplyCorrection}
            onDismissCorrection={handleDismissCorrection}
            onUpdateConfig={handleUpdateTacticalConfig}
            onSimulateFailure={handleSimulateFailure}
            onRefresh={fetchTacticalCorrections}
            onTriggerEvaluation={handleTriggerEvaluation}
          />
        )}

        {activeTab === 'comms' && (
          <CommChannelsView
            channels={channels}
            onBroadcastPacket={handleBroadcastPacket}
            onRefreshChannels={handleRefreshChannels}
          />
        )}

        {activeTab === 'tuning' && (
          <PerformanceTuningView
            config={tuningConfig}
            onUpdateConfig={handleUpdateTuning}
            memoriesCount={memories.length}
            onFlushCache={handleFlushCache}
          />
        )}

        {activeTab === 'terminus' && <TermuxTerminal />}

      {activeTab === 'recon' && (
        <ReconView
          agents={deployedAgents}
          channels={channels}
          tasks={tasks}
          reconResults={reconResults}
          reconHistory={reconHistory}
          reconHosts={reconHosts}
          reconLocalAddresses={reconLocalAddresses}
          watchedHosts={watchedHosts}
          watchProbes={watchProbes}
          watchProbedAt={watchProbedAt}
          onToggleWatch={toggleWatchedHost}
          onProbeWatched={() => void probeWatchedHosts()}
          onRunScan={(scanType) => handleRunReconScan(scanType)}
          onRefreshScan={() => fetchReconResults()}
        />
      )}

        {activeTab === 'stylus' && (
          <StylusCanvas
            onSaveSketch={(url) => setLatestSketchDataUrl(url)}
            onSendToWarRoom={handleSendSketchToWarRoom}
          />
        )}

        {activeTab === 'matrix' && (
          <HermesMatrix
            activePersona={activePersona}
            onChangePersona={setActivePersona}
            temperature={temperature}
            onChangeTemperature={setTemperature}
            memories={memories}
            onAddMemory={(m) => {
              setMemories((prev) => [
                ...prev,
                { ...m, id: `mem-${Date.now()}`, updatedAt: new Date().toLocaleTimeString() },
              ]);
              addLog('INFO', 'MEMORY', `Stored vector key: ${m.key}`);
            }}
            onDeleteMemory={(id) => {
              setMemories((prev) => prev.filter((item) => item.id !== id));
            }}
            onClearMemories={() => setMemories([])}
          />
        )}
      </main>

      {/* Mobile-first Navigation Dock */}
      <NavigationDock
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        unreadLogsCount={logs.filter((l) => l.level === 'CRITICAL').length}
        pendingCorrectionsCount={tacticalRecommendations.filter((r) => r.status === 'PENDING').length}
      />
    </div>
  );
}
