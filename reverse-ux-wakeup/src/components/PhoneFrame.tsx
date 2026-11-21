import React from 'react';
import { BatteryCharging, Signal, Wifi } from 'lucide-react';

interface PhoneFrameProps {
  clock: string;
  bedLabel: string;
  roommateName: string;
  accentHex: string;
  isAlarmActive: boolean;
  isMobileFullscreen: boolean;
  children: React.ReactNode;
}

export function PhoneFrame({
  clock,
  bedLabel,
  roommateName,
  accentHex,
  isAlarmActive,
  isMobileFullscreen,
  children,
}: PhoneFrameProps) {
  if (isMobileFullscreen) {
    return (
      <div className="relative flex min-h-dvh w-full flex-col bg-[#0B1120] text-slate-100 [transform:translateZ(0)]">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800/90 bg-[#090E1A]/95 px-4 py-2 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-black tracking-tight text-white">
              {clock}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold text-slate-950"
              style={{ backgroundColor: accentHex }}
            >
              {bedLabel} · {roommateName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Signal className="h-3.5 w-3.5" />
            <Wifi className="h-3.5 w-3.5" />
            <BatteryCharging className="h-4 w-4 text-[#FACC15]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex shrink-0 flex-col items-center select-none">
      {/* Side hardware buttons */}
      <div className="pointer-events-none absolute top-28 -left-1.5 h-8 w-1.5 rounded-l-md bg-slate-700" />
      <div className="pointer-events-none absolute top-40 -left-1.5 h-14 w-1.5 rounded-l-md bg-slate-700" />
      <div className="pointer-events-none absolute top-58 -left-1.5 h-14 w-1.5 rounded-l-md bg-slate-700" />
      <div className="pointer-events-none absolute top-44 -right-1.5 h-20 w-1.5 rounded-r-md bg-slate-700" />

      {/* Outer Titanium Bezel */}
      <div
        className={`relative flex h-[836px] w-[412px] flex-col overflow-hidden rounded-[50px] border-[9px] bg-[#0B1120] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85)] transition-colors duration-300 ${
          isAlarmActive
            ? 'alarm-glow border-red-500/90'
            : 'border-slate-800 ring-1 ring-slate-700/80'
        }`}
      >
        {/* Inner Viewport with transform:translateZ(0) so fixed modals stay inside phone screen */}
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0B1120] [transform:translateZ(0)]">
          {/* iOS Dynamic Island & Status Bar */}
          <div className="relative z-30 flex shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#070B14] px-6 pt-3 pb-2.5">
            <span className="font-mono text-xs font-extrabold tracking-wider text-slate-100">
              {clock}
            </span>

            {/* Dynamic Island */}
            <div className="flex h-6 items-center gap-1.5 rounded-full border border-slate-800 bg-black px-3.5 shadow-inner">
              <span
                className={`h-2 w-2 rounded-full ${
                  isAlarmActive ? 'animate-ping bg-red-500' : 'bg-emerald-400'
                }`}
              />
              <span className="text-[10px] font-bold tracking-tight text-slate-200">
                {bedLabel} · {roommateName}
              </span>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <Signal className="h-3 w-3" />
              <Wifi className="h-3 w-3" />
              <BatteryCharging className="h-3.5 w-3.5 text-[#FACC15]" />
            </div>
          </div>

          {/* Scrollable Phone Content */}
          <div className="flex-1 overflow-x-hidden overflow-y-auto select-text">
            {children}
          </div>

          {/* Home Indicator Bar */}
          <div className="flex shrink-0 justify-center bg-[#070B14]/95 py-2">
            <div className="h-1 w-32 rounded-full bg-slate-600/80" />
          </div>
        </div>
      </div>
    </div>
  );
}
