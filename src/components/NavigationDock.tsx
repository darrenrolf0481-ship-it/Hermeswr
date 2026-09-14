import React from 'react';
import { 
  Terminal, 
  Activity, 
  PenTool, 
  Layers, 
  MessageSquareCode,
  Users,
  CheckSquare,
  Radio,
  Sliders
} from 'lucide-react';
import { WarRoomTab } from '../types';
import { sound } from '../utils/audio';

interface NavigationDockProps {
  activeTab: WarRoomTab;
  onSelectTab: (tab: WarRoomTab) => void;
  unreadLogsCount?: number;
}

export const NavigationDock: React.FC<NavigationDockProps> = ({
  activeTab,
  onSelectTab,
  unreadLogsCount = 0,
}) => {
  const tabs: { id: WarRoomTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'command', label: 'C2 WAR ROOM', icon: MessageSquareCode },
    { id: 'telemetry', label: 'DASHBOARD', icon: Activity, badge: unreadLogsCount > 0 ? unreadLogsCount : undefined },
    { id: 'tasks', label: 'TASKS', icon: CheckSquare },
    { id: 'agents', label: 'DEPLOYMENT', icon: Users },
    { id: 'comms', label: 'COMMS MESH', icon: Radio },
    { id: 'tuning', label: 'TUNING', icon: Sliders },
    { id: 'termux', label: 'TERMUX CLI', icon: Terminal },
    { id: 'stylus', label: 'STYLUS PAD', icon: PenTool },
    { id: 'matrix', label: 'MATRIX', icon: Layers },
  ];

  return (
    <nav className="w-full bg-[#080b11]/95 backdrop-blur border-t border-cyan-950/80 py-1 px-2 z-40 shrink-0 select-none">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 max-w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => {
                sound.click();
                onSelectTab(tab.id);
              }}
              className={`relative flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl transition-all duration-150 shrink-0 ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-110 text-cyan-400' : ''}`} />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full bg-cyan-500 text-[8px] font-bold text-black min-w-[12px] text-center">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-mono tracking-wider font-semibold whitespace-nowrap ${isActive ? 'text-cyan-200 font-bold' : 'text-slate-400'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

