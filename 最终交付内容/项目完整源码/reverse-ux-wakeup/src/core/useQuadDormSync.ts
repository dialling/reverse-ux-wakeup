import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_WAKE_TIME, dormReducer } from './dormEngine';
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
    () =>
      getStoryActById(defaultActId, boot.initialWakeTime).buildState(
        boot.initialWakeTime
      ),
    [defaultActId, boot.initialWakeTime]
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

      const baseState = localBusRef.current;
      const nextState = dormReducer(baseState, action);
      localBusRef.current = nextState;
      setPhoneStates(buildUniformRoleStates(nextState));
    },
    [busMode]
  );

  const jumpAllPhonesToAct = useCallback(
    (actId: number) => {
      const currentWake = localBusRef.current.targetWakeTime || DEFAULT_WAKE_TIME;
      const presetState = getStoryActById(actId, currentWake).buildState(currentWake);
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
      targetWakeTime: localBusRef.current.targetWakeTime || DEFAULT_WAKE_TIME,
    });
  }, [dispatchFromPhone]);

  const setAllPhonesWakeTime = useCallback(
    (targetWakeTime: string) => {
      dispatchFromPhone('zhang', {
        type: 'SET_WAKE_TIME',
        targetWakeTime,
      });
    },
    [dispatchFromPhone]
  );

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
    setAllPhonesWakeTime,
  };
}
