import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_WAKE_TIME, dormReducer, isValidHHMM } from './dormEngine';
import { getStoryActById } from './storyActs';
import { DormAction, DormState, ROOMMATE_IDS, RoommateId } from '../types/dorm';

export type SyncMode = 'local' | 'lan';

export type ViewMode = 'director' | 'quad' | 'single';

export type ConnectionStatus = 'standalone' | 'connecting' | 'connected' | 'offline_fallback';

interface WakeupInjectedRuntime {
  webPort?: number;
  syncPort?: number;
}

function getInjectedRuntime(): WakeupInjectedRuntime | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { __WAKEUP_RUNTIME__?: WakeupInjectedRuntime })
    .__WAKEUP_RUNTIME__;
}

export function parseInitialViewMode(): ViewMode {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'quad' || viewParam === 'single' || viewParam === 'director') {
      return viewParam;
    }
    const injected = (window as unknown as { __INITIAL_VIEW_MODE__?: string })
      .__INITIAL_VIEW_MODE__;
    if (injected === 'quad' || injected === 'single' || injected === 'director') {
      return injected;
    }
  }
  return 'director';
}

export interface LanPresenceInfo {
  connectedClients: number;
  rolePresence: Record<RoommateId, number>;
  mobileRolePresence: Record<RoommateId, number>;
}

export interface LanServerInfo extends LanPresenceInfo {
  ok: boolean;
  syncPort: number;
  webPort: number;
  primaryLanIp: string;
  lanIps: string[];
  wsUrl: string;
  roleUrls: Record<RoommateId, string>;
}

export interface UrlBootParams {
  initialRole: RoommateId;
  forceMobileView: boolean;
  initialActId: number;
  initialWakeTime: string;
  requestedMode: 'auto' | 'lan' | 'local';
  wsPort: number;
}

