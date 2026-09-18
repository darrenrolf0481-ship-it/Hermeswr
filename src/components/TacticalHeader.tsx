import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Terminal, 
  Volume2, 
  VolumeX, 
  Cpu, 
  BatteryCharging, 
  Radio, 
  Zap,
  HeartPulse,
  Info
} from 'lucide-react';
import { AgentState, DeviceTelemetry } from '../types';
import { sound } from '../utils/audio';

interface TacticalHeaderProps {
  agentState: AgentState;
  telemetry: DeviceTelemetry;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onEmergencyStop: () => void;
  activeModelName: string;
  isProcessing?: boolean;
  activeTasksCount?: number;
}

export const TacticalHeader: React.FC<TacticalHeaderProps> = ({
  agentState,
  telemetry,
  soundEnabled,
  onToggleSound,
  onEmergencyStop,
  activeModelName,
  isProcessing = false,
  activeTasksCount = 0,
}) => {
  const [showHeartbeatDiagnostics, setShowHeartbeatDiagnostics] = useState(false);

  // Active status calculation
  const isActivelyProcessing = isProcessing || agentState !== 'IDLE' || activeTasksCount > 0;

  // Dynamic cardiac rhythm (BPM) based on Hermes processing intensity
  const calculateBpm = () => {
    if (!isActivelyProcessing) {
      return 62; // Steady, resting baseline
    }
    if (agentState === 'EXECUTING_TOOL') {
      return 184; // High synaptic arousal during sub-process tool execution
    }
    if (agentState === 'REASONING') {
      return 168; // Deep cognitive reasoning cycle
    }
    if (agentState === 'SYNTHESIZING' || agentState === 'PERCEIVING') {
      return 152;
    }
    if (activeTasksCount > 1) {
      return 176; // Concurrent pipeline load
    }
    return 144; // Standard active task progression
  };

  const bpm = calculateBpm();
  // Animation duration in seconds derived directly from BPM: (60 / bpm)
  const animationDurationSeconds = `${(60 / bpm).toFixed(2)}s`;

  // Dynamic theme colors based on state
  const getHeartbeatTheme = () => {
    if (!isActivelyProcessing) {
      return {
        border: 'border-emerald-900/60 hover:border-emerald-500/50',
        bg: 'bg-emerald-950/20',
        glow: 'shadow-[0_0_8px_rgba(16,185,129,0.15)]',
        color: 'text-emerald-400',
        stroke: '#10b981',
        ringColor: 'border-emerald-400/40',
        label: 'NOMINAL',
        desc: 'Steady Resting State',
      };
    }
    if (agentState === 'EXECUTING_TOOL') {
      return {
        border: 'border-amber-500/70 shadow-[0_0_14px_rgba(245,158,11,0.3)]',
        bg: 'bg-amber-950/40',
        glow: 'shadow-[0_0_12px_rgba(245,158,11,0.35)]',
        color: 'text-amber-400',
        stroke: '#f59e0b',
        ringColor: 'border-amber-400/60',
        label: 'TOOL RUN',
        desc: 'Sub-process Tool Execution',
      };
    }
    return {
      border: 'border-cyan-500/70 shadow-[0_0_14px_rgba(6,182,212,0.3)]',
      bg: 'bg-cyan-950/40',
      glow: 'shadow-[0_0_12px_rgba(6,182,212,0.35)]',
      color: 'text-cyan-300',
      stroke: '#06b6d4',
      ringColor: 'border-cyan-400/60',
      label: 'PROCESSING',
      desc: 'Active Task Reasoning & Synthesis',
    };
  };

  const theme = getHeartbeatTheme();

  const getStatusColor = (state: AgentState) => {
    switch (state) {
      case 'IDLE':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'PERCEIVING':
      case 'REASONING':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse';
      case 'EXECUTING_TOOL':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse';
      case 'SYNTHESIZING':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      case 'ERROR':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
    }
  };

  return (
    <header className="w-full bg-[#0d111a]/95 backdrop-blur border-b border-cyan-950/70 px-3 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Target Environment */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
          <Radio className="w-4 h-4 animate-pulse" />
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        </div>
        
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-sm sm:text-base font-bold tracking-wider text-cyan-300">
              HERMES
            </span>
            <span className="text-[10px] sm:text-xs font-mono px-1.5 py-0.5 rounded bg-cyan-950/90 text-cyan-400 border border-cyan-800/60 font-medium">
              C2 // WAR ROOM
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono truncate hidden sm:block">
            MOTO G5 STYLUS 2025 • TERMUX aarch64 • {activeModelName}
          </p>
        </div>
      </div>

      {/* Center/Right Status Cluster with Heartbeat Monitor */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs font-mono">
        
        {/* VISUAL HEARTBEAT MONITOR */}
        <div className="relative">
          <button
            id="tactical-heartbeat-monitor"
            onClick={() => {
              sound.click();
              setShowHeartbeatDiagnostics((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg border transition-all duration-300 ${theme.bg} ${theme.border} ${theme.glow}`}
            title={`Hermes Heartbeat: ${bpm} BPM (${theme.label}) - Click for cardiac diagnostics`}
            aria-label={`Hermes heartbeat monitor, ${bpm} BPM, ${theme.label}`}
            aria-expanded={showHeartbeatDiagnostics}
            // Only references the panel while it exists.
            aria-controls={showHeartbeatDiagnostics ? 'heartbeat-diagnostics' : undefined}
          >
            {/* Heartbeat Icon & Pulsating Cardiac Rings */}
            <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
              {/* Expanding Ripple Ring */}
              <div 
                className={`absolute inset-0 rounded-full border ${theme.ringColor} animate-tactical-ring pointer-events-none`}
                style={{ animationDuration: animationDurationSeconds }}
              />

              {/* Secondary Fast Echo Ring during heavy processing */}
              {isActivelyProcessing && (
                <div 
                  className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping pointer-events-none"
                  style={{ animationDuration: animationDurationSeconds }}
                />
              )}

              {/* Pulsating Heart Icon */}
              <HeartPulse 
                className={`w-4 h-4 ${theme.color} animate-tactical-heartbeat`}
                style={{ animationDuration: animationDurationSeconds }}
              />
            </div>

            {/* Mini Real-Time ECG Waveform Oscilloscope */}
            <div className="relative w-10 sm:w-16 h-4 sm:h-5 bg-black/40 rounded border border-slate-800/60 overflow-hidden flex items-center justify-center px-0.5">
              {/* Background grid markings */}
              <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#06b6d4_1px,transparent_1px),linear-gradient(to_bottom,#06b6d4_1px,transparent_1px)] bg-[size:4px_4px]" />
              
              <svg 
                viewBox="0 0 64 20" 
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
              >
                {/* Static Faint Baseline */}
                <path
                  d="M 0 10 L 14 10 L 17 8 L 20 12 L 23 10 L 27 10 L 30 2 L 34 18 L 38 10 L 42 10 L 45 12 L 48 8 L 51 10 L 64 10"
                  fill="none"
                  stroke={theme.stroke}
                  strokeWidth="1"
                  strokeOpacity="0.25"
                />

                {/* Animated Dynamic ECG Trace Line */}
                <path
                  d="M 0 10 L 14 10 L 17 8 L 20 12 L 23 10 L 27 10 L 30 2 L 34 18 L 38 10 L 42 10 L 45 12 L 48 8 L 51 10 L 64 10"
                  fill="none"
                  stroke={theme.stroke}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-ecg-trace"
                  style={{ animationDuration: animationDurationSeconds }}
                />
              </svg>

              {/* Live Blip Indicator on ECG */}
              <div 
                className={`absolute right-1 w-1.5 h-1.5 rounded-full ${isActivelyProcessing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400/80'}`}
              />
            </div>

            {/* Dynamic BPM Readout & Status Tag */}
            <div className="flex flex-col items-start leading-none">
              <div className="flex items-baseline gap-0.5">
                <span className={`font-mono font-bold text-[11px] sm:text-xs ${theme.color}`}>
                  {bpm}
                </span>
                <span className="text-[8px] sm:text-[9px] text-slate-400 font-mono">
                  BPM
                </span>
              </div>
              <span className={`text-[8px] font-mono tracking-tight hidden sm:block ${isActivelyProcessing ? 'text-cyan-300 font-semibold' : 'text-slate-500'}`}>
                {theme.label}
              </span>
            </div>
          </button>

          {/* Heartbeat Cardiac Diagnostics Popover */}
          {showHeartbeatDiagnostics && (
            <div
              id="heartbeat-diagnostics"
              className="absolute top-full right-0 mt-2 w-64 bg-[#0a0e17] border border-cyan-800/80 rounded-xl p-3 shadow-2xl z-50 text-slate-200 font-mono space-y-2.5"
            >
              <div className="flex items-center justify-between border-b border-cyan-950 pb-2">
                <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-bold">
                  <HeartPulse className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span>HERMES CARDIAC ENGINE</span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${theme.bg} ${theme.color} border ${theme.border}`}>
                  {bpm} BPM
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Cardiac Rhythm:</span>
                  <span className={theme.color}>{theme.desc}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Pulse Period:</span>
                  <span className="text-slate-200">{animationDurationSeconds}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Agent Lifecycle:</span>
                  <span className="text-slate-200">{agentState}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Active Tasks:</span>
                  <span className={activeTasksCount > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {activeTasksCount} Running
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Inference Velocity:</span>
                  <span className="text-cyan-300 font-bold">{telemetry.tokensPerSec} tok/s</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Termux Snapdragon:</span>
                  <span className="text-slate-200">{telemetry.batteryTempC}°C • {telemetry.cpuLoad}% Load</span>
                </div>
              </div>

              <div className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-800">
                Pulsates automatically in real time based on task processing load and synaptic reasoning frequency.
              </div>
            </div>
          )}
        </div>

        {/* Agent State Pill */}
        <div className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-full border text-[10px] sm:text-xs font-semibold ${getStatusColor(agentState)}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
          <span>{agentState}</span>
        </div>

        {/* Device Pill (Mobile friendly) */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 text-[11px]">
          <div className="flex items-center gap-1 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>{telemetry.cpuLoad}%</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1 text-slate-400">
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            <span>{telemetry.batteryPct}%</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1 text-slate-400">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{telemetry.tokensPerSec} t/s</span>
          </div>
        </div>

        {/* Audio Toggle */}
        <button
          id="btn-toggle-sound"
          onClick={() => {
            onToggleSound();
            sound.click();
          }}
          className={`p-1.5 rounded-lg border transition-colors ${
            soundEnabled 
              ? 'bg-cyan-950/50 border-cyan-800/80 text-cyan-400 hover:bg-cyan-900/60' 
              : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
          title={soundEnabled ? 'Mute War Room Audio' : 'Enable Tactical Audio'}
          aria-label="War room audio"
          aria-pressed={soundEnabled}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Emergency Stop / Abort Button */}
        <button
          id="btn-emergency-stop"
          onClick={() => {
            sound.alert();
            onEmergencyStop();
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/70 text-red-400 hover:text-red-200 transition-colors text-[11px] font-mono font-semibold active:scale-95"
          title="Emergency Abort / Halt Agents"
          aria-label="Abort all agents"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">ABORT</span>
        </button>
      </div>
    </header>
  );
};

