import React from 'react';
import { AlarmClock } from 'lucide-react';
import { isValidHHMM, QUICK_WAKE_TIMES } from '../core/dormEngine';

export type WakeTimePickerVariant = 'contract' | 'phone-strip' | 'console' | 'inline';

interface WakeTimePickerProps {
  value: string;
  onChange: (nextWakeTime: string) => void;
  variant?: WakeTimePickerVariant;
  showPresets?: boolean;
}

export function WakeTimePicker({
  value,
  onChange,
  variant = 'console',
  showPresets = true,
}: WakeTimePickerProps) {
  const safeValue = isValidHHMM(value) ? value : '07:00';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.slice(0, 5);
    if (isValidHHMM(raw) && raw !== safeValue) {
      onChange(raw);
    }
  };

  if (variant === 'inline') {
    return (
      <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-700/90 bg-slate-950/90 px-2 py-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#FACC15]">
          <AlarmClock className="h-3 w-3" />
          闹钟
        </span>
        <input
          type="time"
          aria-label="自选起床闹钟时间"
          value={safeValue}
          onChange={handleInputChange}
          className="h-5 rounded border border-[#FACC15]/50 bg-slate-900 px-1.5 font-mono text-[11px] font-black text-white [color-scheme:dark] focus:border-[#FACC15] focus:outline-none"
        />
        {showPresets && (
          <div className="hidden items-center gap-0.5 xl:flex">
            {QUICK_WAKE_TIMES.map((preset) => {
              const active = preset === safeValue;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange(preset)}
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition ${
                    active
                      ? 'bg-[#FACC15] text-slate-950'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'phone-strip') {
    return (
      <div className="mt-2 rounded-xl border border-slate-800/95 bg-slate-950/85 px-2.5 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-300">
            <AlarmClock className="h-3 w-3 text-[#FACC15]" />
            契约闹钟设定
          </span>
          <input
            type="time"
            aria-label="手机端起床闹钟时间"
            value={safeValue}
            onChange={handleInputChange}
            className="h-6 rounded-lg border border-[#FACC15]/60 bg-slate-900 px-2 font-mono text-[11px] font-black text-[#FACC15] [color-scheme:dark] focus:border-[#FACC15] focus:outline-none"
          />
        </div>
        {showPresets && (
          <div className="mt-1.5 grid grid-cols-5 gap-1">
            {QUICK_WAKE_TIMES.map((preset) => {
              const active = preset === safeValue;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange(preset)}
                  className={`rounded-md py-0.5 font-mono text-[10px] font-extrabold transition ${
                    active
                      ? 'bg-[#FACC15] text-slate-950 shadow'
                      : 'border border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'contract') {
    return (
      <div className="mt-2.5 rounded-xl border border-[#FACC15]/45 bg-slate-950/90 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#FACC15]">
            <AlarmClock className="h-3.5 w-3.5" />
            ⏰ 契约闹钟时间设定（支持任意分钟）
          </span>
          <input
            type="time"
            aria-label="契约书起床闹钟时间"
            value={safeValue}
            onChange={handleInputChange}
            className="h-7 rounded-lg border border-[#FACC15] bg-slate-900 px-2 font-mono text-xs font-black text-white shadow-inner [color-scheme:dark] focus:ring-2 focus:ring-[#FACC15]/40 focus:outline-none"
          />
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1">
          {QUICK_WAKE_TIMES.map((preset) => {
            const active = preset === safeValue;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(preset)}
                className={`rounded-lg py-1 font-mono text-[11px] font-extrabold transition ${
                  active
                    ? 'bg-[#FACC15] text-slate-950 shadow'
                    : 'border border-slate-800 bg-slate-900 text-slate-300 hover:border-[#FACC15]/60 hover:text-white'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Default: 'console'
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/85 px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#FACC15]">
          <AlarmClock className="h-4 w-4" />
          ⏰ 闹钟时间自选
        </span>
        <span className="text-[11px] text-slate-400">
          自由设定全寝起床时刻，各床位与关键时段实时联动
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="time"
          aria-label="总控台自选起床闹钟时间"
          value={safeValue}
          onChange={handleInputChange}
          className="h-8 rounded-xl border border-[#FACC15]/70 bg-slate-900 px-2.5 font-mono text-xs font-black text-white [color-scheme:dark] focus:border-[#FACC15] focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-1">
          {QUICK_WAKE_TIMES.map((preset) => {
            const active = preset === safeValue;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(preset)}
                className={`rounded-lg px-2.5 py-1 font-mono text-xs font-extrabold transition ${
                  active
                    ? 'bg-[#FACC15] text-slate-950 shadow'
                    : 'border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
