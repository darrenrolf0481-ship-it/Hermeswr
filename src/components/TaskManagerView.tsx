import React, { useState } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Play, 
  Pause, 
  RotateCcw, 
  XCircle, 
  Clock, 
  Zap, 
  Terminal, 
  ShieldAlert, 
  CheckCircle2, 
  Flame, 
  Sliders,
  ChevronDown,
  ChevronRight,
  X,
  Code,
  Wrench,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { AgentTask, AgentDeployment, TacticalCorrectionRecommendation } from '../types';
import { sound } from '../utils/audio';

interface TaskManagerViewProps {
  tasks: AgentTask[];
  agents: AgentDeployment[];
  onCreateTask: (task: Partial<AgentTask>) => Promise<void>;
  onTaskAction: (taskId: string, action: 'run' | 'pause' | 'retry' | 'abort' | 'fail') => Promise<void>;
  recommendations?: TacticalCorrectionRecommendation[];
  onApplyCorrection?: (recommendationId: string) => Promise<void>;
  onOpenCorrectionsTab?: () => void;
}

export const TaskManagerView: React.FC<TaskManagerViewProps> = ({
  tasks,
  agents,
  onCreateTask,
  onTaskAction,
  recommendations = [],
  onApplyCorrection,
  onOpenCorrectionsTab,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [applyingRecId, setApplyingRecId] = useState<string | null>(null);

  const pendingRecs = recommendations.filter((r) => r.status === 'PENDING');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<AgentTask['priority']>('P1_HIGH');
  const [formAgentId, setFormAgentId] = useState(agents[0]?.id || '');
  const [formTools, setFormTools] = useState<string[]>(['termux_shell']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableTools = [
    { id: 'termux_shell', label: 'termux_shell (CLI)' },
    { id: 'code_interpreter', label: 'code_interpreter (Python)' },
    { id: 'vector_memory', label: 'vector_memory (RAG)' },
    { id: 'multimodal_vision', label: 'multimodal_vision (Stylus)' },
  ];

  const handleToggleTool = (toolId: string) => {
    sound.click();
    setFormTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    sound.dispatch();
    setIsSubmitting(true);
    try {
      await onCreateTask({
        title: formTitle.trim(),
        description: formDescription.trim() || 'Autonomous directive executed via War Room.',
        priority: formPriority,
        assignedAgentId: formAgentId || agents[0]?.id,
        toolChain: formTools.length > 0 ? formTools : ['termux_shell'],
      });
      setShowCreateModal(false);
      setFormTitle('');
      setFormDescription('');
      sound.toolSuccess();
    } catch {
      // Handled in parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'ALL') return true;
    return t.status === statusFilter;
  });

  const getPriorityBadge = (p: AgentTask['priority']) => {
    switch (p) {
      case 'P0_CRITICAL':
        return 'bg-red-950 text-red-300 border-red-700 font-bold';
      case 'P1_HIGH':
        return 'bg-amber-950 text-amber-300 border-amber-700';
      case 'P2_NORMAL':
        return 'bg-cyan-950 text-cyan-300 border-cyan-800';
      case 'P3_LOW':
        return 'bg-slate-900 text-slate-400 border-slate-800';
    }
  };

  const getStatusBadge = (s: AgentTask['status']) => {
    switch (s) {
      case 'RUNNING':
        return 'bg-amber-950/80 text-amber-400 border-amber-500 animate-pulse';
      case 'COMPLETED':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-600';
      case 'QUEUED':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-700';
      case 'PAUSED':
        return 'bg-slate-900 text-slate-400 border-slate-700';
      case 'FAILED':
        return 'bg-red-950 text-red-400 border-red-700';
    }
  };

  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const runningCount = tasks.filter((t) => t.status === 'RUNNING').length;
  const successRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 100;

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-[#080a0f] text-slate-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-950/80">
        <div>
          <h2 className="text-base sm:text-lg font-mono font-bold text-cyan-300 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-cyan-400" />
            AUTONOMOUS TASK MANAGEMENT & WORKFLOW PIPELINE
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Orchestrate multi-step cognitive directives, tool invocations, and agent assignments.
          </p>
        </div>

        <button
          onClick={() => {
            sound.click();
            setShowCreateModal(true);
          }}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-black font-mono text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>CREATE AUTONOMOUS TASK</span>
        </button>
      </div>

      {/* Task Performance KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-[#0f1420] border border-cyan-900/60">
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>TOTAL DIRECTIVES</span>
            <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-cyan-300 mt-1">{tasks.length}</div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">Task lifecycle tracking</div>
        </div>

        <div className="p-3 rounded-xl bg-[#0f1420] border border-amber-900/60">
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>RUNNING NOW</span>
            <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          </div>
          <div className="text-2xl font-mono font-bold text-amber-300 mt-1">{runningCount}</div>
          <div className="text-[10px] font-mono text-amber-500 mt-0.5">Active step execution</div>
        </div>

        <div className="p-3 rounded-xl bg-[#0f1420] border border-emerald-900/60">
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>COMPLETED</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-300 mt-1">{completedCount}</div>
          <div className="text-[10px] font-mono text-emerald-500 mt-0.5">Verified outputs</div>
        </div>

        <div className="p-3 rounded-xl bg-[#0f1420] border border-purple-900/60">
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>COMPLETION RATE</span>
            <Clock className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-purple-300 mt-1">{successRate}%</div>
          <div className="text-[10px] font-mono text-purple-400 mt-0.5">Success pipeline</div>
        </div>
      </div>

      {/* Tactical Correction Alert Banner */}
      {pendingRecs.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/70 via-red-950/50 to-amber-950/70 border border-amber-500/80 rounded-2xl p-3.5 sm:p-4 shadow-[0_0_25px_rgba(245,158,11,0.2)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-900/80 border border-amber-500 text-amber-300 shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-mono font-bold text-amber-200 text-sm">
                  TACTICAL CORRECTION ALERT: {pendingRecs.length} AGENT(S) BELOW SUCCESS THRESHOLD
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-600">
                  RECONFIGURATION READY
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-mono">
                Agent <span className="text-cyan-300 font-bold">{pendingRecs[0].agentCallsign}</span> success rate dropped to{' '}
                <span className="text-red-400 font-bold">{pendingRecs[0].successRatePct}%</span>. Automated C2 recommends upgrading toolchain to{' '}
                <span className="text-cyan-300 font-bold">[{pendingRecs[0].suggestedToolchain.join(', ')}]</span>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            {onOpenCorrectionsTab && (
              <button
                onClick={() => {
                  sound.click();
                  onOpenCorrectionsTab();
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 text-xs font-mono transition-colors"
              >
                INSPECT DETAILS
              </button>
            )}

            {onApplyCorrection && (
              <button
                onClick={async () => {
                  sound.dispatch();
                  setApplyingRecId(pendingRecs[0].id);
                  await onApplyCorrection(pendingRecs[0].id);
                  setApplyingRecId(null);
                  sound.toolSuccess();
                }}
                disabled={applyingRecId === pendingRecs[0].id}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-slate-950 text-xs font-mono font-bold shadow-[0_0_12px_rgba(6,182,212,0.4)] flex items-center gap-1.5 transition-all"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                {applyingRecId === pendingRecs[0].id ? 'APPLYING...' : '⚡ AUTO-RECONFIGURE TOOLCHAIN'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1.5 rounded-xl bg-[#0b0f17] border border-cyan-950">
        {['ALL', 'RUNNING', 'QUEUED', 'COMPLETED', 'FAILED'].map((st) => (
          <button
            key={st}
            onClick={() => {
              sound.click();
              setStatusFilter(st);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors whitespace-nowrap ${
              statusFilter === st
                ? 'bg-cyan-500 text-black font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            {st} ({st === 'ALL' ? tasks.length : tasks.filter((t) => t.status === st).length})
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-10 font-mono text-xs text-slate-500 bg-[#0c1018] rounded-2xl border border-slate-900">
            No tasks found matching current filter.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            return (
              <div
                key={task.id}
                className="p-3.5 rounded-xl bg-[#0f1420] border border-cyan-900/50 hover:border-cyan-700/60 transition-all space-y-2.5"
              >
                {/* Task Top Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-mono uppercase ${getPriorityBadge(task.priority)}`}>
                        {task.priority.replace('_', ' ')}
                      </span>
                      <h3 className="font-mono font-bold text-sm text-cyan-200 truncate">
                        {task.title}
                      </h3>
                    </div>
                    <p className="text-xs font-sans text-slate-400 line-clamp-2">
                      {task.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded border text-[10px] font-mono font-bold ${getStatusBadge(task.status)}`}>
                      {task.status}
                    </span>
                  </div>
                </div>

                {/* Agent & Tool Badges */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-mono pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px]">ASSIGNED TO:</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-bold text-[10px]">
                      {task.assignedAgentName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {task.toolChain.map((tool) => (
                      <span
                        key={tool}
                        className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300 text-[9px]"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>EXECUTION PROGRESS</span>
                    <span className="text-cyan-300 font-bold">{task.progressPct}%</span>
                  </div>
                  <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        task.status === 'COMPLETED'
                          ? 'bg-emerald-400'
                          : task.status === 'FAILED'
                          ? 'bg-red-500'
                          : 'bg-gradient-to-r from-cyan-500 to-amber-400'
                      }`}
                      style={{ width: `${task.progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Step Breakdown Collapsible */}
                {task.steps && task.steps.length > 0 && (
                  <div>
                    <button
                      onClick={() => {
                        sound.click();
                        setExpandedTaskId(isExpanded ? null : task.id);
                      }}
                      className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 pt-1"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <span>{isExpanded ? 'Hide' : 'Inspect'} Cognitive Reasoning Steps ({task.steps.length})</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-cyan-800/60 font-mono text-xs">
                        {task.steps.map((step, idx) => (
                          <div
                            key={step.id || idx}
                            className="p-2 rounded bg-[#090d16] border border-slate-800 flex items-start justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-500">[{idx + 1}]</span>
                                <span className="text-slate-200 font-semibold">{step.name}</span>
                              </div>
                              {step.detail && (
                                <p className="text-[11px] text-cyan-400/90 mt-0.5 pl-4">
                                  {step.detail}
                                </p>
                              )}
                            </div>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-bold ${
                                step.status === 'done'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : step.status === 'running'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                                  : step.status === 'failed'
                                  ? 'bg-red-950 text-red-400 border border-red-800'
                                  : 'bg-slate-900 text-slate-500'
                              }`}
                            >
                              {step.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Failure Diagnostic Log */}
                {task.error && (
                  <div className="p-2 rounded-lg bg-red-950/40 border border-red-900/60 text-[11px] font-mono text-red-300 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">FAILURE LOG: </span>
                      <span>{task.error}</span>
                    </div>
                  </div>
                )}

                {/* Tactical Correction Inline Recommendation */}
                {(() => {
                  const agentRec = pendingRecs.find((r) => r.agentId === task.assignedAgentId);
                  if (agentRec && task.status === 'FAILED') {
                    return (
                      <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-950/60 to-cyan-950/60 border border-amber-500/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                          <div className="text-xs font-mono">
                            <span className="text-amber-300 font-bold">TACTICAL CORRECTION READY: </span>
                            <span className="text-slate-300">
                              Upgrade to <span className="text-cyan-300 font-bold">[{agentRec.suggestedToolchain.join(', ')}]</span> &{' '}
                              <span className="text-cyan-300 font-bold">{agentRec.suggestedModel.split('/').pop()}</span>
                            </span>
                          </div>
                        </div>
                        {onApplyCorrection && (
                          <button
                            onClick={async () => {
                              sound.dispatch();
                              setApplyingRecId(agentRec.id);
                              await onApplyCorrection(agentRec.id);
                              setApplyingRecId(null);
                              sound.toolSuccess();
                            }}
                            disabled={applyingRecId === agentRec.id}
                            className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                          >
                            <Zap className="w-3 h-3 fill-current" />
                            {applyingRecId === agentRec.id ? 'RECONFIGURING...' : 'RECONFIGURE & AUTO-RETRY'}
                          </button>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Task Actions Footer */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] font-mono text-slate-500">
                    ID: {task.id}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {task.status !== 'COMPLETED' && (
                      <button
                        onClick={() => {
                          sound.click();
                          onTaskAction(task.id, 'run');
                        }}
                        className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-[10px] font-mono flex items-center gap-1 transition-colors"
                        title="Step / Execute Task"
                      >
                        <Play className="w-3 h-3" />
                        STEP / RUN
                      </button>
                    )}

                    {task.status === 'RUNNING' && (
                      <button
                        onClick={() => {
                          sound.click();
                          onTaskAction(task.id, 'pause');
                        }}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 transition-colors"
                        title="Pause Task"
                      >
                        <Pause className="w-3 h-3" />
                        PAUSE
                      </button>
                    )}

                    {task.status === 'RUNNING' && (
                      <button
                        onClick={() => {
                          sound.alert();
                          onTaskAction(task.id, 'fail');
                        }}
                        className="p-1 rounded bg-slate-900 hover:bg-red-950 border border-slate-700 hover:border-red-700 text-slate-400 hover:text-red-400 text-[10px] font-mono transition-colors"
                        title="Simulate Failure (Test Tactical Correction)"
                      >
                        <Flame className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        sound.click();
                        onTaskAction(task.id, 'retry');
                      }}
                      className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-mono transition-colors"
                      title="Reset / Retry Task"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    {task.status !== 'COMPLETED' && (
                      <button
                        onClick={() => {
                          sound.alert();
                          onTaskAction(task.id, 'abort');
                        }}
                        className="p-1 rounded bg-slate-900 hover:bg-red-950 border border-slate-700 hover:border-red-700 text-slate-400 hover:text-red-400 text-[10px] font-mono transition-colors"
                        title="Abort Task"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-[#0d121c] border border-cyan-700 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.25)] p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-cyan-400" />
                <h3 className="font-mono font-bold text-cyan-300 text-sm sm:text-base">
                  DISPATCH AUTONOMOUS TASK TO FLEET
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                aria-label="Close create task dialog"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs font-mono">
              <div>
                <label htmlFor="task-title" className="text-slate-400 block mb-1">Task Directive Title *</label>
                <input
                  id="task-title"
                  type="text"
                  required
                  placeholder="e.g. Scrape wlan0 Ingress Ports & Dump Logs"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg p-2 text-slate-100 placeholder:text-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="task-description" className="text-slate-400 block mb-1">Operational Objective / Description</label>
                <textarea
                  id="task-description"
                  rows={2}
                  placeholder="Specify task goals, execution bounds, and target nodes..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg p-2 text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="task-assignee" className="text-slate-400 block mb-1">Assignee Agent</label>
                  <select
                    id="task-assignee"
                    value={formAgentId}
                    onChange={(e) => setFormAgentId(e.target.value)}
                    className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg p-2 text-slate-200 focus:outline-none"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.callsign} ({a.specialty})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="task-priority" className="text-slate-400 block mb-1">Priority</label>
                  <select
                    id="task-priority"
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg p-2 text-slate-200 focus:outline-none"
                  >
                    <option value="P0_CRITICAL">P0 Critical - Autonomous Immediate</option>
                    <option value="P1_HIGH">P1 High - Expedited Execution</option>
                    <option value="P2_NORMAL">P2 Normal - Standard Queue</option>
                    <option value="P3_LOW">P3 Low - Background Idle</option>
                  </select>
                </div>
              </div>

              {/* Tool chain selection */}
              <div>
                <label className="text-slate-400 block mb-1.5">Required Hermes Tools</label>
                <div role="group" aria-label="Required Hermes tools" className="grid grid-cols-2 gap-2">
                  {availableTools.map((tool) => {
                    const isSelected = formTools.includes(tool.id);
                    return (
                      <button
                        type="button"
                        key={tool.id}
                        aria-pressed={isSelected}
                        onClick={() => handleToggleTool(tool.id)}
                        className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                            : 'bg-[#080b12] border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="text-[11px] truncate">{tool.label}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'DISPATCHING...' : 'ENQUEUE TASK'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