export function parseUrlBootParams(): UrlBootParams {
  if (typeof window === 'undefined') {
    return {
      initialRole: 'qiang',
      forceMobileView: false,
      initialActId: 1,
      initialWakeTime: DEFAULT_WAKE_TIME,
      requestedMode: 'auto',
      wsPort: 5174,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const roleParam = params.get('role');
  const initialRole: RoommateId =
    roleParam && (ROOMMATE_IDS as readonly string[]).includes(roleParam)
      ? (roleParam as RoommateId)
      : 'qiang';

  const mobileParam = params.get('mobile');
  const forceMobileView = mobileParam === '1' || mobileParam === 'true';

  const actParam = Number(params.get('act') || '1');
  const initialActId = actParam >= 1 && actParam <= 5 ? Math.trunc(actParam) : 1;

  const wakeParam = params.get('wakeTime');
  const initialWakeTime = isValidHHMM(wakeParam) ? wakeParam.trim() : DEFAULT_WAKE_TIME;

  const modeParam = params.get('mode');
  const requestedMode: 'auto' | 'lan' | 'local' =
    modeParam === 'lan' ? 'lan' : modeParam === 'local' ? 'local' : 'auto';

  const injected = getInjectedRuntime();
  const wsPortParam = Number(
    params.get('wsPort') ||
      injected?.syncPort ||
      import.meta.env.VITE_SYNC_PORT ||
      '5174'
  );
  const wsPort = Number.isFinite(wsPortParam) && wsPortParam > 0 ? wsPortParam : 5174;

  return {
    initialRole,
    forceMobileView,
    initialActId,
    initialWakeTime,
    requestedMode,
    wsPort,
  };
}

function isFileProtocol(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

function buildFallbackLanInfo(wsPort: number): LanServerInfo {
  const injected = getInjectedRuntime();
  const host =
    typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : '127.0.0.1';
  const webPort =
    typeof window !== 'undefined' && window.location.port
      ? Number(window.location.port)
      : injected?.webPort || 5173;
  const origin =
    typeof window !== 'undefined' &&
    !isFileProtocol() &&
    window.location.origin &&
    window.location.origin !== 'null'
      ? window.location.origin
      : `http://${host}:${webPort}`;

  const roleUrls = {} as Record<RoommateId, string>;
  for (const id of ROOMMATE_IDS) {
    roleUrls[id] = `${origin}/?role=${id}&mobile=1&mode=lan&wsPort=${wsPort}`;
  }

  return {
    ok: false,
    syncPort: wsPort,
    webPort,
    primaryLanIp: host,
    lanIps: [host],
    wsUrl: `ws://${host}:${wsPort}`,
    roleUrls,
    connectedClients: 0,
    rolePresence: { zhang: 0, qiang: 0, li: 0, wei: 0 },
    mobileRolePresence: { zhang: 0, qiang: 0, li: 0, wei: 0 },
  };
}

export function useDormSyncController() {
  const boot = useMemo(() => parseUrlBootParams(), []);
  const clientIdRef = useRef<string>(
    `dorm-client-${Math.random().toString(36).slice(2, 10)}`
  );

  const [activeRole, setActiveRoleState] = useState<RoommateId>(boot.initialRole);
  const [forceMobileView, setForceMobileView] = useState<boolean>(boot.forceMobileView);
  const [syncMode, setSyncModeState] = useState<SyncMode>(
    boot.requestedMode === 'local' ? 'local' : boot.requestedMode === 'lan' ? 'lan' : 'local'
  );
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    boot.requestedMode === 'lan' ? 'connecting' : 'standalone'
  );
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [lanInfo, setLanInfo] = useState<LanServerInfo>(() =>
    buildFallbackLanInfo(boot.wsPort)
  );

  const [dormState, setDormState] = useState<DormState>(() =>
    getStoryActById(boot.initialActId, boot.initialWakeTime).buildState(
      boot.initialWakeTime
    )
  );

  const dormStateRef = useRef<DormState>(dormState);
  dormStateRef.current = dormState;

  const activeRoleRef = useRef<RoommateId>(activeRole);
  activeRoleRef.current = activeRole;

  const wsRef = useRef<WebSocket | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const fetchLanServerInfo = useCallback(async (): Promise<LanServerInfo | null> => {
    if (typeof window === 'undefined') return null;
    const injected = getInjectedRuntime();
    const host = window.location.hostname || '127.0.0.1';
    const currentWebPort = window.location.port || String(injected?.webPort || 5173);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1200);

    try {
      const resp = await fetch(
        `http://${host}:${boot.wsPort}/api/lan-info?webPort=${encodeURIComponent(currentWebPort)}`,
        { signal: controller.signal }
      );
      window.clearTimeout(timer);
      if (!resp.ok) return null;
      const data = (await resp.json()) as LanServerInfo;
      if (data && data.ok) {
        setServerOnline(true);
        setLanInfo(data);
        return data;
      }
      return null;
    } catch {
      window.clearTimeout(timer);
      setServerOnline(false);
      return null;
    }
  }, [boot.wsPort]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const detected = await fetchLanServerInfo();
      if (cancelled) return;
      if (
        detected &&
        boot.requestedMode === 'auto' &&
        (!isFileProtocol() || parseInitialViewMode() === 'single')
      ) {
        setSyncModeState('lan');
      } else if (!detected && boot.requestedMode === 'lan') {
        setConnectionStatus('offline_fallback');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boot.requestedMode, fetchLanServerInfo]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      return;
    }
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel('dorm-404-sync-v1');
    } catch {
      return;
    }
    broadcastChannelRef.current = channel;

    channel.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || msg.sourceClientId === clientIdRef.current) return;
      if (syncMode === 'lan' && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        if (msg.type === 'TAB_STATE_SYNC' && msg.state) {
          setDormState(msg.state);
        }
      }
    };

    return () => {
      try {
        channel.close();
      } catch {
        // ignore
      }
      broadcastChannelRef.current = null;
    };
  }, [syncMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (syncMode === 'local') {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnectionStatus('standalone');
      return;
    }

    let disposed = false;
    let reconnectTimer: number | null = null;

    const connectWs = () => {
      if (disposed) return;
      setConnectionStatus('connecting');
      const host = window.location.hostname || '127.0.0.1';
      const wsUrl = `ws://${host}:${boot.wsPort}`;

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        setConnectionStatus('offline_fallback');
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        setServerOnline(true);
        setConnectionStatus('connected');
        fetchLanServerInfo();

        ws.send(
          JSON.stringify({
            type: 'HELLO',
            clientId: clientIdRef.current,
            role: activeRoleRef.current,
            isMobile: boot.forceMobileView || window.innerWidth < 900,
            initialState: dormStateRef.current,
          })
        );
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        let msg: any;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (msg.type === 'WELCOME') {
          if (msg.state) {
            setDormState(msg.state);
          }
          if (msg.presence) {
            setLanInfo((prev) => ({ ...prev, ...msg.presence }));
          }
          return;
        }

        if (msg.type === 'PRESENCE' && msg.presence) {
          setLanInfo((prev) => ({ ...prev, ...msg.presence }));
          return;
        }

        if (msg.type === 'STATE_SYNC' && msg.state) {
          setDormState(msg.state);
          return;
        }

        if (msg.type === 'REBASE_REQUIRED' && msg.state && msg.pendingAction) {
          const rebasedBase: DormState = msg.state;
          const rebasedNext = dormReducer(rebasedBase, msg.pendingAction as DormAction);
          setDormState(rebasedNext);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'COMMIT_ACTION',
                action: msg.pendingAction,
                nextState: rebasedNext,
                baseRevision: rebasedBase.revision,
                forceReplace: false,
              })
            );
          }
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (disposed) return;
        setConnectionStatus('offline_fallback');
        reconnectTimer = window.setTimeout(connectWs, 2500);
      };

      ws.onerror = () => {
        setServerOnline(false);
      };
    };

    connectWs();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [syncMode, boot.wsPort, boot.forceMobileView, fetchLanServerInfo]);

  const setActiveRole = useCallback((role: RoommateId) => {
    setActiveRoleState(role);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'SET_ROLE',
          role,
          isMobile:
            typeof window !== 'undefined'
              ? parseUrlBootParams().forceMobileView || window.innerWidth < 900
              : false,
        })
      );
    }
  }, []);

  const setSyncMode = useCallback(
    (mode: SyncMode) => {
      setSyncModeState(mode);
      if (mode === 'lan') {
        fetchLanServerInfo();
      }
    },
    [fetchLanServerInfo]
  );

  const dispatchAction = useCallback(
    (action: DormAction) => {
      const baseState = dormStateRef.current;
      const nextState = dormReducer(baseState, action);
      dormStateRef.current = nextState;
      setDormState(nextState);

      const forceReplace =
        action.type === 'LOAD_PRESET_STATE' || action.type === 'RESET_DAY';

      if (
        syncMode === 'lan' &&
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        wsRef.current.send(
          JSON.stringify({
            type: 'COMMIT_ACTION',
            action,
            nextState,
            baseRevision: baseState.revision,
            forceReplace,
          })
        );
      } else if (syncMode === 'lan' && broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'TAB_STATE_SYNC',
          state: nextState,
          sourceClientId: clientIdRef.current,
        });
      }
    },
    [syncMode]
  );

  const jumpToStoryAct = useCallback(
    (actId: number, switchRole = true) => {
      const currentWake = dormStateRef.current.targetWakeTime || DEFAULT_WAKE_TIME;
      const act = getStoryActById(actId, currentWake);
      const presetState = act.buildState(currentWake);
      dispatchAction({ type: 'LOAD_PRESET_STATE', presetState });
      if (switchRole) {
        setActiveRole(act.recommendedRole);
      }
    },
    [dispatchAction, setActiveRole]
  );

  return {
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
    refreshLanInfo: fetchLanServerInfo,
    dispatchAction,
    jumpToStoryAct,
  };
}
