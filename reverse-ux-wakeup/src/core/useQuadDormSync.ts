import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dormReducer } from './dormEngine';
import { getStoryActById } from './storyActs';
import { LanServerInfo, parseUrlBootParams } from './syncClient';
import { DormAction, DormState, ROOMMATE_IDS, RoommateId } from '../types/dorm';

export type QuadBusMode = 'lan' | 'local';

type RoleStateMap = Record<RoommateId, DormState>;
type RoleOnlineMap = Record<RoommateId, boolean>;

function buildUniformRoleStates(state: DormState): RoleStateMap {
  return {
    zhang: state,
    qiang: state,
    li: state,
    wei: state,
  };
}

export function useQuadDormSync() {
  const boot = useMemo(() => parseUrlBootParams(), []);

  // 默认若 URL 未显式传 ?act=，4机同屏版默认展示第 2 幕（07:00 老张已醒可突袭 + 阿强/小李逃跑滑块 + 阿伟沉睡可拉响闹钟）
  const defaultActId = useMemo(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.has('act')) {
        return boot.initialActId;
      }
    }
    return 2;
  }, [boot.initialActId]);

  const initialSeedState = useMemo(
    () => getStoryActById(defaultActId).buildState(),
    [defaultActId]
  );

  const [phoneStates, setPhoneStates] = useState<RoleStateMap>(() =>
    buildUniformRoleStates(initialSeedState)
  );
  const phoneStatesRef = useRef<RoleStateMap>(phoneStates);
  phoneStatesRef.current = phoneStates;

  const localBusRef = useRef<DormState>(initialSeedState);

  const [busMode, setBusMode] = useState<QuadBusMode>(
    boot.requestedMode === 'local' ? 'local' : 'lan'
  );
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [lanInfo, setLanInfo] = useState<LanServerInfo | null>(null);
  const [roleOnline, setRoleOnline] = useState<RoleOnlineMap>({
    zhang: false,
    qiang: false,
    li: false,
    wei: false,
  });

  const wsMapRef = useRef<Partial<Record<RoommateId, WebSocket>>>({});
  const clientIdsRef = useRef<Record<RoommateId, string>>({
    zhang: `quad-zhang-${Math.random().toString(36).slice(2, 8)}`,
    qiang: `quad-qiang-${Math.random().toString(36).slice(2, 8)}`,
    li: `quad-li-${Math.random().toString(36).slice(2, 8)}`,
    wei: `quad-wei-${Math.random().toString(36).slice(2, 8)}`,
  });

  const probeLanServer = useCallback(async (): Promise<LanServerInfo | null> => {
    if (typeof window === 'undefined') return null;
    const host = window.location.hostname || '127.0.0.1';
    const webPort = window.location.port || '5173';
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1200);

    try {
      const resp = await fetch(
        `http://${host}:${boot.wsPort}/api/lan-info?webPort=${encodeURIComponent(webPort)}`,
        { signal: controller.signal }
      );
      window.clearTimeout(timer);
      if (!resp.ok) {
        setServerOnline(false);
        return null;
      }
      const data = (await resp.json()) as LanServerInfo;
      if (data && data.ok) {
        setServerOnline(true);
        setLanInfo(data);
        return data;
      }
      setServerOnline(false);
      return null;
    } catch {
      window.clearTimeout(timer);
      setServerOnline(false);
      return null;
    }
  }, [boot.wsPort]);

  // 启动时探测 :5174；若离线则优雅停留在本地共享状态总线（零报错），若在线则由 4 个真实 WS 客户端分别接入
  useEffect(() => {
    let disposed = false;
    let reconnectTimer: number | null = null;

    const closeAllSockets = () => {
      for (const id of ROOMMATE_IDS) {
        const existing = wsMapRef.current[id];
        if (existing) {
          try {
            existing.close();
          } catch {
            // ignore
          }
          delete wsMapRef.current[id];
        }
      }
      setRoleOnline({ zhang: false, qiang: false, li: false, wei: false });
    };

    if (busMode === 'local') {
      closeAllSockets();
      return;
    }

    const connectFourPhones = async () => {
      const info = await probeLanServer();
      if (disposed) return;

      if (!info) {
        closeAllSockets();
        // 若用户未手动锁死 local，每 4s 温和HTTP探测一次以便用户中途开启 start-lan.mjs 后自动连入
        reconnectTimer = window.setTimeout(connectFourPhones, 4000);
        return;
      }

      const host = window.location.hostname || '127.0.0.1';
      const wsUrl = `ws://${host}:${boot.wsPort}`;

      for (const role of ROOMMATE_IDS) {
        const prev = wsMapRef.current[role];
        if (prev && (prev.readyState === WebSocket.OPEN || prev.readyState === WebSocket.CONNECTING)) {
          continue;
        }

        let ws: WebSocket;
        try {
          ws = new WebSocket(wsUrl);
        } catch {
          continue;
        }

        wsMapRef.current[role] = ws;

        ws.onopen = () => {
          if (disposed) {
            ws.close();
            return;
          }
          setRoleOnline((prevMap) => ({ ...prevMap, [role]: true }));
          ws.send(
            JSON.stringify({
              type: 'HELLO',
              clientId: clientIdsRef.current[role],
              role,
              isMobile: true,
              initialState: localBusRef.current,
            })
          );
        };

        ws.onmessage = (ev) => {
          if (disposed) return;
          let msg: any;
          try {
            msg = JSON.parse(String(ev.data));
          } catch {
            return;
          }

          if ((msg.type === 'WELCOME' || msg.type === 'STATE_SYNC') && msg.state) {
            const incomingState = msg.state as DormState;
            localBusRef.current = incomingState;
            setPhoneStates((prevMap) => ({
              ...prevMap,
              [role]: incomingState,
            }));
            if (msg.presence) {
              setLanInfo((prevInfo) =>
                prevInfo ? { ...prevInfo, ...msg.presence } : prevInfo
              );
            }
            return;
          }

          if (msg.type === 'PRESENCE' && msg.presence) {
            setLanInfo((prevInfo) =>
              prevInfo ? { ...prevInfo, ...msg.presence } : prevInfo
            );
            return;
          }

          if (msg.type === 'REBASE_REQUIRED' && msg.state && msg.pendingAction) {
            const rebasedBase = msg.state as DormState;
            const rebasedNext = dormReducer(rebasedBase, msg.pendingAction as DormAction);
            localBusRef.current = rebasedNext;
            setPhoneStates((prevMap) => ({
              ...prevMap,
              [role]: rebasedNext,
            }));
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
          if (wsMapRef.current[role] === ws) {
            delete wsMapRef.current[role];
          }
          if (disposed) return;
          setRoleOnline((prevMap) => ({ ...prevMap, [role]: false }));
        };

        ws.onerror = () => {
          setRoleOnline((prevMap) => ({ ...prevMap, [role]: false }));
        };
      }
    };

    connectFourPhones();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      closeAllSockets();
    };
  }, [busMode, boot.wsPort, probeLanServer]);

  const wsOnlineCount = useMemo(
    () => ROOMMATE_IDS.filter((id) => roleOnline[id]).length,
    [roleOnline]
  );

  // 从某一部特定手机发起动作：若该手机已连入 WS，走真实服务端广播至其余 3 部手机；否则走本地共享状态总线实时同步 4 部手机
  const dispatchFromPhone = useCallback(
    (sourceRole: RoommateId, action: DormAction) => {
      const ws = wsMapRef.current[sourceRole];
      const forceReplace =
        action.type === 'LOAD_PRESET_STATE' || action.type === 'RESET_DAY';

      if (busMode === 'lan' && ws && ws.readyState === WebSocket.OPEN) {
        const baseState = phoneStatesRef.current[sourceRole];
        const nextState = dormReducer(baseState, action);
        localBusRef.current = nextState;
        setPhoneStates((prevMap) => ({
          ...prevMap,
          [sourceRole]: nextState,
        }));

        ws.send(
          JSON.stringify({
            type: 'COMMIT_ACTION',
            action,
            nextState,
            baseRevision: baseState.revision,
            forceReplace,
          })
        );
        return;
      }

      // 离线/本地总线兜底：4 部手机共享同一内存实时总线，毫秒级四屏同步
      const baseState = localBusRef.current;
      const nextState = dormReducer(baseState, action);
      localBusRef.current = nextState;
      setPhoneStates(buildUniformRoleStates(nextState));
    },
    [busMode]
  );

  const jumpAllPhonesToAct = useCallback(
    (actId: number) => {
      const presetState = getStoryActById(actId).buildState();
      dispatchFromPhone('zhang', {
        type: 'LOAD_PRESET_STATE',
        presetState,
      });
    },
    [dispatchFromPhone]
  );

  const resetAllPhonesDay = useCallback(() => {
    dispatchFromPhone('zhang', {
      type: 'RESET_DAY',
      clock: '23:30',
    });
  }, [dispatchFromPhone]);

  return {
    phoneStates,
    primaryState: phoneStates.zhang,
    busMode,
    setBusMode,
    serverOnline,
    lanInfo,
    roleOnline,
    wsOnlineCount,
    dispatchFromPhone,
    jumpAllPhonesToAct,
    resetAllPhonesDay,
  };
}
