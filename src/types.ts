export type AgentState = 'IDLE' | 'PERCEIVING' | 'REASONING' | 'EXECUTING_TOOL' | 'SYNTHESIZING' | 'ERROR';

export interface ToolInvocation {
  id: string;
  tool: string;
  args: Record<string, any>;
  output?: string;
  status: 'pending' | 'running' | 'success' | 'error';
  executionTimeMs?: number;
  timestamp: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  scratchpad?: string;
  toolsUsed?: ToolInvocation[];
  subAgentsInvolved?: string[];
  timestamp: string;
  model?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
    speedTokPerSec: number;
  };
  sketchUrl?: string;
}

export interface SubAgentInfo {
  id: string;
  name: string;
  callsign: string;
  specialty: string;
  status: 'STANDBY' | 'ENGAGED' | 'RECON' | 'ANALYSIS';
  tasksCompleted: number;
  health: number;
  currentTask?: string;
}

export interface AgentDeployment {
  id: string;
  name: string;
  callsign: string;
  model: string;
  modelProvider?: 'hermes' | 'openrouter' | 'ollama';
  specialty: string; // Tactical Specialty
  codingSpecialty?: string; // Coding Specialty
  status: 'ONLINE' | 'STANDBY' | 'ENGAGED' | 'PAUSED' | 'TERMINATED' | 'ERROR';
  environment: 'Termux aarch64' | 'Cloud Sandbox' | 'Hybrid Mesh';
  health: number; // 0 - 100
  uptimeSec: number;
  tasksCompleted: number;
  currentTask?: string;
  memoryUsageMb: number;
  cpuQuotaPct: number;
  deployedAt: string;
  priority: 'P0' | 'P1' | 'P2';
}

export interface AgentStateTransition {
  id: string;
  agentId: string;
  agentCallsign: string;
  agentName: string;
  fromStatus: AgentDeployment['status'] | 'OFFLINE' | 'INITIALIZING';
  toStatus: AgentDeployment['status'];
  timestamp: string;
  reason: string;
  triggeredBy: 'OPERATOR' | 'TASK_PIPELINE' | 'AUTONOMOUS_C2' | 'SYSTEM_SUPERVISOR' | 'CRITICAL_FAILSAFE';
  contextSnapshot?: {
    cpuLoad?: number;
    ramUsedMb?: number;
    activeTask?: string;
    batteryTempC?: number;
  };
}

export interface TaskStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  detail?: string;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  priority: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_NORMAL' | 'P3_LOW';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  assignedAgentId: string;
  assignedAgentName: string;
  progressPct: number;
  toolChain: string[];
  steps: TaskStep[];
  createdAt: string;
  completedAt?: string;
  executionTimeMs?: number;
  error?: string;
}

export interface CommPacket {
  id: string;
  from: string;
  to: string;
  channelId: string;
  payloadSnippet: string;
  timestamp: string;
  sizeBytes: number;
}

export interface CommChannel {
  id: string;
  name: string;
  type: 'IPC' | 'TELEMETRY' | 'AGENT_MESH' | 'UPLINK' | 'RECON_DROP';
  description: string;
  throughputKbps: number;
  packetsPerSec: number;
  latencyMs: number;
  status: 'NOMINAL' | 'DEGRADED' | 'DISRUPTED';
  activeListeners: number;
  recentPackets: CommPacket[];
}

export interface TuningConfig {
  temperature: number;
  topP: number;
  maxReasoningSteps: number;
  contextLimitTokens: number;
  nicePriority: number; // -20 to 19 in Linux
  batteryProfile: 'MAX_PERFORMANCE' | 'BALANCED_TACTICAL' | 'STEALTH_ECO';
  toolTimeoutMs: number;
  autoRetryAttempts: number;
  kvCachePolicy: 'AGGRESSIVE' | 'STANDARD' | 'MINIMAL';
  activePreset: string;
}

export interface DeviceTelemetry {
  timestamp: number;
  cpuLoad: number; // 0 - 100%
  ramUsedMb: number;
  ramTotalMb: number;
  batteryPct: number;
  batteryTempC: number;
  tokensPerSec: number;
  tokenTotal?: number;
  networkLatencyMs: number;
  termuxProcsCount: number;
  storageUsedGb: number;
  storageTotalGb: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'TACTICAL' | 'TOOL' | 'CRITICAL';
  source: string;
  message: string;
}

export interface MemoryItem {
  id: string;
  key: string;
  category: 'TACTICAL' | 'ENVIRONMENT' | 'DEVICE' | 'CREDENTIAL' | 'TASK';
  value: string;
  updatedAt: string;
}

export type WarRoomTab = 
  | 'command' 
  | 'tasks' 
  | 'agents' 
  | 'telemetry' 
  | 'comms' 
  | 'tuning' 
  | 'termux' 
  | 'stylus'
  | 'matrix';

