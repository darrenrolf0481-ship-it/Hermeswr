import React, { useState } from 'react';
import {
  Wrench,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  ArrowRight,
  Cpu,
  Clock,
  Terminal,
  Layers,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Flame,
  Check,
  X,
  Radio,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  TacticalCorrectionRecommendation, 
  TacticalCorrectionConfig, 
  AgentMetrics, 
  AgentDeployment 
} from '../types';
import { sound } from '../utils/audio';

interface TacticalCorrectionPanelProps {
  recommendations: TacticalCorrectionRecommendation[];
  config: TacticalCorrectionConfig;
  agentMetrics: AgentMetrics[];
  agents: AgentDeployment[];
  onApplyCorrection: (recommendationId: string) => Promise<void>;
  onDismissCorrection: (recommendationId: string) => Promise<void>;
  onUpdateConfig: (updates: Partial<TacticalCorrectionConfig>) => Promise<void>;
  onSimulateFailure: (agentId: string, failureType: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onTriggerEvaluation?: () => Promise<void>;
}

export const TacticalCorrectionPanel: React.FC<TacticalCorrectionPanelProps> = ({
  recommendations,
  config,
  agentMetrics,
  agents,
  onApplyCorrection,
  onDismissCorrection,
  onUpdateConfig,
  onSimulateFailure,
  onRefresh,
  onTriggerEvaluation,
}) => {
  const [selectedAgentForSim, setSelectedAgentForSim] = useState(agents[0]?.id || 'agent-alpha');
  const [simFailureType, setSimFailureType] = useState('tool_timeout');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isApplyingId, setIsApplyingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'metrics' | 'history'>('recommendations');

  const pendingRecommendations = recommendations.filter((r) => r.status === 'PENDING');
  const historyRecommendations = recommendations.filter((r) => r.status !== 'PENDING');

  const handleApply = async (id: string) => {
    sound.dispatch();
    setIsApplyingId(id);
    try {
      await onApplyCorrection(id);
      sound.toolSuccess();
    } finally {
      setIsApplyingId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    sound.click();
    await onDismissCorrection(id);
  };

  const handleSimulate = async () => {
    sound.alert();
    setIsSimulating(true);
    try {
      await onSimulateFailure(selectedAgentForSim, simFailureType);
      sound.toolSuccess();
    } finally {
      setIsSimulating(false);
    }
  };

  const getMetricBadge = (status: AgentMetrics['status']) => {
    switch (status) {
      case 'CRITICAL_DEGRADED':
        return 'bg-red-950/80 text-red-300 border-red-700 animate-pulse';
      case 'WARNING':
        return 'bg-amber-950/80 text-amber-300 border-amber-700';
      case 'HEALTHY':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-700';
    }
  };

  const thresholdOptions = [60, 70, 75, 80, 85];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070a10] text-slate-100 overflow-y-auto p-3 sm:p-5 space-y-4">
      {/* Top Tactical Banner */}
      <div className="bg-gradient-to-r from-[#0c1424] via-[#0f172a] to-[#0c1424] border border-cyan-800/60 rounded-2xl p-4 sm:p-5 shadow-[0_0_24px_rgba(6,182,212,0.15)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/90 border border-cyan-700 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)] shrink-0">
            <Wrench className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-mono font-bold text-cyan-200 tracking-wide">
                TACTICAL CORRECTION & TOOLCHAIN RECONFIGURATION SERVICE
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/80">
                C2 SENTINEL ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Monitors agent directive failures, measures operational success rate against threshold (
              <span className="text-cyan-300 font-bold">{config.failureThresholdPct}%</span>), and dynamically
              synthesizes optimized toolchain topologies and model tiers to restore fleet readiness.
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <button
            onClick={() => {
              sound.click();
              onRefresh();
            }}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 transition-colors"
            title="Refresh Telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {onTriggerEvaluation && (
            <button
              onClick={() => {
                sound.click();
                onTriggerEvaluation();
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 text-xs font-mono transition-colors flex items-center gap-1.5"
              title="Run Autonomous C2 Evaluation Now"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              EVALUATE NOW
            </button>
          )}

          <button
            onClick={() => {
              sound.click();
              onUpdateConfig({ autoApplyEnabled: !config.autoApplyEnabled });
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 transition-all ${
              config.autoApplyEnabled
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${config.autoApplyEnabled ? 'text-cyan-400 fill-cyan-400' : ''}`} />
            AUTO-HEAL: {config.autoApplyEnabled ? 'ACTIVE (ON)' : 'MANUAL REVIEW (OFF)'}
          </button>
        </div>
      </div>

      {/* Threshold Configuration HUD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Trigger Threshold Selector */}
        <div className="bg-[#0b101b] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              SUCCESS RATE THRESHOLD
            </span>
            <span className="text-sm font-mono font-bold text-cyan-300">
              {config.failureThresholdPct}%
            </span>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            {thresholdOptions.map((th) => (
              <button
                key={th}
                onClick={() => {
                  sound.click();
                  onUpdateConfig({ failureThresholdPct: th });
                }}
                className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                  config.failureThresholdPct === th
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {th}%
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-2 font-mono">
            Trigger correction if agent completed-to-failed ratio falls below this rate.
          </p>
        </div>

        {/* Self-Healing Options */}
        <div className="bg-[#0b101b] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            AUTONOMOUS DIRECTIVE RESILIENCE
          </span>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-slate-300">
              <input
                type="checkbox"
                checked={config.autoRetryFailedTasks}
                onChange={(e) => {
                  sound.click();
                  onUpdateConfig({ autoRetryFailedTasks: e.target.checked });
                }}
                className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Auto-re-queue failed tasks upon reconfiguration</span>
            </label>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
              <span>Min directives evaluated:</span>
              <span className="text-cyan-300 font-bold">{config.minTasksForEvaluation} tasks</span>
            </div>
          </div>
        </div>

        {/* Failure Simulation Sandbox */}
        <div className="bg-[#0b101b] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 mb-2">
            <Flame className="w-3.5 h-3.5 text-red-400" />
            STRESS-TEST FAILURE INJECTION
          </span>
          <div className="flex items-center gap-2">
            <select
              value={selectedAgentForSim}
              onChange={(e) => setSelectedAgentForSim(e.target.value)}
              className="flex-1 bg-[#080b12] border border-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.callsign} ({a.name})
                </option>
              ))}
            </select>
            <select
              value={simFailureType}
              onChange={(e) => setSimFailureType(e.target.value)}
              className="flex-1 bg-[#080b12] border border-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="tool_timeout">POSIX Shell Timeout</option>
              <option value="permission_denied">Socket Permission</option>
              <option value="vector_oom">Vector Memory OOM</option>
            </select>
          </div>
          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="w-full mt-2 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {isSimulating ? 'INJECTING DIRECTIVE FAILURE...' : 'INJECT TASK FAILURE (TEST TRIGGER)'}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => {
            sound.click();
            setActiveTab('recommendations');
          }}
          className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'recommendations'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          ACTIVE RECONFIGURATIONS ({pendingRecommendations.length})
        </button>

        <button
          onClick={() => {
            sound.click();
            setActiveTab('metrics');
          }}
          className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'metrics'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          FLEET SUCCESS METRICS ({agentMetrics.length})
        </button>

        <button
          onClick={() => {
            sound.click();
            setActiveTab('history');
          }}
          className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          CORRECTION AUDIT LOG ({historyRecommendations.length})
        </button>
      </div>

      {/* Tab Content 1: Recommendations */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          {pendingRecommendations.length === 0 ? (
            <div className="bg-[#0b101b] border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className="p-3 rounded-full bg-emerald-950/60 border border-emerald-700 text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-mono text-base font-bold text-slate-200">
                ALL AGENTS OPERATING WITHIN HEALTHY THRESHOLDS
              </h3>
              <p className="text-xs text-slate-400 max-w-md">
                No active toolchain breaches detected. Fleet directive success rate is currently above {config.failureThresholdPct}%.
                Use the failure injection sandbox above if you wish to stress-test automated recovery.
              </p>
            </div>
          ) : (
            pendingRecommendations.map((rec) => (
              <div
                key={rec.id}
                className="bg-[#0d1322] border border-amber-500/70 rounded-2xl p-4 sm:p-5 shadow-[0_0_25px_rgba(245,158,11,0.15)] space-y-4"
              >
                {/* Alert Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-amber-950/80 border border-amber-600 text-amber-400">
                      <AlertTriangle className="w-5 h-5 animate-pulse" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-mono font-bold text-amber-300">
                          {rec.agentCallsign} ({rec.agentName})
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-950 text-red-300 border border-red-700">
                          SUCCESS RATE: {rec.successRatePct}% (THRESHOLD: {rec.thresholdPct}%)
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{rec.triggerReason}</p>
                    </div>
                  </div>

                  <div className="text-right text-[11px] font-mono text-slate-500 shrink-0">
                    ID: {rec.id}
                  </div>
                </div>

                {/* Detected Issues Diagnostic Badges */}
                <div>
                  <span className="text-[11px] font-mono text-slate-400 block mb-1.5">
                    DETECTED FAILURE VECTORS & BOTTLENECKS:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {rec.detectedIssues.map((issue, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded bg-red-950/60 border border-red-800/80 text-red-300 text-[11px] font-mono flex items-center gap-1.5"
                      >
                        <X className="w-3 h-3 text-red-400" />
                        {issue}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Side-by-side Toolchain & Architecture Diff */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Current Configuration */}
                  <div className="bg-[#080b12] border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-1 border-b border-slate-800">
                      <span>PREVIOUS CONFIGURATION</span>
                      <span className="text-red-400 font-bold">DEGRADED</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 font-mono block">TOOLCHAIN:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rec.currentToolchain.map((tool) => (
                          <span
                            key={tool}
                            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-xs font-mono"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs font-mono space-y-1 pt-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Model:</span>
                        <span className="text-slate-300">{rec.currentModel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Specialty:</span>
                        <span className="text-slate-300">{rec.currentSpecialty}</span>
                      </div>
                    </div>
                  </div>

                  {/* Suggested Optimized Configuration */}
                  <div className="bg-[#09111e] border border-cyan-700/80 rounded-xl p-3 space-y-2 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                    <div className="flex items-center justify-between text-xs font-mono text-cyan-300 pb-1 border-b border-cyan-800/60">
                      <span className="flex items-center gap-1 font-bold">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        OPTIMIZED TACTICAL RECONFIGURATION
                      </span>
                      <span className="text-emerald-400 font-bold">RECOMMENDED</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-cyan-400/80 font-mono block">UPGRADED TOOLCHAIN:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rec.suggestedToolchain.map((tool) => (
                          <span
                            key={tool}
                            className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-600 text-cyan-200 text-xs font-mono font-bold flex items-center gap-1 shadow-[0_0_6px_rgba(6,182,212,0.2)]"
                          >
                            <Check className="w-3 h-3 text-cyan-400" />
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs font-mono space-y-1 pt-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Target Model:</span>
                        <span className="text-cyan-300 font-bold truncate max-w-[200px]" title={rec.suggestedModel}>
                          {rec.suggestedModel}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Target Specialty:</span>
                        <span className="text-cyan-300 font-bold">{rec.suggestedSpecialty}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tuning Enhancements */}
                <div className="bg-[#080d17] border border-slate-800 rounded-xl p-3">
                  <span className="text-[11px] font-mono text-slate-400 block mb-1.5">
                    DYNAMIC TUNING & RESOURCE ALLOCATION ADJUSTMENTS:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">TIMEOUT LIMIT</span>
                      <span className="text-cyan-300 font-bold">{rec.suggestedTuning.toolTimeoutMs || 25000} ms</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">CPU CORE QUOTA</span>
                      <span className="text-cyan-300 font-bold">{rec.suggestedTuning.cpuQuotaPct || 35}%</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">RETRY BUFFER</span>
                      <span className="text-cyan-300 font-bold">{rec.suggestedTuning.autoRetryAttempts || 3} Attempts</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">EXECUTION PRIORITY</span>
                      <span className="text-cyan-300 font-bold">{rec.suggestedTuning.priority || 'P0'} Critical</span>
                    </div>
                  </div>
                </div>

                {/* Technical Rationale Summary */}
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-900/50 text-xs font-mono text-slate-300 leading-relaxed">
                  <span className="text-cyan-400 font-bold block mb-0.5">ENGINEERING RATIONALE:</span>
                  {rec.optimizationSummary}
                </div>

                {/* Actions Footer */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                  <button
                    onClick={() => handleDismiss(rec.id)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-mono transition-colors"
                  >
                    DISMISS RECOMMENDATION
                  </button>

                  <button
                    onClick={() => handleApply(rec.id)}
                    disabled={isApplyingId === rec.id}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-slate-950 text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    {isApplyingId === rec.id
                      ? 'DEPLOYING RECONFIGURATION...'
                      : '⚡ EXECUTE TACTICAL RECONFIGURATION'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content 2: Fleet Metrics */}
      {activeTab === 'metrics' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {agentMetrics.map((metric) => (
              <div
                key={metric.agentId}
                className="bg-[#0b101b] border border-slate-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div>
                    <h4 className="font-mono font-bold text-slate-200 text-sm">
                      {metric.agentCallsign}
                    </h4>
                    <span className="text-[11px] text-slate-500 font-mono">{metric.agentName}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${getMetricBadge(metric.status)}`}>
                    {metric.status}
                  </span>
                </div>

                {/* Progress bar gauge */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Success Rate:</span>
                    <span className={`font-bold ${
                      metric.successRatePct < config.failureThresholdPct ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {metric.successRatePct}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        metric.successRatePct < config.failureThresholdPct
                          ? 'bg-red-500'
                          : metric.successRatePct < 85
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${metric.successRatePct}%` }}
                    />
                  </div>
                </div>

                {/* Directive counts */}
                <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-mono">
                  <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">COMPLETED</span>
                    <span className="text-emerald-400 font-bold">{metric.tasksCompleted}</span>
                  </div>
                  <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">FAILED</span>
                    <span className="text-red-400 font-bold">{metric.tasksFailed}</span>
                  </div>
                  <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">TOTAL</span>
                    <span className="text-slate-300 font-bold">{metric.tasksTotal}</span>
                  </div>
                </div>

                {metric.failingTools.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block mb-1">FAILING TOOLS:</span>
                    <div className="flex flex-wrap gap-1">
                      {metric.failingTools.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800 text-[10px] font-mono">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {metric.lastFailureReason && (
                  <div className="p-2 rounded bg-red-950/30 border border-red-900/40 text-[11px] font-mono text-red-300/90 line-clamp-2">
                    {metric.lastFailureReason}
                  </div>
                )}

                <button
                  onClick={() => {
                    sound.click();
                    onSimulateFailure(metric.agentId, 'tool_timeout');
                  }}
                  className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-red-300 text-xs font-mono transition-colors flex items-center justify-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  Test Failure on {metric.agentCallsign}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 3: Historical Audit Log */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {historyRecommendations.length === 0 ? (
            <div className="bg-[#0b101b] border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs font-mono">
              No historical reconfigurations recorded in this deployment session.
            </div>
          ) : (
            historyRecommendations.map((rec) => (
              <div
                key={rec.id}
                className="bg-[#0b101b] border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs font-mono"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      rec.status === 'APPLIED' || rec.status === 'AUTO_APPLIED'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}>
                      {rec.status}
                    </span>
                    <span className="font-bold text-slate-200">
                      {rec.agentCallsign} ({rec.agentName})
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {rec.appliedAt ? new Date(rec.appliedAt).toLocaleTimeString() : rec.createdAt}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-slate-300">
                  <span className="text-slate-500">Toolchain:</span>
                  <span className="line-through text-slate-500">[{rec.currentToolchain.join(', ')}]</span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-cyan-300 font-bold">[{rec.suggestedToolchain.join(', ')}]</span>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-slate-500">Model:</span>
                  <span className="text-slate-300">{rec.suggestedModel}</span>
                </div>

                {rec.appliedResult && (
                  <p className="text-[11px] text-emerald-400/90 pt-1 border-t border-slate-800/80">
                    {rec.appliedResult}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
