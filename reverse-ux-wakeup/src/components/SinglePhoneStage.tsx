import React, { useMemo, useState } from 'react';
import { Columns4, LayoutDashboard, RotateCcw, ShieldCheck, Wifi } from 'lucide-react';
import {
  assertMoneyConservation,
  DEFAULT_WAKE_TIME,
  formatYuan,
} from '../core/dormEngine';
import { ConnectionStatus, SyncMode, ViewMode } from '../core/syncClient';
import { DormAction, DormState, ROOMMATE_IDS, RoommateId } from '../types/dorm';
import { PhoneFrame } from './PhoneFrame';
import { RoommatePhoneScreen } from './RoommatePhoneScreen';
import { SettlementModal } from './SettlementModal';
import { WakeTimePicker } from './WakeTimePicker';

interface SinglePhoneStageProps {
  dormState: DormState;
  activeRole: RoommateId;
  onSelectRole: (role: RoommateId) => void;
  isMobileViewport: boolean;
  syncMode: SyncMode;
  connectionStatus: ConnectionStatus;
  serverOnline: boolean;
  onDispatch: (action: DormAction) => void;
  onChangeView: (view: ViewMode) => void;
}

export function SinglePhoneStage({
  dormState,
  activeRole,
  onSelectRole,
  isMobileViewport,
  syncMode,
  connectionStatus,
  serverOnline,
  onDispatch,
  onChangeView,
}: SinglePhoneStageProps) {
  const [showSettlement, setShowSettlement] = useState<boolean>(false);
  const me = dormState.roommates[activeRole];
  const wakeTime = dormState.targetWakeTime || DEFAULT_WAKE_TIME;
  const conservation = useMemo(
    () => assertMoneyConservation(dormState),
    [dormState]
  );

  const isAlarmBlaring =
    me.status === 'ringing_stage1' ||
    me.status === 'being_raided' ||
    me.status === 'snooze_typing';

  const wsConnected = syncMode === 'lan' && connectionStatus === 'connected';

  return (
    <div
      className={
        isMobileViewport
          ? 'min-h-dvh w-full bg-[#070B14]'
          : 'ledger-grid-bg flex min-h-dvh w-full flex-col items-center justify-center px-4 py-2.5'
      }
    >
      {/* Restrained Semi-Transparent Mini Capsule Bar (Desktop Only) */}
      {!isMobileViewport && (
        <div className="mb-2.5 flex flex-wrap items-center justify-center gap-2 rounded-full border border-slate-800/80 bg-slate-950/75 px-3.5 py-1.5 text-[11px] shadow-xl backdrop-blur">
          <span className="font-black text-[#FACC15]">Rise &amp; Fine · 404个人端</span>

          <span className="h-3 w-px bg-slate-800" />

          <div className="flex items-center gap-1">
            {ROOMMATE_IDS.map((id) => {
              const r = dormState.roommates[id];
              const selected = id === activeRole;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectRole(id)}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                    selected
                      ? 'bg-[#FACC15] text-slate-950 shadow'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      selected
                        ? 'bg-slate-950'
                        : r.status === 'awake'
                          ? 'bg-emerald-400'
                          : 'bg-amber-400'
                    }`}
                  />
                  {r.shortName}
                </button>
              );
            })}
          </div>

          <span className="h-3 w-px bg-slate-800" />

          <WakeTimePicker
            value={wakeTime}
            onChange={(nextWakeTime) =>
              onDispatch({
                type: 'SET_WAKE_TIME',
                targetWakeTime: nextWakeTime,
              })
            }
            variant="inline"
            showPresets={false}
          />

          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-400">
            <ShieldCheck className="h-3 w-3" />
            {formatYuan(conservation.actualTotalCents)}
          </span>

          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
              wsConnected || serverOnline ? 'text-emerald-300' : 'text-slate-400'
            }`}
          >
            <Wifi className="h-3 w-3" />
            {wsConnected ? 'WS实时联机' : '本机清算'}
          </span>

          <span className="h-3 w-px bg-slate-800" />

          <button
            type="button"
            onClick={() => onDispatch({ type: 'RESET_DAY', clock: '23:30' })}
            title="重置新一天"
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" />
            重置
          </button>

          <button
            type="button"
            onClick={() => onChangeView('quad')}
            className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/90 px-2 py-0.5 text-[10px] font-semibold text-slate-400 hover:border-slate-600 hover:text-white"
          >
            <Columns4 className="h-2.5 w-2.5" />
            4机同屏
          </button>

          <button
            type="button"
            onClick={() => onChangeView('director')}
            className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/90 px-2 py-0.5 text-[10px] font-semibold text-slate-400 hover:border-slate-600 hover:text-white"
          >
            <LayoutDashboard className="h-2.5 w-2.5" />
            总控台
          </button>
        </div>
      )}

      <PhoneFrame
        variant={isMobileViewport ? 'fullscreen' : 'default'}
        clock={dormState.currentClock}
        bedLabel={me.badgeLabel}
        roommateName={me.name}
        accentHex={me.accentHex}
        isAlarmActive={isAlarmBlaring}
        wsBadgeText={wsConnected ? 'WS联机' : undefined}
      >
        <RoommatePhoneScreen
          dormState={dormState}
          role={activeRole}
          canSwitchRoleInHeader={true}
          onSelectRole={onSelectRole}
          onDispatch={onDispatch}
          onOpenSettlement={() => setShowSettlement(true)}
        />
      </PhoneFrame>

      {showSettlement && (
        <SettlementModal
          dormState={dormState}
          onClose={() => setShowSettlement(false)}
          onResetDay={() => onDispatch({ type: 'RESET_DAY', clock: '23:30' })}
        />
      )}
    </div>
  );
}
