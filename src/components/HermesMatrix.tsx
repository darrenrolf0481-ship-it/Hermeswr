import React, { useState } from 'react';
import { 
  Sliders, 
  Database, 
  Terminal, 
  Layers, 
  Brain, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Save, 
  Check, 
  FileCode,
  Sparkles
} from 'lucide-react';
import { MemoryItem } from '../types';
import { sound } from '../utils/audio';

interface HermesMatrixProps {
  activePersona: string;
  onChangePersona: (persona: string) => void;
  temperature: number;
  onChangeTemperature: (temp: number) => void;
  memories: MemoryItem[];
  onAddMemory: (item: Omit<MemoryItem, 'id' | 'updatedAt'>) => void;
  onDeleteMemory: (id: string) => void;
  onClearMemories: () => void;
}

export const HermesMatrix: React.FC<HermesMatrixProps> = ({
  activePersona,
  onChangePersona,
  temperature,
  onChangeTemperature,
  memories,
  onAddMemory,
  onDeleteMemory,
  onClearMemories,
}) => {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCat, setNewCat] = useState<MemoryItem['category']>('TACTICAL');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const personas = [
    { name: 'Tactical Ops', desc: 'Autonomous command, real-time threat response & operations execution' },
    { name: 'DevSecOps Specialist', desc: 'Code auditing, exploit mitigation, Python & bash automation' },
    { name: 'Termux System Analyst', desc: 'Hardware thermals, Android internals, aarch64 subsystem tuning' },
    { name: 'Recon & Intel Miner', desc: 'Network topology mapping, port analysis, intelligence aggregation' },
  ];

  const tools = [
    { id: 'termux_shell', name: 'termux_shell', active: true, desc: 'Executes aarch64 shell commands in Termux sandbox' },
    { id: 'code_interpreter', name: 'code_interpreter', active: true, desc: 'Sandboxed Python 3.11 / Node runtime' },
    { id: 'vector_memory', name: 'vector_memory', active: true, desc: 'Persistent RAG vector database & context recall' },
    { id: 'multimodal_vision', name: 'multimodal_vision', active: true, desc: 'Moto G5 Stylus tactical sketch & schematic analysis' },
  ];

  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    sound.dispatch();
    onAddMemory({
      key: newKey.trim(),
      value: newValue.trim(),
      category: newCat,
    });
    setNewKey('');
    setNewValue('');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-5 bg-[#080a0f] text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-cyan-950/80">
        <div>
          <h2 className="text-base sm:text-lg font-mono font-bold text-cyan-300 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            HERMES COGNITIVE MATRIX // SYSTEM ARCHITECTURE
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Configure agent cognitive parameters, tool declarations, and vector memory.
          </p>
        </div>
      </div>

      {/* Personas Selection */}
      <div className="space-y-3">
        <label className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <Brain className="w-4 h-4" /> Agent Operational Persona
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {personas.map((p) => {
            const isSelected = activePersona === p.name;
            return (
              <button
                key={p.name}
                onClick={() => {
                  sound.click();
                  onChangePersona(p.name);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                    : 'bg-[#0f1420] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                    {p.name}
                  </span>
                  {isSelected && <ShieldCheck className="w-4 h-4 text-cyan-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-sans leading-snug">
                  {p.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Temperature & Cognitive Parameters */}
      <div className="p-4 rounded-xl bg-[#0f1420] border border-cyan-900/60 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Sampling Temperature: <span className="text-cyan-300">{temperature}</span>
          </span>
          <span className="text-[10px] text-slate-500">
            {temperature < 0.4 ? 'Deterministic / Precise' : temperature > 0.8 ? 'Exploratory / Creative' : 'Balanced Tactical'}
          </span>
        </div>
        <input
          type="range"
          aria-label="Sampling temperature"
          min="0"
          max="1"
          step="0.05"
          value={temperature}
          onChange={(e) => onChangeTemperature(parseFloat(e.target.value))}
          className="w-full accent-cyan-400 h-6 py-[9px] bg-clip-content bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>

      {/* Hermes Active Tools Registry */}
      <div className="space-y-3">
        <label className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <Terminal className="w-4 h-4" /> Hermes Autonomous Tools Registry
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {tools.map((t) => (
            <div
              key={t.id}
              className="p-3 rounded-xl bg-[#0f1420] border border-amber-900/50 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-300">
                  {t.name}()
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-[9px] font-mono">
                  ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-1">
                {t.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Persistent Vector Memory Bank */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
            <Database className="w-4 h-4" /> Hermes Vector Memory Core ({memories.length} records)
          </label>
          {memories.length > 0 && (
            <button
              onClick={() => {
                sound.alert();
                onClearMemories();
              }}
              className="text-[10px] font-mono text-red-400 hover:text-red-300 transition-colors"
            >
              PURGE MEMORY
            </button>
          )}
        </div>

        {/* Add Memory Form */}
        <form onSubmit={handleCreateMemory} className="p-3 rounded-xl bg-[#0f1420] border border-purple-900/50 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              aria-label="Memory key"
              placeholder="Key (e.g. TARGET_IP)..."
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="bg-[#090d16] border border-slate-800 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
            <input
              type="text"
              aria-label="Memory value"
              placeholder="Value / Context data..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="bg-[#090d16] border border-slate-800 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
            <select
              aria-label="Memory category"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value as any)}
              className="bg-[#090d16] border border-slate-800 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300 focus:outline-none"
            >
              <option value="TACTICAL">TACTICAL</option>
              <option value="DEVICE">DEVICE</option>
              <option value="ENVIRONMENT">ENVIRONMENT</option>
              <option value="TASK">TASK</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{savedSuccess ? 'RECORD STORED' : 'STORE MEMORY RECORD'}</span>
          </button>
        </form>

        {/* Existing Memory List */}
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {memories.map((m) => (
            <div
              key={m.id}
              className="p-2.5 rounded-lg bg-[#090d16] border border-slate-900 flex items-center justify-between text-xs font-mono"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">{m.key}</span>
                  <span className="text-[9px] px-1 rounded bg-purple-950/80 text-purple-300 border border-purple-800">
                    {m.category}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] truncate mt-0.5">{m.value}</p>
              </div>
              <button
                onClick={() => {
                  sound.click();
                  onDeleteMemory(m.id);
                }}
                className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                title="Delete Record"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
