#!/usr/bin/env node
/**
 * 独立零依赖关卡数学求解器验证脚本 (verify-puzzles.mjs)
 *
 * 用途：
 * 1. 直接加载 src/mechanisms/puzzleLevels.ts 中的内置关卡定义（单点数据源）。
 * 2. 使用回溯深度优先搜索（DFS）证明全部 3 个「同色小球不交叉连线」关卡 100% 存在互不交叉全连通合法路径，并打印解网格。
 * 3. 使用广度优先搜索（BFS）证明全部 3 个「无碰撞挪车出库」关卡 100% 可无碰撞驶出右侧出口，
 *    且精确最短步数严格落在 8–16 步黄金区间（实际为 10 / 12 / 14 步，对应普通清醒人类 30–60 秒操作耗时）。
 * 4. 任一关卡无解、重叠越界或步数超标时，以非零状态码退出。
 */

import { FLOW_LEVELS, PARKING_LEVELS } from '../src/mechanisms/puzzleLevels.ts';

const MIN_PARKING_MOVES = 8;
const MAX_PARKING_MOVES = 16;

function solveFlowLevel(level) {
  const { size, pairs } = level;
  if (size < 5 || pairs.length < 5) {
    throw new Error(`关卡 ${level.id} 规格不满足要求: size=${size}, pairs=${pairs.length}`);
  }

  const grid = Array.from({ length: size }, () => Array(size).fill(-1));
  const endpointSet = new Set();

  pairs.forEach((p, idx) => {
    for (const [label, pt] of [['start', p.start], ['end', p.end]]) {
      const [r, c] = pt;
      if (r < 0 || r >= size || c < 0 || c >= size) {
        throw new Error(`关卡 ${level.id} 颜色 ${p.id} ${label} 越界: [${r},${c}]`);
      }
      const key = `${r},${c}`;
      if (endpointSet.has(key)) {
        throw new Error(`关卡 ${level.id} 端点重合冲突: [${r},${c}]`);
      }
      endpointSet.add(key);
      grid[r][c] = idx;
    }
  });

  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const solvedPaths = Array(pairs.length).fill(null);

  function dfs(pairIdx, r, c, currentPath) {
    const target = pairs[pairIdx].end;
    const candidates = [];

    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      if (nr === target[0] && nc === target[1]) {
        candidates.push({ nr, nc, isTarget: true, dist: 0 });
      } else if (grid[nr][nc] === -1) {
        const dist = Math.abs(nr - target[0]) + Math.abs(nc - target[1]);
        candidates.push({ nr, nc, isTarget: false, dist });
      }
    }

    candidates.sort((a, b) => a.dist - b.dist);

    for (const step of candidates) {
      if (step.isTarget) {
        solvedPaths[pairIdx] = [...currentPath, [step.nr, step.nc]];
        if (pairIdx + 1 === pairs.length) {
          return true;
        }
        const nextStart = pairs[pairIdx + 1].start;
        if (dfs(pairIdx + 1, nextStart[0], nextStart[1], [nextStart])) {
          return true;
        }
        solvedPaths[pairIdx] = null;
      } else {
        grid[step.nr][step.nc] = pairIdx;
        currentPath.push([step.nr, step.nc]);
        if (dfs(pairIdx, step.nr, step.nc, currentPath)) {
          return true;
        }
        currentPath.pop();
        grid[step.nr][step.nc] = -1;
      }
    }
    return false;
  }

  const firstStart = pairs[0].start;
  const ok = dfs(0, firstStart[0], firstStart[1], [firstStart]);
  if (!ok) return null;

  // Double-check pairwise vertex disjointness & orthogonal continuity
  const visitedCells = new Set();
  for (let i = 0; i < pairs.length; i++) {
    const path = solvedPaths[i];
    if (!path || path.length < 2) {
      throw new Error(`关卡 ${level.id} 路径校验异常: 颜色 ${pairs[i].id}`);
    }
    for (let k = 0; k < path.length; k++) {
      const key = `${path[k][0]},${path[k][1]}`;
      if (visitedCells.has(key)) {
        throw new Error(`关卡 ${level.id} 发现交叉格冲突: ${key}`);
      }
      visitedCells.add(key);
      if (k > 0) {
        const manhattan =
          Math.abs(path[k][0] - path[k - 1][0]) + Math.abs(path[k][1] - path[k - 1][1]);
        if (manhattan !== 1) {
          throw new Error(`关卡 ${level.id} 路径非相邻跳格!`);
        }
      }
    }
  }

  return {
    grid: grid.map((row) => row.slice()),
    paths: solvedPaths,
    coveredCells: visitedCells.size,
    totalCells: size * size,
    endpointSet,
  };
}

