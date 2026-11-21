import React, { useCallback, useEffect, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import {
  parseInitialViewMode,
  useDormSyncController,
  ViewMode,
} from './core/syncClient';
import { DirectorConsole } from './components/DirectorConsole';
import { PhoneFrame } from './components/PhoneFrame';
import { QuadPhoneWall } from './components/QuadPhoneWall';
import { RoommatePhoneScreen } from './components/RoommatePhoneScreen';
import { SettlementModal } from './components/SettlementModal';
import { SinglePhoneStage } from './components/SinglePhoneStage';
import { ViewModeBar } from './components/ViewModeBar';

function DirectorAndSingleWorkspace({
  viewMode,
  onChangeView,
}: {
  viewMode: 'director' | 'single';
  onChangeView: (next: ViewMode) => void;
}) {
  const {
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
    refreshLanInfo,
    dispatchAction,
    jumpToStoryAct,
  } = useDormSyncController();

  const [isNarrowScreen, setIsNarrowScreen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 960 : false
  );
  const [isMobilePhoneWidth, setIsMobilePhoneWidth] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [showSettlementModal, setShowSettlementModal] = useState<boolean>(false);

  useEffect(() => {
    const onResize = () => {
      setIsNarrowScreen(window.innerWidth < 960);
      setIsMobilePhoneWidth(window.innerWidth < 640);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (viewMode === 'single') {
    return (
      <SinglePhoneStage
        dormState={dormState}
        activeRole={activeRole}
        onSelectRole={setActiveRole}
        isMobileViewport={forceMobileView || isMobilePhoneWidth}
        syncMode={syncMode}
        connectionStatus={connectionStatus}
        serverOnline={serverOnline}
        onDispatch={dispatchAction}
        onChangeView={onChangeView}
      />
    );
  }

  const isMobileFullscreen = forceMobileView || isNarrowScreen;
  const me = dormState.roommates[activeRole];
  const isAlarmBlaring =
    me.status === 'ringing_stage1' ||
    me.status === 'being_raided' ||
    me.status === 'snooze_typing';

  return (
    <div
      className={
        isMobileFullscreen
          ? 'min-h-dvh w-full bg-[#070B14]'
          : 'ledger-grid-bg min-h-dvh w-full px-4 py-5 lg:px-8'
      }
    >
      {/* Desktop Top Brand Bar */}
      {!isMobileFullscreen && (
        <header className="mx-auto mb-5 flex max-w-[1440px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/90 bg-[#0F172A]/90 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FACC15] font-black text-slate-950 shadow">
              404
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white sm:text-lg">
                  《醒醒！分钱了》Rise &amp; Fine
                </h1>
                <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-[11px] font-bold text-red-300">
                  404 寝室早起押金契约
                </span>
              </div>
              <p className="text-xs text-slate-400">
                “你多睡的每一分钟，都在亲手给室友加鸡腿” —— {dormState.actBanner}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <ViewModeBar currentView={viewMode} onChangeView={onChangeView} />
            <button
              type="button"
              onClick={() => setForceMobileView(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:border-[#FACC15] hover:text-[#FACC15]"
            >
              <Smartphone className="h-3.5 w-3.5" /> 沉浸手机全屏
            </button>
          </div>
        </header>
      )}

      {forceMobileView && !isNarrowScreen && (
        <button
          type="button"
          onClick={() => setForceMobileView(false)}
          className="fixed right-4 bottom-4 z-50 flex items-center gap-1.5 rounded-full border border-[#FACC15]/60 bg-slate-900/95 px-3.5 py-2 text-xs font-bold text-[#FACC15] shadow-xl backdrop-blur hover:bg-slate-800"
        >
          <Monitor className="h-3.5 w-3.5" /> 展开寝室总控台
        </button>
      )}

      {/* Main Layout: Left Phone Viewport + Right Director Console */}
      <main
        className={
          isMobileFullscreen
            ? 'w-full'
            : 'mx-auto flex max-w-[1440px] flex-col items-start gap-6 xl:flex-row'
        }
      >
        <PhoneFrame
          clock={dormState.currentClock}
          bedLabel={me.badgeLabel}
          roommateName={me.name}
          accentHex={me.accentHex}
          isAlarmActive={isAlarmBlaring}
          isMobileFullscreen={isMobileFullscreen}
        >
          <RoommatePhoneScreen
            dormState={dormState}
            role={activeRole}
            canSwitchRoleInHeader={!forceMobileView}
            onSelectRole={setActiveRole}
            onDispatch={dispatchAction}
            onOpenSettlement={() => setShowSettlementModal(true)}
          />
        </PhoneFrame>

        {!isMobileFullscreen && (
          <div className="w-full flex-1">
            <DirectorConsole
              dormState={dormState}
              activeRole={activeRole}
              onSelectRole={setActiveRole}
              syncMode={syncMode}
              onChangeSyncMode={setSyncMode}
              connectionStatus={connectionStatus}
              serverOnline={serverOnline}
              lanInfo={lanInfo}
              onRefreshLanInfo={refreshLanInfo}
              onDispatch={dispatchAction}
              onJumpToAct={jumpToStoryAct}
              onOpenSettlement={() => setShowSettlementModal(true)}
            />
          </div>
        )}
      </main>

      {showSettlementModal && (
        <SettlementModal
          dormState={dormState}
          onClose={() => setShowSettlementModal(false)}
          onResetDay={() => dispatchAction({ type: 'RESET_DAY', clock: '23:30' })}
        />
      )}
    </div>
  );
}

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => parseInitialViewMode());

  const handleChangeView = useCallback((next: ViewMode) => {
    setViewMode(next);
    if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
      try {
        const url = new URL(window.location.href);
        if (next === 'director') {
          url.searchParams.delete('view');
        } else {
          url.searchParams.set('view', next);
        }
        window.history.replaceState(null, '', url.toString());
      } catch {
        // ignore URL update issues
      }
    }
  }, []);

  if (viewMode === 'quad') {
    return <QuadPhoneWall currentView={viewMode} onChangeView={handleChangeView} />;
  }

  return (
    <DirectorAndSingleWorkspace
      viewMode={viewMode}
      onChangeView={handleChangeView}
    />
  );
}

export default App;
