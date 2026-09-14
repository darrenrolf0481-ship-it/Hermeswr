import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  BatteryCharging, 
  HardDrive, 
  Zap, 
  Terminal, 
  Radio, 
  ShieldAlert, 
  Clock, 
  BarChart3, 
  Filter, 
  Trash2,
  TrendingUp,
  Users,
  CheckSquare,
  AlertTriangle,
  RefreshCw,
  Search,
  Eye,
  SlidersHorizontal,
  ArrowRight,
  GitCommit,
  History,
  ShieldCheck,
  Play,
  Pause,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  Cell, 
  PieChart, 
  Pie,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { DeviceTelemetry, LogEntry, AgentDeployment, AgentTask, CommChannel, AgentStateTransition } from '../types';
import { sound } from '../utils/audio';

interface TelemetryDashboardProps {
  currentTelemetry: DeviceTelemetry;
  history: { time: string; tokensPerSec: number; cpuLoad: number; memoryPct: number }[];
  logs: LogEntry[];
  toolStats: { name: string; count: number; color: string }[];
  agents: AgentDeployment[];
  tasks: AgentTask[];
  channels: CommChannel[];
  throughputHistory?: { time: string; c2Telemtry: number; termuxIpc: number; agentMesh: number; uplink: number }[];
  transitions?: AgentStateTransition[];
  onClearLogs: () => void;
  onRefreshData?: () => void;
}