function renderFlowSolutionGrid(level, solution) {
  const { size, pairs } = level;
  const lines = [];
  for (let r = 0; r < size; r++) {
    const cells = [];
    for (let c = 0; c < size; c++) {
      const idx = solution.grid[r][c];
      if (idx === -1) {
        cells.push(' · ');
      } else {
        const sym = pairs[idx].symbol;
        const isEndpoint = solution.endpointSet.has(`${r},${c}`);
        cells.push(isEndpoint ? `[${sym}]` : ` ${sym.toLowerCase()} `);
      }
    }
    lines.push('    ' + cells.join(' '));
  }
  return lines.join('\n');
}

function solveParkingLevelBFS(level) {
  const { gridSize, exitRow, vehicles } = level;
  if (gridSize !== 6) {
    throw new Error(`挪车关卡 ${level.id} 网格尺寸应为 6x6，实际为 ${gridSize}`);
  }

  const heroIdx = vehicles.findIndex((v) => v.isHero);
  if (heroIdx === -1) {
    throw new Error(`挪车关卡 ${level.id} 缺少目标红车 (isHero)`);
  }
  const hero = vehicles[heroIdx];
  if (hero.axis !== 'h' || hero.row !== exitRow) {
    throw new Error(`挪车关卡 ${level.id} 目标车必须横向位于出口行 row=${exitRow}`);
  }

  const obstacleCount = vehicles.length - 1;
  if (obstacleCount < 7 || obstacleCount > 9) {
    throw new Error(`挪车关卡 ${level.id} 阻挡车数量 (${obstacleCount}) 不在 7–9 辆范围内`);
  }

  const buildGrid = (positions) => {
    const board = Array.from({ length: gridSize }, () => Array(gridSize).fill(-1));
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const r0 = v.axis === 'h' ? v.row : positions[i];
      const c0 = v.axis === 'h' ? positions[i] : v.col;
      for (let k = 0; k < v.len; k++) {
        const r = v.axis === 'h' ? r0 : r0 + k;
        const c = v.axis === 'h' ? c0 + k : c0;
        if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return null;
        if (board[r][c] !== -1) return null;
        board[r][c] = i;
      }
    }
    return board;
  };

  const startPos = vehicles.map((v) => (v.axis === 'h' ? v.col : v.row));
  if (!buildGrid(startPos)) {
    throw new Error(`挪车关卡 ${level.id} 初始车辆摆放存在越界或重叠冲突！`);
  }

  const encode = (pos) => pos.join(',');
  const queue = [{ pos: startPos, steps: [] }];
  const visited = new Set([encode(startPos)]);
  let exploredStates = 0;

  while (queue.length > 0) {
    const { pos, steps } = queue.shift();
    exploredStates++;

    // 目标红车车头抵达最右侧 EXIT 口 (col === gridSize - hero.len = 4)，无碰撞驶出车库！
    if (pos[heroIdx] === gridSize - hero.len) {
      return {
        moves: steps.length,
        steps,
        exploredStates,
      };
    }

    const board = buildGrid(pos);
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const cur = pos[i];

      // 沿车辆朝向反方向无碰撞平移 (-1, -2, ...)
      for (let delta = -1; cur + delta >= 0; delta--) {
        const checkR = v.axis === 'h' ? v.row : cur + delta;
        const checkC = v.axis === 'h' ? cur + delta : v.col;
        if (board[checkR][checkC] !== -1) break;
        const nextPos = pos.slice();
        nextPos[i] = cur + delta;
        const key = encode(nextPos);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({
            pos: nextPos,
            steps: [...steps, { vehicleIdx: i, from: cur, to: cur + delta, delta }],
          });
        }
      }

      // 沿车辆朝向正方向无碰撞平移 (+1, +2, ...)
      for (let delta = 1; cur + v.len - 1 + delta < gridSize; delta++) {
        const checkR = v.axis === 'h' ? v.row : cur + v.len - 1 + delta;
        const checkC = v.axis === 'h' ? cur + v.len - 1 + delta : v.col;
        if (board[checkR][checkC] !== -1) break;
        const nextPos = pos.slice();
        nextPos[i] = cur + delta;
        const key = encode(nextPos);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({
            pos: nextPos,
            steps: [...steps, { vehicleIdx: i, from: cur, to: cur + delta, delta }],
          });
        }
      }
    }
  }

  return null;
}

