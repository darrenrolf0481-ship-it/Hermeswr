import React, { useState } from 'react';
import { 
  Sliders, 
  Zap, 
  Cpu, 
  BatteryCharging, 
  Database, 
  Clock, 
  RotateCcw, 
  Check, 
  ShieldCheck, 
  Flame, 
  Sparkles,
  Terminal,
  Activity
} from 'lucide-react';
import { TuningConfig, MemoryItem } from '../types';
import { sound } from '../utils/audio';

interface PerformanceTuningViewProps {
  config: TuningConfig;
  onUpdateConfig: (updates: Partial<TuningConfig>) => Promise<void>;
  memoriesCount: number;
  onFlushCache: () => void;
}

export const PerformanceTuningView: React.FC<PerformanceTuningViewProps> = ({
  config,
  onUpdateConfig,
  memoriesCount,
  onFlushCache,
}) => {
  const [localConfig, setLocalConfig] = useState<TuningConfig>(config);
  const [isSaved, setIsSaved] = useState(false);

  const presets = [
    {
      id: 'Extreme Speed / Low Power',
      label: 'Extreme Speed / Eco',
      desc: 'Optimized for high tok/s and lowest battery draw on Moto G5 Stylus.',
      config: {
        temperature: 0.3,
        topP: 0.8,
        maxReasoningSteps: 3,
        contextLimitTokens: 4096,
        nicePriority: 10,
        batteryProfile: 'STEALTH_ECO' as const,
        toolTimeoutMs: 8000,
        autoRetryAttempts: 1,
        activePreset: 'Extreme Speed / Low Power',
      },
    },
    {
      id: 'Deep Tactical Reasoning',
      label: 'Deep Tactical C2',
      desc: 'Deep multi-turn scratchpad reasoning and exhaustive tool chains.',
      config: {
        temperature: 0.7,
        topP: 0.95,
        maxReasoningSteps: 8,
        contextLimitTokens: 16384,
        nicePriority: -10,
        batteryProfile: 'MAX_PERFORMANCE' as const,
        toolTimeoutMs: 25000,
        autoRetryAttempts: 3,
        activePreset: 'Deep Tactical Reasoning',
      },
    },
    {
      id: 'Stealth Recon',
      label: 'Stealth Recon',
      desc: 'Low footprint background surveillance with balanced thermal ceiling.',
      config: {
        temperature: 0.5,
        topP: 0.9,
        maxReasoningSteps: 5,
        contextLimitTokens: 8192,
        nicePriority: 0,
        batteryProfile: 'BALANCED_TACTICAL' as const,
        toolTimeoutMs: 15000,
        autoRetryAttempts: 2,
        activePreset: 'Stealth Recon',
      },
    },
    {
      id: 'Maximum Precision',
      label: 'Maximum Precision',
      desc: 'Deterministic code auditing and strict security syntax output.',
      config: {
        temperature: 0.1,
        topP: 0.7,
        maxReasoningSteps: 10,
        contextLimitTokens: 8192,
        nicePriority: -5,
        batteryProfile: 'BALANCED_TACTICAL' as const,
        toolTimeoutMs: 20000,
        autoRetryAttempts: 3,
        activePreset: 'Maximum Precision',
      },
    },
  ];

  const handleApplyPreset = (preset: typeof presets[0]) => {
    sound.click();
    const updated = { ...localConfig, ...preset.config };
    setLocalConfig(updated);
    onUpdateConfig(updated);
    triggerSaved();
  };

  const handleSliderChange = (key: keyof TuningConfig, val: any) => {
    const updated = { ...localConfig, [key]: val, activePreset: 'Custom' };
    setLocalConfig(updated);
    onUpdateConfig(updated);
    triggerSaved();
  };

  const triggerSaved = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-5 bg-[#080a0f] text-slate-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-950/80">
        <div>
          <h2 className="text-base sm:text-lg font-mono font-bold text-cyan-300 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            HERMES PERFORMANCE TUNING & ENGINE CALIBRATION
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Optimize inference sampling parameters, Termux priority scheduling, and battery profiles.
          </p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-3 py-1.5 rounded-xl">
            <Check className="w-4 h-4" />
            <span>PARAMETERS SYNCHRONIZED</span>
          </div>
        )}
      </div>

      {/* Preset Profiles */}
      <div className="space-y-3">
        <label className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" /> Tactical Operating Profiles
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {presets.map((p) => {
            const isActive = localConfig.activePreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isActive
                    ? 'bg-cyan-950/70 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : 'bg-[#0f1420] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono font-bold ${isActive ? 'text-cyan-300' : 'text-slate-200'}`}>
                    {p.label}
                  </span>
                  {isActive && <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-sans leading-snug">
                  {p.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Inference Tuning Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Sampling Temperature */}
        <div className="p-3.5 rounded-xl bg-[#0f1420] border border-cyan-900/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              Sampling Temperature: <span className="text-amber-300 font-bold">{localConfig.temperature}</span>
            </span>
            <span className="text-[10px] text-slate-500">
              {localConfig.temperature <= 0.3 ? 'Deterministic / Precise' : localConfig.temperature >= 0.8 ? 'Creative / Exploratory' : 'Tactical Optimal'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={localConfig.temperature}
            onChange={(e) => handleSliderChange('temperature', parseFloat(e.target.value))}
            className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <p className="text-[10px] font-sans text-slate-400">
            Controls probability entropy. Lower values ensure precise command syntax; higher values promote speculative reasoning.
          </p>
        </div>

        {/* Top-P Nucleus Sampling */}
        <div className="p-3.5 rounded-xl bg-[#0f1420] border border-cyan-900/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-cyan-400" />
              Top-P (Nucleus Sampling): <span className="text-cyan-300 font-bold">{localConfig.topP}</span>
            </span>
            <span className="text-[10px] text-slate-500">
              P-cutoff: {(localConfig.topP * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.0"
            step="0.05"
            value={localConfig.topP}
            onChange={(e) => handleSliderChange('topP', parseFloat(e.target.value))}
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <p className="text-[10px] font-sans text-slate-400">
            Limits cumulative token selection to the highest probability mass, pruning unpredictable token hallucinations.
          </p>
        </div>

        {/* Max Reasoning Steps (Scratchpad Depth) */}
        <div className="p-3.5 rounded-xl bg-[#0f1420] border border-cyan-900/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-purple-400" />
              Max Scratchpad Steps: <span className="text-purple-300 font-bold">{localConfig.maxReasoningSteps}</span>
            </span>
            <span className="text-[10px] text-slate-500">
              {localConfig.maxReasoningSteps <= 4 ? 'Fast Response' : 'Deep Cognitive Chain'}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="12"
            step="1"
            value={localConfig.maxReasoningSteps}
            onChange={(e) => handleSliderChange('maxReasoningSteps', parseInt(e.target.value))}
            className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <p className="text-[10px] font-sans text-slate-400">
            Governs the recursion ceiling inside the Nous Hermes <code className="text-purple-300">&lt;scratchpad&gt;</code> before tool dispatch.
          </p>
        </div>

        {/* Context Window Token Limit */}
        <div className="p-3.5 rounded-xl bg-[#0f1420] border border-cyan-900/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-400" />
              Context Budget: <span className="text-emerald-300 font-bold">{localConfig.contextLimitTokens} tokens</span>
            </span>
            <span className="text-[10px] text-slate-500">
              Termux KV Buffer
            </span>
          </div>
          <select
            value={localConfig.contextLimitTokens}
            onChange={(e) => handleSliderChange('contextLimitTokens', parseInt(e.target.value))}
            className="w-full bg-[#080b12] border border-slate-800 focus:border-cyan-500 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none"
          >
            <option value="2048">2,048 Tokens (Ultra-low RAM consumption)</option>
            <option value="4096">4,096 Tokens (Recommended for Termux aarch64)</option>
            <option value="8192">8,192 Tokens (Balanced Tactical History)</option>
            <option value="16384">16,384 Tokens (Extended Recon Logs)</option>
            <option value="32768">32,768 Tokens (Full Codebase Auditing)</option>
          </select>
          <p className="text-[10px] font-sans text-slate-400">
            Specifies maximum historical dialogue context retained in active memory.
          </p>
        </div>
      </div>

      {/* Termux Subsystem Scheduling & Hardware Throttle */}
      <div className="p-4 rounded-xl bg-[#0f1420] border border-cyan-900/60 space-y-4">
        <h3 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          Linux Subsystem & Hardware Governance (Moto G5 Stylus 2025)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Nice Priority */}
          <div className="p-3 rounded-lg bg-[#080b12] border border-slate-800 space-y-1.5">
            <span className="text-[11px] font-mono text-slate-400 block">
              Linux Process Priority (<code className="text-cyan-300">nice -n</code>)
            </span>
            <select
              value={localConfig.nicePriority}
              onChange={(e) => handleSliderChange('nicePriority', parseInt(e.target.value))}
              className="w-full bg-[#0f1420] border border-slate-700 rounded p-1.5 text-xs font-mono text-slate-200"
            >
              <option value="-15">-15 (Realtime Priority - Termux Core)</option>
              <option value="-5">-5 (High Tactical Priority)</option>
              <option value="0">0 (Standard Linux Priority)</option>
              <option value="10">10 (Low Priority - Idle Background)</option>
            </select>
            <span className="text-[10px] text-slate-500 block">
              Prioritizes CPU time on Snapdragon cores.
            </span>
          </div>

          {/* Battery Profile */}
          <div className="p-3 rounded-lg bg-[#080b12] border border-slate-800 space-y-1.5">
            <span className="text-[11px] font-mono text-slate-400 block">
              5000mAh Battery Profile
            </span>
            <select
              value={localConfig.batteryProfile}
              onChange={(e) => handleSliderChange('batteryProfile', e.target.value as any)}
              className="w-full bg-[#0f1420] border border-slate-700 rounded p-1.5 text-xs font-mono text-slate-200"
            >
              <option value="MAX_PERFORMANCE">MAX PERFORMANCE (Unlocked Clocks)</option>
              <option value="BALANCED_TACTICAL">BALANCED TACTICAL (Thermal Safe)</option>
              <option value="STEALTH_ECO">STEALTH ECO (Low Temp / Power)</option>
            </select>
            <span className="text-[10px] text-slate-500 block">
              Regulates thermal envelope at 34-38°C.
            </span>
          </div>

          {/* Tool Execution Timeout */}
          <div className="p-3 rounded-lg bg-[#080b12] border border-slate-800 space-y-1.5">
            <span className="text-[11px] font-mono text-slate-400 block">
              Autonomous Tool Timeout
            </span>
            <select
              value={localConfig.toolTimeoutMs}
              onChange={(e) => handleSliderChange('toolTimeoutMs', parseInt(e.target.value))}
              className="w-full bg-[#0f1420] border border-slate-700 rounded p-1.5 text-xs font-mono text-slate-200"
            >
              <option value="5000">5 seconds (Rapid Failover)</option>
              <option value="15000">15 seconds (Standard Tool Timeout)</option>
              <option value="30000">30 seconds (Long-running Scrapes)</option>
              <option value="60000">60 seconds (Heavy Python Scripts)</option>
            </select>
            <span className="text-[10px] text-slate-500 block">
              Terminates hung commands in Termux.
            </span>
          </div>
        </div>

        {/* Cache Flush & Vector Sync */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <div className="text-xs font-mono text-slate-400">
            Active Vector Database: <span className="text-purple-300 font-bold">{memoriesCount} memory vectors</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.click();
                onFlushCache();
                triggerSaved();
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-red-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              FLUSH KV CACHE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
