import React from 'react';
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
  ReceiptText,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Users,
  Volume2,
} from 'lucide-react';
import {
  canBeRaided,
  formatSignedYuan,
  formatYuan,
  getStatusLabel,
} from '../core/dormEngine';
import {
  EvasiveGravitySliderSlot,
  FlowConnectGameSlot,
  ParkingJamGameSlot,
  RaidShakingKeypadSlot,
  ShameTyperModalSlot,
} from './MechanismSlot';
import { DormAction, DormState, ROOMMATE_IDS, RoommateId } from '../types/dorm';

interface RoommatePhoneScreenProps {
  dormState: DormState;
  role: RoommateId;
  compact?: boolean;
  canSwitchRoleInHeader?: boolean;
  onSelectRole?: (role: RoommateId) => void;
  onDispatch: (action: DormAction) => void;
  onOpenSettlement: () => void;
}

export function RoommatePhoneScreen({
  dormState,
  role,
  compact = false,
  canSwitchRoleInHeader = false,
  onSelectRole,
  onDispatch,
  onOpenSettlement,
}: RoommatePhoneScreenProps) {
  const me = dormState.roommates[role];
  const myNetCents = me.balanceCents - me.initialDepositCents;
  const incomingRaid = dormState.activeRaids[role];
  const otherRoommateIds = ROOMMATE_IDS.filter((id) => id !== role);

  const handleOpenSnoozeFromAnywhere = () => {
    if (me.status === 'being_raided' || me.status === 'snooze_typing') return;
    if (me.status === 'awake') {
      onDispatch({
        type: 'ENTER_RELAPSE_SLEEP',
        roommateId: role,
        clock: dormState.currentClock,
      });
    }
    onDispatch({
      type: 'OPEN_SNOOZE_TYPER',
      roommateId: role,
      clock: dormState.currentClock === '23:30' ? '07:02' : dormState.currentClock,
    });
  };

  const handleJumpStage2Game = (game: 'flow' | 'parking') => {
    if (me.status === 'being_raided') return;
    onDispatch({
      type: 'COMPLETE_STAGE1_SLIDER',
      roommateId: role,
      preferredGame: game,
      clock: dormState.currentClock === '23:30' ? '07:04' : dormState.currentClock,
    });
  };

  const handleTriggerMyAlarm = () => {
    const targetClock = dormState.currentClock === '23:30' ? '07:00' : dormState.currentClock;
    if (me.status === 'awake') {
      onDispatch({
        type: 'ENTER_RELAPSE_SLEEP',
        roommateId: role,
        clock: targetClock,
      });
    }
    onDispatch({
      type: 'TRIGGER_ALARM',
      roommateIds: [role],
      clock: targetClock,
    });
  };

  return (
    <div
      className={`flex min-h-full flex-col justify-between ${
        compact ? 'p-2.5' : 'p-3'
      }`}
    >
      <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
        {/* Top Personal Contract Wallet Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0F172A] shadow-lg">
          <div
            className={`h-1.5 w-full ${
              me.status === 'ringing_stage1' ||
              me.status === 'being_raided' ||
              me.status === 'snooze_typing'
                ? 'hazard-stripes-red'
                : 'hazard-stripes'
            }`}
          />
          <div className={compact ? 'p-2.5' : 'p-3'}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-black text-slate-950"
                    style={{ backgroundColor: me.accentHex }}
                  >
                    {me.badgeLabel}
                  </span>
                  <span
                    className={`${
                      compact ? 'text-xs' : 'text-sm'
                    } font-black text-white`}
                  >
                    {me.name}
                  </span>
                </div>
                <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-[#FACC15]">
                  {(me.status === 'ringing_stage1' ||
                    me.status === 'being_raided' ||
                    me.status === 'snooze_typing') && (
                    <Volume2 className="h-3 w-3 animate-bounce text-red-400" />
                  )}
                  {getStatusLabel(me.status)}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-semibold text-slate-400">
                  契约账户余额
                </div>
                <div
                  className={`font-mono ${
                    compact ? 'text-lg' : 'text-xl'
                  } font-black tracking-tight text-white`}
                >
                  {formatYuan(me.balanceCents)}
                </div>
                <div
                  className={`font-mono text-[11px] font-bold ${
                    myNetCents > 0
                      ? 'text-emerald-400'
                      : myNetCents < 0
                        ? 'text-red-400'
                        : 'text-slate-400'
                  }`}
                >
                  净损益 {formatSignedYuan(myNetCents)}
                </div>
              </div>
            </div>

            {/* 4-Bed Live Balance Bar */}
            <div className="mt-2 grid grid-cols-4 gap-1 border-t border-slate-800/90 pt-2">
              {ROOMMATE_IDS.map((id) => {
                const r = dormState.roommates[id];
                const active = id === role;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!canSwitchRoleInHeader}
                    onClick={() => {
                      if (canSwitchRoleInHeader && onSelectRole) {
                        onSelectRole(id);
                      }
                    }}
                    className={`rounded-xl border px-1 py-1 text-center transition ${
                      active
                        ? 'border-[#FACC15] bg-[#FACC15]/15'
                        : canSwitchRoleInHeader
                          ? 'cursor-pointer border-slate-800/90 bg-slate-900/80 hover:border-slate-600'
                          : 'cursor-default border-slate-800/90 bg-slate-900/80'
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
                    <div className="mt-0.5 font-mono text-[10px] font-black text-white">
                      {formatYuan(r.balanceCents)}
                    </div>
                  </button>
                );
              })}
            </div>

            {dormState.publicPoolCents > 0 && (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-[#FACC15]/40 bg-[#FACC15]/10 px-2.5 py-1 text-[10px]">
                <span className="font-bold text-[#FACC15]">
                  早起头彩公共奖池（首醒独揽）
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
            className={`flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold ${
              dormState.lastToast.tone === 'danger'
                ? 'border-red-500/50 bg-red-950/50 text-red-200'
                : dormState.lastToast.tone === 'warning'
                  ? 'border-amber-500/50 bg-amber-950/40 text-amber-200'
                  : dormState.lastToast.tone === 'success'
                    ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200'
                    : 'border-slate-700 bg-slate-900 text-slate-200'
            }`}
          >
            <span className="line-clamp-2 leading-snug">
              {dormState.lastToast.message}
            </span>
            {dormState.lastToast.amountCents !== undefined &&
              dormState.lastToast.amountCents > 0 && (
                <span className="shrink-0 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-[#FACC15]">
                  {formatYuan(dormState.lastToast.amountCents)}
                </span>
              )}
          </div>
        )}

        {/* ==================== CORE INTERACTIVE STAGE SWITCHER ==================== */}

        {/* 1. RAID EMERGENCY: RaidShakingKeypad */}
        {me.status === 'being_raided' && incomingRaid && (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-red-500/60 bg-red-950/45 px-2.5 py-1.5 text-[10px]">
              <span className="flex items-center gap-1 font-bold text-red-200">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-400" />
                连对 2 题保本，超时或错满 4 次立扣给清醒室友
              </span>
              <span className="shrink-0 font-mono font-black text-[#FACC15]">
                {formatYuan(incomingRaid.penaltyCents)}
              </span>
            </div>

            <RaidShakingKeypadSlot
              key={incomingRaid.id}
              raiderName={dormState.roommates[incomingRaid.raiderId].name}
              targetName={me.name}
              timeLimitSec={incomingRaid.timeLimitSec}
              onSurvive={() =>
                onDispatch({
                  type: 'SURVIVE_RAID',
                  targetId: role,
                  clock: dormState.currentClock,
                })
              }
              onFailRaid={() =>
                onDispatch({
                  type: 'FAIL_RAID',
                  targetId: role,
                  clock: dormState.currentClock,
                })
              }
            />
          </div>
        )}

        {/* 2. STAGE 1 WAKEUP: EvasiveGravitySlider + Snooze Trap */}
        {me.status === 'ringing_stage1' && (
          <div className="space-y-2">
            <EvasiveGravitySliderSlot
              key={`slider-${role}-${dormState.currentActId}`}
              roommateName={me.name}
              onComplete={() =>
                onDispatch({
                  type: 'COMPLETE_STAGE1_SLIDER',
                  roommateId: role,
                  clock: dormState.currentClock,
                })
              }
              onSlipPenalty={(reason) =>
                onDispatch({
                  type: 'SLIDER_SLIP_PENALTY',
                  roommateId: role,
                  penaltyCents: 50,
                  reason,
                  clock: dormState.currentClock,
                })
              }
            />

            <button
              type="button"
              onClick={() =>
                onDispatch({
                  type: 'OPEN_SNOOZE_TYPER',
                  roommateId: role,
                  clock: dormState.currentClock,
                })
              }
              className="group w-full rounded-2xl border border-red-500/50 bg-red-950/35 p-2.5 text-left transition hover:border-red-400 hover:bg-red-950/55"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-black text-red-300">
                  <Flame className="h-3.5 w-3.5 text-red-400" />
                  再睡 5 分钟（申请贪睡延时）
                </span>
                <span className="rounded bg-red-500/25 px-1.5 py-0.5 text-[10px] font-bold text-red-200">
                  高危破财入口
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400 group-hover:text-slate-300">
                需禁粘贴一字不差手打社死认怂长文；犹豫每 10 秒向清醒室友滴血转账 ¥1.00！
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
              onDispatch({
                type: 'SNOOZE_TICK_PENALTY',
                roommateId: role,
                penaltyCents: cents,
                reason,
                clock: dormState.currentClock,
              });
            }}
            onCompleteSnooze={() =>
              onDispatch({
                type: 'COMPLETE_SNOOZE',
                roommateId: role,
                snoozeFeeCents: 200,
                clock: dormState.currentClock,
              })
            }
            onCancel={() =>
              onDispatch({
                type: 'CANCEL_SNOOZE_TYPER',
                roommateId: role,
              })
            }
          />
        )}

        {/* 4. STAGE 2 DEEP WAKEFULNESS PUZZLE: FlowConnectGame or ParkingJamGame */}
        {me.status === 'wakeup_stage2' && (
          <div className="space-y-2">
            <div className="rounded-2xl border border-[#FACC15]/45 bg-slate-900/95 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-black text-[#FACC15]">
                  早起第二关 · 深度清醒大考
                </span>
                <span className="rounded bg-[#FACC15]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#FACC15]">
                  通关保本分红
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onDispatch({
                      type: 'SELECT_STAGE2_GAME',
                      roommateId: role,
                      game: 'flow',
                    })
                  }
                  className={`flex items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-extrabold transition ${
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
                    onDispatch({
                      type: 'SELECT_STAGE2_GAME',
                      roommateId: role,
                      game: 'parking',
                    })
                  }
                  className={`flex items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-extrabold transition ${
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
                key={`flow-${role}`}
                initialLevelIndex={me.puzzleLevelIndex}
                onWin={() =>
                  onDispatch({
                    type: 'COMPLETE_STAGE2_PUZZLE',
                    roommateId: role,
                    clock: dormState.currentClock,
                  })
                }
                onCollision={() =>
                  onDispatch({
                    type: 'PUZZLE_COLLISION_PENALTY',
                    roommateId: role,
                    penaltyCents: 50,
                    detail: '异色电线触电短路双崩',
                    clock: dormState.currentClock,
                  })
                }
              />
            ) : (
              <ParkingJamGameSlot
                key={`parking-${role}`}
                initialLevelIndex={me.puzzleLevelIndex}
                onWin={() =>
                  onDispatch({
                    type: 'COMPLETE_STAGE2_PUZZLE',
                    roommateId: role,
                    clock: dormState.currentClock,
                  })
                }
                onCollision={() =>
                  onDispatch({
                    type: 'PUZZLE_COLLISION_PENALTY',
                    roommateId: role,
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
                onDispatch({
                  type: 'OPEN_SNOOZE_TYPER',
                  roommateId: role,
                  clock: dormState.currentClock,
                })
              }
              className="w-full rounded-xl border border-red-500/35 bg-red-950/25 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-950/45"
            >
              大脑宕机解不出？手打认怂书申请贪睡 5 分钟
            </button>
          </div>
        )}

        {/* 5. AWAKE COMMAND CENTER: Roommate Supervision List + Direct Raid Button */}
        {me.status === 'awake' && (
          <div className="space-y-2.5">
            <div className="rounded-2xl border border-emerald-500/45 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-black text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  今日已彻底清醒打卡！
                </span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  {me.wakeupTime || dormState.currentClock}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                已锁定<strong>清醒分红权</strong>！赖床室友手滑、贪睡或被突袭翻车，罚金实时分入你的钱包。
              </p>
            </div>

            {/* Roommate Supervision & Raid List inside Phone */}
            <div className="rounded-2xl border border-[#FACC15]/40 bg-slate-900/95 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-black text-[#FACC15]">
                  <Users className="h-3.5 w-3.5 text-red-400" />
                  室友监督列表（抓包立分 ¥10.00）
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400">
                对赖床/贪睡室友直接甩出「晃动乱序算术题」限时查岗！
              </p>

              <div className="mt-2 space-y-1.5">
                {otherRoommateIds.map((tid: RoommateId) => {
                  const target = dormState.roommates[tid];
                  const raidable = canBeRaided(target.status);
                  const beingRaided = target.status === 'being_raided';

                  return (
                    <div
                      key={tid}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-extrabold text-white">
                          {target.badgeLabel} · {target.shortName}
                        </div>
                        <div
                          className={`truncate text-[10px] ${
                            target.status === 'awake'
                              ? 'text-emerald-400'
                              : beingRaided
                                ? 'text-red-400 font-bold'
                                : 'text-amber-300'
                          }`}
                        >
                          {getStatusLabel(target.status)} · {formatYuan(target.balanceCents)}
                        </div>
                      </div>

                      {raidable ? (
                        <button
                          type="button"
                          onClick={() =>
                            onDispatch({
                              type: 'LAUNCH_RAID',
                              raiderId: role,
                              targetId: tid,
                              timeLimitSec: 40,
                              penaltyCents: 1000,
                              clock: dormState.currentClock,
                            })
                          }
                          className="flex shrink-0 items-center gap-1 rounded-xl bg-red-500 px-2.5 py-1.5 text-[11px] font-black text-white shadow hover:bg-red-400 active:scale-95"
                        >
                          <Crosshair className="h-3 w-3" />
                          🚨 突袭查岗TA
                        </button>
                      ) : beingRaided ? (
                        canSwitchRoleInHeader && onSelectRole ? (
                          <button
                            type="button"
                            onClick={() => onSelectRole(tid)}
                            className="shrink-0 rounded-xl border border-red-500/60 bg-red-500/20 px-2.5 py-1 text-[10px] font-black text-red-200 hover:bg-red-500/30"
                          >
                            切去应战 →
                          </button>
                        ) : (
                          <span className="shrink-0 rounded-lg bg-red-500/20 px-2 py-1 text-[10px] font-bold text-red-300">
                            查岗搏斗中
                          </span>
                        )
                      ) : (
                        <span className="shrink-0 rounded-lg bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-300">
                          分红盟友
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onDispatch({
                  type: 'ENTER_RELAPSE_SLEEP',
                  roommateId: role,
                  clock: dormState.currentClock,
                })
              }
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-amber-300"
            >
              <EyeOff className="h-3.5 w-3.5" />
              偷偷眯眼躺回被窝（模拟回笼觉，可被室友突袭）
            </button>
          </div>
        )}

        {/* 6. SLEEPING / CONTRACT PLEDGE / SNOOZING / SETTLED SLACKER */}
        {(me.status === 'sleeping' ||
          me.status === 'snoozing' ||
          me.status === 'relapse_sleeping' ||
          me.status === 'settled_slacker') && (
          <div className="space-y-2.5">
            {dormState.currentActId === 1 && me.status === 'sleeping' ? (
              <div className="rounded-2xl border-2 border-[#FACC15]/70 bg-gradient-to-b from-slate-900 to-slate-950 p-3.5 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-black text-[#FACC15]">
                    <Sparkles className="h-4 w-4" />
                    404 寝室 07:00 早起对赌契约书
                  </span>
                  <span className="font-mono text-[11px] font-bold text-emerald-400">
                    总池 ¥200.00
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-300">
                  <li>1. 四人各交 ¥50.00 契约押金，账本分毫不差实时守恒；</li>
                  <li>2. 07:00 闯过「逃跑滑块 + 清醒小游戏」才算真起床；</li>
                  <li>3. 贪睡须禁粘贴手打社死认怂长文，犹豫每 10s 滴血扣 ¥1；</li>
                  <li>4. 清醒室友可随时发起「晃动乱序算术突袭」，抓包立分 ¥10！</li>
                </ul>

                <div className="mt-3 space-y-2">
                  {!me.contractSigned && (
                    <button
                      type="button"
                      onClick={() =>
                        onDispatch({
                          type: 'SIGN_CONTRACT',
                          roommateId: role,
                          clock: '23:31',
                        })
                      }
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2.5 text-xs font-black text-white shadow-lg hover:bg-red-400"
                    >
                      <Fingerprint className="h-4 w-4" />
                      按下红手印 · 锁定我的 ¥50.00 军令状
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleTriggerMyAlarm}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FACC15] py-2.5 text-xs font-black text-slate-950 shadow hover:bg-yellow-300"
                  >
                    <AlarmClock className="h-4 w-4" />
                    ⏰ 模拟 07:00 闹钟响起（进入逃跑滑块）
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onDispatch({
                        type: 'SIGN_ALL_AND_START_ALARM',
                        clock: '07:00',
                      })
                    }
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20"
                  >
                    全寝 4 人同时拉响 07:00 夺命闹钟
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-500/45 bg-slate-900/95 p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                  <BedDouble className="h-4 w-4 shrink-0" />
                  {me.status === 'settled_slacker'
                    ? '今日赖床违约已结算，感谢赞助全寝鸡腿！'
                    : me.status === 'sleeping'
                      ? '沉睡未起 · 07:00 夺命闹钟随时炸响！'
                      : '高危赖床/回笼觉 · 随时可能被室友突袭查岗！'}
                </div>
                <p className="mt-1 text-[11px] text-slate-300">{me.lastActionNote}</p>
                {me.status !== 'settled_slacker' && (
                  <button
                    type="button"
                    onClick={handleTriggerMyAlarm}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FACC15] py-2.5 text-xs font-black text-slate-950 shadow hover:bg-yellow-300"
                  >
                    {me.status === 'sleeping' ? (
                      <>
                        <AlarmClock className="h-4 w-4" />
                        ⏰ 模拟 07:00 闹钟响起
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="h-4 w-4" />
                        立刻惊醒爬起 · 开始起床闯关保本！
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom In-Phone Closed-Loop Toolbar + Live Ledger Stream */}
      <div className="mt-2.5 space-y-2">
        {/* Self-Contained In-Phone Quick Experience Bar */}
        <div className="rounded-2xl border border-slate-800/95 bg-slate-900/90 p-2">
          <div className="mb-1.5 flex items-center justify-between px-0.5">
            <span className="text-[10px] font-bold text-slate-400">
              App 内快捷体验与日终结算
            </span>
            <button
              type="button"
              onClick={() => onDispatch({ type: 'RESET_DAY', clock: '23:30' })}
              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400 hover:text-white"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              重置新一天
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => handleJumpStage2Game('flow')}
              className="rounded-lg border border-slate-700/90 bg-slate-950 py-1.5 text-[10px] font-bold text-slate-200 hover:border-[#FACC15] hover:text-[#FACC15]"
            >
              ⚡ 连线关
            </button>
            <button
              type="button"
              onClick={() => handleJumpStage2Game('parking')}
              className="rounded-lg border border-slate-700/90 bg-slate-950 py-1.5 text-[10px] font-bold text-slate-200 hover:border-[#FACC15] hover:text-[#FACC15]"
            >
              🛵 挪车关
            </button>
            <button
              type="button"
              onClick={handleOpenSnoozeFromAnywhere}
              className="rounded-lg border border-red-500/35 bg-red-950/30 py-1.5 text-[10px] font-bold text-red-300 hover:bg-red-950/60"
            >
              ✍️ 认怂书
            </button>
            <button
              type="button"
              onClick={() => {
                if (!dormState.isDaySettled) {
                  onDispatch({
                    type: 'SETTLE_DAY',
                    absentPenaltyCents: 0,
                    clock: dormState.currentClock,
                  });
                }
                onOpenSettlement();
              }}
              className="rounded-lg bg-[#FACC15] py-1.5 text-[10px] font-black text-slate-950 hover:bg-yellow-300"
            >
              🍗 结算单
            </button>
          </div>
        </div>

        {/* Live Ledger Stream */}
        <div className="rounded-2xl border border-slate-800 bg-[#0F172A]/95 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] font-extrabold text-slate-200">
              <History className="h-3 w-3 text-[#FACC15]" />
              实时红包/扣罚流水 ({dormState.ledger.length})
            </span>
            <button
              type="button"
              onClick={onOpenSettlement}
              className="flex items-center gap-0.5 rounded-md bg-[#FACC15]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#FACC15] hover:bg-[#FACC15]/25"
            >
              <ReceiptText className="h-2.5 w-2.5" />
              鸡腿总账
            </button>
          </div>

          <div className="max-h-28 space-y-1 overflow-y-auto pr-0.5">
            {dormState.ledger.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800/90 bg-slate-900/90 px-2 py-1"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="truncate text-[10px] font-bold text-slate-100">
                    <span className="mr-1 font-mono text-[9px] text-slate-400">
                      [{item.clock}]
                    </span>
                    {item.headline}
                  </span>
                  {item.amountCents > 0 && (
                    <span className="shrink-0 font-mono text-[10px] font-black text-[#FACC15]">
                      {formatYuan(item.amountCents)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-slate-400">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
