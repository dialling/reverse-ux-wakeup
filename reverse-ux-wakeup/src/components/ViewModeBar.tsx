import React from 'react';
import { Columns4, LayoutDashboard, Smartphone } from 'lucide-react';
import { ViewMode } from '../core/syncClient';

interface ViewModeBarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  compact?: boolean;
}

export function ViewModeBar({
  currentView,
  onChangeView,
  compact = false,
}: ViewModeBarProps) {
  const items: Array<{ id: ViewMode; label: string; icon: React.ReactNode }> = [
    {
      id: 'director',
      label: compact ? '导播台' : '手机+导播台',
      icon: <LayoutDashboard className="h-3 w-3" />,
    },
    {
      id: 'quad',
      label: compact ? '4机同屏' : '4部联机同屏',
      icon: <Columns4 className="h-3 w-3" />,
    },
    {
      id: 'single',
      label: compact ? '单机纯享' : '单机纯享Demo',
      icon: <Smartphone className="h-3 w-3" />,
    },
  ];

  return (
    <div className="inline-flex items-center rounded-xl border border-slate-700/90 bg-slate-950/90 p-0.5">
      {items.map((item) => {
        const active = currentView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChangeView(item.id)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition ${
              active
                ? 'bg-[#FACC15] text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
