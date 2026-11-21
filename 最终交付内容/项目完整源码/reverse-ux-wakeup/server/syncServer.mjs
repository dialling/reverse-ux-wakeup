import http from 'node:http';
import os from 'node:os';
import { URL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const SYNC_PORT = Number(process.env.SYNC_PORT || process.env.PORT || 5174);
const SYNC_HOST = process.env.SYNC_HOST || '0.0.0.0';
const DEFAULT_WEB_PORT = Number(process.env.WEB_PORT || 5173);
const ROOMMATE_IDS = ['zhang', 'qiang', 'li', 'wei'];
const HHMM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function normalizeDormStatePayload(state) {
  const wakeTime =
    typeof state.targetWakeTime === 'string' && HHMM_REGEX.test(state.targetWakeTime)
      ? state.targetWakeTime
      : typeof state.targetAlarmClock === 'string' && HHMM_REGEX.test(state.targetAlarmClock)
        ? state.targetAlarmClock
        : '07:00';
  return {
    ...state,
    targetWakeTime: wakeTime,
    targetAlarmClock: wakeTime,
  };
}

function detectLanIpv4List() {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const [ifaceName, addrs] of Object.entries(nets)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      const isV4 = addr.family === 'IPv4' || addr.family === 4;
      if (!isV4 || addr.internal) continue;
      if (addr.address.startsWith('169.254.')) continue;

      let priority = 3;
      if (addr.address.startsWith('192.168.')) priority = 1;
      else if (addr.address.startsWith('10.')) priority = 2;
      else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(addr.address)) priority = 2;

      candidates.push({ address: addr.address, ifaceName, priority });
    }
  }

  candidates.sort((a, b) => a.priority - b.priority);
  const unique = [...new Set(candidates.map((c) => c.address))];
  return unique;
}

function validateDormStateConservation(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('Invalid state payload');
  }
  if (
    state.targetWakeTime !== undefined &&
    (typeof state.targetWakeTime !== 'string' || !HHMM_REGEX.test(state.targetWakeTime))
  ) {
    throw new Error(`Invalid targetWakeTime format: ${state.targetWakeTime}`);
  }
  if (!Number.isSafeInteger(state.totalFundCents) || state.totalFundCents <= 0) {
    throw new Error(`Invalid totalFundCents: ${state.totalFundCents}`);
  }
  if (!Number.isSafeInteger(state.publicPoolCents) || state.publicPoolCents < 0) {
    throw new Error(`Invalid publicPoolCents: ${state.publicPoolCents}`);
  }
  if (!state.roommates || typeof state.roommates !== 'object') {
    throw new Error('Missing roommates map');
  }

  let sum = 0;
  for (const id of ROOMMATE_IDS) {
    const r = state.roommates[id];
    if (!r || !Number.isSafeInteger(r.balanceCents) || r.balanceCents < 0) {
      throw new Error(`Invalid roommate balance for ${id}`);
    }
    sum += r.balanceCents;
  }

  if (sum + state.publicPoolCents !== state.totalFundCents) {
    throw new Error(
      `Server money conservation check failed: ${sum} + ${state.publicPoolCents} !== ${state.totalFundCents}`
    );
  }
}

let sharedDormState = null;
const clients = new Map(); // ws -> { clientId, role, isMobile, joinedAt }

function buildPresenceSummary() {
  const rolePresence = { zhang: 0, qiang: 0, li: 0, wei: 0 };
  const mobileRolePresence = { zhang: 0, qiang: 0, li: 0, wei: 0 };
  const peers = [];

  for (const meta of clients.values()) {
    if (meta.role && rolePresence[meta.role] !== undefined) {
      rolePresence[meta.role] += 1;
      if (meta.isMobile) {
        mobileRolePresence[meta.role] += 1;
      }
    }
    peers.push({
      clientId: meta.clientId,
      role: meta.role,
      isMobile: Boolean(meta.isMobile),
    });
  }

  return {
    connectedClients: clients.size,
    rolePresence,
    mobileRolePresence,
    peers,
  };
}

