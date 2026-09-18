// Shared sample data for the view render tests.
//
// Values are deliberately distinctive strings so an assertion can prove the
// fixture actually reached the DOM rather than matching incidental markup.

import type {
  AgentDeployment,
  AgentMessage,
  AgentMetrics,
  AgentStateTransition,
  AgentTask,
  CommChannel,
  DeviceTelemetry,
  LogEntry,
  MemoryItem,
  SubAgentInfo,
  TacticalCorrectionConfig,
  TacticalCorrectionRecommendation,
  TuningConfig,
} from '../src/types';

export const NOW = '2026-09-18T10:00:00.000Z';

export const agent: AgentDeployment = {
  id: 'agent-alpha',
  name: 'Hermes-3-Alpha',
  callsign: 'HERMES-3',
  model: 'gemini-2.5-flash',
  modelProvider: 'hermes',
  specialty: 'Reconnaissance',
  codingSpecialty: 'TypeScript',
  status: 'ONLINE',
  environment: 'Termux aarch64',
  health: 92,
  uptimeSec: 3600,
  tasksCompleted: 12,
  currentTask: 'subnet sweep',
  memoryUsageMb: 412,
  cpuQuotaPct: 35,
  deployedAt: NOW,
  priority: 'P1',
};

export const subAgent: SubAgentInfo = {
  id: 'sub-1',
  name: 'HermesSub-Rec',
  callsign: 'RECON-1',
  specialty: 'Reconnaissance',
  status: 'ENGAGED',
  tasksCompleted: 4,
  health: 88,
  currentTask: 'port sweep',
};

export const message: AgentMessage = {
  id: 'msg-1',
  role: 'assistant',
  content: 'Recon sweep complete for 192.168.1.0/24',
  scratchpad: 'gateway unreachable, local node answered on 3000',
  toolsUsed: [
    {
      id: 'tool-1',
      tool: 'termux_shell',
      args: { cmd: 'nmap -sn 192.168.1.0/24' },
      output: 'host up: 10.37.250.225',
      status: 'success',
      executionTimeMs: 412,
      timestamp: NOW,
    },
  ],
  subAgentsInvolved: ['RECON-1'],
  timestamp: NOW,
  model: 'gemini-2.5-flash',
  tokens: { prompt: 100, completion: 40, total: 140, speedTokPerSec: 33 },
};

export const telemetry: DeviceTelemetry = {
  timestamp: Date.parse(NOW),
  cpuLoad: 41,
  ramUsedMb: 3072,
  ramTotalMb: 7483,
  batteryPct: 63,
  batteryTempC: 34,
  tokensPerSec: 128,
  tokenTotal: 9001,
  networkLatencyMs: 42,
  termuxProcsCount: 14,
  storageUsedGb: 21,
  storageTotalGb: 64,
};

export const logEntry: LogEntry = {
  id: 'log-1',
  timestamp: NOW,
  level: 'TACTICAL',
  source: 'RECON',
  message: 'sweep initiated by operator',
};

export const task: AgentTask = {
  id: 'task-1',
  title: 'Recon sweep of subnet',
  description: 'Enumerate 192.168.1.0/24 for live hosts',
  priority: 'P1_HIGH',
  status: 'RUNNING',
  assignedAgentId: agent.id,
  assignedAgentName: agent.name,
  progressPct: 45,
  toolChain: ['termux_shell', 'net_probe'],
  steps: [
    { id: 'step-1', name: 'arp scan', status: 'done', detail: '4 hosts' },
    { id: 'step-2', name: 'port probe', status: 'running' },
  ],
  createdAt: NOW,
};

export const channel: CommChannel = {
  id: 'chan-1',
  name: 'C2-DROP-LINK',
  type: 'TELEMETRY',
  description: 'Encrypted telemetry stream',
  throughputKbps: 240,
  packetsPerSec: 18,
  latencyMs: 42,
  status: 'NOMINAL',
  activeListeners: 3,
  recentPackets: [
    { id: 'pkt-1', from: 'HERMES-3', to: 'C2', channelId: 'chan-1', payloadSnippet: 'SIG=0.98', timestamp: NOW, sizeBytes: 512 },
  ],
};

export const tuningConfig: TuningConfig = {
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
};

export const memory: MemoryItem = {
  id: 'mem-1',
  key: 'WAR_ROOM_SSID',
  category: 'ENVIRONMENT',
  value: 'WAR_ROOM_SECURE_5G',
  updatedAt: NOW,
};

export const agentMetrics: AgentMetrics = {
  agentId: agent.id,
  agentCallsign: agent.callsign,
  agentName: agent.name,
  tasksTotal: 12,
  tasksCompleted: 8,
  tasksFailed: 4,
  tasksRunning: 0,
  successRatePct: 42,
  consecutiveFailures: 3,
  failingTools: ['termux_shell'],
  lastFailureReason: 'probe timeout',
  lastFailureTimestamp: NOW,
  status: 'WARNING',
};

export const correctionConfig: TacticalCorrectionConfig = {
  failureThresholdPct: 60,
  minTasksForEvaluation: 5,
  autoApplyEnabled: false,
  autoRetryFailedTasks: true,
  coolDownPeriodSec: 300,
};

export const recommendation: TacticalCorrectionRecommendation = {
  id: 'rec-1',
  agentId: agent.id,
  agentCallsign: agent.callsign,
  agentName: agent.name,
  createdAt: NOW,
  successRatePct: 42,
  thresholdPct: 60,
  consecutiveFailures: 3,
  triggerReason: 'Success rate 42% below threshold',
  detectedIssues: ['tool timeout'],
  currentToolchain: ['termux_shell'],
  suggestedToolchain: ['net_probe'],
  currentModel: 'gemini-2.5-flash',
  suggestedModel: 'gemini-2.5-pro',
  currentSpecialty: 'Reconnaissance',
  suggestedSpecialty: 'Network Ops',
  suggestedTuning: { toolTimeoutMs: 30000, autoRetryAttempts: 5, priority: 'P0' },
  optimizationSummary: 'Widen tool timeout and retry budget',
  status: 'PENDING',
};

export const transition: AgentStateTransition = {
  id: 'tr-1',
  agentId: agent.id,
  agentCallsign: agent.callsign,
  agentName: agent.name,
  fromStatus: 'ONLINE',
  toStatus: 'ENGAGED',
  timestamp: NOW,
  reason: 'task assigned',
  triggeredBy: 'TASK_PIPELINE',
  contextSnapshot: { cpuLoad: 41, ramUsedMb: 3072, activeTask: 'subnet sweep' },
};

export const throughputHistory = [
  { time: '10:00', c2Telemtry: 120, termuxIpc: 80, agentMesh: 40, uplink: 20 },
];

export const telemetryHistory = [{ time: '10:00', tokensPerSec: 128, cpuLoad: 41, memoryPct: 41 }];

export const toolStats = [{ name: 'termux_shell', count: 12, color: '#06b6d4' }];

/** Async no-ops for the callbacks the views expect. */
export const noop = () => {};
export const asyncNoop = async () => {};
