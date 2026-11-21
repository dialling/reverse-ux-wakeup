import React, { useMemo, useState } from 'react';
import {
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import {
  assertMoneyConservation,
  DEFAULT_WAKE_TIME,
  formatYuan,
} from '../core/dormEngine';
import { getStoryActsForWakeTime } from '../core/storyActs';
import { ViewMode } from '../core/syncClient';
import { useQuadDormSync } from '../core/useQuadDormSync';
import { ROOMMATE_IDS } from '../types/dorm';
import { PhoneFrame } from './PhoneFrame';
import { RoommatePhoneScreen } from './RoommatePhoneScreen';
import { SettlementModal } from './SettlementModal';
import { ViewModeBar } from './ViewModeBar';
import { WakeTimePicker } from './WakeTimePicker';

interface QuadPhoneWallProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

export function QuadPhoneWall({
  currentView,
  onChangeView,
}: QuadPhoneWallProps) {
  const {
    phoneStates,
    primaryState,
    busMode,
    setBusMode,
    roleOnline,
    wsOnlineCount,
    lanInfo,
    dispatchFromPhone,
    jumpAllPhonesToAct,
    resetAllPhonesDay,
    setAllPhonesWakeTime,
  } = useQuadDormSync();

  const [showSettlement, setShowSettlement] = useState<boolean>(false);

  const conservation = useMemo(
    () => assertMoneyConservation(primaryState),
    [primaryState]
  );

  const wakeTime = primaryState.targetWakeTime || DEFAULT_WAKE_TIME;
  const dynamicActs = useMemo(() => getStoryActsForWakeTime(wakeTime), [wakeTime]);

  const totalConnectedPeers = lanInfo?.connectedClients ?? wsOnlineCount;

  return (
    <div className="ledger-grid-bg flex min-h-dvh w-full flex-col px-2.5 py-2">
      {/* Slim Top Status & Control Strip */}
      <header className="mx-auto mb-2 flex w-full max-w-[1480px] flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800/95 bg-[#0F172A]/95 px-3.5 py-2 shadow-lg backdrop-blur">
        {/* Brand + 3-View Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FACC15] text-xs font-black text-slate-950">
              404
            </span>
            <h1 className="text-sm font-black tracking-tight text-white">
              《醒醒！分钱了》Rise &amp; Fine · 4机同屏
            </h1>
          </div>

          <ViewModeBar currentView={currentView} onChangeView={onChangeView} compact />
        </div>

        {/* Center Conservation + Wake Time Picker + Live 4-Phone WS Sync Badge */}
        <div className="flex flex-wrap items-center gap-1.5">
          <WakeTimePicker
            value={wakeTime}
            onChange={setAllPhonesWakeTime}
            variant="inline"
            showPresets
          />

          <span className="inline-flex items-center gap-1 rounded-xl border border-[#FACC15]/40 bg-[#FACC15]/10 px-2 py-1 font-mono text-[11px] font-bold text-[#FACC15]">
            <ShieldCheck className="h-3.5 w-3.5" />
            资金守恒 {formatYuan(conservation.actualTotalCents)}
            {conservation.publicPoolCents > 0 &&
              ` (奖池 ${formatYuan(conservation.publicPoolCents)})`}
          </span>

          <button
            type="button"
            onClick={() => setBusMode(busMode === 'lan' ? 'local' : 'lan')}
            title="点击切换局域网 WebSocket / 纯本地共享总线"
            className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-[11px] font-extrabold transition ${
              busMode === 'lan' && wsOnlineCount === 4
                ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300'
                : busMode === 'lan' && wsOnlineCount > 0
                  ? 'border-sky-500/45 bg-sky-500/15 text-sky-300'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
            }`}
          >
            {busMode === 'lan' && wsOnlineCount > 0 ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                WS 联机状态（{wsOnlineCount}部同屏手机实时在线
                {totalConnectedPeers > wsOnlineCount
                  ? ` · 含${totalConnectedPeers - wsOnlineCount}台外部真机`
                  : ''}
                ）
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-[#FACC15]" />
                本地4机实时联动总线
              </>
            )}
          </button>
        </div>

        {/* Right: Quick Dynamic Time Moments Switcher + Settlement + Reset */}
        <div className="flex flex-wrap items-center gap-1">
          {dynamicActs.map((act) => {
            const active = primaryState.currentActId === act.actId;
            return (
              <button
                key={act.actId}
                type="button"
                onClick={() => jumpAllPhonesToAct(act.actId)}
                title={act.title}
                className={`rounded-lg px-2 py-1 font-mono text-[11px] font-extrabold transition ${
                  active
                    ? 'bg-[#FACC15] text-slate-950 shadow'
                    : 'border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                {act.clock}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              if (!primaryState.isDaySettled) {
                dispatchFromPhone('zhang', {
                  type: 'SETTLE_DAY',
                  absentPenaltyCents: 0,
                  clock: primaryState.currentClock,
                });
              }
              setShowSettlement(true);
            }}
            className="ml-1 flex items-center gap-1 rounded-lg bg-[#FACC15] px-2.5 py-1 text-[11px] font-black text-slate-950 hover:bg-yellow-300"
          >
            <ReceiptText className="h-3 w-3" />
            结算单
          </button>

          <button
            type="button"
            onClick={resetAllPhonesDay}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" />
            重置
          </button>
        </div>
      </header>

      {/* 4 Phones Side-by-Side Wall */}
      <main className="mx-auto grid w-full max-w-[1480px] flex-1 grid-cols-1 items-start gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {ROOMMATE_IDS.map((roleId) => {
          const rState = phoneStates[roleId];
          const person = rState.roommates[roleId];
          const isAlarmBlaring =
            person.status === 'ringing_stage1' ||
            person.status === 'being_raided' ||
            person.status === 'snooze_typing';

          return (
            <PhoneFrame
              key={roleId}
              variant="quad"
              clock={rState.currentClock}
              bedLabel={person.badgeLabel}
              roommateName={person.shortName}
              accentHex={person.accentHex}
              isAlarmActive={isAlarmBlaring}
              wsBadgeText={
                busMode === 'lan' && roleOnline[roleId] ? 'WS在线' : '同屏联动'
              }
            >
              <RoommatePhoneScreen
                dormState={rState}
                role={roleId}
                compact
                canSwitchRoleInHeader={false}
                onDispatch={(action) => dispatchFromPhone(roleId, action)}
                onOpenSettlement={() => setShowSettlement(true)}
              />
            </PhoneFrame>
          );
        })}
      </main>

      {showSettlement && (
        <SettlementModal
          dormState={primaryState}
          onClose={() => setShowSettlement(false)}
          onResetDay={resetAllPhonesDay}
        />
      )}
    </div>
  );
}
