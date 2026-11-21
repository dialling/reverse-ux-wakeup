import React, { useEffect, useState } from 'react';
import {
  AlarmClock,
  ArrowUpRight,
  BedDouble,
  Car,
  CheckCircle2,
  Crosshair,
  EyeOff,
  Fingerprint,
  Flame,
  GitCommitHorizontal,
  History,
  Monitor,
  ReceiptText,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {
  canBeRaided,
  formatSignedYuan,
  formatYuan,
  getStatusLabel,
} from './core/dormEngine';
import { useDormSyncController } from './core/syncClient';
import { DirectorConsole } from './components/DirectorConsole';
import {
  EvasiveGravitySliderSlot,
  FlowConnectGameSlot,
  ParkingJamGameSlot,
  RaidShakingKeypadSlot,
  ShameTyperModalSlot,
} from './components/MechanismSlot';
import { PhoneFrame } from './components/PhoneFrame';
import { SettlementModal } from './components/SettlementModal';
import { ROOMMATE_IDS, RoommateId } from './types/dorm';

export function App() {
  const {
    dormState,
    activeRole,
    setActiveRole,
    forceMobileView,
    setForceMobileView,
    syncMode,
    setSyncMode,
    connectionStatus,
    serverOnline,
    lanInfo,
    refreshLanInfo,
    dispatchAction,
    jumpToStoryAct,
  } = useDormSyncController();

  const [isNarrowScreen, setIsNarrowScreen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 960 : false
  );
  const [showSettlementModal, setShowSettlementModal] = useState<boolean>(false);

  useEffect(() => {
    const onResize = () => {
      setIsNarrowScreen(window.innerWidth < 960);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobileFullscreen = forceMobileView || isNarrowScreen;
  const me = dormState.roommates[activeRole];
  const myNetCents = me.balanceCents - me.initialDepositCents;
  const incomingRaid = dormState.activeRaids[activeRole];
  const isAlarmBlaring =
    me.status === 'ringing_stage1' ||
    me.status === 'being_raided' ||
    me.status === 'snooze_typing';

  const raidableTargets = ROOMMATE_IDS.filter(
    (id) => id !== activeRole && canBeRaided(dormState.roommates[id].status)
  );

  return (
    <div
      className={
        isMobileFullscreen
          ? 'min-h-dvh w-full bg-[#070B14]'
          : 'ledger-grid-bg min-h-dvh w-full px-4 py-5 lg:px-8'
      }
    >
      {/* Desktop Top Brand Bar */}
      {!isMobileFullscreen && (
        <header className="mx-auto mb-5 flex max-w-[1440px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/90 bg-[#0F172A]/90 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FACC15] font-black text-slate-950 shadow">
              404
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white sm:text-lg">
                  《醒醒！分钱了》Snooze &amp; Lose
                </h1>
                <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-[11px] font-bold text-red-300">
                  逆向 UX 早起押金契约
                </span>
              </div>
              <p className="text-xs text-slate-400">
                “你多睡的每一分钟，都在亲手给室友加鸡腿” —— {dormState.actBanner}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setForceMobileView(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:border-[#FACC15] hover:text-[#FACC15]"
          >
            <Smartphone className="h-3.5 w-3.5" /> 切换纯手机全屏预览
          </button>
        </header>
      )}

      {/* Floating Desktop Restore Button when previewing mobile=1 on wide desktop */}
      {forceMobileView && !isNarrowScreen && (
        <button
          type="button"
          onClick={() => setForceMobileView(false)}
          className="fixed right-4 bottom-4 z-50 flex items-center gap-1.5 rounded-full border border-[#FACC15]/60 bg-slate-900/95 px-3.5 py-2 text-xs font-bold text-[#FACC15] shadow-xl backdrop-blur hover:bg-slate-800"
        >
          <Monitor className="h-3.5 w-3.5" /> 展开上帝导播台
        </button>
      )}

      {/* Main Layout: Left Phone Viewport + Right Director Console */}
      <main
        className={
          isMobileFullscreen
            ? 'w-full'
            : 'mx-auto flex max-w-[1440px] flex-col items-start gap-6 xl:flex-row'
        }
      >
        {/* PHONE VIEWPORT */}
        <PhoneFrame
          clock={dormState.currentClock}
          bedLabel={me.badgeLabel}
          roommateName={me.name}
          accentHex={me.accentHex}
          isAlarmActive={isAlarmBlaring}
          isMobileFullscreen={isMobileFullscreen}
        >
          <div className="flex min-h-full flex-col justify-between p-3">
            <div className="space-y-2.5">
              {/* Top App Brand & Personal Wallet Card */}
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0F172A] shadow-lg">
                <div
                  className={`h-1.5 w-full ${
                    isAlarmBlaring ? 'hazard-stripes-red' : 'hazard-stripes'
                  }`}
                />
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-black text-slate-950"
                          style={{ backgroundColor: me.accentHex }}
                        >
                          {me.badgeLabel}
                        </span>
                        <span className="text-sm font-black text-white">
                          {me.name}
                        </span>
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-[#FACC15]">
                        {isAlarmBlaring && (
                          <Volume2 className="h-3 w-3 animate-bounce text-red-400" />
                        )}
                        {getStatusLabel(me.status)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-slate-400">
                        契约账户余额
                      </div>
                      <div className="font-mono text-xl font-black tracking-tight text-white">
                        {formatYuan(me.balanceCents)}
                      </div>
                      <div
                        className={`font-mono text-xs font-bold ${
                          myNetCents > 0
                            ? 'text-emerald-400'
                            : myNetCents < 0
                              ? 'text-red-400'
                              : 'text-slate-400'
                        }`}
                      >
                        今日净损益 {formatSignedYuan(myNetCents)}
                      </div>
                    </div>
                  </div>

                  {/* Compact 4-Bed Live Balance Bar */}
                  <div className="mt-2.5 grid grid-cols-4 gap-1.5 border-t border-slate-800/90 pt-2">
                    {ROOMMATE_IDS.map((id) => {
                      const r = dormState.roommates[id];
                      const active = id === activeRole;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            if (!forceMobileView) {
                              setActiveRole(id);
                            }
                          }}
                          className={`rounded-xl border px-1.5 py-1 text-center transition ${
                            active
                              ? 'border-[#FACC15] bg-[#FACC15]/15'
                              : 'border-slate-800/90 bg-slate-900/80'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-300">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                r.status === 'awake'
                                  ? 'bg-emerald-400'
                                  : r.status === 'being_raided' ||
                                      r.status === 'ringing_stage1'
                                    ? 'bg-red-500'
                                    : 'bg-amber-400'
                              }`}
                            />
                            {r.shortName}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] font-black text-white">
                            {formatYuan(r.balanceCents)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {dormState.publicPoolCents > 0 && (
                    <div className="mt-2 flex items-center justify-between rounded-xl border border-[#FACC15]/40 bg-[#FACC15]/10 px-2.5 py-1 text-[11px]">
                      <span className="font-bold text-[#FACC15]">
                        早起头彩公共待分奖池（首位打卡独得）
                      </span>
                      <span className="font-mono font-black text-[#FACC15]">
                        {formatYuan(dormState.publicPoolCents)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Event Toast Strip */}
              {dormState.lastToast && (
                <div
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-bold ${
                    dormState.lastToast.tone === 'danger'
                      ? 'border-red-500/50 bg-red-950/50 text-red-200'
                      : dormState.lastToast.tone === 'warning'
                        ? 'border-amber-500/50 bg-amber-950/40 text-amber-200'
                        : dormState.lastToast.tone === 'success'
                          ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200'
                          : 'border-slate-700 bg-slate-900 text-slate-200'
                  }`}
                >
                  <span className="leading-snug">{dormState.lastToast.message}</span>
                  {dormState.lastToast.amountCents !== undefined &&
                    dormState.lastToast.amountCents > 0 && (
                      <span className="shrink-0 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-[#FACC15]">
                        {formatYuan(dormState.lastToast.amountCents)}
                      </span>
                    )}
                </div>
              )}

              {/* ==================== CORE INTERACTIVE STAGE SWITCHER ==================== */}

              {/* 1. RAID EMERGENCY: RaidShakingKeypad */}
              {me.status === 'being_raided' && incomingRaid && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl border border-red-500/60 bg-red-950/45 px-3 py-1.5 text-[11px]">
                    <span className="flex items-center gap-1 font-bold text-red-200">
                      <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                      连对 2 题保本，超时或错满 4 次当场扣罚给清醒室友
                    </span>
                    <span className="shrink-0 font-mono font-black text-[#FACC15]">
                      赌注 {formatYuan(incomingRaid.penaltyCents)}
                    </span>
                  </div>

                  <RaidShakingKeypadSlot
                    key={incomingRaid.id}
                    raiderName={dormState.roommates[incomingRaid.raiderId].name}
                    targetName={me.name}
                    timeLimitSec={incomingRaid.timeLimitSec}
                    onSurvive={() =>
                      dispatchAction({
                        type: 'SURVIVE_RAID',
                        targetId: activeRole,
                        clock: dormState.currentClock,
                      })
                    }
                    onFailRaid={() =>
                      dispatchAction({
                        type: 'FAIL_RAID',
                        targetId: activeRole,
                        clock: dormState.currentClock,
                      })
                    }
                  />
                </div>
              )}

              {/* 2. STAGE 1 WAKEUP: EvasiveGravitySlider + Tempting Snooze Button */}
              {me.status === 'ringing_stage1' && (
                <div className="space-y-2.5">
                  <EvasiveGravitySliderSlot
                    key={`slider-${activeRole}-${dormState.currentActId}`}
                    roommateName={me.name}
                    onComplete={() =>
                      dispatchAction({
                        type: 'COMPLETE_STAGE1_SLIDER',
                        roommateId: activeRole,
                        clock: dormState.currentClock,
                      })
                    }
                    onSlipPenalty={(reason) =>
                      dispatchAction({
                        type: 'SLIDER_SLIP_PENALTY',
                        roommateId: activeRole,
                        penaltyCents: 50,
                        reason,
                        clock: dormState.currentClock,
                      })
                    }
                  />

                  {/* Devil's Snooze Trap Button */}
                  <button
                    type="button"
                    onClick={() =>
                      dispatchAction({
                        type: 'OPEN_SNOOZE_TYPER',
                        roommateId: activeRole,
                        clock: dormState.currentClock,
                      })
                    }
                    className="group w-full rounded-2xl border border-red-500/50 bg-red-950/35 p-3 text-left transition hover:border-red-400 hover:bg-red-950/55"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-black text-red-300">
                        <Flame className="h-4 w-4 text-red-400" />
                        再睡 5 分钟（申请贪睡延时）
                      </span>
                      <span className="rounded bg-red-500/25 px-2 py-0.5 text-[10px] font-bold text-red-200">
                        高危破财入口
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 group-hover:text-slate-300">
                      需禁粘贴一字不差手打社死认怂长文；犹豫每 10 秒给清醒室友滴血转账 ¥1.00！
                    </p>
                  </button>
                </div>
              )}

              {/* 3. SNOOZE CONFESSION: ShameTyperModal */}
              {me.status === 'snooze_typing' && (
                <ShameTyperModalSlot
                  roommateName={me.name}
                  onTickPenalty={(amount, _totalPaid, reason) => {
                    const cents =
                      amount > 0 && amount <= 20
                        ? Math.round(amount * 100)
                        : Math.max(50, Math.round(amount || 100));
                    dispatchAction({
                      type: 'SNOOZE_TICK_PENALTY',
                      roommateId: activeRole,
                      penaltyCents: cents,
                      reason,
                      clock: dormState.currentClock,
                    });
                  }}
                  onCompleteSnooze={() =>
                    dispatchAction({
                      type: 'COMPLETE_SNOOZE',
                      roommateId: activeRole,
                      snoozeFeeCents: 200,
                      clock: dormState.currentClock,
                    })
                  }
                  onCancel={() =>
                    dispatchAction({
                      type: 'CANCEL_SNOOZE_TYPER',
                      roommateId: activeRole,
                    })
                  }
                />
              )}

              {/* 4. STAGE 2 DEEP WAKEFULNESS PUZZLE: FlowConnectGame or ParkingJamGame */}
              {me.status === 'wakeup_stage2' && (
                <div className="space-y-2">
                  <div className="rounded-2xl border border-[#FACC15]/45 bg-slate-900/95 p-2.5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-black text-[#FACC15]">
                        早起第二关 · 深度清醒大脑大考
                      </span>
                      <span className="rounded bg-[#FACC15]/15 px-2 py-0.5 text-[10px] font-bold text-[#FACC15]">
                        二选一通关即保本分红
                      </span>
                    </div>

                    {/* Game Switcher Tabs */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          dispatchAction({
                            type: 'SELECT_STAGE2_GAME',
                            roommateId: activeRole,
                            game: 'flow',
                          })
                        }
                        className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-extrabold transition ${
                          me.selectedGame === 'flow'
                            ? 'bg-[#FACC15] text-slate-950 shadow'
                            : 'border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <GitCommitHorizontal className="h-3.5 w-3.5" />
                        同色不交叉连线
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          dispatchAction({
                            type: 'SELECT_STAGE2_GAME',
                            roommateId: activeRole,
                            game: 'parking',
                          })
                        }
                        className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-extrabold transition ${
                          me.selectedGame === 'parking'
                            ? 'bg-[#FACC15] text-slate-950 shadow'
                            : 'border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <Car className="h-3.5 w-3.5" />
                        无碰撞挪车出库
                      </button>
                    </div>
                  </div>

                  {me.selectedGame === 'flow' ? (
                    <FlowConnectGameSlot
                      key={`flow-${activeRole}`}
                      initialLevelIndex={me.puzzleLevelIndex}
                      onWin={() =>
                        dispatchAction({
                          type: 'COMPLETE_STAGE2_PUZZLE',
                          roommateId: activeRole,
                          clock: dormState.currentClock,
                        })
                      }
                      onCollision={() =>
                        dispatchAction({
                          type: 'PUZZLE_COLLISION_PENALTY',
                          roommateId: activeRole,
                          penaltyCents: 50,
                          detail: '异色电线触电短路双崩',
                          clock: dormState.currentClock,
                        })
                      }
                    />
                  ) : (
                    <ParkingJamGameSlot
                      key={`parking-${activeRole}`}
                      initialLevelIndex={me.puzzleLevelIndex}
                      onWin={() =>
                        dispatchAction({
                          type: 'COMPLETE_STAGE2_PUZZLE',
                          roommateId: activeRole,
                          clock: dormState.currentClock,
                        })
                      }
                      onCollision={() =>
                        dispatchAction({
                          type: 'PUZZLE_COLLISION_PENALTY',
                          roommateId: activeRole,
                          penaltyCents: 50,
                          detail: '迷糊挪车追尾擦碰回退',
                          clock: dormState.currentClock,
                        })
                      }
                    />
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      dispatchAction({
                        type: 'OPEN_SNOOZE_TYPER',
                        roommateId: activeRole,
                        clock: dormState.currentClock,
                      })
                    }
                    className="w-full rounded-xl border border-red-500/35 bg-red-950/25 py-2 text-[11px] font-bold text-red-300 hover:bg-red-950/45"
                  >
                    大脑宕机解不出？点此去手打认怂书申请贪睡 5 分钟
                  </button>
                </div>
              )}

              {/* 5. AWAKE COMMAND CENTER: Dividend Status + Launch Raid on Roommates */}
              {me.status === 'awake' && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-500/45 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-black text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        今日已彻底清醒打卡！
                      </span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                        打卡时刻 {me.wakeupTime || dormState.currentClock}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300">
                      你已成功保住押金并进入<strong>清醒分红池</strong>！任何赖床室友手滑、贪睡或被查岗翻车，罚金都将实时打入你的账户。
                    </p>
                  </div>

                  {/* Raid Launchpad */}
                  <div className="rounded-2xl border border-[#FACC15]/40 bg-slate-900/95 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-black text-[#FACC15]">
                        <Crosshair className="h-4 w-4 text-red-400" />
                        发起「突袭查岗」薅羊毛（单次赏金 ¥10.00）
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      对未起床或疑似睡回笼觉的室友甩出「晃动乱序键盘算术题」，对方限时答不出立扣 ¥10.00！
                    </p>

                    <div className="mt-2.5 space-y-2">
                      {raidableTargets.length === 0 ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-center text-xs text-slate-400">
                          当前暂无可突袭对象（室友均已清醒或正在接受查岗）
                        </div>
                      ) : (
                        raidableTargets.map((tid: RoommateId) => {
                          const target = dormState.roommates[tid];
                          return (
                            <div
                              key={tid}
                              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
                            >
                              <div>
                                <div className="text-xs font-extrabold text-white">
                                  {target.badgeLabel} · {target.name}
                                </div>
                                <div className="text-[11px] text-amber-300">
                                  {getStatusLabel(target.status)} · 余额{' '}
                                  {formatYuan(target.balanceCents)}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  dispatchAction({
                                    type: 'LAUNCH_RAID',
                                    raiderId: activeRole,
                                    targetId: tid,
                                    timeLimitSec: 40,
                                    penaltyCents: 1000,
                                    clock: dormState.currentClock,
                                  })
                                }
                                className="flex items-center gap-1 rounded-xl bg-red-500 px-3 py-1.5 text-xs font-black text-white shadow hover:bg-red-400 active:scale-95"
                              >
                                <Crosshair className="h-3.5 w-3.5" />
                                突袭TA
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      dispatchAction({
                        type: 'ENTER_RELAPSE_SLEEP',
                        roommateId: activeRole,
                        clock: dormState.currentClock,
                      })
                    }
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 py-2 text-xs font-semibold text-slate-400 hover:text-amber-300"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    偷偷眯眼躺回被窝（模拟睡回笼觉，可被室友突袭）
                  </button>
                </div>
              )}

              {/* 6. SLEEPING / CONTRACT PLEDGE / SNOOZING / SETTLED SLACKER */}
              {(me.status === 'sleeping' ||
                me.status === 'snoozing' ||
                me.status === 'relapse_sleeping' ||
                me.status === 'settled_slacker') && (
                <div className="space-y-3">
                  {dormState.currentActId === 1 && me.status === 'sleeping' ? (
                    <div className="rounded-2xl border-2 border-[#FACC15]/70 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-xl">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-black text-[#FACC15]">
                          <Sparkles className="h-4 w-4" />
                          404 寝室 07:00 早起对赌契约书
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          总池 ¥200.00
                        </span>
                      </div>
                      <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-slate-300">
                        <li>1. 四人各托管 ¥50.00 早餐契约金，账本分毫不差实时守恒；</li>
                        <li>2. 07:00 必须闯过「逃跑滑块 + 深度清醒小游戏」才算真醒；</li>
                        <li>3. 贪睡 5 分钟须禁粘贴手打社死认怂长文，犹豫每秒滴血发红包；</li>
                        <li>4. 已醒室友可随时发起「晃动乱序算术突袭」，抓包立分 ¥10.00！</li>
                      </ul>

                      <div className="mt-3.5 space-y-2">
                        {!me.contractSigned ? (
                          <button
                            type="button"
                            onClick={() =>
                              dispatchAction({
                                type: 'SIGN_CONTRACT',
                                roommateId: activeRole,
                                clock: '23:31',
                              })
                            }
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-xs font-black text-white shadow-lg hover:bg-red-400 active:scale-98"
                          >
                            <Fingerprint className="h-4 w-4" />
                            按下红手印 · 锁定我的 ¥50.00 军令状
                          </button>
                        ) : (
                          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 py-2 text-center text-xs font-bold text-emerald-300">
                            你已按下红手印，¥50.00 契约押金已锁定！
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            dispatchAction({
                              type: 'SIGN_ALL_AND_START_ALARM',
                              clock: '07:00',
                            })
                          }
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FACC15] py-2.5 text-xs font-black text-slate-950 hover:bg-yellow-300"
                        >
                          <AlarmClock className="h-4 w-4" />
                          快进至次日 07:00 · 拉响夺命闹钟！
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-500/45 bg-slate-900/95 p-4">
                      <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                        <BedDouble className="h-4 w-4" />
                        {me.status === 'settled_slacker'
                          ? '今日赖床违约已结算，感谢赞助全寝鸡腿！'
                          : '高危赖床/回笼觉状态 · 随时可能被室友突袭查岗！'}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-300">
                        {me.lastActionNote}
                      </p>
                      {me.status !== 'settled_slacker' && (
                        <button
                          type="button"
                          onClick={() =>
                            dispatchAction({
                              type: 'TRIGGER_ALARM',
                              roommateIds: [activeRole],
                              clock: dormState.currentClock,
                            })
                          }
                          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FACC15] py-2.5 text-xs font-black text-slate-950 hover:bg-yellow-300"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                          立刻惊醒爬起 · 开始起床闯关保本！
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Live Ledger Stream inside Phone */}
            <div className="mt-3 rounded-2xl border border-slate-800 bg-[#0F172A]/95 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-200">
                  <History className="h-3.5 w-3.5 text-[#FACC15]" />
                  404 寝室实时红包/扣罚流水 ({dormState.ledger.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowSettlementModal(true)}
                  className="flex items-center gap-1 rounded-lg bg-[#FACC15]/15 px-2 py-1 text-[11px] font-bold text-[#FACC15] hover:bg-[#FACC15]/25"
                >
                  <ReceiptText className="h-3 w-3" />
                  查看鸡腿总账单
                </button>
              </div>

              <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                {dormState.ledger.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-800/90 bg-slate-900/90 px-2.5 py-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-100">
                        <span className="mr-1.5 font-mono text-[10px] text-slate-400">
                          [{item.clock}]
                        </span>
                        {item.headline}
                      </span>
                      {item.amountCents > 0 && (
                        <span className="shrink-0 font-mono text-[11px] font-black text-[#FACC15]">
                          {formatYuan(item.amountCents)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PhoneFrame>

        {/* RIGHT DESKTOP DIRECTOR CONSOLE */}
        {!isMobileFullscreen && (
          <div className="w-full flex-1">
            <DirectorConsole
              dormState={dormState}
              activeRole={activeRole}
              onSelectRole={setActiveRole}
              syncMode={syncMode}
              onChangeSyncMode={setSyncMode}
              connectionStatus={connectionStatus}
              serverOnline={serverOnline}
              lanInfo={lanInfo}
              onRefreshLanInfo={refreshLanInfo}
              onDispatch={dispatchAction}
              onJumpToAct={jumpToStoryAct}
              onOpenSettlement={() => setShowSettlementModal(true)}
            />
          </div>
        )}
      </main>

      {showSettlementModal && (
        <SettlementModal
          dormState={dormState}
          onClose={() => setShowSettlementModal(false)}
          onResetDay={() => dispatchAction({ type: 'RESET_DAY', clock: '23:30' })}
        />
      )}
    </div>
  );
}

export default App;
