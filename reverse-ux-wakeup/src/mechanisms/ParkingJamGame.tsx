import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PARKING_CRASH_TAUNTS,
  PARKING_LEVELS,
  type ParkingVehicleDef,
} from './puzzleLevels';
import type { ParkingJamProps } from './types';

interface DragSession {
  vehicleId: string;
  pointerId: number;
  startClientCoord: number;
  originGridPos: number;
  minLegalPos: number;
  maxLegalPos: number;
  cellPx: number;
}

const CRASH_OVERSHOOT_CELLS = 0.44;

export const ParkingJamGame: React.FC<ParkingJamProps> = ({
  initialLevelIndex = 0,
  onWin,
  onCollision,
}) => {
  const safeInitIdx = Math.max(0, Math.min(PARKING_LEVELS.length - 1, initialLevelIndex));
  const [levelIdx, setLevelIdx] = useState<number>(safeInitIdx);
  const level = PARKING_LEVELS[levelIdx];

  // 记录每辆车沿自身移动轴的起始格索引（横向车存 col，纵向车存 row）
  const buildInitialPositions = useCallback((vehicles: ParkingVehicleDef[]) => {
    const map: Record<string, number> = {};
    for (const v of vehicles) {
      map[v.id] = v.axis === 'h' ? v.col : v.row;
    }
    return map;
  }, []);

  const [positions, setPositions] = useState<Record<string, number>>(() =>
    buildInitialPositions(level.vehicles)
  );
  const [selectedId, setSelectedId] = useState<string>('hero');
  const [dragVisualPos, setDragVisualPos] = useState<{
    id: string;
    floatPos: number;
  } | null>(null);

  const [seconds, setSeconds] = useState<number>(0);
  const [collisions, setCollisions] = useState<number>(0);
  const [moves, setMoves] = useState<number>(0);
  const [crashedVehicleId, setCrashedVehicleId] = useState<string | null>(null);
  const [crashFlash, setCrashFlash] = useState<boolean>(false);
  const [isExitingWin, setIsExitingWin] = useState<boolean>(false);
  const [banner, setBanner] = useState<{
    tone: 'info' | 'crash' | 'win';
    text: string;
  }>({
    tone: 'info',
    text: '🛵 按住车辆顺朝向拖移，或点选车辆用下方方向键微调；撞车/撞墙会赌气退回原位！',
  });

  const boardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const positionsRef = useRef<Record<string, number>>(positions);
  positionsRef.current = positions;

  const lastMovedVehicleRef = useRef<string | null>(null);
  const movesRef = useRef<number>(0);
  const collisionsRef = useRef<number>(0);
  const secondsRef = useRef<number>(0);
  const wonRef = useRef<boolean>(false);

  const vehicleMap = useMemo(() => {
    const m = new Map<string, ParkingVehicleDef>();
    for (const v of level.vehicles) m.set(v.id, v);
    return m;
  }, [level]);

  const resetLevel = useCallback(
    (nextIdx?: number) => {
      const targetLevel =
        typeof nextIdx === 'number' ? PARKING_LEVELS[nextIdx] : PARKING_LEVELS[levelIdx];
      if (typeof nextIdx === 'number') {
        setLevelIdx(nextIdx);
      }
      const initPos = buildInitialPositions(targetLevel.vehicles);
      positionsRef.current = initPos;
      setPositions(initPos);
      dragRef.current = null;
      setDragVisualPos(null);
      setSelectedId('hero');
      lastMovedVehicleRef.current = null;
      movesRef.current = 0;
      setMoves(0);
      collisionsRef.current = 0;
      setCollisions(0);
      secondsRef.current = 0;
      setSeconds(0);
      wonRef.current = false;
      setIsExitingWin(false);
      setCrashedVehicleId(null);
      setCrashFlash(false);
      setBanner({
        tone: 'info',
        text: `🛵 目标：零碰撞把红色【早八驴】挪到右侧绿色 EXIT 口！（参考最优 ${targetLevel.optimalMoves} 步）`,
      });
    },
    [buildInitialPositions, levelIdx]
  );

  const prevInitPropRef = useRef<number>(safeInitIdx);
  useEffect(() => {
    if (prevInitPropRef.current !== safeInitIdx) {
      prevInitPropRef.current = safeInitIdx;
      resetLevel(safeInitIdx);
    }
  }, [resetLevel, safeInitIdx]);

  // 计时器
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (wonRef.current) return;
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [levelIdx]);

  // 计算指定车辆在当前棋盘下不碰撞可滑动的合法闭区间 [minPos, maxPos]
  const computeLegalRange = useCallback(
    (vehicle: ParkingVehicleDef, curPositions: Record<string, number>) => {
      const N = level.gridSize;
      const occupied = Array.from({ length: N }, () => Array<string | null>(N).fill(null));

      for (const v of level.vehicles) {
        if (v.id === vehicle.id) continue;
        const p = curPositions[v.id] ?? (v.axis === 'h' ? v.col : v.row);
        for (let k = 0; k < v.len; k++) {
          const r = v.axis === 'h' ? v.row : p + k;
          const c = v.axis === 'h' ? p + k : v.col;
          if (r >= 0 && r < N && c >= 0 && c < N) {
            occupied[r][c] = v.id;
          }
        }
      }

      const cur = curPositions[vehicle.id];
      let minPos = cur;
      while (minPos - 1 >= 0) {
        const checkR = vehicle.axis === 'h' ? vehicle.row : minPos - 1;
        const checkC = vehicle.axis === 'h' ? minPos - 1 : vehicle.col;
        if (occupied[checkR][checkC] !== null) break;
        minPos--;
      }

      let maxPos = cur;
      while (maxPos + vehicle.len < N) {
        const checkR = vehicle.axis === 'h' ? vehicle.row : maxPos + vehicle.len;
        const checkC = vehicle.axis === 'h' ? maxPos + vehicle.len : vehicle.col;
        if (occupied[checkR][checkC] !== null) break;
        maxPos++;
      }

      return { minPos, maxPos };
    },
    [level]
  );

  // 触发“迷糊追尾肇事”惩罚并退回拖动前原位
  const triggerCrashPenalty = useCallback(
    (vehicle: ParkingVehicleDef, revertToPos: number) => {
      dragRef.current = null;
      setDragVisualPos(null);

      // 强制退回本次拖动开始前的原位！
      const reverted = { ...positionsRef.current, [vehicle.id]: revertToPos };
      positionsRef.current = reverted;
      setPositions(reverted);

      const nextCols = collisionsRef.current + 1;
      collisionsRef.current = nextCols;
      setCollisions(nextCols);

      const roar = PARKING_CRASH_TAUNTS[(nextCols - 1) % PARKING_CRASH_TAUNTS.length];
      setCrashedVehicleId(vehicle.id);
      setCrashFlash(true);
      setBanner({
        tone: 'crash',
        text: `${roar}（【${vehicle.shortTag}】已赌气退回原位！）`,
      });

      window.setTimeout(() => {
        setCrashFlash(false);
        setCrashedVehicleId(null);
      }, 650);

      onCollision?.(nextCols);
    },
    [onCollision]
  );

  // 完成一次有效车辆位移并检查目标红车是否驶抵右侧 EXIT 口
  const commitVehicleMove = useCallback(
    (vehicle: ParkingVehicleDef, nextPos: number, prevPos: number) => {
      if (nextPos === prevPos || wonRef.current) return;

      const updated = { ...positionsRef.current, [vehicle.id]: nextPos };
      positionsRef.current = updated;
      setPositions(updated);

      // 同一辆车连续点微调方向键记为同一步顺滑平移（与 Rush Hour 标准步数严格对齐）
      let nextMoves = movesRef.current;
      if (lastMovedVehicleRef.current !== vehicle.id) {
        nextMoves += 1;
        movesRef.current = nextMoves;
        setMoves(nextMoves);
        lastMovedVehicleRef.current = vehicle.id;
      }

      if (vehicle.isHero && nextPos === level.gridSize - vehicle.len) {
        wonRef.current = true;
        setIsExitingWin(true);
        const usedSec = Math.max(1, secondsRef.current);
        setBanner({
          tone: 'win',
          text: `🎉 嘀嘀——！【${vehicle.name}】零刮擦冲出车棚！用时 ${usedSec}s · 共 ${nextMoves} 步！`,
        });
        window.setTimeout(() => {
          onWin({
            levelId: level.id,
            seconds: usedSec,
            collisions: collisionsRef.current,
            moves: nextMoves,
          });
        }, 360);
      } else {
        setBanner({
          tone: 'info',
          text: `✅ 【${vehicle.shortTag}】已平稳移至新位置，继续疏通右侧早八通道！`,
        });
      }
    },
    [level.gridSize, level.id, onWin]
  );

  // 车辆直接 Pointer 按下拖拽
  const handleVehiclePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    vehicle: ParkingVehicleDef
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (wonRef.current) return;

    setSelectedId(vehicle.id);
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const cellPx = rect.width / level.gridSize;
    const originGridPos = positionsRef.current[vehicle.id];
    const { minPos, maxPos } = computeLegalRange(vehicle, positionsRef.current);

    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      vehicleId: vehicle.id,
      pointerId: e.pointerId,
      startClientCoord: vehicle.axis === 'h' ? e.clientX : e.clientY,
      originGridPos,
      minLegalPos: minPos,
      maxLegalPos: maxPos,
      cellPx,
    };
    setDragVisualPos({ id: vehicle.id, floatPos: originGridPos });
  };

  const handleVehiclePointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
    vehicle: ParkingVehicleDef
  ) => {
    const sess = dragRef.current;
    if (!sess || sess.vehicleId !== vehicle.id || sess.pointerId !== e.pointerId || wonRef.current) {
      return;
    }

    const curCoord = vehicle.axis === 'h' ? e.clientX : e.clientY;
    const deltaCells = (curCoord - sess.startClientCoord) / Math.max(1, sess.cellPx);
    const rawFloatPos = sess.originGridPos + deltaCells;

    // 特殊绿灯：目标红车已无阻挡直通 EXIT 口（maxLegalPos === 4），继续往右拉直接出库胜利！
    const heroCanExitRight =
      Boolean(vehicle.isHero) && sess.maxLegalPos === level.gridSize - vehicle.len;

    if (
      rawFloatPos < sess.minLegalPos - CRASH_OVERSHOOT_CELLS ||
      (!heroCanExitRight && rawFloatPos > sess.maxLegalPos + CRASH_OVERSHOOT_CELLS)
    ) {
      triggerCrashPenalty(vehicle, sess.originGridPos);
      return;
    }

    if (heroCanExitRight && rawFloatPos >= sess.maxLegalPos + 0.15) {
      dragRef.current = null;
      setDragVisualPos(null);
      commitVehicleMove(vehicle, sess.maxLegalPos, sess.originGridPos);
      return;
    }

    const clamped = Math.max(sess.minLegalPos, Math.min(sess.maxLegalPos, rawFloatPos));
    setDragVisualPos({ id: vehicle.id, floatPos: clamped });
  };

  const handleVehiclePointerUp = (
    e: React.PointerEvent<HTMLDivElement>,
    vehicle: ParkingVehicleDef
  ) => {
    const sess = dragRef.current;
    if (!sess || sess.vehicleId !== vehicle.id || sess.pointerId !== e.pointerId) return;

    const finalFloat =
      dragVisualPos && dragVisualPos.id === vehicle.id
        ? dragVisualPos.floatPos
        : sess.originGridPos;
    const snapped = Math.max(
      sess.minLegalPos,
      Math.min(sess.maxLegalPos, Math.round(finalFloat))
    );

    dragRef.current = null;
    setDragVisualPos(null);

    if (snapped !== sess.originGridPos) {
      commitVehicleMove(vehicle, snapped, sess.originGridPos);
    }
  };

  // 下方微调控制面板：按方向移动选中车 1 格（若前方被堵强行点按，同样触发追尾肇事！）
  const handleStepNudge = (delta: -1 | 1) => {
    if (wonRef.current) return;
    const v = vehicleMap.get(selectedId);
    if (!v) return;

    const cur = positionsRef.current[v.id];
    const { minPos, maxPos } = computeLegalRange(v, positionsRef.current);
    const target = cur + delta;

    // 若目标红车已经在 col=4 门口再点右移，直接出库
    if (v.isHero && cur === level.gridSize - v.len && delta === 1) {
      commitVehicleMove(v, cur, cur - 1);
      return;
    }

    if (target < minPos || target > maxPos) {
      triggerCrashPenalty(v, cur);
      return;
    }

    commitVehicleMove(v, target, cur);
  };

  const selectedVehicle = vehicleMap.get(selectedId) ?? level.vehicles[0];
  const cellPct = 100 / level.gridSize;

  return (
    <div
      className={`w-full rounded-2xl border-2 p-3.5 transition-colors select-none ${
        crashFlash
          ? 'border-[#EF4444] bg-[#450A0A]'
          : isExitingWin
            ? 'border-emerald-400 bg-[#0F172A]'
            : 'border-[#FACC15]/75 bg-[#0F172A]'
      } text-slate-100 shadow-2xl`}
    >
      <style>{`
        @keyframes parking-crash-shake {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-6px, 2px); }
          40% { transform: translate(6px, -2px); }
          60% { transform: translate(-5px, -2px); }
          80% { transform: translate(5px, 2px); }
        }
      `}</style>

      {/* 顶部标题 + 重置 */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-[#EF4444] text-white text-[11px] font-black">
              清醒核验 · 挪车
            </span>
            <span className="text-xs font-extrabold text-white">{level.title}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{level.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => resetLevel()}
          className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-bold text-[#FACC15] cursor-pointer"
        >
          ↻ 重置
        </button>
      </div>

      {/* 关卡切换胶囊 + 统计 */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {PARKING_LEVELS.map((lv, idx) => (
            <button
              key={lv.id}
              type="button"
              onClick={() => resetLevel(idx)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer ${
                idx === levelIdx
                  ? 'bg-[#FACC15] text-[#0F172A]'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              关{idx + 1} ({lv.optimalMoves}步)
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="text-amber-300 font-bold">步数 {moves}</span>
          <span className="text-red-300 font-bold">💥肇事 {collisions}</span>
          <span className="text-slate-300">⏱{seconds}s</span>
        </div>
      </div>

      {/* 宿管大爷咆哮 / 状态提示横幅 */}
      <div
        className={`mb-3 rounded-xl px-3 py-2 text-xs font-bold leading-snug border ${
          banner.tone === 'crash'
            ? 'bg-[#EF4444]/25 border-[#EF4444] text-red-100'
            : banner.tone === 'win'
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
              : 'bg-slate-900 border-slate-700 text-amber-100'
        }`}
      >
        {banner.text}
      </div>

      {/* 6×6 寝室楼下车棚棋盘 + 右侧第 3 行 EXIT 绿灯出口 */}
      <div className="mx-auto w-full max-w-[344px] pr-5 relative">
        {/* 右侧第 3 行 (row = 2) 专属 EXIT 出库口灯牌 */}
        <div
          style={{
            top: `${level.exitRow * cellPct}%`,
            height: `${cellPct}%`,
          }}
          className="absolute right-0 w-5 z-20 flex flex-col items-center justify-center rounded-r-xl bg-emerald-500 border-2 border-l-0 border-emerald-300 text-slate-950 font-black text-[9px] leading-tight shadow-[0_0_14px_rgba(16,185,129,0.75)]"
        >
          <span>E</span>
          <span>X</span>
          <span>I</span>
          <span>T</span>
        </div>

        <div
          ref={boardRef}
          style={{
            animation: crashFlash ? 'parking-crash-shake 0.38s ease-in-out' : undefined,
          }}
          className="relative aspect-square w-full rounded-2xl border-2 border-slate-600 bg-slate-950 overflow-hidden shadow-inner"
        >
          {/* 停车位地面标线网格 */}
          <div className="grid grid-cols-6 grid-rows-6 w-full h-full">
            {Array.from({ length: 36 }).map((_, idx) => {
              const r = Math.floor(idx / 6);
              const c = idx % 6;
              const isExitLane = r === level.exitRow;
              return (
                <div
                  key={`lot-${r}-${c}`}
                  className={`border border-dashed ${
                    isExitLane
                      ? 'border-emerald-500/30 bg-emerald-950/20'
                      : 'border-slate-800/90'
                  } flex items-center justify-center`}
                >
                  {isExitLane && c >= 2 && (
                    <span className="text-[10px] font-black text-emerald-500/35 pointer-events-none">
                      ➔
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 右侧出口虚线缺口高亮 */}
          <div
            style={{
              top: `${level.exitRow * cellPct}%`,
              height: `${cellPct}%`,
            }}
            className="pointer-events-none absolute right-0 w-1.5 bg-emerald-400 animate-pulse z-10"
          />

          {/* 全部车辆渲染层 */}
          {level.vehicles.map((v) => {
            const activeDrag =
              dragVisualPos && dragVisualPos.id === v.id ? dragVisualPos.floatPos : null;
            const axisPos = activeDrag !== null ? activeDrag : positions[v.id];
            const rowPos = v.axis === 'h' ? v.row : axisPos;
            const colPos =
              v.isHero && isExitingWin
                ? level.gridSize + 0.2
                : v.axis === 'h'
                  ? axisPos
                  : v.col;

            const widthPct = (v.axis === 'h' ? v.len : 1) * cellPct;
            const heightPct = (v.axis === 'v' ? v.len : 1) * cellPct;
            const isSelected = selectedId === v.id;
            const isCrashed = crashedVehicleId === v.id;

            return (
              <div
                key={v.id}
                onPointerDown={(e) => handleVehiclePointerDown(e, v)}
                onPointerMove={(e) => handleVehiclePointerMove(e, v)}
                onPointerUp={(e) => handleVehiclePointerUp(e, v)}
                onPointerCancel={(e) => handleVehiclePointerUp(e, v)}
                style={{
                  touchAction: 'none',
                  left: `${colPos * cellPct}%`,
                  top: `${rowPos * cellPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  padding: '3px',
                  transition:
                    activeDrag !== null
                      ? 'none'
                      : isExitingWin && v.isHero
                        ? 'left 0.34s cubic-bezier(0.22, 1, 0.36, 1)'
                        : 'left 0.14s ease-out, top 0.14s ease-out',
                }}
                className="absolute z-10 cursor-grab active:cursor-grabbing"
              >
                <div
                  style={{
                    backgroundColor: isCrashed ? '#EF4444' : v.color,
                    borderColor: isSelected ? '#FFFFFF' : v.borderColor,
                    color: v.textColor ?? '#FFFFFF',
                  }}
                  className={`w-full h-full rounded-xl border-2 shadow-md flex ${
                    v.axis === 'h' ? 'flex-row px-2' : 'flex-col py-1.5'
                  } items-center justify-between overflow-hidden ${
                    isSelected ? 'ring-2 ring-[#FACC15] shadow-lg' : ''
                  }`}
                >
                  {/* 朝向箭头微标 */}
                  <span className="text-[10px] font-black opacity-80 leading-none">
                    {v.axis === 'h' ? '◀' : '▲'}
                  </span>

                  {/* 车辆简称铭牌 */}
                  <div className="flex flex-col items-center justify-center text-center leading-none">
                    <span className="text-[11px] font-black tracking-tight">
                      {v.isHero ? '🛵早八驴' : v.shortTag}
                    </span>
                    {v.isHero && (
                      <span className="text-[9px] font-extrabold bg-[#FACC15] text-[#0F172A] px-1 rounded mt-0.5">
                        目标出库
                      </span>
                    )}
                  </div>

                  {/* 车头大灯 / 尾向微标 */}
                  <span className="text-[10px] font-black opacity-90 leading-none">
                    {v.isHero ? '💡▶' : v.axis === 'h' ? '▶' : '▼'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部跟手双模操控台：手机窄屏防手抖微调方向键 */}
      <div className="mt-3 rounded-xl bg-slate-900 border border-slate-700/90 px-3 py-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] text-slate-400">当前选中车辆（点击车身切换）</div>
          <div className="text-xs font-extrabold text-[#FACC15] truncate">
            {selectedVehicle.name}（{selectedVehicle.axis === 'h' ? '仅限左右 ↔' : '仅限上下 ↕'}）
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={isExitingWin}
            onClick={() => handleStepNudge(-1)}
            className="h-9 px-3 rounded-lg border border-slate-600 bg-slate-800 hover:border-[#FACC15] active:bg-[#FACC15] active:text-[#0F172A] text-xs font-black text-white cursor-pointer"
          >
            {selectedVehicle.axis === 'h' ? '◀ 左移1格' : '▲ 上移1格'}
          </button>
          <button
            type="button"
            disabled={isExitingWin}
            onClick={() => handleStepNudge(1)}
            className="h-9 px-3 rounded-lg border border-[#FACC15]/80 bg-slate-800 hover:bg-[#FACC15] hover:text-[#0F172A] active:scale-95 text-xs font-black text-[#FACC15] cursor-pointer"
          >
            {selectedVehicle.axis === 'h' ? '右移1格 ▶' : '下移1格 ▼'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParkingJamGame;
