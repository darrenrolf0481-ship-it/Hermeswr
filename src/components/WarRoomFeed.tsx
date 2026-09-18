import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Terminal, 
  Brain, 
  ChevronDown, 
  ChevronRight, 
  Sparkles, 
  Zap, 
  RefreshCw, 
  Radio, 
  ShieldCheck, 
  Code2, 
  Layers, 
  Paperclip, 
  CheckCircle2, 
  Play, 
  Bot, 
  User,
  Share2,
  Mic,
  MicOff,
  Volume2,
  HelpCircle,
  X,
  Activity,
  AlertCircle,
  Headphones,
  Check
} from 'lucide-react';
import { AgentMessage, AgentState, ToolInvocation, SubAgentInfo } from '../types';
import { sound } from '../utils/audio';
import { useTacticalSpeechRecognition } from '../hooks/useTacticalSpeechRecognition';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface WarRoomFeedProps {
  messages: AgentMessage[];
  agentState: AgentState;
  onSendMessage: (prompt: string, attachedSketch?: string) => Promise<void>;
  subAgents: SubAgentInfo[];
  latestSketchDataUrl: string | null;
  activePersona: string;
}

export const WarRoomFeed: React.FC<WarRoomFeedProps> = ({
  messages,
  agentState,
  onSendMessage,
  subAgents,
  latestSketchDataUrl,
  activePersona,
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [useAttachedSketch, setUseAttachedSketch] = useState(false);
  const [expandedScratchpads, setExpandedScratchpads] = useState<Record<string, boolean>>({});
  const [showVoiceGuide, setShowVoiceGuide] = useState(false);
  const [lastVoiceCommand, setLastVoiceCommand] = useState<string | null>(null);

  const voiceGuideRef = useDialogFocus<HTMLDivElement>(showVoiceGuide, () => setShowVoiceGuide(false));

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, agentState]);

  const toggleScratchpad = (id: string) => {
    setExpandedScratchpads((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSend = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const text = (customPrompt !== undefined ? customPrompt : inputPrompt).trim();
    if (!text && !useAttachedSketch) return;

    sound.dispatch();
    const promptToSend = text || 'Analyze attached tactical stylus schematic.';
    const sketch = useAttachedSketch && latestSketchDataUrl ? latestSketchDataUrl : undefined;
    
    setInputPrompt('');
    setUseAttachedSketch(false);
    speech.resetTranscript();
    await onSendMessage(promptToSend, sketch);
  };

  const speech = useTacticalSpeechRecognition({
    onFinalTranscript: (text) => {
      setInputPrompt(text);
    },
    onAutoDispatch: (fullText) => {
      if (fullText.trim()) {
        handleSend(undefined, fullText);
      }
    },
    onCommandTriggered: (cmd) => {
      setLastVoiceCommand(cmd);
      setTimeout(() => setLastVoiceCommand(null), 3000);
      if (cmd === 'CLEAR') {
        setInputPrompt('');
        sound.micOff();
      } else if (cmd === 'TRANSMIT') {
        sound.dispatch();
      } else if (cmd === 'ATTACH_SKETCH') {
        if (latestSketchDataUrl) {
          setUseAttachedSketch(true);
          sound.toolSuccess();
        }
      }
    },
    autoDispatchDelayMs: 2200,
  });

  const quickDirectives = [
    { label: '🛡️ Audit Ports & Gateway', prompt: 'Audit local Termux listening ports and gateway security posture.' },
    { label: '🔋 Termux Battery & Hardware', prompt: 'Check Moto G5 Stylus 2025 hardware thermal, memory, and battery status.' },
    { label: '🐍 Execute Python Daemon', prompt: 'Initialize an autonomous Hermes Python daemon in Termux to monitor telemetry.' },
    { label: '🛰️ Deploy Child Agents', prompt: 'Dispatch child agents Alpha (Recon) and Bravo (Code) on parallel audit vectors.' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080a0f] overflow-hidden">
      {/* Sub-Agent Status Ribbon */}
      <div className="bg-[#0f141f] border-b border-cyan-950/60 px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Radio className="w-3 h-3 text-cyan-400 animate-pulse" /> SQUAD:
        </span>
        {subAgents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#161d2d] border border-cyan-900/40 text-[11px] font-mono shrink-0"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                agent.status === 'ENGAGED'
                  ? 'bg-amber-400 animate-ping'
                  : agent.status === 'RECON'
                  ? 'bg-cyan-400 animate-pulse'
                  : 'bg-emerald-400'
              }`}
            />
            <span className="text-slate-200 font-semibold">{agent.name}</span>
            <span className="text-[9px] px-1 rounded bg-black/40 text-cyan-400">
              {agent.status}
            </span>
          </div>
        ))}
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.map((msg) => {
          const isAssistant = msg.role === 'assistant';
          const isExpanded = expandedScratchpads[msg.id] ?? true; // Default open for visibility

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'} w-full`}
            >
              <div
                className={`max-w-[95%] sm:max-w-[85%] rounded-2xl p-3 sm:p-4 border transition-all ${
                  isAssistant
                    ? 'bg-[#0f1420] border-cyan-900/50 text-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
                    : 'bg-gradient-to-br from-cyan-950/80 to-blue-950/80 border-cyan-700/60 text-cyan-100 shadow-[0_2px_12px_rgba(6,182,212,0.15)]'
                }`}
              >
                {/* Header Tag */}
                <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/5 font-mono text-[10px]">
                  <div className="flex items-center gap-1.5">
                    {isAssistant ? (
                      <>
                        <div className="p-1 rounded bg-cyan-950/90 text-cyan-400 border border-cyan-800/60">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-cyan-300">HERMES-3 // {activePersona}</span>
                        {msg.model && (
                          <span className="hidden sm:inline text-slate-500">({msg.model})</span>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="p-1 rounded bg-blue-900/60 text-blue-300">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-cyan-200">OPERATOR</span>
                      </>
                    )}
                  </div>
                  <span className="text-slate-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                {/* Attached Stylus Sketch Preview (if sent) */}
                {msg.sketchUrl && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-cyan-700/60 bg-black/60 p-1">
                    <div className="flex items-center justify-between px-2 py-1 text-[10px] font-mono text-cyan-400">
                      <span>STYLUS SKETCH ATTACHMENT</span>
                      <span>MOTO G5 STYLUS</span>
                    </div>
                    <img
                      src={msg.sketchUrl}
                      alt="Stylus sketch"
                      className="w-full max-h-48 object-contain rounded bg-slate-950"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {/* Hermes Cognitive Scratchpad (Nous Hermes format) */}
                {msg.scratchpad && (
                  <div className="mb-3 rounded-xl bg-[#090d15] border border-cyan-900/60 overflow-hidden">
                    <button
                      onClick={() => toggleScratchpad(msg.id)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-cyan-950/40 hover:bg-cyan-950/60 text-cyan-300 text-xs font-mono transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Brain className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                        <span className="font-bold uppercase tracking-wider text-[11px]">
                          Cognitive Scratchpad (&lt;scratchpad&gt;)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-cyan-400/80">
                        <span>{isExpanded ? 'COLLAPSE' : 'EXPAND'}</span>
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="p-3 font-mono text-xs text-cyan-200/90 bg-[#070a10] border-t border-cyan-950/60 whitespace-pre-wrap leading-relaxed">
                        {msg.scratchpad}
                      </div>
                    )}
                  </div>
                )}

                {/* Hermes Tool Calls */}
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {msg.toolsUsed.map((tool) => (
                      <div
                        key={tool.id}
                        className="rounded-xl bg-[#070b12] border border-amber-900/50 overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-950/30 border-b border-amber-900/40 text-amber-300 font-mono text-xs">
                          <div className="flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-amber-400" />
                            <span className="font-bold">TOOL INVOCATION: {tool.tool}</span>
                          </div>
                          <span className="text-[10px] text-amber-400/70">
                            {tool.executionTimeMs ? `${tool.executionTimeMs}ms` : 'COMPLETE'}
                          </span>
                        </div>
                        {tool.args && (
                          <div className="px-3 py-1.5 bg-black/40 text-[11px] font-mono text-slate-400 border-b border-slate-900">
                            <span className="text-amber-500/80">ARGS: </span>
                            {JSON.stringify(tool.args)}
                          </div>
                        )}
                        {tool.output && (
                          <div className="p-3 font-mono text-xs text-emerald-400 bg-black/70 overflow-x-auto whitespace-pre-wrap leading-tight">
                            {tool.output}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Core Synthesized Content */}
                <div className="text-sm font-sans whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>

                {/* Token Telemetry Badge */}
                {msg.tokens && (
                  <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      {msg.tokens.total} tokens
                    </span>
                    <span>{msg.tokens.speedTokPerSec} tok/s</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Real-time Agent Thinking Indicator */}
        {agentState !== 'IDLE' && (
          <div className="flex items-start gap-2 w-full">
            <div className="max-w-[90%] rounded-2xl p-3 bg-[#0f1420] border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] font-mono text-xs">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400 animate-spin" />
                <span className="font-bold uppercase tracking-wider">
                  HERMES AGENT: {agentState}...
                </span>
              </div>
              <p className="mt-1.5 text-slate-400 text-[11px]">
                {agentState === 'REASONING' && 'Populating <scratchpad> and formulating execution vector...'}
                {agentState === 'EXECUTING_TOOL' && 'Executing Termux shell commands on aarch64 runtime...'}
                {agentState === 'SYNTHESIZING' && 'Synthesizing tactical report for operator...'}
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Fast Tactical Quick Directives Bar */}
      <div className="px-3 py-1.5 bg-[#0a0d14] border-t border-cyan-950/70 overflow-x-auto no-scrollbar flex items-center gap-2">
        <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold shrink-0">
          DIRECTIVES:
        </span>
        {quickDirectives.map((d, i) => (
          <button
            key={i}
            id={`btn-quick-directive-${i}`}
            onClick={() => {
              sound.click();
              setInputPrompt(d.prompt);
              if (textareaRef.current) {
                textareaRef.current.focus();
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-[#141a27] hover:bg-cyan-950/70 border border-slate-800 hover:border-cyan-800/80 text-[11px] font-mono text-slate-300 hover:text-cyan-300 transition-colors shrink-0 whitespace-nowrap active:scale-95"
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Voice Directive Transceiver HUD (When active, hands-free engaged, buffer holding words, or error) */}
      {(speech.isListening || speech.handsFreeMode || speech.transcript || speech.interimTranscript || speech.error || lastVoiceCommand) && (
        <div className="px-3 py-2 bg-[#090d16] border-t border-cyan-800/60 flex flex-col gap-2">
          {/* HUD Top Bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded-md ${speech.isListening ? 'bg-red-950/80 text-red-400 border border-red-700/80 animate-pulse' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>
                <Radio className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-cyan-300 text-[11px] uppercase tracking-wider">
                  VOICE DIRECTIVE TRANSCEIVER
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                  speech.isListening 
                    ? 'bg-red-950/90 text-red-300 border border-red-800' 
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}>
                  {speech.isListening ? 'CAPTURE ACTIVE' : 'STANDBY'}
                </span>
              </div>

              {/* Dynamic Tactical Equalizer Bars */}
              {speech.isListening && (
                <div className="flex items-center gap-0.5 h-3.5 px-1 bg-black/40 rounded border border-cyan-950">
                  {[0.4, 0.9, 0.6, 1.0, 0.5].map((factor, idx) => {
                    const barHeight = Math.max(3, Math.min(14, Math.round(14 * speech.audioLevel * factor)));
                    return (
                      <span
                        key={idx}
                        className="w-1 bg-cyan-400 rounded-sm transition-all duration-75"
                        style={{ height: `${barHeight}px` }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right-aligned HUD controls */}
            <div className="flex items-center gap-1.5">
              {/* Hands-free mode toggle button */}
              <button
                type="button"
                id="btn-toggle-hands-free"
                onClick={() => {
                  sound.click();
                  speech.setHandsFreeMode(!speech.handsFreeMode);
                }}
                className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors ${
                  speech.handsFreeMode
                    ? 'bg-amber-950/90 border-amber-500 text-amber-300 font-bold shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                    : 'bg-[#141a27] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Hands-Free Auto-Dispatch Mode: Automatically sends prompt after speech pauses or upon vocal command"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>HANDS-FREE: {speech.handsFreeMode ? 'ON' : 'OFF'}</span>
              </button>

              {/* Voice Guide / Cheat sheet toggle */}
              <button
                type="button"
                onClick={() => {
                  sound.click();
                  setShowVoiceGuide(true);
                }}
                className="p-1.5 rounded bg-[#141a27] hover:bg-cyan-950 border border-slate-800 text-slate-400 hover:text-cyan-300"
                title="Tactical Voice Directives Guide"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>

              {/* Clear Speech Buffer */}
              {(speech.transcript || inputPrompt) && (
                <button
                  type="button"
                  onClick={() => {
                    sound.click();
                    speech.resetTranscript();
                    setInputPrompt('');
                  }}
                  className="px-1.5 py-1 rounded bg-slate-900 hover:bg-red-950 border border-slate-800 hover:border-red-800 text-slate-400 hover:text-red-300 text-[10px]"
                >
                  CLEAR
                </button>
              )}

              {/* Mic Toggle button in HUD */}
              <button
                type="button"
                onClick={speech.toggleListening}
                className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 border ${
                  speech.isListening
                    ? 'bg-red-950 hover:bg-red-900 border-red-700 text-red-200'
                    : 'bg-cyan-950 hover:bg-cyan-900 border-cyan-700 text-cyan-200'
                }`}
              >
                {speech.isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                <span>{speech.isListening ? 'DISENGAGE' : 'ENGAGE MIC'}</span>
              </button>
            </div>
          </div>

          {/* Vocal trigger recognition flash */}
          {lastVoiceCommand && (
            <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500 text-cyan-200 text-[11px] font-mono flex items-center gap-2 animate-bounce">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span className="font-bold uppercase">VOICE COMMAND TRIGGERED:</span>
              <span className="text-amber-300 font-bold">"{lastVoiceCommand}"</span>
              <span className="text-slate-400 ml-auto text-[10px]">Action executed</span>
            </div>
          )}

          {/* Real-time transcription stream */}
          <div className="p-2 rounded-lg bg-[#070a10] border border-cyan-950 font-mono text-xs text-slate-200 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <Terminal className="w-3 h-3 text-cyan-400" />
                LIVE AUDIO TRANSCRIPTION BUFFER
              </span>
              <span>
                {speech.handsFreeMode ? 'Auto-Dispatch on 2.2s pause or "Execute Directive"' : 'Dictation Mode'}
              </span>
            </div>
            <div className="text-slate-100 min-h-[22px] flex items-center flex-wrap gap-1">
              <span>{speech.transcript || inputPrompt || (speech.isListening ? 'Awaiting tactical speech...' : 'Microphone idle')}</span>
              {speech.interimTranscript && (
                <span className="text-cyan-400 italic bg-cyan-950/40 px-1 rounded border border-cyan-800/40">
                  {speech.interimTranscript}
                </span>
              )}
              {speech.isListening && (
                <span className="inline-block w-2 h-3.5 bg-cyan-400 animate-pulse ml-0.5" />
              )}
            </div>
          </div>

          {/* Speech Error Banner if any */}
          {speech.error && (
            <div className="p-2 rounded-lg bg-red-950/80 border border-red-700/80 text-red-200 text-xs font-mono flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{speech.error}</span>
              </div>
              <button
                type="button"
                onClick={() => speech.startListening()}
                className="px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-white text-[10px]"
              >
                RETRY
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input Form Dock */}
      <form
        onSubmit={handleSend}
        className="p-2 sm:p-3 bg-[#0d111a] border-t border-cyan-950/80 flex flex-col gap-2"
      >
        {/* Attachment preview if stylus sketch is ready */}
        {useAttachedSketch && latestSketchDataUrl && (
          <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-cyan-950/50 border border-cyan-800 text-xs text-cyan-300 font-mono">
            <span className="flex items-center gap-1.5 truncate">
              <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
              Attached Moto G5 Stylus Schematic
            </span>
            <button
              type="button"
              onClick={() => setUseAttachedSketch(false)}
              className="text-slate-400 hover:text-red-400 ml-2"
            >
              Remove
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Stylus Sketch Quick Attach Toggle */}
          {latestSketchDataUrl && (
            <button
              type="button"
              id="btn-attach-stylus-sketch"
              onClick={() => {
                sound.click();
                setUseAttachedSketch(!useAttachedSketch);
              }}
              className={`p-2 rounded-xl border transition-colors ${
                useAttachedSketch
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Attach Moto G5 Stylus Sketch"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          )}

          {/* Voice Directive Entry Toggle Button */}
          <button
            type="button"
            id="btn-tactical-mic"
            onClick={speech.toggleListening}
            className={`p-2.5 rounded-xl border transition-all shrink-0 ${
              speech.isListening
                ? 'bg-red-950/90 border-red-500 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse'
                : speech.handsFreeMode
                ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                : 'bg-[#141a27] border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-800'
            }`}
            title={
              speech.isListening
                ? 'Disengage Tactical Microphone (Listening)'
                : 'Engage Voice-to-Text Directive Entry (Web Speech API)'
            }
          >
            {speech.isListening ? (
              <Mic className="w-4 h-4 text-red-400" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Text Input */}
          <textarea
            ref={textareaRef}
            id="warroom-prompt-input"
            aria-label="Operator prompt"
            rows={1}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              speech.isListening
                ? 'Listening to operator voice directive...'
                : useAttachedSketch 
                ? 'Direct Hermes on this sketch...' 
                : 'Issue directive to Hermes Agent (or speak voice command)...'
            }
            className={`flex-1 bg-[#121724] border focus:border-cyan-500/80 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none font-mono min-h-[42px] max-h-24 transition-colors ${
              speech.isListening ? 'border-red-600/70 shadow-[0_0_10px_rgba(239,68,68,0.15)]' : 'border-cyan-950/80'
            }`}
          />

          {/* Send Button */}
          <button
            type="submit"
            id="btn-send-directive"
            disabled={agentState !== 'IDLE' || (!inputPrompt.trim() && !useAttachedSketch)}
            className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 disabled:opacity-40 disabled:pointer-events-none text-black font-bold shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-all shrink-0 active:scale-95"
            aria-label="Send Directive"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Voice Directive Cheat Sheet & Command Guide Modal */}
      {showVoiceGuide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div
            ref={voiceGuideRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-guide-dialog-title"
            tabIndex={-1}
            className="w-full max-w-lg bg-[#0d121c] border border-cyan-600 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.3)] p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3">
              <div className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 id="voice-guide-dialog-title" className="font-mono font-bold text-cyan-300 text-sm sm:text-base">
                    TACTICAL VOICE DIRECTIVES GUIDE
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Web Speech API voice-to-text with hands-free autonomous dispatch.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVoiceGuide(false)}
                aria-label="Close voice directives guide"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs text-slate-300">
              {/* Voice Macro Triggers */}
              <div className="space-y-1.5">
                <span className="text-cyan-400 font-bold block uppercase text-[11px]">
                  Vocal Execution Triggers
                </span>
                <div className="space-y-1 bg-[#080b12] p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                    <span className="text-amber-300 font-bold">"Transmit directive" / "Execute directive"</span>
                    <span className="text-slate-400 text-[11px] text-right">Immediately dispatches prompt to Hermes squad</span>
                  </div>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 py-1.5">
                    <span className="text-red-300 font-bold">"Clear directive" / "Abort directive"</span>
                    <span className="text-slate-400 text-[11px] text-right">Clears speech buffer & prompt input</span>
                  </div>
                  <div className="flex items-start justify-between gap-2 pt-1.5">
                    <span className="text-emerald-300 font-bold">"Attach schematic" / "Attach sketch"</span>
                    <span className="text-slate-400 text-[11px] text-right">Attaches current Moto G5 Stylus schematic</span>
                  </div>
                </div>
              </div>

              {/* Hands-Free Mode */}
              <div className="space-y-1.5">
                <span className="text-amber-400 font-bold block uppercase text-[11px]">
                  Hands-Free Auto-Dispatch Mode
                </span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  When Hands-Free is enabled, the microphone keeps continuous vigilance. After you pause speaking for 2.2 seconds, the directive is automatically transmitted to Hermes agents without needing to touch the screen.
                </p>
              </div>

              {/* Hardware / Environment Note */}
              <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-900/60 text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Hardware Optimization: Moto G5 Stylus 2025 & Termux</span>
                </div>
                <p className="text-slate-400">
                  Direct microphone audio input leverages high-clarity Snapdragon beamforming on the Moto G5 Stylus 2025. Ensure microphone permissions are allowed when prompted by your browser.
                </p>
              </div>

              {/* Browser Engine Status */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#080b12] border border-slate-800 text-[11px]">
                <span className="text-slate-400">Web Speech API Support:</span>
                <span className={`font-bold flex items-center gap-1 ${speech.isSupported ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {speech.isSupported ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {speech.isSupported ? 'Supported & Online' : 'Not Supported in Browser'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-cyan-950">
              <button
                type="button"
                onClick={() => {
                  speech.setHandsFreeMode(!speech.handsFreeMode);
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 ${
                  speech.handsFreeMode 
                    ? 'bg-amber-950 border-amber-600 text-amber-300' 
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>{speech.handsFreeMode ? 'DISABLE HANDS-FREE' : 'ENABLE HANDS-FREE'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowVoiceGuide(false)}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold font-mono text-xs transition-colors shadow-[0_0_12px_rgba(6,182,212,0.3)]"
              >
                CLOSE GUIDE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
