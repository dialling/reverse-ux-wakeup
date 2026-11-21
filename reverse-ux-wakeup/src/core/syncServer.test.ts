import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { assertMoneyConservation, createInitialDormState, dormReducer } from './dormEngine';

const TEST_PORT = 15874;
const ROOT_DIR = path.resolve(__dirname, '../..');

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', (err) => reject(err));
  });
}

function nextMessageMatching(
  ws: WebSocket,
  predicate: (msg: any) => boolean,
  timeoutMs = 3000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error('Timed out waiting for WebSocket message'));
    }, timeoutMs);

    const handler = (raw: any) => {
      try {
        const parsed = JSON.parse(String(raw));
        if (predicate(parsed)) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(parsed);
        }
      } catch {
        // ignore
      }
    };

    ws.on('message', handler);
  });
}

describe('LAN Dual-Mode Sync Server (HTTP + WebSocket)', () => {
  let serverProc: ChildProcess | null = null;

  beforeAll(async () => {
    serverProc = spawn(process.execPath, ['server/syncServer.mjs'], {
      cwd: ROOT_DIR,
      env: { ...process.env, SYNC_PORT: String(TEST_PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('syncServer startup timeout')),
        5000
      );
      serverProc!.stdout?.on('data', (chunk) => {
        if (String(chunk).includes(String(TEST_PORT))) {
          clearTimeout(timer);
          resolve();
        }
      });
      serverProc!.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`syncServer exited early with code ${code}`));
      });
    });
  });

  afterAll(async () => {
    if (serverProc && !serverProc.killed) {
      serverProc.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 150));
    }
  });

  it('serves /api/lan-info with LAN IPv4 addresses and 4 roommate mobile scan URLs', async () => {
    const resp = await fetch(`http://127.0.0.1:${TEST_PORT}/api/lan-info?webPort=5173`);
    expect(resp.status).toBe(200);
    const body = await resp.json();

    expect(body.ok).toBe(true);
    expect(body.syncPort).toBe(TEST_PORT);
    expect(body.webPort).toBe(5173);
    expect(Array.isArray(body.lanIps)).toBe(true);
    expect(body.lanIps.length).toBeGreaterThanOrEqual(1);
    expect(body.roleUrls.qiang).toContain('role=qiang&mobile=1');
    expect(body.roleUrls.zhang).toContain('role=zhang&mobile=1');
    expect(body.roleUrls.li).toContain('role=li&mobile=1');
    expect(body.roleUrls.wei).toContain('role=wei&mobile=1');
  });

  it('synchronizes DormState across multiple clients and resolves stale baseRevision conflicts cleanly', async () => {
    const wsZhang = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    const wsQiang = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await Promise.all([waitForOpen(wsZhang), waitForOpen(wsQiang)]);

    const initialState = createInitialDormState();

    const welcomeZhangPromise = nextMessageMatching(wsZhang, (m) => m.type === 'WELCOME');
    wsZhang.send(
      JSON.stringify({
        type: 'HELLO',
        clientId: 'client-zhang',
        role: 'zhang',
        isMobile: true,
        initialState,
      })
    );
    const welcomeZhang = await welcomeZhangPromise;
    expect(welcomeZhang.state.totalFundCents).toBe(20000);

    const welcomeQiangPromise = nextMessageMatching(wsQiang, (m) => m.type === 'WELCOME');
    wsQiang.send(
      JSON.stringify({
        type: 'HELLO',
        clientId: 'client-qiang',
        role: 'qiang',
        isMobile: true,
        initialState,
      })
    );
    const welcomeQiang = await welcomeQiangPromise;
    const baseRev = welcomeQiang.state.revision;

    // 1. 老张完成打卡 -> 广播给阿强
    const actionZhangAwake = {
      type: 'COMPLETE_STAGE2_PUZZLE' as const,
      roommateId: 'zhang' as const,
      clock: '06:59',
    };
    const nextAfterZhang = dormReducer(welcomeZhang.state, actionZhangAwake);

    const syncOnQiangPromise = nextMessageMatching(wsQiang, (m) => m.type === 'STATE_SYNC');
    wsZhang.send(
      JSON.stringify({
        type: 'COMMIT_ACTION',
        action: actionZhangAwake,
        nextState: nextAfterZhang,
        baseRevision: baseRev,
        forceReplace: false,
      })
    );
    const syncedToQiang = await syncOnQiangPromise;
    expect(syncedToQiang.state.roommates.zhang.status).toBe('awake');
    assertMoneyConservation(syncedToQiang.state);

    // 2. 模拟并发冲突：阿强故意用过期的 baseRev 提交一次扣款 -> 服务端应返回 REBASE_REQUIRED 而非覆盖老张状态
    const actionQiangSlip = {
      type: 'SLIDER_SLIP_PENALTY' as const,
      roommateId: 'qiang' as const,
      penaltyCents: 100,
      clock: '07:01',
    };
    const staleOptimistic = dormReducer(welcomeQiang.state, actionQiangSlip);

    const rebasePromise = nextMessageMatching(
      wsQiang,
      (m) => m.type === 'REBASE_REQUIRED'
    );
    wsQiang.send(
      JSON.stringify({
        type: 'COMMIT_ACTION',
        action: actionQiangSlip,
        nextState: staleOptimistic,
        baseRevision: baseRev, // 过期版本号！
        forceReplace: false,
      })
    );
    const rebaseMsg = await rebasePromise;
    expect(rebaseMsg.state.roommates.zhang.status).toBe('awake');

    // 阿强基于最新状态重放动作并提交 -> 老张实时收到 +¥1.00 分红！
    const rebasedNext = dormReducer(rebaseMsg.state, rebaseMsg.pendingAction);
    const finalSyncOnZhangPromise = nextMessageMatching(
      wsZhang,
      (m) => m.type === 'STATE_SYNC' && m.state.roommates.zhang.balanceCents === 5100
    );
    wsQiang.send(
      JSON.stringify({
        type: 'COMMIT_ACTION',
        action: rebaseMsg.pendingAction,
        nextState: rebasedNext,
        baseRevision: rebaseMsg.state.revision,
        forceReplace: false,
      })
    );

    const finalSynced = await finalSyncOnZhangPromise;
    expect(finalSynced.state.roommates.zhang.balanceCents).toBe(5100);
    expect(finalSynced.state.roommates.qiang.balanceCents).toBe(4900);
    assertMoneyConservation(finalSynced.state);

    wsZhang.close();
    wsQiang.close();
  });
});
