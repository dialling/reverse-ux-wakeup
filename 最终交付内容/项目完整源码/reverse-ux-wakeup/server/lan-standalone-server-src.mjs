process.env.WS_NO_BUFFER_UTIL = '1';
process.env.WS_NO_UTF_8_VALIDATE = '1';

import fs from 'node:fs';
import net from 'node:net';

function probeTcpConnect(host, port, timeoutMs = 120) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (inUse) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', (err) => {
      // ECONNREFUSED means nothing is listening; anything else except ENETUNREACH/EADDRNOTAVAIL is treated conservatively
      if (
        err &&
        (err.code === 'ECONNREFUSED' ||
          err.code === 'EADDRNOTAVAIL' ||
          err.code === 'ENETUNREACH' ||
          err.code === 'EHOSTUNREACH')
      ) {
        finish(false);
      } else {
        finish(false);
      }
    });
    socket.connect(port, host);
  });
}

async function isPortAlreadyOccupied(port) {
  const [v4Busy, v6Busy] = await Promise.all([
    probeTcpConnect('127.0.0.1', port),
    probeTcpConnect('::1', port),
  ]);
  return v4Busy || v6Busy;
}
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { URL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const PREFERRED_WEB_PORT = Number(process.env.WEB_PORT || 5173);
const PREFERRED_SYNC_PORT = Number(process.env.SYNC_PORT || process.env.PORT || 5174);
const BIND_HOST = process.env.HOST || '0.0.0.0';
const AUTO_OPEN_BROWSER = process.argv.includes('--open');

const ROOMMATE_IDS = ['zhang', 'qiang', 'li', 'wei'];
const HHMM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

// In bundled CJS (__dirname is .../reverse-ux-wakeup/server)
const SERVER_DIR =
  typeof __dirname !== 'undefined' ? __dirname : path.resolve(process.cwd(), 'server');
const APP_ROOT = path.resolve(SERVER_DIR, '..');
const DIST_DIR = path.join(APP_ROOT, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

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
  return [...new Set(candidates.map((c) => c.address))];
}

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

async function listenWithFallback(
  server,
  host,
  preferredPort,
  excludePorts = new Set(),
  maxTries = 40
) {
  let candidate = preferredPort;
  for (let attempts = 0; attempts < maxTries; attempts += 1) {
    while (excludePorts.has(candidate) || (await isPortAlreadyOccupied(candidate))) {
      candidate += 1;
    }

    try {
      const boundPort = await new Promise((resolve, reject) => {
        const onError = (err) => {
          server.off('listening', onListening);
          reject(err);
        };
        const onListening = () => {
          server.off('error', onError);
          const addr = server.address();
          resolve(typeof addr === 'object' && addr ? addr.port : candidate);
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(candidate, host);
      });
      return boundPort;
    } catch (err) {
      if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
        candidate += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Unable to bind port starting from ${preferredPort}`);
}

function findFallbackStandaloneHtml() {
  const candidates = [
    path.resolve(APP_ROOT, '..', '醒醒分钱了-寝室总控台版.html'),
    path.resolve(APP_ROOT, '..', '..', '醒醒分钱了-寝室总控台版.html'),
    path.resolve(APP_ROOT, '..', '醒醒分钱了-4部联机手机同屏版.html'),
    path.resolve(APP_ROOT, '..', '..', '醒醒分钱了-4部联机手机同屏版.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function injectRuntimePortsIntoHtml(rawHtml, webPort, syncPort) {
  const runtimeScript = `<script>window.__WAKEUP_RUNTIME__=${JSON.stringify({
    webPort,
    syncPort,
  })};</script>`;
  if (rawHtml.includes('</head>')) {
    return rawHtml.replace('</head>', `${runtimeScript}</head>`);
  }
  return `${runtimeScript}\n${rawHtml}`;
}

function openBrowserUrl(targetUrl) {
  try {
    if (process.platform === 'darwin') {
      const child = spawn('open', [targetUrl], { stdio: 'ignore', detached: true });
      child.unref();
    } else if (process.platform === 'win32') {
      const child = spawn('cmd', ['/c', 'start', '', targetUrl], {
        stdio: 'ignore',
        detached: true,
      });
      child.unref();
    } else {
      const child = spawn('xdg-open', [targetUrl], { stdio: 'ignore', detached: true });
      child.unref();
    }
  } catch {
    // ignore browser auto-open failure on headless systems
  }
}

async function startStandaloneLanCluster() {
  let sharedDormState = null;
  const clients = new Map();
  let actualSyncPort = PREFERRED_SYNC_PORT;
  let actualWebPort = PREFERRED_WEB_PORT;

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
    const webPort = Number(webPortOverride || actualWebPort);
    const roleUrls = {};

    for (const id of ROOMMATE_IDS) {
      roleUrls[id] = `http://${primaryLanIp}:${webPort}/?role=${id}&mobile=1&mode=lan&wsPort=${actualSyncPort}`;
    }

    return {
      ok: true,
      syncPort: actualSyncPort,
      webPort,
      primaryLanIp,
      lanIps: lanIps.length > 0 ? lanIps : ['127.0.0.1'],
      wsUrl: `ws://${primaryLanIp}:${actualSyncPort}`,
      roleUrls,
      ...buildPresenceSummary(),
    };
  }

  // 1. Sync HTTP + WebSocket Server
  const syncServer = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      setCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && parsedUrl.pathname === '/api/lan-info') {
      const queryWebPort = Number(parsedUrl.searchParams.get('webPort') || actualWebPort);
      sendJson(res, 200, buildLanInfo(queryWebPort));
      return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'reverse-ux-wakeup-sync',
        brand: 'Rise & Fine',
        standalone: true,
        webPort: actualWebPort,
        syncPort: actualSyncPort,
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

  const wss = new WebSocketServer({ server: syncServer });
  wss.on('error', () => {});

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

  // 2. Static Web Server (serves prebuilt dist/ or standalone HTML with zero npm dependencies)
  const webServer = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      setCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && parsedUrl.pathname === '/api/config') {
      sendJson(res, 200, {
        ok: true,
        brand: 'Rise & Fine',
        webPort: actualWebPort,
        syncPort: actualSyncPort,
      });
      return;
    }

    let reqPathname = decodeURIComponent(parsedUrl.pathname || '/');
    if (reqPathname === '/') {
      reqPathname = '/index.html';
    }

    const safeRel = path.normalize(reqPathname).replace(/^(\.\.(\/|\\|$))+/, '');
    const candidatePath = path.resolve(DIST_DIR, `.${safeRel}`);

    if (
      candidatePath.startsWith(DIST_DIR) &&
      fs.existsSync(candidatePath) &&
      fs.statSync(candidatePath).isFile()
    ) {
      const ext = path.extname(candidatePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      if (ext === '.html') {
        const rawHtml = fs.readFileSync(candidatePath, 'utf8');
        const injectedHtml = injectRuntimePortsIntoHtml(rawHtml, actualWebPort, actualSyncPort);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        });
        res.end(injectedHtml);
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });
      fs.createReadStream(candidatePath).pipe(res);
      return;
    }

    // SPA fallback to dist/index.html or standalone single-file HTML
    const distIndex = path.join(DIST_DIR, 'index.html');
    const fallbackHtmlPath = fs.existsSync(distIndex)
      ? distIndex
      : findFallbackStandaloneHtml();

    if (fallbackHtmlPath) {
      const rawHtml = fs.readFileSync(fallbackHtmlPath, 'utf8');
      const injectedHtml = injectRuntimePortsIntoHtml(rawHtml, actualWebPort, actualSyncPort);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(injectedHtml);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found — Rise & Fine');
  });

  actualSyncPort = await listenWithFallback(syncServer, BIND_HOST, PREFERRED_SYNC_PORT);
  actualWebPort = await listenWithFallback(
    webServer,
    BIND_HOST,
    PREFERRED_WEB_PORT,
    new Set([actualSyncPort])
  );

  const info = buildLanInfo(actualWebPort);
  const localUrl = `http://localhost:${actualWebPort}/`;
  const lanUrl = `http://${info.primaryLanIp}:${actualWebPort}/`;
  const quadLanUrl = `http://${info.primaryLanIp}:${actualWebPort}/?view=quad`;

  console.log('==============================================================');
  console.log(' 🚨 《醒醒！分钱了》(Rise & Fine) — 零依赖局域网多机实时联机服务');
  console.log('==============================================================');
  console.log(` ✅ 电脑总控台地址 : ${localUrl}`);
  console.log(` ✅ 局域网访问地址 : ${lanUrl}`);
  console.log(` ✅ 4机同屏墙地址  : ${quadLanUrl}`);
  console.log(` ✅ 实时同步端口   : ws://${info.primaryLanIp}:${actualSyncPort}`);
  console.log(' 💡 同一 Wi-Fi / 手机热点下扫描页面底部二维码即可绑定床位联机！');
  console.log(' 💡 保持本窗口开启以维持联机；按 Ctrl + C 可随时停止服务。');
  console.log('==============================================================');

  if (AUTO_OPEN_BROWSER) {
    openBrowserUrl(localUrl);
  }

  function shutdown() {
    for (const ws of clients.keys()) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
    webServer.close(() => {
      syncServer.close(() => {
        process.exit(0);
      });
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startStandaloneLanCluster().catch((err) => {
  console.error('❌ 启动局域网服务失败:', err);
  process.exit(1);
});
