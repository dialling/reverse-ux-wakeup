import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { EvasiveSliderProps } from './types';

const BOLT_HOLD_MS = 800;
const GOAL_HOLD_MS = 500;
const GOAL_THRESHOLD_PCT = 98;
const SAFE_MAX_SPEED_PCT_PER_SEC = 105; // 超过此速度且快速甩动即判定为闭眼猛甩脱轨
const THUMB_WIDTH_PX = 56;

const EVADE_TAUNTS = [
  '半梦半醒瞎划拉？请先长按上方【防梦游安全栓】0.8秒！',
  '抓不到我吧～没扣死安全栓休想盲按打卡！先长按上方黄键！',
  '还在闭眼乱摸屏幕？上方【防梦游安全栓】按满 0.8 秒我才停下！',
  '404防盲按系统警告：请睁开眼，先长按解锁上方安全栓！',
];

const EVADE_POSITIONS: Array<{ x: number; y: number; rot: number }> = [
  { x: 118, y: -20, rot: -12 },
  { x: 46, y: 20, rot: 10 },
  { x: 176, y: -16, rot: 14 },
  { x: 88, y: 18, rot: -9 },
  { x: 148, y: 16, rot: 11 },
];

interface SamplePoint {
  t: number;
  pct: number;
}

export const EvasiveGravitySlider: React.FC<EvasiveSliderProps> = ({
  roommateName,
  onComplete,
  onSlipPenalty,
}) => {
  const [isBoltLocked, setIsBoltLocked] = useState(false);
  const [boltProgress, setBoltProgress] = useState(0); // 0..100
  const [isHoldingBolt, setIsHoldingBolt] = useState(false);

  const [evadeIndex, setEvadeIndex] = useState(-1);
  const [evadeCount, setEvadeCount] = useState(0);
  const [tauntMessage, setTauntMessage] = useState<string>(
    '⚠️ 滑块处于游离防盲按态：请先长按【防梦游安全栓】0.8秒解锁！'
  );
  const [tauntTone, setTauntTone] = useState<'warn' | 'danger' | 'ok'>('warn');

  const [progressPct, setProgressPct] = useState(0); // 0..100
  const [isDragging, setIsDragging] = useState(false);
  const [speedPctPerSec, setSpeedPctPerSec] = useState(0);
  const [goalHoldPct, setGoalHoldPct] = useState(0); // 0..100 for 0.5s hold at >=98%
  const [isGravityReversing, setIsGravityReversing] = useState(false);
  const [derailFlash, setDerailFlash] = useState(false);
  const [completed, setCompleted] = useState(false);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const boltRafRef = useRef<number | null>(null);
  const boltStartRef = useRef<number>(0);

  const gravityRafRef = useRef<number | null>(null);
  const goalRafRef = useRef<number | null>(null);
  const goalStartRef = useRef<number | null>(null);

  const draggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const dragStartOffsetPxRef = useRef<number>(0);
  const progressRef = useRef<number>(0);
  const samplesRef = useRef<SamplePoint[]>([]);
  const completedRef = useRef(false);

  const setProgressSync = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    progressRef.current = clamped;
    setProgressPct(clamped);
  }, []);

  const stopGravityAnim = useCallback(() => {
    if (gravityRafRef.current !== null) {
      cancelAnimationFrame(gravityRafRef.current);
      gravityRafRef.current = null;
    }
    setIsGravityReversing(false);
  }, []);

  const stopGoalHoldAnim = useCallback(() => {
    if (goalRafRef.current !== null) {
      cancelAnimationFrame(goalRafRef.current);
      goalRafRef.current = null;
    }
    goalStartRef.current = null;
    setGoalHoldPct(0);
  }, []);

  // 启动“被窝万有引力”加速倒退回 0%
  const startGravityReverse = useCallback(
    (reasonText?: string) => {
      stopGravityAnim();
      stopGoalHoldAnim();
      if (progressRef.current <= 0.2) {
        setProgressSync(0);
        return;
      }
      setIsGravityReversing(true);
      if (reasonText) {
        setTauntMessage(reasonText);
        setTauntTone('danger');
      }

      let lastTime = performance.now();
      let velocity = 38; // 初始倒吸速度 (%/s)
      const accel = 260; // 万有引力加速度 (%/s^2)

      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;
        velocity += accel * dt;
        const next = progressRef.current - velocity * dt;
        if (next <= 0) {
          setProgressSync(0);
          setIsGravityReversing(false);
          gravityRafRef.current = null;
          return;
        }
        setProgressSync(next);
        gravityRafRef.current = requestAnimationFrame(tick);
      };

      gravityRafRef.current = requestAnimationFrame(tick);
    },
    [setProgressSync, stopGoalHoldAnim, stopGravityAnim]
  );

  // 触发终点 0.5 秒驻留读条
  const startGoalHoldIfNeeded = useCallback(() => {
    if (goalRafRef.current !== null || completedRef.current) return;
    goalStartRef.current = performance.now();
    setTauntMessage('🎯 已抵终点！稳住别松手，保持 0.5 秒完成早起打卡！');
    setTauntTone('ok');

    const tick = (now: number) => {
      if (completedRef.current) return;
      if (!draggingRef.current || progressRef.current < GOAL_THRESHOLD_PCT) {
        stopGoalHoldAnim();
        return;
      }
      const elapsed = now - (goalStartRef.current ?? now);
      const pct = Math.min(100, (elapsed / GOAL_HOLD_MS) * 100);
      setGoalHoldPct(pct);
      if (elapsed >= GOAL_HOLD_MS) {
        completedRef.current = true;
        draggingRef.current = false;
        setIsDragging(false);
        setCompleted(true);
        setGoalHoldPct(100);
        setSpeedPctPerSec(0);
        setTauntMessage(`✅ ${roommateName} 已解除被窝封印！第一阶段打卡通过！`);
        setTauntTone('ok');
        onComplete();
        return;
      }
      goalRafRef.current = requestAnimationFrame(tick);
    };

    goalRafRef.current = requestAnimationFrame(tick);
  }, [onComplete, roommateName, stopGoalHoldAnim]);

  // 清理动画帧
  useEffect(() => {
    return () => {
      if (boltRafRef.current !== null) cancelAnimationFrame(boltRafRef.current);
      if (gravityRafRef.current !== null) cancelAnimationFrame(gravityRafRef.current);
      if (goalRafRef.current !== null) cancelAnimationFrame(goalRafRef.current);
    };
  }, []);

  // 【防梦游安全栓】按住 0.8s 逻辑
  const handleBoltPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isBoltLocked || completed) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsHoldingBolt(true);
    boltStartRef.current = performance.now();
    setTauntMessage('⏳ 正在扣死【防梦游安全栓】… 稳住按满 0.8 秒！');
    setTauntTone('warn');

    const tick = (now: number) => {
      const elapsed = now - boltStartRef.current;
      const pct = Math.min(100, (elapsed / BOLT_HOLD_MS) * 100);
      setBoltProgress(pct);
      if (elapsed >= BOLT_HOLD_MS) {
        boltRafRef.current = null;
        setIsHoldingBolt(false);
        setIsBoltLocked(true);
        setEvadeIndex(-1);
        setBoltProgress(100);
        setTauntMessage('🔓 安全栓已扣死！请看着上方绿色速度表盘，匀速向右推到底并稳住 0.5 秒！');
        setTauntTone('ok');
        return;
      }
      boltRafRef.current = requestAnimationFrame(tick);
    };

    if (boltRafRef.current !== null) cancelAnimationFrame(boltRafRef.current);
    boltRafRef.current = requestAnimationFrame(tick);
  };

  const handleBoltPointerRelease = () => {
    if (isBoltLocked || !isHoldingBolt) return;
    if (boltRafRef.current !== null) {
      cancelAnimationFrame(boltRafRef.current);
      boltRafRef.current = null;
    }
    setIsHoldingBolt(false);
    setBoltProgress(0);
    setTauntMessage('😤 松手太快啦！防梦游安全栓必须连续按满 0.8 秒才能扣死滑块！');
    setTauntTone('danger');
  };

  // 未锁安全栓时，滑块闪现躲避手指
  const triggerEvade = useCallback(() => {
    if (isBoltLocked || completed) return;
    setEvadeCount((prev) => {
      const nextCount = prev + 1;
      setEvadeIndex((prevIdx) => (prevIdx + 1) % EVADE_POSITIONS.length);
      const msg = EVADE_TAUNTS[(nextCount - 1) % EVADE_TAUNTS.length];
      setTauntMessage(msg);
      setTauntTone('danger');
      return nextCount;
    });
  }, [completed, isBoltLocked]);

  // 滑块 Pointer 拖拽逻辑
  const handleThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (completed) return;

    if (!isBoltLocked) {
      triggerEvade();
      return;
    }

    stopGravityAnim();
    const track = trackRef.current;
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const usableWidth = Math.max(1, rect.width - THUMB_WIDTH_PX);
    const currentThumbLeft = (progressRef.current / 100) * usableWidth;
    const pointerXInTrack = e.clientX - rect.left;
    dragStartOffsetPxRef.current = Math.max(
      0,
      Math.min(THUMB_WIDTH_PX, pointerXInTrack - currentThumbLeft)
    );

    activePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    setIsDragging(true);
    samplesRef.current = [{ t: performance.now(), pct: progressRef.current }];
    setSpeedPctPerSec(0);
    setTauntMessage('🟢 保持指针在绿色匀速区，稳稳推到最右侧！切勿猛甩或中途松手！');
    setTauntTone('ok');
  };

  const handleThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || activePointerIdRef.current !== e.pointerId || completedRef.current) {
      return;
    }
    const track = trackRef.current;
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const usableWidth = Math.max(1, rect.width - THUMB_WIDTH_PX);
    const rawLeft = e.clientX - rect.left - dragStartOffsetPxRef.current;
    const nextPct = Math.max(0, Math.min(100, (rawLeft / usableWidth) * 100));

    // 只允许从当前位置连续推进，防止点击轨道末端瞬移
    if (nextPct - progressRef.current > 32) {
      // 瞬移跳变视作猛甩脱轨
      triggerOverspeedDerail();
      return;
    }

    const now = performance.now();
    samplesRef.current.push({ t: now, pct: nextPct });
    // 保留最近 110ms 窗口采样点用于平滑测速
    while (samplesRef.current.length > 2 && now - samplesRef.current[0].t > 120) {
      samplesRef.current.shift();
    }

    const oldest = samplesRef.current[0];
    const dtSec = (now - oldest.t) / 1000;
    const dPct = nextPct - oldest.pct;
    let instantSpeed = 0;
    if (dtSec >= 0.035 && dPct > 0) {
      instantSpeed = dPct / dtSec;
    }
    setSpeedPctPerSec(Math.max(0, Math.round(instantSpeed)));

    // 判定“用力过猛脱轨”：窗口位移超过 13% 且推进速度超过红线
    if (dtSec >= 0.045 && dPct >= 13.5 && instantSpeed > SAFE_MAX_SPEED_PCT_PER_SEC) {
      triggerOverspeedDerail();
      return;
    }

    setProgressSync(nextPct);

    if (nextPct >= GOAL_THRESHOLD_PCT) {
      startGoalHoldIfNeeded();
    } else {
      stopGoalHoldAnim();
    }
  };

  const triggerOverspeedDerail = () => {
    draggingRef.current = false;
    activePointerIdRef.current = null;
    setIsDragging(false);
    setSpeedPctPerSec(135);
    stopGoalHoldAnim();
    setDerailFlash(true);
    setTimeout(() => {
      setDerailFlash(false);
      setSpeedPctPerSec(0);
    }, 650);

    startGravityReverse('💥 用力过猛脱轨！系统判定你在闭眼猛甩，已弹回 0%！');
    onSlipPenalty?.('猛甩滑块超速脱轨（闭眼乱划嫌疑）');
  };

  const handleThumbPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || activePointerIdRef.current !== e.pointerId) return;
    draggingRef.current = false;
    activePointerIdRef.current = null;
    setIsDragging(false);
    setSpeedPctPerSec(0);

    if (completedRef.current) return;

    const wasNearGoal = progressRef.current >= GOAL_THRESHOLD_PCT;
    startGravityReverse(
      wasNearGoal
        ? '😱 差一点点！终点必须按住稳停 0.5 秒，被窝万有引力把你吸回去了！'
        : '🧲 中途松手！被窝万有引力（9.8G）生效，打卡进度急速倒退归零！'
    );
  };

  // 计算当前表盘指针比例 (0..100%)，红线约在 78% 位置
  const gaugeRatio = Math.min(100, (speedPctPerSec / 135) * 100);
  const isSpeedDanger = speedPctPerSec > SAFE_MAX_SPEED_PCT_PER_SEC * 0.88;
  const isSpeedSweet = speedPctPerSec >= 12 && !isSpeedDanger;

  const currentEvade =
    !isBoltLocked && evadeIndex >= 0 ? EVADE_POSITIONS[evadeIndex] : { x: 0, y: 0, rot: 0 };

  return (
    <div
      className={`w-full rounded-2xl border-2 p-4 transition-colors select-none ${
        derailFlash
          ? 'border-[#EF4444] bg-[#450A0A] animate-pulse'
          : completed
            ? 'border-emerald-400 bg-[#0F172A]'
            : 'border-[#FACC15]/70 bg-[#0F172A]'
      } text-slate-100 shadow-2xl`}
    >
      <style>{`
        @keyframes snooze-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>

      {/* 顶部栏：关卡标识与室友名字 */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#FACC15] text-[#0F172A] text-xs font-black tracking-wider">
            早起第一关
          </span>
          <span className="text-sm font-bold text-white truncate">
            防盲按重力打卡栓
          </span>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-[#FACC15] border border-slate-700">
          床位：{roommateName}
        </span>
      </div>

      {/* 嘲讽 / 指引气泡 */}
      <div
        style={tauntTone === 'danger' ? { animation: 'snooze-shake 0.32s ease-in-out' } : undefined}
        className={`mb-3 rounded-xl px-3 py-2.5 text-xs font-semibold leading-relaxed border flex items-start gap-2 ${
          tauntTone === 'danger'
            ? 'bg-[#EF4444]/20 border-[#EF4444] text-red-200'
            : tauntTone === 'ok'
              ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-200'
              : 'bg-[#FACC15]/15 border-[#FACC15]/60 text-amber-100'
        }`}
      >
        <span className="text-base leading-none mt-0.5">
          {tauntTone === 'danger' ? '🚨' : tauntTone === 'ok' ? '🟢' : '⚠️'}
        </span>
        <div className="flex-1">
          <div>{tauntMessage}</div>
          {!isBoltLocked && evadeCount > 0 && (
            <div className="mt-1 text-[11px] text-[#FACC15] font-mono">
              已扑空闪避 {evadeCount} 次 · 请按住下方安全栓解锁
            </div>
          )}
        </div>
      </div>

      {/* 步骤 1：防梦游安全栓按钮 */}
      <div className="mb-3.5">
        <button
          type="button"
          disabled={isBoltLocked || completed}
          onPointerDown={handleBoltPointerDown}
          onPointerUp={handleBoltPointerRelease}
          onPointerLeave={handleBoltPointerRelease}
          onPointerCancel={handleBoltPointerRelease}
          style={{ touchAction: 'none' }}
          className={`relative w-full overflow-hidden rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
            isBoltLocked
              ? 'border-emerald-400 bg-emerald-950/60 cursor-default'
              : 'border-[#FACC15] bg-slate-900 hover:bg-slate-800 active:scale-[0.99] cursor-pointer'
          }`}
        >
          {/* 充能背景进度 */}
          <div
            className={`absolute inset-y-0 left-0 transition-none ${
              isBoltLocked ? 'bg-emerald-500/25' : 'bg-[#FACC15]/35'
            }`}
            style={{ width: `${isBoltLocked ? 100 : boltProgress}%` }}
          />
          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isBoltLocked ? (
                <svg className="w-5 h-5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-[#FACC15] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 118 0v4" />
                </svg>
              )}
              <div>
                <div className="text-xs font-extrabold tracking-wide text-white">
                  {isBoltLocked
                    ? 'STEP 1 已完成：防梦游安全栓已扣死'
                    : isHoldingBolt
                      ? '稳住别松！正在注入清醒气压…'
                      : 'STEP 1：长按此处 0.8 秒扣死【防梦游安全栓】'}
                </div>
                <div className="text-[11px] text-slate-300">
                  {isBoltLocked
                    ? '滑块已锁定在轨道起点，现在可匀速向右推进'
                    : '未解锁直接碰滑块会触发闪避嘲讽'}
                </div>
              </div>
            </div>
            <span className="text-xs font-mono font-black px-2 py-1 rounded bg-slate-950/80 text-[#FACC15] shrink-0">
              {isBoltLocked ? 'LOCKED' : `${Math.round(boltProgress)}%`}
            </span>
          </div>
        </button>
      </div>

      {/* 实时绿色安全速度区间表盘 */}
      <div className="mb-3 rounded-xl bg-slate-900/90 border border-slate-700/80 px-3 py-2">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <span>⏱️ 推进速度监控表盘</span>
            {isDragging && (
              <span
                className={`px-1.5 py-0.2 rounded font-bold ${
                  isSpeedDanger
                    ? 'bg-[#EF4444] text-white'
                    : isSpeedSweet
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-700 text-slate-200'
                }`}
              >
                {isSpeedDanger ? '超速危险!' : isSpeedSweet ? '安全匀速' : '待推进'}
              </span>
            )}
          </span>
          <span className="font-mono text-xs font-bold text-[#FACC15]">
            {speedPctPerSec} %/s
          </span>
        </div>

        {/* 分段仪表条：静止灰 | 绿色安全推进区 | 红色猛甩脱轨区 */}
        <div className="relative h-3 w-full rounded-full overflow-hidden bg-slate-800 flex">
          <div className="h-full bg-slate-600/70" style={{ width: '10%' }} title="静止区" />
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-400"
            style={{ width: '66%' }}
            title="绿色安全匀速区间"
          />
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-[#EF4444]"
            style={{ width: '24%' }}
            title="猛甩超速脱轨区"
          />
          {/* 实时速度游标针 */}
          <div
            className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_8px_#fff] transition-all duration-75"
            style={{ left: `calc(${gaugeRatio}% - 3px)` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400 font-medium">
          <span>0 静止</span>
          <span className="text-emerald-400 font-bold">▲ 绿色安全速度区（约 1.5~3秒推完）</span>
          <span className="text-[#EF4444] font-bold">猛甩脱轨 ▶</span>
        </div>
      </div>

      {/* 步骤 2：主滑轨（带游离闪现 + 万有引力倒吸） */}
      <div className="pt-3 pb-2">
        <div
          ref={trackRef}
          onClick={() => {
            if (!isBoltLocked && !completed) triggerEvade();
          }}
          className={`relative h-14 w-full rounded-2xl border-2 transition-colors ${
            completed
              ? 'border-emerald-400 bg-emerald-950/50'
              : isBoltLocked
                ? 'border-slate-600 bg-slate-950'
                : 'border-dashed border-[#FACC15]/60 bg-slate-950/80'
          }`}
        >
          {/* 轨道警示斜纹填充条 */}
          <div
            className={`absolute inset-y-0 left-0 rounded-l-xl transition-none ${
              isGravityReversing
                ? 'bg-[#EF4444]/40'
                : completed
                  ? 'bg-emerald-500/40 rounded-r-xl'
                  : 'bg-gradient-to-r from-[#FACC15]/30 via-emerald-500/35 to-emerald-400/50'
            }`}
            style={{
              width: completed
                ? '100%'
                : `calc(${THUMB_WIDTH_PX / 2}px + ${(progressPct / 100) * 100}% * 0.82)`,
            }}
          />

          {/* 轨道中央底纹提示文字 */}
          <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
            <span className="text-[11px] font-bold text-slate-500 pl-12">
              {isGravityReversing
                ? '💤 被窝万有引力急速倒吸中...'
                : isBoltLocked
                  ? 'STEP 2：匀速向右推到底 ➔'
                  : '🔒 未扣安全栓（触碰必闪避）'}
            </span>
            <span
              className={`text-[11px] font-black px-2 py-0.5 rounded ${
                progressPct >= GOAL_THRESHOLD_PCT
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {completed
                ? '100% 已醒'
                : progressPct >= GOAL_THRESHOLD_PCT
                  ? `稳住 ${(0.5 * (1 - goalHoldPct / 100)).toFixed(1)}s`
                  : '终点驻留0.5s'}
            </span>
          </div>

          {/* 滑块本体 */}
          <div
            role="slider"
            tabIndex={0}
            aria-label="早起防盲按打卡滑块"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPct)}
            onPointerEnter={() => {
              if (!isBoltLocked && !completed) triggerEvade();
            }}
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerUpOrCancel}
            onPointerCancel={handleThumbPointerUpOrCancel}
            style={{
              touchAction: 'none',
              width: `${THUMB_WIDTH_PX}px`,
              left: isBoltLocked
                ? `calc((100% - ${THUMB_WIDTH_PX}px) * ${progressPct / 100})`
                : '6px',
              transform: !isBoltLocked
                ? `translate(${currentEvade.x}px, ${currentEvade.y}px) rotate(${currentEvade.rot}deg)`
                : isDragging
                  ? 'scale(1.05)'
                  : 'scale(1)',
              transition: !isBoltLocked
                ? 'transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1)'
                : 'none',
            }}
            className={`absolute top-1 bottom-1 z-20 rounded-xl flex flex-col items-center justify-center font-black shadow-lg border-2 ${
              completed
                ? 'bg-emerald-400 border-white text-slate-950 cursor-default'
                : !isBoltLocked
                  ? 'bg-[#EF4444] border-[#FACC15] text-white cursor-pointer'
                  : progressPct >= GOAL_THRESHOLD_PCT
                    ? 'bg-emerald-400 border-[#FACC15] text-slate-950 cursor-grabbing'
                    : 'bg-[#FACC15] border-amber-200 text-[#0F172A] cursor-grab active:cursor-grabbing'
            }`}
          >
            {completed ? (
              <span className="text-base">✓</span>
            ) : !isBoltLocked ? (
              <span className="text-xs leading-none">抓我呀</span>
            ) : progressPct >= GOAL_THRESHOLD_PCT ? (
              <div className="flex flex-col items-center">
                <span className="text-[10px] leading-none font-extrabold">HOLD</span>
                <span className="text-[11px] font-mono leading-tight">
                  {Math.round(goalHoldPct)}%
                </span>
              </div>
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* 底部通关秘籍微提示 */}
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
        <span>反作弊机制：猛甩脱轨 · 松手倒吸归零</span>
        <span className="font-mono text-slate-300">进度 {Math.round(progressPct)}%</span>
      </div>
    </div>
  );
};

export default EvasiveGravitySlider;
