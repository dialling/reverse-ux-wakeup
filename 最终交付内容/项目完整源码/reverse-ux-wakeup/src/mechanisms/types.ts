export interface EvasiveSliderProps {
  roommateName: string;
  onComplete: () => void;
  onSlipPenalty?: (reason: string) => void;
}

export interface ShameTyperProps {
  roommateName: string;
  onCompleteSnooze: (stats: {
    elapsedSeconds: number;
    mistakes: number;
    penaltyPaid: number;
  }) => void;
  onTickPenalty: (amount: number, totalPaid: number, reason: string) => void;
  onCancel: () => void;
}

export interface RaidKeypadProps {
  raiderName: string;
  targetName: string;
  timeLimitSec?: number;
  onSurvive: (stats: { remainingSec: number; mistakes: number }) => void;
  onFailRaid: (reason: 'timeout' | 'too_many_errors') => void;
}

export interface PuzzleStats {
  levelId: string;
  seconds: number;
  collisions: number;
  moves: number;
}

export interface FlowConnectProps {
  initialLevelIndex?: number;
  onWin: (stats: PuzzleStats) => void;
  onCollision?: (totalCollisions: number) => void;
}

export interface ParkingJamProps {
  initialLevelIndex?: number;
  onWin: (stats: PuzzleStats) => void;
  onCollision?: (totalCollisions: number) => void;
}
