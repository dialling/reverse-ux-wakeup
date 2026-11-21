import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FLOW_LEVELS,
  FLOW_SHOCK_TAUNTS,
  type FlowColorPair,
  type GridCoord,
} from './puzzleLevels';
import type { FlowConnectProps } from './types';

function sameCell(a: GridCoord, b: GridCoord): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function isPairComplete(pair: FlowColorPair, path: GridCoord[] | undefined): boolean {
  if (!path || path.length < 2) return false;
  const first = path[0];
  const last = path[path.length - 1];
  return (
    (sameCell(first, pair.start) && sameCell(last, pair.end)) ||
    (sameCell(first, pair.end) && sameCell(last, pair.start))
  );
}

export const FlowConnectGame: React.FC<FlowConnectProps> = ({
  initialLevelIndex = 0,
  onWin,
  onCollision,
}) => {
  const safeInitIdx = Math.max(0, Math.min(FLOW_LEVELS.length - 1, initialLevelIndex));
  const [levelIdx, setLevelIdx] = useState<number>(safeInitIdx);
  const level = FLOW_LEVELS[levelIdx];

  // 每种颜色当前留在棋盘上的折线坐标序列
  const [paths, setPaths] = useState<Record<string, GridCoord[]>>({});
  const [activeColorId, setActiveColorId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState<number>(0);
  const [collisions, setCollisions] = useState<number>(0);
  const [moves, setMoves] = useState<number>(0);
  const [isWon, setIsWon] = useState<boolean>(false);

  const [shockSpark, setShockSpark] = useState<GridCoord | null>(null);
  const [shockFlash, setShockFlash] = useState<boolean>(false);
  const [banner, setBanner] = useState<{
    tone: 'info' | 'shock' | 'win';
    text: string;
  }>({
    tone: 'info',
    text: '💡 按住任一圆点拖向同色圆点；严禁碰到异色电线，否则两条线一起短路炸毁！',
  });

  const boardRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pathsRef = useRef<Record<string, GridCoord[]>>({});
  pathsRef.current = paths;

  const activeColorRef = useRef<string | null>(null);
  activeColorRef.current = activeColorId;

  const collisionsRef = useRef<number>(0);
  const movesRef = useRef<number>(0);
  const secondsRef = useRef<number>(0);
  const wonRef = useRef<boolean>(false);

  // 端点快速索引表: "r,c" -> FlowColorPair
  const endpointMap = useMemo(() => {
    const map = new Map<string, FlowColorPair>();
    for (const p of level.pairs) {
      map.set(`${p.start[0]},${p.start[1]}`, p);
      map.set(`${p.end[0]},${p.end[1]}`, p);
    }
    return map;
  }, [level]);

  const pairById = useMemo(() => {
    const map = new Map<string, FlowColorPair>();
    for (const p of level.pairs) {
      map.set(p.id, p);
    }
    return map;
  }, [level]);

  const resetCurrentLevel = useCallback((nextIdx?: number) => {
    if (typeof nextIdx === 'number') {
      setLevelIdx(nextIdx);
    }
    pointerIdRef.current = null;
    activeColorRef.current = null;
    setActiveColorId(null);
    pathsRef.current = {};
    setPaths({});
    secondsRef.current = 0;
    setSeconds(0);
    collisionsRef.current = 0;
    setCollisions(0);
    movesRef.current = 0;
    setMoves(0);
    wonRef.current = false;
    setIsWon(false);
    setShockSpark(null);
    setShockFlash(false);
    setBanner({
      tone: 'info',
      text: '💡 先规划好互不交叉的绕行路线再下笔！碰上异色线会双双崩断重来！',
    });
  }, []);

  const prevInitPropRef = useRef<number>(safeInitIdx);
  useEffect(() => {
    if (prevInitPropRef.current !== safeInitIdx) {
      prevInitPropRef.current = safeInitIdx;
      resetCurrentLevel(safeInitIdx);
    }
  }, [resetCurrentLevel, safeInitIdx]);

  // 计时器
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (wonRef.current) return;
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [levelIdx]);

  // 检验是否全部颜色对均连通通关
  const checkWinAndFinish = useCallback(
    (candidatePaths: Record<string, GridCoord[]>, nextMoves: number) => {
      if (wonRef.current) return;
      const allConnected = level.pairs.every((pair) =>
        isPairComplete(pair, candidatePaths[pair.id])
      );
      if (!allConnected) return;

      wonRef.current = true;
      setIsWon(true);
      activeColorRef.current = null;
      setActiveColorId(null);
      pointerIdRef.current = null;
      const usedSec = Math.max(1, secondsRef.current);
      setBanner({
        tone: 'win',
        text: `🎉 全寝室配电箱合闸成功！耗时 ${usedSec} 秒，短路 ${collisionsRef.current} 次！`,
      });
      onWin({
        levelId: level.id,
        seconds: usedSec,
        collisions: collisionsRef.current,
        moves: nextMoves,
      });
    },
    [level, onWin]
  );

  // 根据 Pointer 在棋盘内的坐标换算格子 [row, col]
  const getCellFromPointer = (clientX: number, clientY: number): GridCoord | null => {
    const el = boardRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }
    const col = Math.min(
      level.size - 1,
      Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * level.size))
    );
    const row = Math.min(
      level.size - 1,
      Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * level.size))
    );
    return [row, col];
  };

  // 查找某个格子当前被哪条异色路径占据
  const findOccupyingColor = (
    cell: GridCoord,
    currentPaths: Record<string, GridCoord[]>,
    ignoreColorId: string
  ): string | null => {
    const ep = endpointMap.get(`${cell[0]},${cell[1]}`);
    if (ep && ep.id !== ignoreColorId) {
      return ep.id;
    }
    for (const [cid, coords] of Object.entries(currentPaths)) {
      if (cid === ignoreColorId || !coords) continue;
      if (coords.some((pt) => sameCell(pt, cell))) {
        return cid;
      }
    }
    return null;
  };

  // 触发逆向触电双崩惩罚！
  const triggerElectricShock = (
    cell: GridCoord,
    drawingColorId: string,
    victimColorId: string
  ) => {
    pointerIdRef.current = null;
    activeColorRef.current = null;
    setActiveColorId(null);

    const nextPaths = { ...pathsRef.current };
    delete nextPaths[drawingColorId];
    delete nextPaths[victimColorId];
    pathsRef.current = nextPaths;
    setPaths(nextPaths);

    const nextCols = collisionsRef.current + 1;
    collisionsRef.current = nextCols;
    setCollisions(nextCols);

    const drawName = pairById.get(drawingColorId)?.label ?? drawingColorId;
    const victimName = pairById.get(victimColorId)?.label ?? victimColorId;
    const taunt = FLOW_SHOCK_TAUNTS[(nextCols - 1) % FLOW_SHOCK_TAUNTS.length];

    setShockSpark(cell);
    setShockFlash(true);
    setBanner({
      tone: 'shock',
      text: `${taunt}（【${drawName}】撞毁了【${victimName}】！）`,
    });
    window.setTimeout(() => {
      setShockFlash(false);
      setShockSpark(null);
    }, 650);

    onCollision?.(nextCols);
  };

  // 单步推进画笔到相邻格 targetCell
  const stepActivePathTo = (targetCell: GridCoord): boolean => {
    const cid = activeColorRef.current;
    if (!cid || wonRef.current) return false;
    const pair = pairById.get(cid);
    if (!pair) return false;

    const currentSeq = pathsRef.current[cid] ?? [];
    if (currentSeq.length === 0) return false;

    const tail = currentSeq[currentSeq.length - 1];
    if (sameCell(tail, targetCell)) return true;

    const manhattan =
      Math.abs(targetCell[0] - tail[0]) + Math.abs(targetCell[1] - tail[1]);
    if (manhattan !== 1) return false;

    // 1. 允许沿自身已画路径回退修正
    const existingSelfIdx = currentSeq.findIndex((pt) => sameCell(pt, targetCell));
    if (existingSelfIdx !== -1) {
      const trimmed = currentSeq.slice(0, existingSelfIdx + 1);
      const nextPaths = { ...pathsRef.current, [cid]: trimmed };
      pathsRef.current = nextPaths;
      setPaths(nextPaths);
      return true;
    }

    // 2. 若当前已抵达本色终点，不再继续延伸越过终点
    if (isPairComplete(pair, currentSeq)) {
      return false;
    }

    // 3. 检测是否撞上异色电线或异色端点 —— 触发双崩触电短路！
    const collidedColorId = findOccupyingColor(targetCell, pathsRef.current, cid);
    if (collidedColorId) {
      triggerElectricShock(targetCell, cid, collidedColorId);
      return false;
    }

    // 4. 合法推进一格
    const updatedSeq = [...currentSeq, targetCell];
    const nextPaths = { ...pathsRef.current, [cid]: updatedSeq };
    pathsRef.current = nextPaths;
    setPaths(nextPaths);

    // 若恰好连到本色另一端点，自动锁定该色并检查全盘通关
    if (isPairComplete(pair, updatedSeq)) {
      pointerIdRef.current = null;
      activeColorRef.current = null;
      setActiveColorId(null);
      setBanner({
        tone: 'info',
        text: `✅ 【${pair.label}】已安全接通！继续连接其余颜色回路！`,
      });
      checkWinAndFinish(nextPaths, movesRef.current);
      return false;
    }

    return true;
  };

  const handleBoardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (wonRef.current) return;

    const cell = getCellFromPointer(e.clientX, e.clientY);
    if (!cell) return;

    // 1. 点击在某颜色圆点端点上：从该圆点重新拉线
    const ep = endpointMap.get(`${cell[0]},${cell[1]}`);
    if (ep) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      pointerIdRef.current = e.pointerId;
      activeColorRef.current = ep.id;
      setActiveColorId(ep.id);

      const nextMoves = movesRef.current + 1;
      movesRef.current = nextMoves;
      setMoves(nextMoves);

      const nextPaths = { ...pathsRef.current, [ep.id]: [cell] };
      pathsRef.current = nextPaths;
      setPaths(nextPaths);
      setBanner({
        tone: 'info',
        text: `🔌 正在牵引【${ep.label}】… 小心避开其他颜色的线路！`,
      });
      return;
    }

    // 2. 点击在某条半截/已有线上：从该位置截断续画同色线
    for (const [cid, seq] of Object.entries(pathsRef.current)) {
      const idx = seq.findIndex((pt) => sameCell(pt, cell));
      if (idx !== -1) {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pointerIdRef.current = e.pointerId;
        activeColorRef.current = cid;
        setActiveColorId(cid);

        const nextMoves = movesRef.current + 1;
        movesRef.current = nextMoves;
        setMoves(nextMoves);

        const trimmed = seq.slice(0, idx + 1);
        const nextPaths = { ...pathsRef.current, [cid]: trimmed };
        pathsRef.current = nextPaths;
        setPaths(nextPaths);
        return;
      }
    }
  };

  const handleBoardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId || !activeColorRef.current || wonRef.current) {
      return;
    }
    const cell = getCellFromPointer(e.clientX, e.clientY);
    if (!cell) return;

    const cid = activeColorRef.current;
    const seq = pathsRef.current[cid];
    if (!seq || seq.length === 0) return;

    const tail = seq[seq.length - 1];
    if (sameCell(tail, cell)) return;

    const dr = cell[0] - tail[0];
    const dc = cell[1] - tail[1];

    // 兼容快速滑动直线跨 2 格的插值补帧
    if (dr === 0 && Math.abs(dc) === 2) {
      const mid: GridCoord = [tail[0], tail[1] + Math.sign(dc)];
      if (stepActivePathTo(mid)) {
        stepActivePathTo(cell);
      }
      return;
    }
    if (dc === 0 && Math.abs(dr) === 2) {
      const mid: GridCoord = [tail[0] + Math.sign(dr), tail[1]];
      if (stepActivePathTo(mid)) {
        stepActivePathTo(cell);
      }
      return;
    }

    stepActivePathTo(cell);
  };

  const handleBoardPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    activeColorRef.current = null;
    setActiveColorId(null);
  };

  const connectedCount = level.pairs.filter((p) => isPairComplete(p, paths[p.id])).length;

  return (
    <div
      className={`w-full rounded-2xl border-2 p-3.5 transition-colors select-none ${
        shockFlash
          ? 'border-[#EF4444] bg-[#450A0A]'
          : isWon
            ? 'border-emerald-400 bg-[#0F172A]'
            : 'border-[#FACC15]/75 bg-[#0F172A]'
      } text-slate-100 shadow-2xl`}
    >
      <style>{`
        @keyframes flow-shock-jolt {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-6px, 3px); }
          40% { transform: translate(6px, -3px); }
          60% { transform: translate(-5px, -2px); }
          80% { transform: translate(5px, 2px); }
        }
      `}</style>

      {/* 顶部标题 + 关卡切换器 */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-[#FACC15] text-[#0F172A] text-[11px] font-black">
              清醒核验 · 连线
            </span>
            <span className="text-xs font-extrabold text-white">{level.title}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{level.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => resetCurrentLevel()}
          className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-bold text-[#FACC15] cursor-pointer"
        >
          ↻ 重置
        </button>
      </div>

      {/* 3 个内置关卡切换胶囊 + 实时统计 */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {FLOW_LEVELS.map((lv, idx) => (
            <button
              key={lv.id}
              type="button"
              onClick={() => resetCurrentLevel(idx)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer ${
                idx === levelIdx
                  ? 'bg-[#FACC15] text-[#0F172A]'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              关{idx + 1} ({lv.size}×{lv.size})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="text-emerald-300 font-bold">
            连通 {connectedCount}/{level.pairs.length}
          </span>
          <span className="text-red-300 font-bold">⚡短路 {collisions}</span>
          <span className="text-slate-300">⏱{seconds}s</span>
        </div>
      </div>

      {/* 状态与触电警报横幅 */}
      <div
        className={`mb-3 rounded-xl px-3 py-2 text-xs font-bold leading-snug border ${
          banner.tone === 'shock'
            ? 'bg-[#EF4444]/25 border-[#EF4444] text-red-100'
            : banner.tone === 'win'
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
              : 'bg-slate-900 border-slate-700 text-amber-100'
        }`}
      >
        {banner.text}
      </div>

      {/* 核心正方形配电盘网格（兼容鼠标与手机单指拖拽） */}
      <div className="mx-auto w-full max-w-[336px]">
        <div
          ref={boardRef}
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerUp}
          onPointerCancel={handleBoardPointerUp}
          style={{
            touchAction: 'none',
            animation: shockFlash ? 'flow-shock-jolt 0.38s ease-in-out' : undefined,
          }}
          className="relative aspect-square w-full rounded-2xl border-2 border-slate-700 bg-slate-950 overflow-hidden shadow-inner"
        >
          {/* 底层网格单元格底色 */}
          <div
            className="grid w-full h-full"
            style={{
              gridTemplateColumns: `repeat(${level.size}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${level.size}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: level.size * level.size }).map((_, idx) => {
              const r = Math.floor(idx / level.size);
              const c = idx % level.size;
              let cellColorHex: string | null = null;
              for (const p of level.pairs) {
                const seq = paths[p.id];
                if (seq?.some((pt) => pt[0] === r && pt[1] === c)) {
                  cellColorHex = p.hex;
                  break;
                }
              }
              return (
                <div
                  key={`${r}-${c}`}
                  className="border border-slate-800/90 relative flex items-center justify-center"
                  style={{
                    backgroundColor: cellColorHex ? `${cellColorHex}22` : undefined,
                  }}
                />
              );
            })}
          </div>

          {/* 中层 SVG 霓虹折线导管 */}
          <svg
            viewBox={`0 0 ${level.size * 100} ${level.size * 100}`}
            className="pointer-events-none absolute inset-0 w-full h-full"
          >
            {level.pairs.map((pair) => {
              const seq = paths[pair.id];
              if (!seq || seq.length < 2) return null;
              const pointsAttr = seq
                .map(([r, c]) => `${c * 100 + 50},${r * 100 + 50}`)
                .join(' ');
              const complete = isPairComplete(pair, seq);
              return (
                <g key={`pipe-${pair.id}`}>
                  <polyline
                    points={pointsAttr}
                    fill="none"
                    stroke={pair.glow}
                    strokeWidth={44}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={pointsAttr}
                    fill="none"
                    stroke={pair.hex}
                    strokeWidth={complete ? 28 : 22}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
          </svg>

          {/* 顶层圆点电极端子 + 短路电火花 */}
          <div
            className="pointer-events-none absolute inset-0 grid"
            style={{
              gridTemplateColumns: `repeat(${level.size}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${level.size}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: level.size * level.size }).map((_, idx) => {
              const r = Math.floor(idx / level.size);
              const c = idx % level.size;
              const ep = endpointMap.get(`${r},${c}`);
              const isSparkHere =
                shockSpark !== null && shockSpark[0] === r && shockSpark[1] === c;

              return (
                <div
                  key={`ep-${r}-${c}`}
                  className="relative flex items-center justify-center"
                >
                  {ep && (
                    <div
                      style={{
                        backgroundColor: ep.hex,
                        boxShadow: `0 0 14px ${ep.glow}`,
                      }}
                      className={`w-[64%] h-[64%] rounded-full border-2 flex items-center justify-center font-black text-xs text-slate-950 transition-transform ${
                        activeColorId === ep.id
                          ? 'scale-110 border-white'
                          : isPairComplete(ep, paths[ep.id])
                            ? 'border-white/90 scale-100'
                            : 'border-slate-900/80'
                      }`}
                    >
                      {isPairComplete(ep, paths[ep.id]) ? '✓' : ep.symbol}
                    </div>
                  )}

                  {isSparkHere && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#EF4444]/60 animate-ping rounded-lg">
                      <span className="text-xl">⚡</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 底部颜色回路状态指示条 */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        {level.pairs.map((p) => {
          const done = isPairComplete(p, paths[p.id]);
          return (
            <span
              key={p.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                done
                  ? 'border-emerald-400/70 bg-emerald-950/60 text-emerald-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: p.hex }}
              />
              <span>{p.label}</span>
              <span>{done ? '✓' : '·'}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default FlowConnectGame;
