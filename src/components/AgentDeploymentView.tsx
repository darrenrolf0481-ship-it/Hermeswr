import React, { useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Plus, 
  Play, 
  Pause, 
  RotateCcw, 
  Trash2, 
  Cpu, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Server,
  Zap,
  Terminal,
  Filter,
  SlidersHorizontal,
  X,
  Globe,
  Cloud,
  Code2,
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { AgentDeployment, AgentMetrics, TacticalCorrectionRecommendation } from '../types';
import { sound } from '../utils/audio';
import { activationKeyDown } from '../utils/a11y';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { 
  OPENROUTER_MODELS, 
  OLLAMA_CLOUD_MODELS, 
  HERMES_NATIVE_MODELS, 
  ALL_MODELS,
  TACTICAL_SPECIALTIES, 
  CODING_SPECIALTIES,
  detectModelProvider,
  getModelInfo,
  ModelOption
} from '../data/modelsAndSpecialties';

interface AgentDeploymentViewProps {
  agents: AgentDeployment[];
  onDeployAgent: (agent: Partial<AgentDeployment>) => Promise<void>;
  onAgentAction: (agentId: string, action: 'pause' | 'resume' | 'terminate' | 'recalibrate') => Promise<void>;
  onUpdateAgentModel?: (agentId: string, model: string, modelProvider?: 'hermes' | 'openrouter' | 'ollama') => Promise<void>;
  onSelectAgentForTask?: (agent: AgentDeployment) => void;
  agentMetrics?: AgentMetrics[];
  recommendations?: TacticalCorrectionRecommendation[];
  onApplyCorrection?: (recommendationId: string) => Promise<void>;
  onOpenCorrectionsTab?: () => void;
}

export const AgentDeploymentView: React.FC<AgentDeploymentViewProps> = ({
  agents,
  onDeployAgent,
  onAgentAction,
  onUpdateAgentModel,
  onSelectAgentForTask,
  agentMetrics = [],
  recommendations = [],
  onApplyCorrection,
  onOpenCorrectionsTab,
}) => {
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterProvider, setFilterProvider] = useState<'ALL' | 'openrouter' | 'ollama' | 'hermes'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [applyingRecId, setApplyingRecId] = useState<string | null>(null);

  const pendingRecs = recommendations.filter((r) => r.status === 'PENDING');

  // Deploy form state
  const [formName, setFormName] = useState('');
  const [formCallsign, setFormCallsign] = useState('');
  const [formProvider, setFormProvider] = useState<'hermes' | 'openrouter' | 'ollama'>('openrouter');
  const [formModel, setFormModel] = useState<string>(OPENROUTER_MODELS[0].id);
  const [customModelInput, setCustomModelInput] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [formSpecialty, setFormSpecialty] = useState(TACTICAL_SPECIALTIES[0]);
  const [formCodingSpecialty, setFormCodingSpecialty] = useState(CODING_SPECIALTIES[0]);
  const [formEnvironment, setFormEnvironment] = useState<AgentDeployment['environment']>('Termux aarch64');
  const [formPriority, setFormPriority] = useState<AgentDeployment['priority']>('P1');
  const [isDeploying, setIsDeploying] = useState(false);

  // Model Switcher Modal state for existing agent
  const [modelSwitchTargetAgent, setModelSwitchTargetAgent] = useState<AgentDeployment | null>(null);
  const [switchProvider, setSwitchProvider] = useState<'hermes' | 'openrouter' | 'ollama'>('openrouter');
  const [selectedSwitchModel, setSelectedSwitchModel] = useState<string>('');

  /** Picks a model preset for the pending hot-swap (shared by click and keyboard). */
  const selectSwitchModel = (id: string) => {
    sound.click();
    setSelectedSwitchModel(id);
  };
  const [customSwitchModel, setCustomSwitchModel] = useState('');
  const [useCustomSwitch, setUseCustomSwitch] = useState(false);
  const [isSwitchingModel, setIsSwitchingModel] = useState(false);

  const modelSwitchDialogRef = useDialogFocus<HTMLDivElement>(Boolean(modelSwitchTargetAgent), () =>
    setModelSwitchTargetAgent(null),
  );
  const deployDialogRef = useDialogFocus<HTMLDivElement>(showDeployModal, () => setShowDeployModal(false));

  const handleOpenDeploy = () => {
    sound.click();
    setFormName('');
    setFormCallsign('');
    setFormProvider('openrouter');
    setFormModel(OPENROUTER_MODELS[0].id);
    setUseCustomModel(false);
    setCustomModelInput('');
    setFormSpecialty(TACTICAL_SPECIALTIES[0]);
    setFormCodingSpecialty(CODING_SPECIALTIES[0]);
    setShowDeployModal(true);
  };

  const handleProviderChange = (provider: 'hermes' | 'openrouter' | 'ollama') => {
    sound.click();
    setFormProvider(provider);
    setUseCustomModel(false);
    if (provider === 'openrouter') {
      setFormModel(OPENROUTER_MODELS[0].id);
    } else if (provider === 'ollama') {
      setFormModel(OLLAMA_CLOUD_MODELS[0].id);
    } else {
      setFormModel(HERMES_NATIVE_MODELS[0].id);
    }
  };

  const handleSubmitDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    sound.dispatch();
    setIsDeploying(true);
    const chosenModel = useCustomModel && customModelInput.trim() ? customModelInput.trim() : formModel;
    try {
      await onDeployAgent({
        name: formName.trim(),
        callsign: formCallsign.trim() || `HERMES-${formName.trim().toUpperCase()}`,
        model: chosenModel,
        modelProvider: formProvider,
        specialty: formSpecialty,
        codingSpecialty: formCodingSpecialty,
        environment: formEnvironment,
        priority: formPriority,
      });
      setShowDeployModal(false);
      sound.toolSuccess();
    } catch {
      // Handled in parent
    } finally {
      setIsDeploying(false);
    }
  };

  // Open model switcher for specific agent
  const handleOpenModelSwitcher = (agent: AgentDeployment) => {
    sound.click();
    setModelSwitchTargetAgent(agent);
    const currentProv = agent.modelProvider || detectModelProvider(agent.model);
    setSwitchProvider(currentProv);
    setSelectedSwitchModel(agent.model);
    setUseCustomSwitch(false);
    setCustomSwitchModel('');
  };

  const handleConfirmModelSwitch = async () => {
    if (!modelSwitchTargetAgent || !onUpdateAgentModel) return;
    const finalModel = useCustomSwitch && customSwitchModel.trim() ? customSwitchModel.trim() : selectedSwitchModel;
    if (!finalModel) return;

    sound.dispatch();
    setIsSwitchingModel(true);
    try {
      await onUpdateAgentModel(modelSwitchTargetAgent.id, finalModel, switchProvider);
      sound.toolSuccess();
      setModelSwitchTargetAgent(null);
    } catch {
      // Handled in parent
    } finally {
      setIsSwitchingModel(false);
    }
  };

  const filteredAgents = agents.filter((a) => {
    if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
    
    const prov = a.modelProvider || detectModelProvider(a.model);
    if (filterProvider !== 'ALL' && prov !== filterProvider) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.callsign.toLowerCase().includes(q) ||
        a.specialty.toLowerCase().includes(q) ||
        (a.codingSpecialty && a.codingSpecialty.toLowerCase().includes(q)) ||
        a.model.toLowerCase().includes(q) ||
        prov.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusBadge = (status: AgentDeployment['status']) => {
    switch (status) {
      case 'ENGAGED':
        return 'bg-amber-950/80 text-amber-300 border-amber-600/60 animate-pulse';
      case 'ONLINE':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60';
      case 'STANDBY':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-600/60';
      case 'PAUSED':
        return 'bg-slate-900 text-slate-400 border-slate-700';
      case 'TERMINATED':
        return 'bg-red-950/80 text-red-400 border-red-800/60';
      case 'ERROR':
        return 'bg-red-900 text-red-200 border-red-500 animate-bounce';
    }
  };

  const renderModelBadge = (agent: AgentDeployment) => {
    const prov = agent.modelProvider || detectModelProvider(agent.model);
    const modelInfo = getModelInfo(agent.model);
    const displayName = modelInfo ? modelInfo.name : agent.model;

    if (prov === 'openrouter') {
      return (
        <span 
          title={`OpenRouter Model: ${agent.model}`}
          className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800/70 text-purple-200 flex items-center gap-1.5 shadow-[0_0_8px_rgba(168,85,247,0.15)]"
        >
          <Globe className="w-3 h-3 text-purple-400 shrink-0" />
          <span className="text-purple-400 font-bold uppercase text-[9px] tracking-wider">OPENROUTER:</span>
          <span className="truncate max-w-[150px]">{displayName}</span>
        </span>
      );
    }

    if (prov === 'ollama') {
      return (
        <span 
          title={`Ollama Cloud Model: ${agent.model}`}
          className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/70 text-blue-200 flex items-center gap-1.5 shadow-[0_0_8px_rgba(59,130,246,0.15)]"
        >
          <Cloud className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="text-blue-400 font-bold uppercase text-[9px] tracking-wider">OLLAMA CLOUD:</span>
          <span className="truncate max-w-[150px]">{displayName}</span>
        </span>
      );
    }

    return (
      <span 
        title={`Hermes Engine Model: ${agent.model}`}
        className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/70 text-cyan-200 flex items-center gap-1.5 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
      >
        <Cpu className="w-3 h-3 text-cyan-400 shrink-0" />
        <span className="text-cyan-400 font-bold uppercase text-[9px] tracking-wider">HERMES:</span>
        <span className="truncate max-w-[150px]">{displayName}</span>
      </span>
    );
  };

  const onlineCount = agents.filter((a) => a.status === 'ONLINE' || a.status === 'ENGAGED').length;
  const totalCompleted = agents.reduce((acc, a) => acc + a.tasksCompleted, 0);

  // Active models based on provider for deploy form
  const currentProviderModels = 
    formProvider === 'openrouter' 
      ? OPENROUTER_MODELS 
      : formProvider === 'ollama' 
        ? OLLAMA_CLOUD_MODELS 
        : HERMES_NATIVE_MODELS;

  const currentSwitchProviderModels = 
    switchProvider === 'openrouter' 
      ? OPENROUTER_MODELS 
      : switchProvider === 'ollama' 
        ? OLLAMA_CLOUD_MODELS 
        : HERMES_NATIVE_MODELS;

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-[#080a0f] text-slate-200">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-950/80">
        <div>
          <h2 className="text-base sm:text-lg font-mono font-bold text-cyan-300 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            HERMES SQUAD DEPLOYMENT & AGENT LIFECYCLE
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Provision, monitor, and command autonomous sub-agents across OpenRouter, Ollama Cloud, and Termux Hermes Engine.
          </p>
        </div>

        <button
          onClick={handleOpenDeploy}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-black font-mono text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>DEPLOY NEW AGENT</span>
        </button>
      </div>

      {/* Deployment Fleet KPI Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-[#0f1420] border border-cyan-900/60">
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>TOTAL DEPLOYED</span>
            <Users className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-cyan-300 mt-1">{agents.length}</div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">Active Hermes Instances</div>
        </div>

        <div className="p-3 rounded-xl bg-[#0f1420] border border-emerald-900/60">
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>ACTIVE / ENGAGED</span>
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-300 mt-1">{onlineCount}</div>
          <div className="text-[10px] font-mono text-emerald-500 mt-0.5">Operational readiness</div>
        </div>

        <div className="p-3 rounded-xl bg-[#0f1420] border border-purple-900/60">
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>TASKS COMPLETED</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-purple-300 mt-1">{totalCompleted}</div>
          <div className="text-[10px] font-mono text-purple-400 mt-0.5">Across all squad agents</div>
        </div>

        <div className="p-3 rounded-xl bg-[#0f1420] border border-amber-900/60">
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>AVG AGENT HEALTH</span>
            <Activity className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-amber-300 mt-1">
            {agents.length > 0 ? Math.round(agents.reduce((a, b) => a + b.health, 0) / agents.length) : 100}%
          </div>
          <div className="text-[10px] font-mono text-amber-400 mt-0.5">Subsystem nominal</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 p-3 rounded-xl bg-[#0b0f17] border border-cyan-950">
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {/* Status filters */}
          <div className="flex items-center gap-1 bg-[#080b12] p-1 rounded-lg border border-slate-800">
            {['ALL', 'ONLINE', 'ENGAGED', 'STANDBY', 'PAUSED'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  sound.click();
                  setFilterStatus(status);
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors whitespace-nowrap ${
                  filterStatus === status
                    ? 'bg-cyan-500 text-black font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Provider filters */}
          <div className="flex items-center gap-1 bg-[#080b12] p-1 rounded-lg border border-slate-800">
            {[
              { id: 'ALL', label: 'All Models' },
              { id: 'openrouter', label: 'OpenRouter' },
              { id: 'ollama', label: 'Ollama Cloud' },
              { id: 'hermes', label: 'Hermes' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  sound.click();
                  setFilterProvider(p.id as any);
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors whitespace-nowrap ${
                  filterProvider === p.id
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full md:w-72">
          <input
            type="text"
            aria-label="Search agents by callsign, model, tactical and coding specialty"
            placeholder="Search callsign, model, tactical & coding..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#070a10] border border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredAgents.map((agent) => {
          const isTermux = agent.environment.includes('Termux');
          return (
            <div
              key={agent.id}
              className="p-4 rounded-xl bg-[#0f1420] border border-cyan-900/50 hover:border-cyan-700/60 transition-all flex flex-col justify-between space-y-3 relative group"
            >
              {/* Agent Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-cyan-200">
                        {agent.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        {agent.priority}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-cyan-400/80 mt-0.5">
                      {agent.callsign}
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-semibold ${getStatusBadge(agent.status)}`}>
                    {agent.status}
                  </span>
                </div>

                {/* Tactical Specialty */}
                <div className="mt-2.5 text-xs font-mono text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-slate-400 text-[10px] uppercase font-bold">TACTICAL:</span>
                  <span className="font-semibold text-slate-200 truncate">{agent.specialty}</span>
                </div>

                {/* Tactical Below Specialty: Coding Specialty */}
                <div className="mt-1.5 text-xs font-mono text-emerald-300 flex items-center gap-1.5 bg-[#080c14] px-2 py-1 rounded-lg border border-cyan-950/80">
                  <Code2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-emerald-500/80 text-[10px] uppercase font-bold">CODE:</span>
                  <span className="font-medium text-emerald-200 truncate">
                    {agent.codingSpecialty || 'Python Termux Daemons & Async Sockets'}
                  </span>
                </div>

                {/* Model & Environment Badges */}
                <div className="flex items-center justify-between gap-2 mt-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {renderModelBadge(agent)}
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      isTermux 
                        ? 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300' 
                        : 'bg-blue-950/70 border-blue-800/60 text-blue-300'
                    }`}>
                      {agent.environment}
                    </span>
                  </div>

                  {/* Hot-Swap Model Button for each agent */}
                  {onUpdateAgentModel && (
                    <button
                      onClick={() => handleOpenModelSwitcher(agent)}
                      className="px-2 py-1 rounded bg-slate-800/90 hover:bg-cyan-950 border border-slate-700 hover:border-cyan-700 text-cyan-300 text-[10px] font-mono flex items-center gap-1 transition-colors"
                      title="Hot-swap model provider or variant for this agent"
                    >
                      <SlidersHorizontal className="w-2.5 h-2.5 text-cyan-400" />
                      <span>CONFIG MODEL</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Active Task snippet if engaged */}
              {agent.currentTask && (
                <div className="p-2 rounded-lg bg-[#07090f] border border-amber-900/50 text-[11px] font-mono text-amber-200">
                  <span className="text-amber-500 font-bold block text-[9px] uppercase">Active Task Directive</span>
                  {agent.currentTask}
                </div>
              )}

              {/* Telemetry Vitals Mini-bars */}
              <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80 text-[11px] font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400" /> Health
                  </span>
                  <span className="text-emerald-300 font-bold">{agent.health}%</span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-cyan-400" /> Memory / Quota
                  </span>
                  <span className="text-cyan-300">{agent.memoryUsageMb}MB / {agent.cpuQuotaPct}% CPU</span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-purple-400" /> Completed
                  </span>
                  <span className="text-purple-300">{agent.tasksCompleted} tasks</span>
                </div>

                {(() => {
                  const metric = agentMetrics.find((m) => m.agentId === agent.id);
                  const rec = pendingRecs.find((r) => r.agentId === agent.id);
                  return (
                    <>
                      {metric && (
                        <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3 text-cyan-400" /> Success Rate
                          </span>
                          <span className={`font-bold ${metric.successRatePct < 75 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {metric.successRatePct}% ({metric.tasksCompleted}/{metric.tasksCompleted + metric.tasksFailed})
                          </span>
                        </div>
                      )}

                      {rec && (
                        <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/70 text-xs font-mono space-y-2 mt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-amber-300 font-bold flex items-center gap-1.5 text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                              TACTICAL CORRECTION READY
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold">
                              {rec.successRatePct}% Success
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-300">
                            Suggested Toolchain: <span className="text-cyan-300 font-bold">[{rec.suggestedToolchain.join(', ')}]</span>
                          </p>
                          <div className="flex items-center gap-1.5">
                            {onOpenCorrectionsTab && (
                              <button
                                onClick={onOpenCorrectionsTab}
                                className="flex-1 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono transition-colors"
                              >
                                Inspect
                              </button>
                            )}
                            {onApplyCorrection && (
                              <button
                                onClick={async () => {
                                  sound.dispatch();
                                  setApplyingRecId(rec.id);
                                  await onApplyCorrection(rec.id);
                                  setApplyingRecId(null);
                                  sound.toolSuccess();
                                }}
                                disabled={applyingRecId === rec.id}
                                className="flex-1 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[10px] font-mono font-bold flex items-center justify-center gap-1"
                              >
                                <Zap className="w-3 h-3 fill-current" />
                                {applyingRecId === rec.id ? 'Applying...' : '⚡ Reconfigure'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-cyan-950/60">
                {agent.status === 'ONLINE' || agent.status === 'ENGAGED' ? (
                  <button
                    onClick={() => {
                      sound.click();
                      onAgentAction(agent.id, 'pause');
                    }}
                    className="flex-1 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-300 text-[10px] font-mono flex items-center justify-center gap-1 transition-colors"
                    title="Pause Agent Process"
                  >
                    <Pause className="w-3 h-3" />
                    PAUSE
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      sound.click();
                      onAgentAction(agent.id, 'resume');
                    }}
                    className="flex-1 py-1.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 text-[10px] font-mono flex items-center justify-center gap-1 transition-colors"
                    title="Resume Agent Process"
                  >
                    <Play className="w-3 h-3" />
                    RESUME
                  </button>
                )}

                <button
                  onClick={() => {
                    sound.click();
                    onAgentAction(agent.id, 'recalibrate');
                  }}
                  className="py-1.5 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 text-[10px] font-mono transition-colors"
                  title="Recalibrate Agent Subsystems"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>

                <button
                  onClick={() => {
                    sound.alert();
                    onAgentAction(agent.id, 'terminate');
                  }}
                  className="py-1.5 px-2 rounded bg-slate-900 hover:bg-red-950 border border-slate-700 hover:border-red-700 text-slate-400 hover:text-red-300 text-[10px] font-mono transition-colors"
                  title="Terminate Agent"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Model Hot-Swap Modal for Existing Agent */}
      {modelSwitchTargetAgent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div
            ref={modelSwitchDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-switch-dialog-title"
            tabIndex={-1}
            className="w-full max-w-lg bg-[#0d121c] border border-cyan-600 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.3)] p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 id="model-switch-dialog-title" className="font-mono font-bold text-cyan-300 text-sm sm:text-base">
                    RECONFIGURE MODEL: {modelSwitchTargetAgent.callsign}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Hot-swap inference model provider and parameters without terminating agent state.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModelSwitchTargetAgent(null)}
                aria-label="Close model reconfigure dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Provider Tabs */}
            <div className="space-y-1.5">
              <label className="text-slate-400 text-xs font-mono block">Select Inference Provider</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sound.click();
                    setSwitchProvider('openrouter');
                    setSelectedSwitchModel(OPENROUTER_MODELS[0].id);
                    setUseCustomSwitch(false);
                  }}
                  className={`p-2 rounded-xl border text-xs font-mono flex flex-col items-center gap-1 transition-all ${
                    switchProvider === 'openrouter'
                      ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                      : 'bg-[#080b12] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Globe className="w-4 h-4 text-purple-400" />
                  <span className="font-bold text-[11px]">OpenRouter</span>
                  <span className="text-[9px] text-purple-400/80">Cloud Frontier</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.click();
                    setSwitchProvider('ollama');
                    setSelectedSwitchModel(OLLAMA_CLOUD_MODELS[0].id);
                    setUseCustomSwitch(false);
                  }}
                  className={`p-2 rounded-xl border text-xs font-mono flex flex-col items-center gap-1 transition-all ${
                    switchProvider === 'ollama'
                      ? 'bg-blue-950/80 border-blue-500 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
                      : 'bg-[#080b12] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Cloud className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-[11px]">Ollama Cloud</span>
                  <span className="text-[9px] text-blue-400/80">Remote Cluster</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.click();
                    setSwitchProvider('hermes');
                    setSelectedSwitchModel(HERMES_NATIVE_MODELS[0].id);
                    setUseCustomSwitch(false);
                  }}
                  className={`p-2 rounded-xl border text-xs font-mono flex flex-col items-center gap-1 transition-all ${
                    switchProvider === 'hermes'
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                      : 'bg-[#080b12] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-[11px]">Hermes Engine</span>
                  <span className="text-[9px] text-cyan-400/80">Termux aarch64</span>
                </button>
              </div>
            </div>

            {/* Model Presets List */}
            {!useCustomSwitch ? (
              <div className="space-y-2">
                <label className="text-slate-400 text-xs font-mono block">Available {switchProvider === 'openrouter' ? 'OpenRouter' : switchProvider === 'ollama' ? 'Ollama Cloud' : 'Hermes'} Models</label>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {currentSwitchProviderModels.map((m) => (
                    <div
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selectedSwitchModel === m.id}
                      onClick={() => selectSwitchModel(m.id)}
                      onKeyDown={activationKeyDown(() => selectSwitchModel(m.id))}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                        selectedSwitchModel === m.id
                          ? 'bg-cyan-950/60 border-cyan-500 text-slate-100 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                          : 'bg-[#080b12] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-cyan-300">{m.name}</span>
                        {m.contextLength && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {m.contextLength} ctx
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono">{m.description}</p>
                      {m.recommendedRole && (
                        <div className="text-[10px] text-cyan-400/80 mt-1 font-mono flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Role: {m.recommendedRole}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-slate-400 text-xs font-mono block">Custom Model Tag / Identifier</label>
                <input
                  type="text"
                  placeholder={switchProvider === 'openrouter' ? 'e.g. meta-llama/llama-3.2-3b-instruct' : 'e.g. user/my-coding-model:latest'}
                  value={customSwitchModel}
                  onChange={(e) => setCustomSwitchModel(e.target.value)}
                  className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg p-2.5 text-slate-100 text-xs font-mono placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            )}

            {/* Custom Model Toggle */}
            <div className="flex items-center justify-between text-xs font-mono pt-1 text-slate-400">
              <label className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomSwitch}
                  onChange={(e) => setUseCustomSwitch(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span>Specify Custom Model String</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-cyan-950">
              <button
                type="button"
                onClick={() => setModelSwitchTargetAgent(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isSwitchingModel}
                onClick={handleConfirmModelSwitch}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs font-mono flex items-center gap-1.5 transition-colors shadow-[0_0_12px_rgba(6,182,212,0.3)]"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isSwitchingModel ? 'HOT-SWAPPING...' : 'APPLY MODEL HOT-SWAP'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deploy Agent Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div
            ref={deployDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deploy-dialog-title"
            tabIndex={-1}
            className="w-full max-w-xl bg-[#0d121c] border border-cyan-700 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.25)] p-4 sm:p-5 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 id="deploy-dialog-title" className="font-mono font-bold text-cyan-300 text-sm sm:text-base">
                    DEPLOY AUTONOMOUS HERMES SUB-AGENT
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Configure inference provider, tactical specialty, and coding domain.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeployModal(false)}
                aria-label="Close deploy agent dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitDeploy} className="space-y-4 text-xs font-mono">
              {/* Agent Name & Callsign */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="deploy-agent-name" className="text-slate-400 block mb-1">Agent Name *</label>
                  <input
                    id="deploy-agent-name"
                    type="text"
                    required
                    placeholder="e.g. Echo, Sentinel, Phantom"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg p-2 text-slate-100 placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="deploy-agent-callsign" className="text-slate-400 block mb-1">Tactical Callsign</label>
                  <input
                    id="deploy-agent-callsign"
                    type="text"
                    placeholder="e.g. HERMES-ECHO"
                    value={formCallsign}
                    onChange={(e) => setFormCallsign(e.target.value)}
                    className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg p-2 text-slate-100 placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Inference Engine / Provider Selector */}
              <div className="space-y-1.5">
                <label className="text-slate-400 block font-bold text-cyan-300">
                  Select Inference Provider & Architecture
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleProviderChange('openrouter')}
                    className={`p-2.5 rounded-xl border text-xs font-mono flex flex-col items-center gap-1 transition-all ${
                      formProvider === 'openrouter'
                        ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                        : 'bg-[#080b12] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-[11px]">OpenRouter</span>
                    <span className="text-[9px] text-purple-400/80">Frontier Cloud</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleProviderChange('ollama')}
                    className={`p-2.5 rounded-xl border text-xs font-mono flex flex-col items-center gap-1 transition-all ${
                      formProvider === 'ollama'
                        ? 'bg-blue-950/80 border-blue-500 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
                        : 'bg-[#080b12] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Cloud className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-[11px]">Ollama Cloud</span>
                    <span className="text-[9px] text-blue-400/80">Remote Cluster</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleProviderChange('hermes')}
                    className={`p-2.5 rounded-xl border text-xs font-mono flex flex-col items-center gap-1 transition-all ${
                      formProvider === 'hermes'
                        ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                        : 'bg-[#080b12] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-[11px]">Hermes Engine</span>
                    <span className="text-[9px] text-cyan-400/80">Snapdragon aarch64</span>
                  </button>
                </div>
              </div>

              {/* Model Selection Dropdown */}
              {!useCustomModel ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="deploy-agent-model" className="text-slate-400">
                      {formProvider === 'openrouter' 
                        ? 'OpenRouter Model Variant' 
                        : formProvider === 'ollama' 
                          ? 'Ollama Cloud Model Variant' 
                          : 'Hermes Engine Model Variant'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setUseCustomModel(true)}
                      className="text-[10px] text-cyan-400 hover:underline py-1.5"
                    >
                      + Custom Model ID
                    </button>
                  </div>
                  <select
                    id="deploy-agent-model"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg p-2.5 text-slate-200 focus:outline-none font-mono"
                  >
                    {currentProviderModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.contextLength || 'standard'}) - {m.recommendedRole || ''}
                      </option>
                    ))}
                  </select>
                  {/* Selected model details snippet */}
                  {getModelInfo(formModel) && (
                    <div className="mt-1.5 p-2 rounded bg-[#070a10] border border-cyan-950 text-[11px] text-slate-400 flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-300 font-semibold">{getModelInfo(formModel)?.name}: </span>
                        {getModelInfo(formModel)?.description}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="deploy-agent-custom-model" className="text-slate-400">Custom Model Identifier</label>
                    <button
                      type="button"
                      onClick={() => setUseCustomModel(false)}
                      className="text-[10px] text-cyan-400 hover:underline py-1.5"
                    >
                      Back to Preset List
                    </button>
                  </div>
                  <input
                    id="deploy-agent-custom-model"
                    type="text"
                    placeholder={formProvider === 'openrouter' ? 'e.g. meta-llama/llama-3.2-3b-instruct' : 'e.g. deepseek-coder-v2:16b'}
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              )}

              {/* Tactical Specialty */}
              <div>
                <label className="text-slate-400 block mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    Tactical Specialty
                  </span>
                  <span className="text-[10px] text-slate-500">Field Operations</span>
                </label>
                <select
                  aria-label="Tactical specialty"
                  value={formSpecialty}
                  onChange={(e) => setFormSpecialty(e.target.value)}
                  className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg p-2 text-slate-200 focus:outline-none"
                >
                  {TACTICAL_SPECIALTIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* TACTICAL BELOW SPECIALTY: Coding Specialty */}
              <div>
                <label className="text-slate-400 block mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-emerald-300 font-bold">
                    <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                    Coding Specialty (Software & Termux Engineering)
                  </span>
                  <span className="text-[10px] text-emerald-400/80">Codebase Discipline</span>
                </label>
                <select
                  aria-label="Coding specialty"
                  value={formCodingSpecialty}
                  onChange={(e) => setFormCodingSpecialty(e.target.value)}
                  className="w-full bg-[#080b12] border border-slate-800 focus:border-emerald-500 rounded-lg p-2 text-slate-200 focus:outline-none"
                >
                  {CODING_SPECIALTIES.map((cs) => (
                    <option key={cs} value={cs}>{cs}</option>
                  ))}
                </select>
              </div>

              {/* Environment and Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="deploy-agent-sandbox" className="text-slate-400 block mb-1">Execution Sandbox</label>
                  <select
                    id="deploy-agent-sandbox"
                    value={formEnvironment}
                    onChange={(e) => setFormEnvironment(e.target.value as any)}
                    className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg p-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Termux aarch64">Termux aarch64 (Local Snapdragon 5G)</option>
                    <option value="Cloud Sandbox">Cloud Sandbox (Node / Python Container)</option>
                    <option value="Hybrid Mesh">Hybrid Mesh (Termux + Cloud Relay)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="deploy-agent-priority" className="text-slate-400 block mb-1">Priority Level</label>
                  <select
                    id="deploy-agent-priority"
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg p-2 text-slate-200 focus:outline-none"
                  >
                    <option value="P0">P0 - Critical Autonomous Response</option>
                    <option value="P1">P1 - High Operational Focus</option>
                    <option value="P2">P2 - Standard Background Polling</option>
                  </select>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#070a10] border border-cyan-950 text-[11px] text-slate-400">
                <span className="text-cyan-400 font-bold">Auto-Registration:</span> The agent will bind to the War Room C2 bus with access to <code className="text-amber-300">termux_shell</code>, <code className="text-purple-300">vector_memory</code>, and selected inference pipeline.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeployModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isDeploying}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isDeploying ? 'PROVISIONING...' : 'CONFIRM DEPLOYMENT'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
