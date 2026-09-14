import React, { useState } from 'react';
import { 
  Radio, 
  Send, 
  Wifi, 
  Zap, 
  Activity, 
  ShieldCheck, 
  Clock, 
  RefreshCw,
  Server,
  Layers,
  ArrowRight,
  Terminal,
  Volume2
} from 'lucide-react';
import { CommChannel, CommPacket } from '../types';
import { sound } from '../utils/audio';

interface CommChannelsViewProps {
  channels: CommChannel[];
  onBroadcastPacket: (channelId: string, payload: string, from?: string, to?: string) => Promise<void>;
  onRefreshChannels: () => Promise<void>;
}

export const CommChannelsView: React.FC<CommChannelsViewProps> = ({
  channels,
  onBroadcastPacket,
  onRefreshChannels,
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(channels[0]?.id || 'chan-c2');
  const [testPayload, setTestPayload] = useState('');
  const [sender, setSender] = useState('OPERATOR');
  const [recipient, setRecipient] = useState('HERMES-CORE');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) || channels[0];

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPayload.trim()) return;

    sound.dispatch();
    setIsBroadcasting(true);
    try {
      await onBroadcastPacket(selectedChannelId, testPayload.trim(), sender, recipient);
      setTestPayload('');
      sound.toolSuccess();
    } catch {
      // Handled in parent
    } finally {
      setIsBroadcasting(false);
    }
  };

  const totalThroughput = channels.reduce((acc, c) => acc + c.throughputKbps, 0).toFixed(1);
  const totalPackets = channels.reduce((acc, c) => acc + c.packetsPerSec, 0);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-[#080a0f] text-slate-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-950/80">
        <div>
          <h2 className="text-base sm:text-lg font-mono font-bold text-cyan-300 flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
            COMMUNICATION CHANNELS & INTER-AGENT MESH MONITOR
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real-time telemetry streams, Termux IPC Unix sockets, and agent P2P mesh bus.
          </p>
        </div>

        <button
          onClick={() => {
            sound.click();
            onRefreshChannels();
          }}
          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-mono text-xs flex items-center justify-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>POLL CHANNELS</span>
        </button>
      </div>

      {/* Overview Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-[#0f1420] border border-cyan-900/60">
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>ACTIVE PIPES</span>
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-cyan-300 mt-1">{channels.length}</div>
          <div className="text-[10px] font-mono text-emerald-400 mt-0.5">All links verified</div>
        </div>

        <div className="p-3 rounded-xl bg-[#0f1420] border border-emerald-900/60">
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>TOTAL THROUGHPUT</span>
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-300 mt-1">
            {totalThroughput} <span className="text-xs font-normal text-slate-400">KB/s</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">Aggregated band</div>
        </div>

        <div className="p-3 rounded-xl bg-[#0f1420] border border-purple-900/60">
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>PACKET VELOCITY</span>
            <Activity className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-purple-300 mt-1">
            {totalPackets} <span className="text-xs font-normal text-slate-400">pkt/s</span>
          </div>
          <div className="text-[10px] font-mono text-purple-400 mt-0.5">Zero packet loss</div>
        </div>

        <div className="p-3 rounded-xl bg-[#0f1420] border border-amber-900/60">
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>AVG IPC LATENCY</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-amber-300 mt-1">
            {channels.length > 0 ? Math.round(channels.reduce((a, b) => a + b.latencyMs, 0) / channels.length) : 5}
            <span className="text-xs font-normal text-slate-400"> ms</span>
          </div>
          <div className="text-[10px] font-mono text-amber-400 mt-0.5">Snapdragon bus</div>
        </div>
      </div>

      {/* Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {channels.map((chan) => {
          const isSelected = selectedChannelId === chan.id;
          return (
            <div
              key={chan.id}
              onClick={() => {
                sound.click();
                setSelectedChannelId(chan.id);
              }}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-cyan-950/40 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.18)]'
                  : 'bg-[#0f1420] border-cyan-900/40 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {chan.name}
                  </span>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    {chan.type} • {chan.activeListeners} Listeners
                  </div>
                </div>

                <span className="px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-800 text-[9px] font-mono font-bold">
                  {chan.status}
                </span>
              </div>

              <p className="text-[11px] font-sans text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                {chan.description}
              </p>

              <div className="grid grid-cols-3 gap-1 pt-2.5 mt-2 border-t border-slate-800/80 text-[10px] font-mono text-center">
                <div className="bg-[#090d16] p-1 rounded border border-slate-800">
                  <span className="text-slate-500 block">BANDWIDTH</span>
                  <span className="text-cyan-300 font-bold">{chan.throughputKbps} KB/s</span>
                </div>
                <div className="bg-[#090d16] p-1 rounded border border-slate-800">
                  <span className="text-slate-500 block">PACKETS</span>
                  <span className="text-purple-300 font-bold">{chan.packetsPerSec} /s</span>
                </div>
                <div className="bg-[#090d16] p-1 rounded border border-slate-800">
                  <span className="text-slate-500 block">LATENCY</span>
                  <span className="text-amber-300 font-bold">{chan.latencyMs}ms</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Packet Broadcast Console & Stream */}
      <div className="p-3.5 rounded-xl bg-[#0f1420] border border-cyan-900/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
              Active Channel Inspector: <span className="text-amber-400">{selectedChannel?.name}</span>
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {selectedChannel?.recentPackets?.length || 0} Recent Packets
          </span>
        </div>

        {/* Injection / Broadcast form */}
        <form onSubmit={handleBroadcast} className="p-3 rounded-lg bg-[#090d16] border border-cyan-950 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
            <div>
              <label className="text-slate-500 block text-[10px] mb-1">Origin Entity</label>
              <select
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                className="w-full bg-[#0d121c] border border-slate-800 focus:border-cyan-500 rounded px-2 py-1 text-slate-200"
              >
                <option value="OPERATOR">OPERATOR (War Room C2)</option>
                <option value="HERMES-CORE">HERMES-CORE</option>
                <option value="HERMES-ALPHA">HERMES-ALPHA (Recon)</option>
                <option value="HERMES-BRAVO">HERMES-BRAVO (Exploit)</option>
                <option value="HERMES-DELTA">HERMES-DELTA (Audit)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-500 block text-[10px] mb-1">Target Entity</label>
              <select
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-[#0d121c] border border-slate-800 focus:border-cyan-500 rounded px-2 py-1 text-slate-200"
              >
                <option value="HERMES-CORE">HERMES-CORE</option>
                <option value="ALL-AGENTS">ALL-AGENTS (Broadcast)</option>
                <option value="HERMES-ALPHA">HERMES-ALPHA</option>
                <option value="HERMES-BRAVO">HERMES-BRAVO</option>
                <option value="TERMUX-PTS0">TERMUX-PTS0 (Daemon)</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="text-slate-500 block text-[10px] mb-1">Transmission Mode</label>
              <span className="text-cyan-400 text-[11px] font-bold py-1">
                ENCRYPTED AES-256 GCM
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Inject tactical message or telemetry probe payload..."
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              className="flex-1 bg-[#0d121c] border border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isBroadcasting || !testPayload.trim()}
              className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isBroadcasting ? 'INJECTING...' : 'DISPATCH'}</span>
            </button>
          </div>
        </form>

        {/* Live Packet Log Stream */}
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {(!selectedChannel?.recentPackets || selectedChannel.recentPackets.length === 0) ? (
            <div className="text-slate-500 text-center py-6 text-xs font-mono">
              No recent transmission packets recorded in buffer.
            </div>
          ) : (
            selectedChannel.recentPackets.map((pkt) => (
              <div
                key={pkt.id}
                className="p-2 rounded bg-[#090d16] border border-slate-900 flex items-start justify-between gap-2 font-mono text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-slate-500">{pkt.timestamp}</span>
                    <span className="text-cyan-400 font-bold">{pkt.from}</span>
                    <ArrowRight className="w-3 h-3 text-slate-600" />
                    <span className="text-amber-400 font-bold">{pkt.to}</span>
                    <span className="text-slate-500">({pkt.sizeBytes} bytes)</span>
                  </div>
                  <div className="text-slate-300 text-[11px] truncate mt-1 bg-[#05070a] p-1.5 rounded border border-slate-900">
                    {pkt.payloadSnippet}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
