import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  BellRing,
  CheckCircle2,
  Copy,
  Crosshair,
  ExternalLink,
  Eye,
  Film,
  QrCode,
  Radio,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wifi,
} from 'lucide-react';
import {
  assertMoneyConservation,
  canBeRaided,
  formatSignedYuan,
  formatYuan,
  getStatusLabel,
} from '../core/dormEngine';
import { STORY_ACTS } from '../core/storyActs';
import { ConnectionStatus, LanServerInfo, SyncMode } from '../core/syncClient';
import { DormAction, DormState, ROOMMATE_IDS, RoommateId } from '../types/dorm';
import { getMountedMechanismCount } from './MechanismSlot';

interface DirectorConsoleProps {
  dormState: DormState;
  activeRole: RoommateId;
  onSelectRole: (role: RoommateId) => void;
  syncMode: SyncMode;
  onChangeSyncMode: (mode: SyncMode) => void;
  connectionStatus: ConnectionStatus;
  serverOnline: boolean;
  lanInfo: LanServerInfo;
  onRefreshLanInfo: () => void;
  onDispatch: (action: DormAction) => void;
  onJumpToAct: (actId: number, switchRole?: boolean) => void;
  onOpenSettlement: () => void;
}

export function DirectorConsole({
  dormState,
  activeRole,
  onSelectRole,
  syncMode,
  onChangeSyncMode,
  connectionStatus,
  serverOnline,
  lanInfo,
  onRefreshLanInfo,
  onDispatch,
  onJumpToAct,
  onOpenSettlement,
}: DirectorConsoleProps) {
  const conservation = useMemo(() => assertMoneyConservation(dormState), [dormState]);
  const mountedMechCount = getMountedMechanismCount();

  const [customHost, setCustomHost] = useState<string>('');
  const [qrDataUrls, setQrDataUrls] = useState<Partial<Record<RoommateId, string>>>({});
  const [copiedRole, setCopiedRole] = useState<RoommateId | null>(null);

  const effectiveHost = customHost.trim() || lanInfo.primaryLanIp || '127.0.0.1';
  const effectiveWebPort =
    typeof window !== 'undefined' && window.location.port
      ? window.location.port
      : String(lanInfo.webPort || 5173);

  const roleMobileLinks = useMemo(() => {
    const map = {} as Record<RoommateId, string>;
    for (const id of ROOMMATE_IDS) {
      map[id] = `http://${effectiveHost}:${effectiveWebPort}/?role=${id}&mobile=1&mode=lan&wsPort=${lanInfo.syncPort}`;
    }
    return map;
  }, [effectiveHost, effectiveWebPort, lanInfo.syncPort]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextQrs: Partial<Record<RoommateId, string>> = {};
      for (const id of ROOMMATE_IDS) {
        try {
          nextQrs[id] = await QRCode.toDataURL(roleMobileLinks[id], {
            width: 148,
            margin: 1,
            color: {
              dark: '#0F172A',
              light: '#FFFFFF',
            },
          });
        } catch {
          // ignore QR generation error
        }
      }
      if (!cancelled) {
        setQrDataUrls(nextQrs);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roleMobileLinks]);

  const handleDirectorRaid = (targetId: RoommateId) => {
    // 优先选一位已清醒且非目标本人的室友作为突袭发起人；若暂无清醒室友，默认由老张（或阿强）发起
    const awakeRaider = ROOMMATE_IDS.find(
      (id) => id !== targetId && dormState.roommates[id].status === 'awake'
    );
    const fallbackRaider: RoommateId = targetId === 'zhang' ? 'qiang' : 'zhang';
    const raiderId = awakeRaider ?? fallbackRaider;

    // 若目标正处于 awake，先置入眯眼回笼觉以便现场立即演示突袭
    if (!canBeRaided(dormState.roommates[targetId].status)) {
      onDispatch({
        type: 'ENTER_RELAPSE_SLEEP',
        roommateId: targetId,
        clock: dormState.currentClock,
      });
    }
    if (!awakeRaider && dormState.roommates[raiderId].status !== 'awake') {
      onDispatch({
        type: 'COMPLETE_STAGE2_PUZZLE',
        roommateId: raiderId,
        clock: dormState.currentClock,
      });
    }

    onDispatch({
      type: 'LAUNCH_RAID',
      raiderId,
      targetId,
      timeLimitSec: 40,
      penaltyCents: 1000,
      clock: dormState.currentClock,
    });
    onSelectRole(targetId);
  };

  const handleCopyLink = async (id: RoommateId) => {
    try {
      await navigator.clipboard.writeText(roleMobileLinks[id]);
      setCopiedRole(id);
      window.setTimeout(() => setCopiedRole(null), 1600);
    } catch {
      // ignore clipboard restrictions
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-[#0F172A]/95 p-5 shadow-2xl">
      {/* Top Console Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[#FACC15] px-2 py-0.5 text-[11px] font-black tracking-wider text-slate-950 uppercase">
              DIRECTOR CONSOLE
            </span>
            <h2 className="text-lg font-black tracking-tight text-white">
              404 寝室上帝导播切换台
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            实时透视 4 人押金池守恒账本 · 一键推进五幕答辩故事 · 局域网真机扫码上号
          </p>
        </div>

        {/* Dual-Mode Toggle & Status */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => onChangeSyncMode('local')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                syncMode === 'local'
                  ? 'bg-[#FACC15] text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              单机剧本模式
            </button>
            <button
              type="button"
              onClick={() => onChangeSyncMode('lan')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                syncMode === 'lan'
                  ? 'bg-emerald-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              局域网联机模式
            </button>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold ${
              syncMode === 'lan' && connectionStatus === 'connected'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : serverOnline
                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                  : 'border-slate-700 bg-slate-800/90 text-slate-300'
            }`}
          >
            <Wifi className="h-3.5 w-3.5" />
            {syncMode === 'lan' && connectionStatus === 'connected'
              ? `WS已同步 (${lanInfo.connectedClients}端在线)`
              : serverOnline
                ? `联机服务就绪 (:${lanInfo.syncPort})`
                : '纯本地零依赖引擎'}
          </span>
        </div>
      </div>

      {/* Strict Money Conservation Meter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#FACC15]/35 bg-gradient-to-r from-[#FACC15]/10 via-slate-900 to-emerald-500/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FACC15]/20 text-[#FACC15]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#FACC15]">
                刚性资金守恒不变量校验通过
              </span>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                REV #{dormState.revision} · 机制槽位 {mountedMechCount}/5
              </span>
            </div>
            <div className="mt-0.5 font-mono text-xs text-slate-300">
              4人余额合计{' '}
              <strong className="text-white">
                {formatYuan(conservation.totalBalancesCents)}
              </strong>{' '}
              + 公共待分奖池{' '}
              <strong className="text-[#FACC15]">
                {formatYuan(conservation.publicPoolCents)}
              </strong>{' '}
              ==={' '}
              <strong className="text-emerald-400">
                {formatYuan(conservation.expectedTotalCents)}
              </strong>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onDispatch({
                type: 'SIGN_ALL_AND_START_ALARM',
                clock: '07:00',
              })
            }
            className="flex items-center gap-1 rounded-xl border border-red-500/50 bg-red-500/15 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/25"
          >
            <BellRing className="h-3.5 w-3.5" /> 全寝拉响 07:00 闹钟
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
            className="flex items-center gap-1 rounded-xl bg-[#FACC15] px-3 py-2 text-xs font-black text-slate-950 hover:bg-yellow-300"
          >
            <ReceiptText className="h-3.5 w-3.5" /> 今日鸡腿结算单
          </button>
          <button
            type="button"
            onClick={() => onDispatch({ type: 'RESET_DAY', clock: '23:30' })}
            className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 重置新一天
          </button>
        </div>
      </div>

      {/* Section 1: 5-Act Pitch Story Switcher */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-slate-300 uppercase">
            <Film className="h-4 w-4 text-[#FACC15]" /> 五幕式答辩路演剧本快进器（一键切幕）
          </span>
          <span className="text-[11px] text-slate-400">
            当前：{dormState.currentClock} · 第 {dormState.currentActId} 幕
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {STORY_ACTS.map((act) => {
            const isCurrent = dormState.currentActId === act.actId;
            return (
              <button
                key={act.actId}
                type="button"
                onClick={() => onJumpToAct(act.actId, true)}
                className={`group flex flex-col justify-between rounded-2xl border p-2.5 text-left transition ${
                  isCurrent
                    ? 'border-[#FACC15] bg-[#FACC15]/15 shadow-md'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-600 hover:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-black ${
                        isCurrent
                          ? 'bg-[#FACC15] text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      ACT {act.actId} · {act.clock}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      视角:{dormState.roommates[act.recommendedRole].shortName}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs font-extrabold text-white">
                    {act.shortTitle}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-400">
                    {act.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: 4 Roommates Live Status & Perspective Switcher */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-slate-300 uppercase">
            <Eye className="h-4 w-4 text-[#FACC15]" /> 404 寝室四人实时账本 & 手机视角切换
          </span>
          <span className="text-[11px] text-slate-400">
            点击任意室友卡片即可在左侧手机屏接管操作
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {ROOMMATE_IDS.map((id) => {
            const r = dormState.roommates[id];
            const isSelected = activeRole === id;
            const netCents = r.balanceCents - r.initialDepositCents;
            const mobileCount = lanInfo.mobileRolePresence?.[id] ?? 0;
            const barWidthPct = Math.min(
              100,
              Math.max(4, Math.round((r.balanceCents / 8000) * 100))
            );

            return (
              <div
                key={id}
                onClick={() => onSelectRole(id)}
                className={`cursor-pointer rounded-2xl border p-3.5 transition ${
                  isSelected
                    ? 'border-[#FACC15] bg-slate-900 ring-2 ring-[#FACC15]/30'
                    : 'border-slate-800 bg-slate-900/65 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-black text-slate-950"
                        style={{ backgroundColor: r.accentHex }}
                      >
                        {r.badgeLabel}
                      </span>
                      <span className="text-sm font-black text-white">{r.name}</span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                        {r.roleTag}
                      </span>
                      {isSelected && (
                        <span className="rounded bg-[#FACC15]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#FACC15]">
                          当前手机视角
                        </span>
                      )}
                      {mobileCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                          <Smartphone className="h-2.5 w-2.5" /> 真机在线×{mobileCount}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          r.status === 'awake'
                            ? 'bg-emerald-400'
                            : r.status === 'being_raided' || r.status === 'ringing_stage1'
                              ? 'animate-ping bg-red-500'
                              : 'bg-amber-400'
                        }`}
                      />
                      <span className="text-xs font-bold text-slate-200">
                        {getStatusLabel(r.status)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-base font-black text-white">
                      {formatYuan(r.balanceCents)}
                    </div>
                    <div
                      className={`font-mono text-xs font-bold ${
                        netCents > 0
                          ? 'text-emerald-400'
                          : netCents < 0
                            ? 'text-red-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {formatSignedYuan(netCents)}
                    </div>
                  </div>
                </div>

                {/* Balance Bar */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${barWidthPct}%`,
                      backgroundColor:
                        netCents > 0 ? '#22C55E' : netCents < 0 ? '#EF4444' : r.accentHex,
                    }}
                  />
                </div>

                <p className="mt-1.5 line-clamp-1 text-[11px] text-slate-400">
                  {r.lastActionNote}
                </p>

                {/* Director Manual Triggers */}
                <div
                  className="mt-2.5 flex flex-wrap gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onDispatch({
                        type: 'TRIGGER_ALARM',
                        roommateIds: [id],
                        clock: dormState.currentClock,
                      });
                      onSelectRole(id);
                    }}
                    className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20"
                  >
                    触发闹钟滑块
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDispatch({
                        type: 'COMPLETE_STAGE1_SLIDER',
                        roommateId: id,
                        clock: dormState.currentClock,
                      });
                      onSelectRole(id);
                    }}
                    className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[11px] font-bold text-sky-300 hover:bg-sky-500/20"
                  >
                    直达小游戏关
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDirectorRaid(id)}
                    className="flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/15 px-2 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/25"
                  >
                    <Crosshair className="h-3 w-3" /> 突袭查岗TA
                  </button>
                  {r.status !== 'awake' && (
                    <button
                      type="button"
                      onClick={() =>
                        onDispatch({
                          type: 'COMPLETE_STAGE2_PUZZLE',
                          roommateId: id,
                          clock: dormState.currentClock,
                        })
                      }
                      className="flex items-center gap-0.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20"
                    >
                      <CheckCircle2 className="h-3 w-3" /> 秒醒打卡
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: LAN Multi-Phone Scan-to-Join Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
              <QrCode className="h-4 w-4 text-[#FACC15]" />
              局域网真机扫码上号（4 床位独立全屏视图）
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              同一 Wi-Fi / 热点下手机扫码即自动进入对应室友全屏模式（`?role=xxx&amp;mobile=1`）并毫秒级同步账本
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={customHost}
              onChange={(e) => setCustomHost(e.target.value)}
              placeholder={`IP: ${lanInfo.primaryLanIp}`}
              className="w-36 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-200 focus:border-[#FACC15] focus:outline-none"
            />
            <button
              type="button"
              onClick={onRefreshLanInfo}
              title="重新探测本机局域网 IPv4"
              className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:border-[#FACC15] hover:text-[#FACC15]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {ROOMMATE_IDS.map((id) => {
            const r = dormState.roommates[id];
            const qrSrc = qrDataUrls[id];
            return (
              <div
                key={id}
                className="flex flex-col items-center rounded-xl border border-slate-800 bg-slate-900/90 p-2.5"
              >
                <div className="mb-1.5 flex w-full items-center justify-between">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-black text-slate-950"
                    style={{ backgroundColor: r.accentHex }}
                  >
                    {r.badgeLabel}
                  </span>
                  <span className="text-xs font-bold text-white">{r.shortName}</span>
                </div>

                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg bg-white p-1">
                  {qrSrc ? (
                    <img
                      src={qrSrc}
                      alt={`${r.name}扫码上号二维码`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-500">生成中...</span>
                  )}
                </div>

                <div className="mt-2 flex w-full gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(id)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-700 bg-slate-800 py-1 text-[10px] font-semibold text-slate-300 hover:text-white"
                  >
                    <Copy className="h-2.5 w-2.5" />
                    {copiedRole === id ? '已复制' : '复制'}
                  </button>
                  <a
                    href={
                      typeof window !== 'undefined' &&
                      window.location.protocol === 'file:' &&
                      !serverOnline
                        ? `${window.location.href.split('?')[0].split('#')[0]}?role=${id}&mobile=1`
                        : roleMobileLinks[id]
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1 rounded-md bg-slate-800 py-1 text-[10px] font-semibold text-[#FACC15] hover:bg-slate-700"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                    小窗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