function buildLanInfo(webPortOverride) {
  const lanIps = detectLanIpv4List();
  const primaryLanIp = lanIps[0] || '127.0.0.1';
  const webPort = Number(webPortOverride || DEFAULT_WEB_PORT);
  const roleUrls = {};

  for (const id of ROOMMATE_IDS) {
    roleUrls[id] = `http://${primaryLanIp}:${webPort}/?role=${id}&mobile=1&mode=lan&wsPort=${SYNC_PORT}`;
  }

  return {
    ok: true,
    syncPort: SYNC_PORT,
    webPort,
    primaryLanIp,
    lanIps: lanIps.length > 0 ? lanIps : ['127.0.0.1'],
    wsUrl: `ws://${primaryLanIp}:${SYNC_PORT}`,
    roleUrls,
    ...buildPresenceSummary(),
  };
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && parsedUrl.pathname === '/api/lan-info') {
    const queryWebPort = Number(parsedUrl.searchParams.get('webPort') || DEFAULT_WEB_PORT);
    sendJson(res, 200, buildLanInfo(queryWebPort));
    return;
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'reverse-ux-wakeup-sync',
      brand: 'Rise & Fine',
      syncPort: SYNC_PORT,
      hasState: Boolean(sharedDormState),
      targetWakeTime: sharedDormState?.targetWakeTime ?? '07:00',
      revision: sharedDormState?.revision ?? 0,
      ...buildPresenceSummary(),
    });
    return;
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/api/state') {
    sendJson(res, 200, {
      ok: true,
      state: sharedDormState,
      ...buildPresenceSummary(),
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

const wss = new WebSocketServer({ server });

function broadcastJson(payload, excludeWs = null) {
  const raw = JSON.stringify(payload);
  for (const ws of clients.keys()) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  }
}

wss.on('connection', (ws) => {
  const fallbackId = `peer-${Math.random().toString(36).slice(2, 9)}`;
  clients.set(ws, {
    clientId: fallbackId,
    role: 'qiang',
    isMobile: false,
    joinedAt: Date.now(),
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }

    if (msg.type === 'HELLO') {
      const meta = clients.get(ws) || {};
      clients.set(ws, {
        clientId: typeof msg.clientId === 'string' ? msg.clientId : meta.clientId,
        role: ROOMMATE_IDS.includes(msg.role) ? msg.role : 'qiang',
        isMobile: Boolean(msg.isMobile),
        joinedAt: meta.joinedAt || Date.now(),
      });

      if (!sharedDormState && msg.initialState) {
        try {
          validateDormStateConservation(msg.initialState);
          const normalized = normalizeDormStatePayload(msg.initialState);
          sharedDormState = {
            ...normalized,
            revision: Math.max(1, Number(normalized.revision || 1)),
          };
        } catch (err) {
          ws.send(
            JSON.stringify({
              type: 'ERROR',
              message: err instanceof Error ? err.message : 'Invalid initialState',
            })
          );
        }
      }

      const presence = buildPresenceSummary();
      ws.send(
        JSON.stringify({
          type: 'WELCOME',
          state: sharedDormState,
          presence,
        })
      );
      broadcastJson({ type: 'PRESENCE', presence }, ws);
      return;
    }

    if (msg.type === 'SET_ROLE') {
      const meta = clients.get(ws);
      if (meta) {
        if (ROOMMATE_IDS.includes(msg.role)) {
          meta.role = msg.role;
        }
        if (typeof msg.isMobile === 'boolean') {
          meta.isMobile = msg.isMobile;
        }
        broadcastJson({ type: 'PRESENCE', presence: buildPresenceSummary() });
      }
      return;
    }

    if (msg.type === 'COMMIT_ACTION') {
      const { action, nextState, baseRevision, forceReplace } = msg;
      try {
        validateDormStateConservation(nextState);
      } catch (err) {
        ws.send(
          JSON.stringify({
            type: 'ERROR',
            message: err instanceof Error ? err.message : 'Conservation check failed',
          })
        );
        return;
      }

      if (
        forceReplace ||
        !sharedDormState ||
        baseRevision === sharedDormState.revision
      ) {
        const nextRevision = (sharedDormState ? sharedDormState.revision : 0) + 1;
        const normalized = normalizeDormStatePayload(nextState);
        sharedDormState = {
          ...normalized,
          revision: nextRevision,
        };
        const meta = clients.get(ws);
        broadcastJson({
          type: 'STATE_SYNC',
          state: sharedDormState,
          action: action || null,
          sourceClientId: meta?.clientId || null,
        });
      } else {
        ws.send(
          JSON.stringify({
            type: 'REBASE_REQUIRED',
            state: sharedDormState,
            pendingAction: action,
          })
        );
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcastJson({ type: 'PRESENCE', presence: buildPresenceSummary() });
  });

  ws.on('error', () => {
    clients.delete(ws);
  });
});

server.listen(SYNC_PORT, SYNC_HOST, () => {
  const info = buildLanInfo(DEFAULT_WEB_PORT);
  console.log(
    `[醒醒！分钱了 Rise & Fine · 联机同步台] HTTP + WebSocket 已启动: http://${info.primaryLanIp}:${SYNC_PORT}`
  );
  console.log(
    `[局域网扫码基址] 探测到本机 IPv4: ${info.lanIps.join(', ')} | 扫码信息接口: http://localhost:${SYNC_PORT}/api/lan-info`
  );
});

function shutdown() {
  for (const ws of clients.keys()) {
    try {
      ws.close();
    } catch {
      // ignore
    }
  }
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