function main() {
  let hasError = false;
  console.log('================================================================');
  console.log(' 🔍 《醒醒！分钱了》逆向 UX 益智关卡独立数学求解验证');
  console.log('================================================================\n');

  console.log('【一】同色小球不交叉连线 (FlowConnectGame) 回溯求解验证：');
  if (FLOW_LEVELS.length < 3) {
    console.error(`❌ 连线关卡数量不足 3 关（当前 ${FLOW_LEVELS.length} 关）`);
    process.exit(1);
  }

  for (const level of FLOW_LEVELS) {
    const t0 = performance.now();
    const sol = solveFlowLevel(level);
    const ms = (performance.now() - t0).toFixed(2);

    if (!sol) {
      console.error(`❌ [${level.id}] ${level.title} —— 无解！`);
      hasError = true;
      continue;
    }

    console.log(
      `\n✅ [${level.id}] ${level.title} | 网格: ${level.size}×${level.size} | 颜色对: ${level.pairs.length} | 覆盖率: ${sol.coveredCells}/${sol.totalCells} 格 | 耗时: ${ms}ms`
    );
    console.log('   示例合法不交叉解（[X]=圆点端点, x=连线轨迹）：');
    console.log(renderFlowSolutionGrid(level, sol));
  }

  console.log('\n----------------------------------------------------------------');
  console.log('【二】早高峰无碰撞挪车出库 (ParkingJamGame) BFS 最短路径验证：');
  if (PARKING_LEVELS.length < 3) {
    console.error(`❌ 挪车关卡数量不足 3 关（当前 ${PARKING_LEVELS.length} 关）`);
    process.exit(1);
  }

  for (const level of PARKING_LEVELS) {
    const t0 = performance.now();
    const bfs = solveParkingLevelBFS(level);
    const ms = (performance.now() - t0).toFixed(2);

    if (!bfs) {
      console.error(`❌ [${level.id}] ${level.title} —— 无碰撞条件下无解！`);
      hasError = true;
      continue;
    }

    const inGoldenRange = bfs.moves >= MIN_PARKING_MOVES && bfs.moves <= MAX_PARKING_MOVES;
    const matchesDeclared = bfs.moves === level.optimalMoves;

    if (!inGoldenRange || !matchesDeclared) {
      console.error(
        `❌ [${level.id}] 最短步数 ${bfs.moves} 步不满足黄金区间 [${MIN_PARKING_MOVES}, ${MAX_PARKING_MOVES}] 或与声明值 (${level.optimalMoves}) 不符！`
      );
      hasError = true;
    } else {
      console.log(
        `\n✅ [${level.id}] ${level.title} | 车辆总数: ${level.vehicles.length} (含 ${level.vehicles.length - 1} 辆阻挡车) | BFS 最短步数: ${bfs.moves} 步 (遍历状态 ${bfs.exploredStates} 个, ${ms}ms)`
      );
      bfs.steps.forEach((s, idx) => {
        const v = level.vehicles[s.vehicleIdx];
        const dirText =
          v.axis === 'h'
            ? s.delta > 0
              ? `向右平移 ${s.delta} 格`
              : `向左平移 ${Math.abs(s.delta)} 格`
            : s.delta > 0
              ? `向下平移 ${s.delta} 格`
              : `向上平移 ${Math.abs(s.delta)} 格`;
        const exitSuffix =
          v.isHero && idx === bfs.steps.length - 1 ? ' ➔ 直冲 EXIT 出库通关！' : '';
        console.log(
          `   Step ${String(idx + 1).padStart(2, '0')}: [${v.shortTag} (${v.id})] ${dirText} (${v.axis === 'h' ? 'col' : 'row'} ${s.from} → ${s.to})${exitSuffix}`
        );
      });
    }
  }

  console.log('\n================================================================');
  if (hasError) {
    console.error('❌ 验证未通过：存在无解或步数越界关卡！');
    process.exit(1);
  }
  console.log('🎉 全部 3 个连线关卡 + 3 个无碰撞挪车关卡均已通过数学可解性与 30–60s 黄金步数验证！');
  console.log('================================================================');
}

main();
