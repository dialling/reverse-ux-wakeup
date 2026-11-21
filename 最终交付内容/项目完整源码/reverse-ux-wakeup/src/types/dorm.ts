export const ROOMMATE_IDS = ['zhang', 'qiang', 'li', 'wei'] as const;

export type RoommateId = (typeof ROOMMATE_IDS)[number];

export type WakeStageGame = 'flow' | 'parking';

export type RoommateStatus =
  | 'sleeping'
  | 'ringing_stage1'
  | 'snooze_typing'
  | 'snoozing'
  | 'relapse_sleeping'
  | 'wakeup_stage2'
  | 'being_raided'
  | 'awake'
  | 'settled_slacker';

export interface RoommateProfile {
  id: RoommateId;
  bedNumber: 1 | 2 | 3 | 4;
  name: string;
  shortName: string;
  badgeLabel: string;
  roleTag: string;
  bio: string;
  accentHex: string;
}

export interface RoommateState extends RoommateProfile {
  initialDepositCents: number;
  balanceCents: number;
  totalPenaltyPaidCents: number;
  totalBonusEarnedCents: number;
  contractSigned: boolean;
  status: RoommateStatus;
  previousStatusBeforeModal?: RoommateStatus;
  selectedGame: WakeStageGame;
  puzzleLevelIndex: number;
  wakeupTime?: string;
  snoozeCount: number;
  slipCount: number;
  collisionCount: number;
  raidsLaunched: number;
  raidsSurvived: number;
  raidsFailed: number;
  lastActionNote: string;
}

export interface RaidSession {
  id: string;
  raiderId: RoommateId;
  targetId: RoommateId;
  timeLimitSec: number;
  penaltyCents: number;
  startedAtClock: string;
  startedAtMs: number;
  previousTargetStatus: RoommateStatus;
}

export type LedgerEntryKind =
  | 'contract_init'
  | 'wake_time_update'
  | 'slider_slip'
  | 'snooze_tick'
  | 'snooze_fee'
  | 'puzzle_collision'
  | 'pool_claim'
  | 'raid_launch'
  | 'raid_survive'
  | 'raid_penalty'
  | 'slacker_forfeit'
  | 'wake_success'
  | 'day_settled';

export interface LedgerSplitItem {
  roommateId: RoommateId;
  amountCents: number;
}

export interface LedgerEntry {
  id: string;
  seq: number;
  clock: string;
  kind: LedgerEntryKind;
  actorId?: RoommateId;
  fromId?: RoommateId | 'public_pool';
  toIds: RoommateId[];
  toPublicPool?: boolean;
  amountCents: number;
  headline: string;
  detail: string;
  splits?: LedgerSplitItem[];
}

export interface ToastNotice {
  id: string;
  tone: 'warning' | 'danger' | 'success' | 'info';
  message: string;
  amountCents?: number;
}

export interface DormState {
  dormName: string;
  contractTitle: string;
  targetWakeTime: string;
  targetAlarmClock: string;
  currentClock: string;
  currentActId: number;
  actBanner: string;
  totalFundCents: number;
  publicPoolCents: number;
  roommates: Record<RoommateId, RoommateState>;
  activeRaids: Partial<Record<RoommateId, RaidSession>>;
  ledger: LedgerEntry[];
  isDaySettled: boolean;
  revision: number;
  lastToast?: ToastNotice;
}

export interface ConservationCheckResult {
  valid: true;
  totalBalancesCents: number;
  publicPoolCents: number;
  actualTotalCents: number;
  expectedTotalCents: number;
}

export interface SettlementRow {
  roommateId: RoommateId;
  bedNumber: 1 | 2 | 3 | 4;
  name: string;
  shortName: string;
  status: RoommateStatus;
  initialDepositCents: number;
  finalBalanceCents: number;
  netProfitCents: number;
  totalBonusEarnedCents: number;
  totalPenaltyPaidCents: number;
  chickenDrumstickEquivalent: number;
  verdictTitle: string;
  verdictTagTone: 'winner' | 'neutral' | 'loser';
}

export interface DailySettlementReport {
  dormName: string;
  settledClock: string;
  totalFundCents: number;
  publicPoolCents: number;
  totalTransferredCents: number;
  rows: SettlementRow[];
  mvpWinner: SettlementRow;
  topSponsor: SettlementRow;
}

export type DormAction =
  | {
      type: 'RESET_DAY';
      initialDepositCents?: number;
      clock?: string;
      targetWakeTime?: string;
    }
  | { type: 'SET_WAKE_TIME'; targetWakeTime: string; clock?: string }
  | { type: 'SIGN_CONTRACT'; roommateId: RoommateId; clock?: string }
  | { type: 'SIGN_ALL_AND_START_ALARM'; clock?: string }
  | { type: 'TRIGGER_ALARM'; roommateIds?: RoommateId[]; clock?: string }
  | {
      type: 'SLIDER_SLIP_PENALTY';
      roommateId: RoommateId;
      penaltyCents?: number;
      reason?: string;
      clock?: string;
    }
  | {
      type: 'COMPLETE_STAGE1_SLIDER';
      roommateId: RoommateId;
      preferredGame?: WakeStageGame;
      clock?: string;
    }
  | {
      type: 'SELECT_STAGE2_GAME';
      roommateId: RoommateId;
      game: WakeStageGame;
      levelIndex?: number;
    }
  | {
      type: 'PUZZLE_COLLISION_PENALTY';
      roommateId: RoommateId;
      penaltyCents?: number;
      detail?: string;
      clock?: string;
    }
  | {
      type: 'COMPLETE_STAGE2_PUZZLE';
      roommateId: RoommateId;
      clock?: string;
    }
  | { type: 'OPEN_SNOOZE_TYPER'; roommateId: RoommateId; clock?: string }
  | { type: 'CANCEL_SNOOZE_TYPER'; roommateId: RoommateId }
  | {
      type: 'SNOOZE_TICK_PENALTY';
      roommateId: RoommateId;
      penaltyCents?: number;
      reason?: string;
      clock?: string;
    }
  | {
      type: 'COMPLETE_SNOOZE';
      roommateId: RoommateId;
      snoozeFeeCents?: number;
      clock?: string;
    }
  | { type: 'ENTER_RELAPSE_SLEEP'; roommateId: RoommateId; clock?: string }
  | {
      type: 'LAUNCH_RAID';
      raiderId: RoommateId;
      targetId: RoommateId;
      timeLimitSec?: number;
      penaltyCents?: number;
      startedAtMs?: number;
      clock?: string;
    }
  | { type: 'SURVIVE_RAID'; targetId: RoommateId; clock?: string }
  | { type: 'FAIL_RAID'; targetId: RoommateId; clock?: string }
  | {
      type: 'FORFEIT_SLEEP_PENALTY';
      roommateId: RoommateId;
      penaltyCents?: number;
      clock?: string;
    }
  | { type: 'SETTLE_DAY'; absentPenaltyCents?: number; clock?: string }
  | { type: 'LOAD_PRESET_STATE'; presetState: DormState };

export interface StoryActDefinition {
  actId: 1 | 2 | 3 | 4 | 5;
  clock: string;
  shortTitle: string;
  title: string;
  subtitle: string;
  pitchCue: string;
  recommendedRole: RoommateId;
  buildState: (targetWakeTime?: string) => DormState;
}