export const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  currentTelemetry,
  history,
  logs,
  toolStats,
  agents,
  tasks,
  channels,
  throughputHistory = [],
  transitions = [],
  onClearLogs,
  onRefreshData,
}) => {
  type DashboardView = 'OVERVIEW' | 'TRANSITIONS' | 'AGENTS' | 'TASKS' | 'THROUGHPUT' | 'ERRORS';
  const [activeDashboardView, setActiveDashboardView] = useState<DashboardView>('OVERVIEW');
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>('ALL');
  const [searchLogQuery, setSearchLogQuery] = useState('');
  const [isLivePolling, setIsLivePolling] = useState(true);

  // Transitions view specific filters
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('ALL');
  const [selectedTriggerFilter, setSelectedTriggerFilter] = useState<string>('ALL');
  const [searchTransitionQuery, setSearchTransitionQuery] = useState('');
  const [expandedTransitionId, setExpandedTransitionId] = useState<string | null>(null);

  // Dynamic calculations for Agent Statuses
  const agentStatusData = [
    { name: 'Online', value: agents.filter((a) => a.status === 'ONLINE').length, color: '#10b981' },
    { name: 'Engaged', value: agents.filter((a) => a.status === 'ENGAGED').length, color: '#f59e0b' },
    { name: 'Standby', value: agents.filter((a) => a.status === 'STANDBY').length, color: '#06b6d4' },
    { name: 'Paused', value: agents.filter((a) => a.status === 'PAUSED').length, color: '#64748b' },
    { name: 'Terminated', value: agents.filter((a) => a.status === 'TERMINATED').length, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  // Dynamic calculations for Task Completion Rates
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const runningTasks = tasks.filter((t) => t.status === 'RUNNING').length;
  const queuedTasks = tasks.filter((t) => t.status === 'QUEUED').length;
  const failedTasks = tasks.filter((t) => t.status === 'FAILED').length;
  const totalTasks = tasks.length || 1;
  const taskSuccessRate = Math.round((completedTasks / (completedTasks + failedTasks || 1)) * 100);

  const taskCompletionData = [
    { name: 'Completed', count: completedTasks, color: '#10b981' },
    { name: 'Running', count: runningTasks, color: '#f59e0b' },
    { name: 'Queued', count: queuedTasks, color: '#06b6d4' },
    { name: 'Failed', count: failedTasks, color: '#ef4444' },
  ];

  // Dynamic Communication Throughput Data
  const defaultThroughputHistory = [
    { time: '19:00', c2Telemtry: 38.2, termuxIpc: 24.5, agentMesh: 31.0, uplink: 12.0 },
    { time: '19:01', c2Telemtry: 41.5, termuxIpc: 26.2, agentMesh: 33.4, uplink: 13.5 },
    { time: '19:02', c2Telemtry: 39.8, termuxIpc: 28.0, agentMesh: 36.1, uplink: 14.2 },
    { time: '19:03', c2Telemtry: 44.2, termuxIpc: 27.4, agentMesh: 34.8, uplink: 15.0 },
    { time: '19:04', c2Telemtry: 42.4, termuxIpc: 28.1, agentMesh: 35.7, uplink: 14.9 },
  ];
  const chartThroughput = throughputHistory.length > 0 ? throughputHistory : defaultThroughputHistory;

  // Dynamic Error Logs breakdown
  const errorLogs = logs.filter((l) => l.level === 'CRITICAL' || l.level === 'TOOL' || l.source.includes('ERR'));
  const errorSources = [
    { source: 'TERMUX_KERNEL', incidents: logs.filter((l) => l.source === 'TERMUX' && l.level === 'CRITICAL').length + 1, color: '#ef4444' },
    { source: 'HERMES_C2', incidents: logs.filter((l) => l.source === 'HERMES').length, color: '#f59e0b' },
    { source: 'MESH_SOCKET', incidents: 1, color: '#8b5cf6' },
    { source: 'TOOL_EXEC', incidents: logs.filter((l) => l.level === 'TOOL').length, color: '#06b6d4' },
  ];

  const filteredLogs = logs.filter((log) => {
    if (selectedLogLevel !== 'ALL' && log.level !== selectedLogLevel) return false;
    if (searchLogQuery.trim()) {
      const q = searchLogQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.source.toLowerCase().includes(q) ||
        log.level.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleDownloadLogs = () => {
    sound.click();
    const exportSession = {
      exportSession: 'Hermes-3-Alpha Tactical Logs Session',
      device: 'Moto G5 Stylus (2025) / Android-15 (Termux)',
      exportedAt: new Date().toISOString(),
      activeView: activeDashboardView,
      logStats: {
        total: logs.length,
        filtered: filteredLogs.length,
        levelFilter: selectedLogLevel,
        searchQuery: searchLogQuery || null,
        criticalCount: logs.filter((l) => l.level === 'CRITICAL').length,
        tacticalCount: logs.filter((l) => l.level === 'TACTICAL').length,
        toolCount: logs.filter((l) => l.level === 'TOOL').length,
        infoCount: logs.filter((l) => l.level === 'INFO').length,
      },
      currentTelemetry,
      activeAgentsCount: agents.length,
      activeTasksCount: tasks.length,
      logs: logs,
    };

    const blob = new Blob([JSON.stringify(exportSession, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hermes-tactical-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLogLevelBadge = (level: LogEntry['level']) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'TACTICAL':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'TOOL':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'INFO':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'DEBUG':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'ENGAGED':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'STANDBY':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'PAUSED':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
      case 'TERMINATED':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'INITIALIZING':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      case 'OFFLINE':
      default:
        return 'bg-slate-700/30 text-slate-400 border-slate-700/50';
    }
  };

  const getTriggerBadge = (trigger: AgentStateTransition['triggeredBy']) => {
    switch (trigger) {
      case 'OPERATOR':
        return 'bg-cyan-950 text-cyan-400 border-cyan-800';
      case 'TASK_PIPELINE':
        return 'bg-amber-950 text-amber-400 border-amber-800';
      case 'AUTONOMOUS_C2':
        return 'bg-purple-950 text-purple-400 border-purple-800';
      case 'CRITICAL_FAILSAFE':
        return 'bg-red-950 text-red-400 border-red-800';
      case 'SYSTEM_SUPERVISOR':
      default:
        return 'bg-blue-950 text-blue-400 border-blue-800';
    }
  };

  // Filtered State Transitions for forensic analysis
  const filteredTransitions = transitions.filter((tr) => {
    if (selectedAgentFilter !== 'ALL' && tr.agentId !== selectedAgentFilter) return false;
    if (selectedTriggerFilter !== 'ALL' && tr.triggeredBy !== selectedTriggerFilter) return false;
    if (searchTransitionQuery.trim()) {
      const q = searchTransitionQuery.toLowerCase();
      return (
        tr.agentCallsign.toLowerCase().includes(q) ||
        tr.agentName.toLowerCase().includes(q) ||
        tr.fromStatus.toLowerCase().includes(q) ||
        tr.toStatus.toLowerCase().includes(q) ||
        tr.reason.toLowerCase().includes(q) ||
        tr.triggeredBy.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const ramPct = Math.round((currentTelemetry.ramUsedMb / currentTelemetry.ramTotalMb) * 100);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-[#080a0f] text-slate-200">
      {/* Top Banner & Interactive Dashboard View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-950/80">
        <div>
          <h2 className="text-base sm:text-lg font-mono font-bold text-cyan-300 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            HERMES REAL-TIME TELEMETRY & DATA VISUALIZATION
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Dynamic telemetry analytics across agent status, tasks, comms throughput, and error logs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            id="telemetry-download-logs-top-btn"
            onClick={handleDownloadLogs}
            className="p-1.5 px-2.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-xs font-mono flex items-center gap-1.5 transition-colors shadow-sm"
            title="Download current tactical log session as JSON"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Download Logs</span>
            <span className="sm:hidden">Logs</span>
          </button>

          {onRefreshData && (
            <button
              onClick={() => {
                sound.click();
                onRefreshData();
              }}
              className="p-1.5 rounded-lg bg-[#0f1420] hover:bg-slate-800 border border-slate-700 text-cyan-300 text-xs font-mono flex items-center gap-1 transition-colors"
              title="Poll latest telemetry snapshot"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">REFRESH</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-[#090d16] p-1 rounded-xl border border-cyan-900/60 overflow-x-auto no-scrollbar">
            {[
              { id: 'OVERVIEW', label: 'OVERVIEW' },
              { id: 'TRANSITIONS', label: 'STATE TRANSITIONS' },
              { id: 'AGENTS', label: 'AGENTS' },
              { id: 'TASKS', label: 'TASKS' },
              { id: 'THROUGHPUT', label: 'COMMS' },
              { id: 'ERRORS', label: 'ERROR LOGS' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  sound.click();
                  setActiveDashboardView(tab.id as DashboardView);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all whitespace-nowrap ${
                  activeDashboardView === tab.id
                    ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Vital Hardware Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Token Velocity */}
        <div className="p-3 rounded-xl bg-[#0f1420] border border-cyan-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>INFERENCE VELOCITY</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-1.5">
            <span className="text-2xl font-mono font-bold text-cyan-300">
              {currentTelemetry.tokensPerSec}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1">tok/s</span>
          </div>
          <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" /> Total: {currentTelemetry.tokenTotal.toLocaleString()}
          </div>
        </div>

        {/* Task Completion Rate */}
        <div className="p-3 rounded-xl bg-[#0f1420] border border-emerald-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>TASK COMPLETION</span>
            <CheckSquare className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-1.5">
            <span className="text-2xl font-mono font-bold text-emerald-300">
              {taskSuccessRate}%
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1">success</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            {completedTasks}/{totalTasks} directives finished
          </div>
        </div>

        {/* Fleet Online Gauge */}
        <div className="p-3 rounded-xl bg-[#0f1420] border border-purple-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>AGENT STATUS</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-1.5">
            <span className="text-2xl font-mono font-bold text-purple-300">
              {agents.filter((a) => a.status === 'ONLINE' || a.status === 'ENGAGED').length} / {agents.length}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1">active</span>
          </div>
          <div className="text-[10px] font-mono text-purple-400 mt-1">
            Mesh bus connected
          </div>
        </div>

        {/* Hardware Envelope */}
        <div className="p-3 rounded-xl bg-[#0f1420] border border-cyan-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>MOTO G5 STYLUS 5G</span>
            <BatteryCharging className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-bold text-slate-100">
              {currentTelemetry.batteryPct}%
            </span>
            <span className="text-xs font-mono text-amber-300">
              {currentTelemetry.batteryTempC}°C
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            Snapdragon CPU: {currentTelemetry.cpuLoad}%
          </div>
        </div>
      </div>

      {/* DASHBOARD VIEW: STATE TRANSITIONS (POST-MISSION FORENSIC ANALYSIS) */}
      {(activeDashboardView === 'TRANSITIONS' || activeDashboardView === 'OVERVIEW') && (
        <div className="p-3.5 rounded-xl bg-[#0f1420] border border-cyan-900/60 space-y-3.5">
          {/* Header & Filter Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-cyan-950">
            <div>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <span className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-cyan-300">
                  Agent Historical State Transitions (Forensic Audit Trail)
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                Full chronological state lifecycle audit logging for autonomous Hermes agents (e.g., STANDBY &rarr; ENGAGED)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Agent Filter */}
              <div className="flex items-center gap-1 bg-[#080b12] px-2 py-1 rounded-lg border border-slate-800 text-[11px] font-mono">
                <Filter className="w-3 h-3 text-slate-500" />
                <span className="text-slate-400 text-[10px]">AGENT:</span>
                <select
                  value={selectedAgentFilter}
                  onChange={(e) => setSelectedAgentFilter(e.target.value)}
                  className="bg-transparent text-cyan-300 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-[#0f1420] text-slate-200">ALL AGENTS</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id} className="bg-[#0f1420] text-slate-200">
                      {a.callsign} ({a.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Trigger Filter */}
              <div className="flex items-center gap-1 bg-[#080b12] px-2 py-1 rounded-lg border border-slate-800 text-[11px] font-mono">
                <span className="text-slate-400 text-[10px]">TRIGGER:</span>
                <select
                  value={selectedTriggerFilter}
                  onChange={(e) => setSelectedTriggerFilter(e.target.value)}
                  className="bg-transparent text-cyan-300 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-[#0f1420] text-slate-200">ALL TRIGGERS</option>
                  <option value="OPERATOR" className="bg-[#0f1420] text-slate-200">OPERATOR</option>
                  <option value="TASK_PIPELINE" className="bg-[#0f1420] text-slate-200">TASK_PIPELINE</option>
                  <option value="AUTONOMOUS_C2" className="bg-[#0f1420] text-slate-200">AUTONOMOUS_C2</option>
                  <option value="SYSTEM_SUPERVISOR" className="bg-[#0f1420] text-slate-200">SYSTEM_SUPERVISOR</option>
                  <option value="CRITICAL_FAILSAFE" className="bg-[#0f1420] text-slate-200">CRITICAL_FAILSAFE</option>
                </select>
              </div>

              {/* Forensic Search */}
              <div className="relative">
                <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
                <input
                  type="text"
                  placeholder="Filter transitions..."
                  value={searchTransitionQuery}
                  onChange={(e) => setSearchTransitionQuery(e.target.value)}
                  className="bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg pl-6 pr-2 py-1 text-[11px] font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none w-36 sm:w-44"
                />
              </div>

              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 shrink-0">
                {filteredTransitions.length} TRANSITIONS
              </span>
            </div>
          </div>

          {/* Quick Stats Banner for Transitions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
            <div className="p-2 rounded bg-[#090d16] border border-slate-800">
              <span className="text-[10px] text-slate-500 block">RECORDED EVENTS</span>
              <span className="text-cyan-300 font-bold text-sm">{transitions.length}</span>
            </div>
            <div className="p-2 rounded bg-[#090d16] border border-slate-800">
              <span className="text-[10px] text-slate-500 block">ENGAGED (ACTIVE)</span>
              <span className="text-amber-400 font-bold text-sm">
                {transitions.filter((t) => t.toStatus === 'ENGAGED').length}
              </span>
            </div>
            <div className="p-2 rounded bg-[#090d16] border border-slate-800">
              <span className="text-[10px] text-slate-500 block">STANDBY RELEASES</span>
              <span className="text-cyan-400 font-bold text-sm">
                {transitions.filter((t) => t.toStatus === 'STANDBY').length}
              </span>
            </div>
            <div className="p-2 rounded bg-[#090d16] border border-slate-800">
              <span className="text-[10px] text-slate-500 block">TASK DISPATCHES</span>
              <span className="text-emerald-400 font-bold text-sm">
                {transitions.filter((t) => t.triggeredBy === 'TASK_PIPELINE').length}
              </span>
            </div>
          </div>

          {/* Dedicated Transitions List View */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1 font-mono">
            {filteredTransitions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-mono border border-dashed border-slate-800 rounded-xl">
                No historical state transitions match the active filter criteria.
              </div>
            ) : (
              filteredTransitions.map((tr) => {
                const isExpanded = expandedTransitionId === tr.id;
                return (
                  <div
                    key={tr.id}
                    className={`rounded-xl border transition-all ${
                      isExpanded
                        ? 'bg-[#0a0f1c] border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                        : 'bg-[#090d16] hover:bg-[#0d1322] border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    {/* Main Row */}
                    <div 
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none"
                      onClick={() => {
                        sound.click();
                        setExpandedTransitionId(isExpanded ? null : tr.id);
                      }}
                    >
                      {/* Left: Timestamp, Agent, & State Transition Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] sm:text-xs text-slate-400 font-bold bg-[#06080e] px-1.5 py-0.5 rounded border border-slate-800">
                          {tr.timestamp}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-200">
                            {tr.agentCallsign}
                          </span>
                          <span className="text-[10px] text-slate-500 hidden sm:inline">
                            ({tr.agentName})
                          </span>
                        </div>

                        {/* State Transition Flow Indicator */}
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                          <span className={`px-2 py-0.5 rounded-full border ${getStatusBadge(tr.fromStatus)}`}>
                            {tr.fromStatus}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className={`px-2 py-0.5 rounded-full border ${getStatusBadge(tr.toStatus)}`}>
                            {tr.toStatus}
                          </span>
                        </div>
                      </div>

                      {/* Right: Trigger badge and Expand Chevron */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded border text-[9px] font-bold tracking-tight ${getTriggerBadge(tr.triggeredBy)}`}>
                          {tr.triggeredBy}
                        </span>

                        <div className="flex items-center gap-1 text-[10px] text-cyan-400">
                          <span className="hidden sm:inline">{isExpanded ? 'Collapse' : 'Details'}</span>
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Collapsed Brief Reason Preview */}
                    {!isExpanded && (
                      <div className="px-3 pb-2.5 text-[11px] text-slate-400 truncate">
                        <span className="text-slate-500 mr-1.5 font-semibold">Reason:</span>
                        {tr.reason}
                      </div>
                    )}

                    {/* Expanded Forensic Dossier */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-cyan-950/80 text-xs">
                        <div className="p-2.5 rounded-lg bg-[#06080e] border border-slate-800/80 space-y-1">
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            Forensic Transition Rationale
                          </div>
                          <div className="text-slate-200 leading-relaxed">
                            {tr.reason}
                          </div>
                        </div>

                        {/* Snapshot of Telemetry at Transition Time */}
                        {tr.contextSnapshot && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            {tr.contextSnapshot.activeTask && (
                              <div className="col-span-2 p-2 rounded bg-[#06080e] border border-slate-800/80">
                                <span className="text-[10px] text-slate-500 block">TASK CONTEXT</span>
                                <span className="text-cyan-300 font-semibold truncate block">
                                  {tr.contextSnapshot.activeTask}
                                </span>
                              </div>
                            )}
                            {tr.contextSnapshot.cpuLoad !== undefined && (
                              <div className="p-2 rounded bg-[#06080e] border border-slate-800/80">
                                <span className="text-[10px] text-slate-500 block">CPU QUOTA</span>
                                <span className="text-amber-300 font-bold">
                                  {tr.contextSnapshot.cpuLoad}%
                                </span>
                              </div>
                            )}
                            {tr.contextSnapshot.ramUsedMb !== undefined && (
                              <div className="p-2 rounded bg-[#06080e] border border-slate-800/80">
                                <span className="text-[10px] text-slate-500 block">RAM USAGE</span>
                                <span className="text-purple-300 font-bold">
                                  {tr.contextSnapshot.ramUsedMb} MB
                                </span>
                              </div>
                            )}
                            {tr.contextSnapshot.batteryTempC !== undefined && (
                              <div className="p-2 rounded bg-[#06080e] border border-slate-800/80">
                                <span className="text-[10px] text-slate-500 block">SNAPDRAGON TEMP</span>
                                <span className="text-slate-200 font-bold">
                                  {tr.contextSnapshot.batteryTempC}°C
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                          <span>Transition Event ID: {tr.id}</span>
                          <span>Target Agent ID: {tr.agentId}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* DASHBOARD VIEW: OVERVIEW */}
      {(activeDashboardView === 'OVERVIEW' || activeDashboardView === 'AGENTS' || activeDashboardView === 'TASKS') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Visual Dashboard 1: Agent Status Distribution (Pie / Donut) */}
          <div className="p-3.5 rounded-xl bg-[#0f1420] border border-cyan-900/60 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                  Agent Fleet Status Distribution
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                {agents.length} AGENTS
              </span>
            </div>

            <div className="h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={agentStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {agentStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: '#0e7490',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-800 text-center text-[10px] font-mono">
              <div className="bg-[#090d16] p-1 rounded">
                <span className="text-slate-500 block">ENGAGED</span>
                <span className="text-amber-400 font-bold">
                  {agents.filter((a) => a.status === 'ENGAGED').length}
                </span>
              </div>
              <div className="bg-[#090d16] p-1 rounded">
                <span className="text-slate-500 block">ONLINE</span>
                <span className="text-emerald-400 font-bold">
                  {agents.filter((a) => a.status === 'ONLINE').length}
                </span>
              </div>
              <div className="bg-[#090d16] p-1 rounded">
                <span className="text-slate-500 block">STANDBY</span>
                <span className="text-cyan-400 font-bold">
                  {agents.filter((a) => a.status === 'STANDBY').length}
                </span>
              </div>
            </div>
          </div>

          {/* Visual Dashboard 2: Task Completion Rates & Pipeline */}
          <div className="p-3.5 rounded-xl bg-[#0f1420] border border-cyan-900/60 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-300">
                  Task Completion Pipeline & Rates
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                {taskSuccessRate}% SUCCESS
              </span>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskCompletionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={10} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: '#059669',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {taskCompletionData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-4 gap-1 pt-2 border-t border-slate-800 text-center text-[10px] font-mono">
              <div className="bg-[#090d16] p-1 rounded">
                <span className="text-slate-500 block">DONE</span>
                <span className="text-emerald-400 font-bold">{completedTasks}</span>
              </div>
              <div className="bg-[#090d16] p-1 rounded">
                <span className="text-slate-500 block">RUNNING</span>
                <span className="text-amber-400 font-bold">{runningTasks}</span>
              </div>
              <div className="bg-[#090d16] p-1 rounded">
                <span className="text-slate-500 block">QUEUED</span>
                <span className="text-cyan-400 font-bold">{queuedTasks}</span>
              </div>
              <div className="bg-[#090d16] p-1 rounded">
                <span className="text-slate-500 block">FAILED</span>
                <span className="text-red-400 font-bold">{failedTasks}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD VIEW: COMMUNICATION THROUGHPUT (Multi-line / Area Chart) */}
      {(activeDashboardView === 'OVERVIEW' || activeDashboardView === 'THROUGHPUT') && (
        <div className="p-3.5 rounded-xl bg-[#0f1420] border border-cyan-900/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                Live Communication Channels Throughput (KB/s)
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-slate-400">Aggregated:</span>
              <span className="text-cyan-300 font-bold">
                {channels.reduce((a, b) => a + b.throughputKbps, 0).toFixed(1)} KB/s
              </span>
            </div>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartThroughput} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="c2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="ipcGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="meshGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#090d16',
                    borderColor: '#0e7490',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                <Area type="monotone" name="#c2-telemetry" dataKey="c2Telemtry" stroke="#06b6d4" fill="url(#c2Grad)" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" name="#termux-ipc" dataKey="termuxIpc" stroke="#10b981" fill="url(#ipcGrad)" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" name="#agent-mesh" dataKey="agentMesh" stroke="#8b5cf6" fill="url(#meshGrad)" strokeWidth={2} isAnimationActive={false} />
                <Line type="monotone" name="#uplink" dataKey="uplink" stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* DASHBOARD VIEW: ERROR LOGS & INCIDENT ANALYTICS */}
      {(activeDashboardView === 'OVERVIEW' || activeDashboardView === 'ERRORS') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          {/* Error Incident Sources Bar Chart */}
          <div className="p-3.5 rounded-xl bg-[#0f1420] border border-cyan-900/60 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                  Subsystem Anomaly Sources
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
                {errorSources.reduce((a, b) => a + b.incidents, 0)} ANOMALIES
              </span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={errorSources} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 0 }}>
                  <XAxis type="number" stroke="#475569" fontSize={10} allowDecimals={false} />
                  <YAxis type="category" dataKey="source" stroke="#475569" fontSize={9} width={80} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: '#ef4444',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <Bar dataKey="incidents" radius={[0, 4, 4, 0]}>
                    {errorSources.map((entry, index) => (
                      <Cell key={`err-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800 text-center">
              Snapdragon thermal & Termux pts/0 IPC logs
            </div>
          </div>

          {/* Interactive Tactical Log Inspector */}
          <div className="lg:col-span-2 p-3.5 rounded-xl bg-[#0f1420] border border-cyan-900/60 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                  Interactive Event & Error Audit Stream
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between">
                {/* Search Bar */}
                <div className="relative flex-1 sm:w-44">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchLogQuery}
                    onChange={(e) => setSearchLogQuery(e.target.value)}
                    className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg pl-6 pr-2 py-0.8 text-[10px] font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none"
                  />
                </div>

                <button
                  id="telemetry-download-logs-stream-btn"
                  onClick={handleDownloadLogs}
                  className="px-2 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-[10px] font-mono flex items-center gap-1 transition-colors whitespace-nowrap"
                  title="Download current tactical log session as JSON"
                >
                  <Download className="w-3 h-3 text-cyan-400" />
                  <span className="hidden sm:inline">Download Logs</span>
                  <span className="sm:hidden">JSON</span>
                </button>

                <button
                  onClick={() => {
                    sound.click();
                    onClearLogs();
                  }}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Clear Logs Buffer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Level Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {['ALL', 'CRITICAL', 'TACTICAL', 'TOOL', 'INFO'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => {
                    sound.click();
                    setSelectedLogLevel(lvl);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap ${
                    selectedLogLevel === lvl
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Logs List */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
              {filteredLogs.length === 0 ? (
                <div className="text-slate-500 text-center py-6 text-xs font-mono">
                  No log entries matched your filter parameters.
                </div>
              ) : (
                filteredLogs.slice(0, 30).map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-[#090d16] border border-slate-900 flex items-start gap-2 text-[11px]"
                  >
                    <span className="text-slate-500 shrink-0">{log.timestamp}</span>
                    <span className={`px-1.5 py-0.2 rounded border text-[9px] font-semibold uppercase shrink-0 ${getLogLevelBadge(log.level)}`}>
                      {log.level}
                    </span>
                    <span className="text-cyan-400/90 font-semibold shrink-0">[{log.source}]</span>
                    <span className="text-slate-300 break-all">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
