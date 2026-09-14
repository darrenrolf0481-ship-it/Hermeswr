import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal as TerminalIcon, 
  CornerDownLeft, 
  Trash2, 
  Copy, 
  Check, 
  Maximize2, 
  ChevronUp, 
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { sound } from '../utils/audio';

interface TerminalEntry {
  id: string;
  command: string;
  output: string;
  timestamp: string;
}

export const TermuxTerminal: React.FC = () => {
  const [entries, setEntries] = useState<TerminalEntry[]>([
    {
      id: 'init-1',
      command: 'uname -a && termux-battery-status',
      output: `Linux localhost 5.15.137-android14-moto-g5-stylus #1 SMP PREEMPT aarch64 Android
{
  "health": "GOOD",
  "percentage": 84,
  "plugged": "UNPLUGGED",
  "status": "DISCHARGING",
  "temperature": 34.6
}`,
      timestamp: '19:01:49',
    },
    {
      id: 'init-2',
      command: 'hermes --version',
      output: `HERMES AUTONOMOUS AGENT COMMAND CORE v3.4.1 (Termux aarch64)
System ready. Tool hooks: termux_shell, python_interpreter, vector_memory, recon`,
      timestamp: '19:01:50',
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [history, setHistory] = useState<string[]>([
    'uname -a && termux-battery-status',
    'hermes --version',
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copied, setCopied] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const executeCommand = async (cmdToRun: string) => {
    if (!cmdToRun.trim() || isExecuting) return;

    sound.dispatch();
    const command = cmdToRun.trim();
    setInputVal('');
    setIsExecuting(true);
    setHistory((prev) => [...prev, command]);
    setHistoryIndex(-1);

    if (command === 'clear') {
      setEntries([]);
      setIsExecuting(false);
      return;
    }

    try {
      const res = await fetch('/api/termux/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();

      setEntries((prev) => [
        ...prev,
        {
          id: `cmd-${Date.now()}`,
          command,
          output: data.output || 'Command executed with no output.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setEntries((prev) => [
        ...prev,
        {
          id: `cmd-err-${Date.now()}`,
          command,
          output: `Execution error: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
      ]);
    } finally {
      setIsExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand(inputVal);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const nextIdx = historyIndex + 1;
        if (nextIdx < history.length) {
          setHistoryIndex(nextIdx);
          setInputVal(history[nextIdx]);
        } else {
          setHistoryIndex(-1);
          setInputVal('');
        }
      }
    }
  };

  // Termux Mobile Soft Keys (Standard Termux key row)
  const termuxKeys = [
    { label: 'ESC', action: () => setInputVal('') },
    { label: 'TAB', action: () => setInputVal((prev) => prev + '  ') },
    { label: 'CTRL', action: () => sound.click() },
    { label: 'ALT', action: () => sound.click() },
    { label: '|', action: () => setInputVal((prev) => prev + ' | ') },
    { label: '/', action: () => setInputVal((prev) => prev + '/') },
    { label: '-', action: () => setInputVal((prev) => prev + '-') },
    { label: '~', action: () => setInputVal((prev) => prev + '~') },
    { label: '&&', action: () => setInputVal((prev) => prev + ' && ') },
    {
      label: '▲',
      action: () => {
        sound.click();
        if (history.length > 0) {
          const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
          setHistoryIndex(nextIdx);
          setInputVal(history[nextIdx]);
        }
      },
    },
    {
      label: '▼',
      action: () => {
        sound.click();
        if (historyIndex !== -1) {
          const nextIdx = historyIndex + 1;
          if (nextIdx < history.length) {
            setHistoryIndex(nextIdx);
            setInputVal(history[nextIdx]);
          } else {
            setHistoryIndex(-1);
            setInputVal('');
          }
        }
      },
    },
  ];

  const quickMacros = [
    { label: 'battery', cmd: 'termux-battery-status' },
    { label: 'wifi', cmd: 'termux-wifi-connectioninfo' },
    { label: 'ports', cmd: 'nmap localhost' },
    { label: 'storage', cmd: 'df -h' },
    { label: 'procs', cmd: 'ps aux' },
    { label: 'hermes', cmd: 'hermes status' },
  ];

  const copyTerminalText = () => {
    const text = entries.map((e) => `[termux@moto-g5-stylus ~]$ ${e.command}\n${e.output}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#05070a] text-slate-100 font-mono overflow-hidden">
      {/* Terminal Title Bar */}
      <div className="bg-[#0b0e14] border-b border-cyan-950/70 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-400">TERMUX // aarch64 MOTO G5</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">
            ACTIVE TTY
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyTerminalText}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 transition-colors"
            title="Copy Terminal Logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => {
              sound.click();
              setEntries([]);
            }}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-red-400 text-xs transition-colors"
            title="Clear Terminal Screen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 text-xs space-y-3 font-mono">
        {entries.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center gap-2 text-cyan-400">
              <span className="text-emerald-400 font-bold">u0_a248@moto-g5-stylus</span>
              <span className="text-slate-500">:</span>
              <span className="text-blue-400">~</span>
              <span className="text-slate-400">$</span>
              <span className="text-slate-100 font-semibold">{item.command}</span>
            </div>
            <pre className="text-emerald-300/90 whitespace-pre-wrap pl-2 border-l-2 border-emerald-900/60 leading-relaxed overflow-x-auto">
              {item.output}
            </pre>
          </div>
        ))}

        {isExecuting && (
          <div className="text-amber-400 text-xs flex items-center gap-2 animate-pulse">
            <span>Executing command on Termux runtime...</span>
          </div>
        )}

        <div ref={terminalEndRef} />
      </div>

      {/* Quick Macro Commands Ribbon */}
      <div className="px-3 py-1.5 bg-[#090c12] border-t border-slate-900 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[10px] text-slate-500 font-bold shrink-0">MACROS:</span>
        {quickMacros.map((macro, idx) => (
          <button
            key={idx}
            onClick={() => {
              sound.click();
              executeCommand(macro.cmd);
            }}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-800 text-[10px] text-cyan-300 hover:text-cyan-200 transition-colors shrink-0 active:scale-95"
          >
            ${macro.label}
          </button>
        ))}
      </div>

      {/* Interactive Command Input Line */}
      <div className="p-2 sm:p-3 bg-[#0a0d14] border-t border-cyan-950/70 flex items-center gap-2">
        <span className="text-emerald-400 font-bold text-xs shrink-0">$</span>
        <input
          ref={inputRef}
          id="termux-cli-input"
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type Termux command (e.g. termux-battery-status, nmap, pkg)..."
          className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-600 focus:outline-none text-xs font-mono"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          onClick={() => executeCommand(inputVal)}
          disabled={!inputVal.trim() || isExecuting}
          className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-black font-bold shrink-0 transition-colors"
          title="Run Command"
        >
          <CornerDownLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Termux Mobile Keyboard Ribbon (Crucial for Moto G5 touch keyboard) */}
      <div className="bg-[#05070a] border-t border-slate-900 px-2 py-1.5 grid grid-cols-11 gap-1 select-none">
        {termuxKeys.map((k, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              sound.click();
              k.action();
            }}
            className="py-1.5 rounded bg-[#111622] hover:bg-cyan-950 border border-slate-800 hover:border-cyan-700 text-slate-300 hover:text-cyan-300 text-[10px] font-bold transition-all text-center active:scale-90"
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
};
