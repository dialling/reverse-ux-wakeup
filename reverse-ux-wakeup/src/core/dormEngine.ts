import {
  ConservationCheckResult,
  DailySettlementReport,
  DormAction,
  DormState,
  LedgerEntry,
  LedgerEntryKind,
  LedgerSplitItem,
  ROOMMATE_IDS,
  RoommateId,
  RoommateProfile,
  RoommateState,
  RoommateStatus,
  SettlementRow,
} from '../types/dorm';

export const DEFAULT_DEPOSIT_CENTS = 5000; // ¥50.00 per roommate
export const DEFAULT_TOTAL_FUND_CENTS = DEFAULT_DEPOSIT_CENTS * ROOMMATE_IDS.length; // ¥200.00
export const DEFAULT_SLIP_PENALTY_CENTS = 50; // ¥0.50
export const DEFAULT_COLLISION_PENALTY_CENTS = 50; // ¥0.50
export const DEFAULT_SNOOZE_TICK_CENTS = 100; // ¥1.00
export const DEFAULT_SNOOZE_FEE_CENTS = 200; // ¥2.00
export const DEFAULT_RAID_PENALTY_CENTS = 1000; // ¥10.00
export const DEFAULT_SLACKER_FORFEIT_CENTS = 1500; // ¥15.00
export const DEFAULT_RAID_TIME_LIMIT_SEC = 35;

export const ROOMMATE_PROFILES: Record<RoommateId, RoommateProfile> = {
  zhang: {
    id: 'zhang',
    bedNumber: 1,
    name: '卷王老张',
    shortName: '老张',
    badgeLabel: '1号床',
    roleTag: '早起狂魔',
    bio: '06:58 准时睁眼盯盘，最爱发起突袭查岗薅室友早餐鸡腿钱。',
    accentHex: '#22C55E',
  },
  qiang: {
    id: 'qiang',
    bedNumber: 2,
    name: '早八阿强',
    shortName: '阿强',
    badgeLabel: '2号床',
    roleTag: '屡败早八人',
    bio: '默认主角，深夜立最狠的早起毒誓，清晨打最卑微的认怂长文。',
    accentHex: '#FACC15',
  },
  li: {
    id: 'li',
    bedNumber: 3,
    name: '回笼觉小李',
    shortName: '小李',
    badgeLabel: '3号床',
    roleTag: '假醒惯犯',
    bio: '嘴上喊着醒了醒了，身体诚实缩回被窝眯眼，常年被算术查岗精准制裁。',
    accentHex: '#38BDF8',
  },
  wei: {
    id: 'wei',
    bedNumber: 4,
    name: '死睡阿伟',
    shortName: '阿伟',
    badgeLabel: '4号床',
    roleTag: '首席慈善家',
    bio: '十个闹钟叫不醒的深度睡眠户，404 寝室早餐基金最大赞助商。',
    accentHex: '#FB7185',
  },
};

export function formatYuan(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  const yuan = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, '0');
  return `${sign}¥${yuan}.${rem}`;
}

export function formatSignedYuan(cents: number): string {
  if (cents > 0) return `+${formatYuan(cents)}`;
  if (cents < 0) return formatYuan(cents);
  return '¥0.00';
}

export function getStatusLabel(status: RoommateStatus): string {
  switch (status) {
    case 'sleeping':
      return '沉睡未起';
    case 'ringing_stage1':
      return '闹钟轰炸 · 逃跑滑块';
    case 'snooze_typing':
      return '贪睡受刑 · 手打认怂';
    case 'snoozing':
      return '贪睡延时 · 高危赖床';
    case 'relapse_sleeping':
      return '眯眼回笼觉 · 可被突袭';
    case 'wakeup_stage2':
      return '深度核验 · 益智大考';
    case 'being_raided':
      return '突袭警报 · 乱序算术';
    case 'awake':
      return '已清醒打卡 · 享分红权';
    case 'settled_slacker':
      return '今日赖床破防';
  }
}

export function canBeRaided(status: RoommateStatus): boolean {
  return (
    status === 'sleeping' ||
    status === 'snoozing' ||
    status === 'relapse_sleeping' ||
    status === 'ringing_stage1' ||
    status === 'wakeup_stage2'
  );
}

/**
 * 刚性资金守恒不变量断言：
 * 1. 4 名室友余额与公共待分配奖池必须均为非负安全整数（单位：分）
 * 2. 每人 `初始押金 - 累计扣罚 + 累计分红 === 当前余额`
 * 3. `4人当前账户余额之和 + 公共待分配奖池 === 寝室初始总资金 (默认 ¥200.00 = 20000 分)`
 */
export function assertMoneyConservation(state: DormState): ConservationCheckResult {
  if (!Number.isSafeInteger(state.totalFundCents) || state.totalFundCents <= 0) {
    throw new Error(`Invalid totalFundCents: ${state.totalFundCents}`);
  }
  if (!Number.isSafeInteger(state.publicPoolCents) || state.publicPoolCents < 0) {
    throw new Error(`Invalid publicPoolCents: ${state.publicPoolCents}`);
  }

  let totalBalancesCents = 0;

  for (const id of ROOMMATE_IDS) {
    const r = state.roommates[id];
    if (!r) {
      throw new Error(`Missing roommate state for ${id}`);
    }
    if (!Number.isSafeInteger(r.balanceCents) || r.balanceCents < 0) {
      throw new Error(`Invalid balanceCents for ${id}: ${r.balanceCents}`);
    }
    if (!Number.isSafeInteger(r.totalPenaltyPaidCents) || r.totalPenaltyPaidCents < 0) {
      throw new Error(`Invalid totalPenaltyPaidCents for ${id}: ${r.totalPenaltyPaidCents}`);
    }
    if (!Number.isSafeInteger(r.totalBonusEarnedCents) || r.totalBonusEarnedCents < 0) {
      throw new Error(`Invalid totalBonusEarnedCents for ${id}: ${r.totalBonusEarnedCents}`);
    }

    const expectedPersonalBalance =
      r.initialDepositCents - r.totalPenaltyPaidCents + r.totalBonusEarnedCents;
    if (expectedPersonalBalance !== r.balanceCents) {
      throw new Error(
        `Personal ledger mismatch for ${id}: expected ${expectedPersonalBalance}, got ${r.balanceCents}`
      );
    }

    totalBalancesCents += r.balanceCents;
  }

  const actualTotalCents = totalBalancesCents + state.publicPoolCents;
  if (actualTotalCents !== state.totalFundCents) {
    throw new Error(
      `Money conservation violated! sum(balances)=${totalBalancesCents} + publicPool=${state.publicPoolCents} = ${actualTotalCents}, expected ${state.totalFundCents}`
    );
  }

  return {
    valid: true,
    totalBalancesCents,
    publicPoolCents: state.publicPoolCents,
    actualTotalCents,
    expectedTotalCents: state.totalFundCents,
  };
}

/**
 * 将正整数 `amountCents` 精确按顺序均分给 `recipientIds`，余数（< N 分）按列表顺序逐人补 1 分，确保分毫不差。
 */
export function splitCentsExact(
  amountCents: number,
  recipientIds: RoommateId[]
): LedgerSplitItem[] {
  if (amountCents <= 0 || recipientIds.length === 0) {
    return [];
  }
  const count = recipientIds.length;
  const base = Math.floor(amountCents / count);
  const remainder = amountCents - base * count;

  return recipientIds.map((roommateId, idx) => ({
    roommateId,
    amountCents: base + (idx < remainder ? 1 : 0),
  }));
}

function cloneState(state: DormState): DormState {
  const roommates = {} as Record<RoommateId, RoommateState>;
  for (const id of ROOMMATE_IDS) {
    roommates[id] = { ...state.roommates[id] };
  }
  const activeRaids: DormState['activeRaids'] = {};
  for (const [k, v] of Object.entries(state.activeRaids)) {
    if (v) {
      activeRaids[k as RoommateId] = { ...v };
    }
  }
  return {
    ...state,
    roommates,
    activeRaids,
    ledger: [...state.ledger],
    revision: state.revision + 1,
  };
}

function getAwakeRoommateIds(
  state: DormState,
  excludeId?: RoommateId,
  priorityFirstId?: RoommateId
): RoommateId[] {
  const awake = ROOMMATE_IDS.filter(
    (id) => id !== excludeId && state.roommates[id].status === 'awake'
  );
  if (priorityFirstId && awake.includes(priorityFirstId)) {
    return [priorityFirstId, ...awake.filter((id) => id !== priorityFirstId)];
  }
  return awake;
}

function appendLedger(
  state: DormState,
  params: {
    clock: string;
    kind: LedgerEntryKind;
    actorId?: RoommateId;
    fromId?: RoommateId | 'public_pool';
    toIds?: RoommateId[];
    toPublicPool?: boolean;
    amountCents: number;
    headline: string;
    detail: string;
    splits?: LedgerSplitItem[];
  }
): void {
  const seq = state.ledger.length + 1;
  const entry: LedgerEntry = {
    id: `tx-${seq}-${state.revision}`,
    seq,
    clock: params.clock,
    kind: params.kind,
    actorId: params.actorId,
    fromId: params.fromId,
    toIds: params.toIds ?? [],
    toPublicPool: params.toPublicPool,
    amountCents: params.amountCents,
    headline: params.headline,
    detail: params.detail,
    splits: params.splits,
  };
  state.ledger = [entry, ...state.ledger];
}

interface PenaltyDistributionOutcome {
  actualDeductedCents: number;
  toPublicPool: boolean;
  splits: LedgerSplitItem[];
}

/**
 * 核心扣罚与分红划转：
 * - 自动按扣款人剩余余额截断（绝不穿仓变负数）
 * - 若已有清醒室友：按顺序均分给已清醒室友
 * - 若尚无室友起床：转入 `publicPoolCents` 公共待分奖池，待首位早起者打卡时立即领取
 */
function applyPenaltyTransfer(
  state: DormState,
  payerId: RoommateId,
  requestedCents: number,
  priorityRecipientId?: RoommateId
): PenaltyDistributionOutcome {
  const normalizedRequest = Math.max(0, Math.trunc(requestedCents));
  const payer = state.roommates[payerId];
  const actualDeductedCents = Math.min(normalizedRequest, payer.balanceCents);

  if (actualDeductedCents <= 0) {
    return { actualDeductedCents: 0, toPublicPool: false, splits: [] };
  }

  payer.balanceCents -= actualDeductedCents;
  payer.totalPenaltyPaidCents += actualDeductedCents;

  const recipients = getAwakeRoommateIds(state, payerId, priorityRecipientId);
  if (recipients.length === 0) {
    state.publicPoolCents += actualDeductedCents;
    return {
      actualDeductedCents,
      toPublicPool: true,
      splits: [],
    };
  }

  const splits = splitCentsExact(actualDeductedCents, recipients);
  for (const split of splits) {
    const target = state.roommates[split.roommateId];
    target.balanceCents += split.amountCents;
    target.totalBonusEarnedCents += split.amountCents;
  }

  return {
    actualDeductedCents,
    toPublicPool: false,
    splits,
  };
}

/**
 * 当室友完成深度清醒打卡成为 `awake`（或结算日触发）时，若 `publicPoolCents > 0`，立即按规则分配给已清醒室友。
 */
function distributePublicPoolToAwake(
  state: DormState,
  recipientIds: RoommateId[],
  clock: string,
  reasonLabel: string
): number {
  if (state.publicPoolCents <= 0 || recipientIds.length === 0) {
    return 0;
  }
  const poolAmount = state.publicPoolCents;
  const splits = splitCentsExact(poolAmount, recipientIds);
  state.publicPoolCents = 0;

  for (const split of splits) {
    const r = state.roommates[split.roommateId];
    r.balanceCents += split.amountCents;
    r.totalBonusEarnedCents += split.amountCents;
  }

  const names = splits
    .map((s) => `${state.roommates[s.roommateId].shortName}(+${formatYuan(s.amountCents)})`)
    .join('、');

  appendLedger(state, {
    clock,
    kind: 'pool_claim',
    fromId: 'public_pool',
    toIds: recipientIds,
    amountCents: poolAmount,
    splits,
    headline: `${reasonLabel} · 瓜分早起公共奖池 ${formatYuan(poolAmount)}`,
    detail: `公共待分奖池全额发放至已清醒室友：${names}`,
  });

  return poolAmount;
}

export function createInitialDormState(options?: {
  initialDepositCents?: number;
  clock?: string;
}): DormState {
  const deposit =
    options?.initialDepositCents !== undefined
      ? Math.max(100, Math.trunc(options.initialDepositCents))
      : DEFAULT_DEPOSIT_CENTS;
  const clock = options?.clock ?? '23:30';
  const totalFundCents = deposit * ROOMMATE_IDS.length;

  const roommates = {} as Record<RoommateId, RoommateState>;
  ROOMMATE_IDS.forEach((id, idx) => {
    const profile = ROOMMATE_PROFILES[id];
    roommates[id] = {
      ...profile,
      initialDepositCents: deposit,
      balanceCents: deposit,
      totalPenaltyPaidCents: 0,
      totalBonusEarnedCents: 0,
      contractSigned: true,
      status: 'sleeping',
      selectedGame: idx % 2 === 0 ? 'flow' : 'parking',
      puzzleLevelIndex: 0,
      snoozeCount: 0,
      slipCount: 0,
      collisionCount: 0,
      raidsLaunched: 0,
      raidsSurvived: 0,
      raidsFailed: 0,
      lastActionNote: `已缴纳契约押金 ${formatYuan(deposit)}，明早 07:00 准时对赌`,
    };
  });

  const state: DormState = {
    dormName: '404 寝室',
    contractTitle: '07:00 铁血早八互坑契约',
    targetAlarmClock: '07:00',
    currentClock: clock,
    currentActId: 1,
    actBanner: '第1幕 · 23:30 深夜立毒誓：4人交齐 ¥200.00 押金池，谁赖床谁请全寝吃鸡腿！',
    totalFundCents,
    publicPoolCents: 0,
    roommates,
    activeRaids: {},
    ledger: [
      {
        id: 'tx-1-0',
        seq: 1,
        clock,
        kind: 'contract_init',
        toIds: [...ROOMMATE_IDS],
        amountCents: totalFundCents,
        headline: `404 寝室早起契约生效 · 总资金池锁定 ${formatYuan(totalFundCents)}`,
        detail: `老张、阿强、小李、阿伟各投入 ${formatYuan(deposit)}，07:00 准时开启互坑监督。`,
      },
    ],
    isDaySettled: false,
    revision: 1,
    lastToast: {
      id: 'toast-init',
      tone: 'info',
      message: `404 寝室契约池已锁定 ${formatYuan(totalFundCents)}`,
      amountCents: totalFundCents,
    },
  };

  assertMoneyConservation(state);
  return state;
}

function formatRecipientSummary(state: DormState, outcome: PenaltyDistributionOutcome): string {
  if (outcome.actualDeductedCents <= 0) {
    return '押金余额已归零，触发纯精神社死公开处刑';
  }
  if (outcome.toPublicPool) {
    return `暂无室友起床，${formatYuan(outcome.actualDeductedCents)} 已滚入公共早起奖池（首位早起者通吃！）`;
  }
  return `已实时均分给清醒室友：${outcome.splits
    .map((s) => `${state.roommates[s.roommateId].shortName} +${formatYuan(s.amountCents)}`)
    .join('、')}`;
}

export function dormReducer(prevState: DormState, action: DormAction): DormState {
  assertMoneyConservation(prevState);

  if (action.type === 'RESET_DAY') {
    return createInitialDormState({
      initialDepositCents: action.initialDepositCents,
      clock: action.clock ?? '23:30',
    });
  }

  if (action.type === 'LOAD_PRESET_STATE') {
    const next = cloneState(action.presetState);
    assertMoneyConservation(next);
    return next;
  }

  const next = cloneState(prevState);
  const clock =
    'clock' in action && action.clock ? action.clock : next.currentClock;
  next.currentClock = clock;

  switch (action.type) {
    case 'SIGN_CONTRACT': {
      const r = next.roommates[action.roommateId];
      r.contractSigned = true;
      r.lastActionNote = `${clock} 已按下红手印，押金 ${formatYuan(r.balanceCents)} 锁定生效`;
      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'success',
        message: `${r.shortName}已立下 07:00 早起毒誓！`,
      };
      break;
    }

    case 'SIGN_ALL_AND_START_ALARM': {
      const alarmClock = action.clock ?? '07:00';
      next.currentClock = alarmClock;
      next.isDaySettled = false;
      for (const id of ROOMMATE_IDS) {
        const r = next.roommates[id];
        r.contractSigned = true;
        if (r.status === 'sleeping' || r.status === 'snoozing') {
          r.status = 'ringing_stage1';
          r.lastActionNote = `${alarmClock} 夺命闹钟炸响！请先解锁逃跑滑块`;
        }
      }
      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'danger',
        message: `${alarmClock} 404寝室夺命早八闹钟全面拉响！`,
      };
      break;
    }

    case 'TRIGGER_ALARM': {
      const targets = action.roommateIds ?? ROOMMATE_IDS;
      const triggeredNames: string[] = [];
      for (const id of targets) {
        const r = next.roommates[id];
        if (r.status !== 'awake' && r.status !== 'being_raided') {
          delete next.activeRaids[id];
          r.status = 'ringing_stage1';
          r.lastActionNote = `${clock} 闹钟轰炸中，正在与逃跑滑块搏斗`;
          triggeredNames.push(r.shortName);
        }
      }
      if (triggeredNames.length > 0) {
        next.isDaySettled = false;
        next.lastToast = {
          id: `toast-${next.revision}`,
          tone: 'warning',
          message: `已拉响 ${triggeredNames.join('、')} 的夺命闹钟！`,
        };
      }
      break;
    }

    case 'SLIDER_SLIP_PENALTY': {
      const r = next.roommates[action.roommateId];
      const penalty = action.penaltyCents ?? DEFAULT_SLIP_PENALTY_CENTS;
      r.slipCount += 1;
      const outcome = applyPenaltyTransfer(next, r.id, penalty);
      const summary = formatRecipientSummary(next, outcome);
      const reason = action.reason ?? '鲁莽扑抓滑块脱手回弹';
      r.lastActionNote = `${reason}（第 ${r.slipCount} 次手滑，-${formatYuan(outcome.actualDeductedCents)}）`;

      appendLedger(next, {
        clock,
        kind: 'slider_slip',
        actorId: r.id,
        fromId: r.id,
        toIds: outcome.splits.map((s) => s.roommateId),
        toPublicPool: outcome.toPublicPool,
        amountCents: outcome.actualDeductedCents,
        splits: outcome.splits,
        headline: `${r.shortName}滑块脱手回弹 · 滴血扣罚 ${formatYuan(outcome.actualDeductedCents)}`,
        detail: `${reason}。${summary}`,
      });

      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'warning',
        message: `${r.shortName}滑块松手倒退！扣罚 ${formatYuan(outcome.actualDeductedCents)}`,
        amountCents: outcome.actualDeductedCents,
      };
      break;
    }

    case 'COMPLETE_STAGE1_SLIDER': {
      const r = next.roommates[action.roommateId];
      delete next.activeRaids[r.id];
      if (action.preferredGame) {
        r.selectedGame = action.preferredGame;
      }
      r.status = 'wakeup_stage2';
      r.lastActionNote = `${clock} 已制服逃跑滑块，进入深度清醒益智大考`;
      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'info',
        message: `${r.shortName}通过第一关！请完成深度清醒小游戏核验`,
      };
      break;
    }

    case 'SELECT_STAGE2_GAME': {
      const r = next.roommates[action.roommateId];
      r.selectedGame = action.game;
      if (action.levelIndex !== undefined) {
        r.puzzleLevelIndex = Math.max(0, Math.min(2, Math.trunc(action.levelIndex)));
      }
      r.lastActionNote = `已切换至${action.game === 'flow' ? '「同色不交叉连线」' : '「无碰撞挪车出库」'}第 ${r.puzzleLevelIndex + 1} 关`;
      break;
    }

    case 'PUZZLE_COLLISION_PENALTY': {
      const r = next.roommates[action.roommateId];
      const penalty = action.penaltyCents ?? DEFAULT_COLLISION_PENALTY_CENTS;
      r.collisionCount += 1;
      const outcome = applyPenaltyTransfer(next, r.id, penalty);
      const summary = formatRecipientSummary(next, outcome);
      const detailText =
        action.detail ??
        (r.selectedGame === 'flow' ? '连线交叉误触异色线路' : '迷糊挪车擦碰室友电瓶车');
      r.lastActionNote = `${detailText}（-${formatYuan(outcome.actualDeductedCents)}）`;

      appendLedger(next, {
        clock,
        kind: 'puzzle_collision',
        actorId: r.id,
        fromId: r.id,
        toIds: outcome.splits.map((s) => s.roommateId),
        toPublicPool: outcome.toPublicPool,
        amountCents: outcome.actualDeductedCents,
        splits: outcome.splits,
        headline: `${r.shortName}迷糊操作失误 · 扣罚 ${formatYuan(outcome.actualDeductedCents)}`,
        detail: `${detailText}。${summary}`,
      });

      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'warning',
        message: `${r.shortName}${detailText}！扣款 ${formatYuan(outcome.actualDeductedCents)}`,
        amountCents: outcome.actualDeductedCents,
      };
      break;
    }

    case 'COMPLETE_STAGE2_PUZZLE': {
      const r = next.roommates[action.roommateId];
      delete next.activeRaids[r.id];
      r.status = 'awake';
      r.wakeupTime = clock;

      appendLedger(next, {
        clock,
        kind: 'wake_success',
        actorId: r.id,
        toIds: [r.id],
        amountCents: 0,
        headline: `${r.shortName}通关深度清醒核验 · 正式打卡成功！`,
        detail: `${r.shortName}于 ${clock} 彻底清醒，保住押金 ${formatYuan(r.balanceCents)} 并解锁分红与突袭查岗特权！`,
      });

      const claimedPool = distributePublicPoolToAwake(
        next,
        [r.id],
        clock,
        `${r.shortName}早起拔得头筹`
      );

      r.lastActionNote =
        claimedPool > 0
          ? `${clock} 清醒打卡成功！独揽早起奖池 +${formatYuan(claimedPool)}`
          : `${clock} 清醒打卡成功！正在坐等赖床室友发红包`;

      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'success',
        message:
          claimedPool > 0
            ? `${r.shortName}早起打卡成功，直接领走奖池 ${formatYuan(claimedPool)}！`
            : `${r.shortName}清醒打卡成功！已加入分钱阵营`,
        amountCents: claimedPool > 0 ? claimedPool : undefined,
      };
      break;
    }

    case 'OPEN_SNOOZE_TYPER': {
      const r = next.roommates[action.roommateId];
      if (r.status !== 'awake' && r.status !== 'being_raided') {
        r.previousStatusBeforeModal = r.status;
        r.status = 'snooze_typing';
        r.lastActionNote = `${clock} 试图贪睡 5 分钟，正在手打社死认怂书...`;
        next.lastToast = {
          id: `toast-${next.revision}`,
          tone: 'warning',
          message: `${r.shortName}点开了「贪睡 5 分钟」，手打认怂滴血计费开始！`,
        };
      }
      break;
    }

    case 'CANCEL_SNOOZE_TYPER': {
      const r = next.roommates[action.roommateId];
      if (r.status === 'snooze_typing') {
        r.status =
          r.previousStatusBeforeModal && r.previousStatusBeforeModal !== 'snooze_typing'
            ? r.previousStatusBeforeModal
            : 'ringing_stage1';
        r.lastActionNote = '放弃贪睡认怂，咬牙回到起床关卡';
      }
      break;
    }

    case 'SNOOZE_TICK_PENALTY': {
      const r = next.roommates[action.roommateId];
      const penalty = action.penaltyCents ?? DEFAULT_SNOOZE_TICK_CENTS;
      const outcome = applyPenaltyTransfer(next, r.id, penalty);
      const summary = formatRecipientSummary(next, outcome);
      const reason = action.reason ?? '手打认怂书犹豫超时/错字重打';
      r.lastActionNote = `${reason}，滴血扣款 -${formatYuan(outcome.actualDeductedCents)}`;

      appendLedger(next, {
        clock,
        kind: 'snooze_tick',
        actorId: r.id,
        fromId: r.id,
        toIds: outcome.splits.map((s) => s.roommateId),
        toPublicPool: outcome.toPublicPool,
        amountCents: outcome.actualDeductedCents,
        splits: outcome.splits,
        headline: `${r.shortName}认怂书滴血计费 · -${formatYuan(outcome.actualDeductedCents)}`,
        detail: `${reason}。${summary}`,
      });

      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'danger',
        message: `${r.shortName}认怂犹豫滴血 ${formatYuan(outcome.actualDeductedCents)}！`,
        amountCents: outcome.actualDeductedCents,
      };
      break;
    }

    case 'COMPLETE_SNOOZE': {
      const r = next.roommates[action.roommateId];
      const fee = action.snoozeFeeCents ?? DEFAULT_SNOOZE_FEE_CENTS;
      r.snoozeCount += 1;
      r.status = 'snoozing';
      const outcome = applyPenaltyTransfer(next, r.id, fee);
      const summary = formatRecipientSummary(next, outcome);
      r.lastActionNote = `${clock} 已手打社死认怂书换取 5 分钟贪睡（高危可被突袭！）`;

      appendLedger(next, {
        clock,
        kind: 'snooze_fee',
        actorId: r.id,
        fromId: r.id,
        toIds: outcome.splits.map((s) => s.roommateId),
        toPublicPool: outcome.toPublicPool,
        amountCents: outcome.actualDeductedCents,
        splits: outcome.splits,
        headline: `${r.shortName}完成社死认怂书 · 支付贪睡税 ${formatYuan(outcome.actualDeductedCents)}`,
        detail: `${r.shortName}第 ${r.snoozeCount} 次贪睡 5 分钟。${summary}`,
      });

      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'warning',
        message: `${r.shortName}交完贪睡税缩回被窝，清醒室友可随时发起突袭查岗！`,
        amountCents: outcome.actualDeductedCents,
      };
      break;
    }

    case 'ENTER_RELAPSE_SLEEP': {
      const r = next.roommates[action.roommateId];
      delete next.activeRaids[r.id];
      r.status = 'relapse_sleeping';
      r.lastActionNote = `${clock} 偷偷眯眼躺回被窝睡回笼觉，极易被室友查岗抓包！`;
      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'warning',
        message: `警报：${r.shortName}疑似缩回被窝睡回笼觉！`,
      };
      break;
    }

    case 'LAUNCH_RAID': {
      const raider = next.roommates[action.raiderId];
      const target = next.roommates[action.targetId];
      if (action.raiderId === action.targetId) {
        break;
      }
      if (next.activeRaids[target.id]) {
        next.lastToast = {
          id: `toast-${next.revision}`,
          tone: 'info',
          message: `${target.shortName}已在接受突袭查岗拷问中！`,
        };
        break;
      }
      if (!canBeRaided(target.status)) {
        next.lastToast = {
          id: `toast-${next.revision}`,
          tone: 'info',
          message: `${target.shortName}当前状态不可被突袭查岗`,
        };
        break;
      }

      const penaltyCents =
        action.penaltyCents !== undefined
          ? Math.max(0, Math.trunc(action.penaltyCents))
          : DEFAULT_RAID_PENALTY_CENTS;
      const timeLimitSec = action.timeLimitSec ?? DEFAULT_RAID_TIME_LIMIT_SEC;

      raider.raidsLaunched += 1;
      const prevTargetStatus = target.status;
      target.status = 'being_raided';
      target.lastActionNote = `正遭${raider.shortName}突袭查岗！限时 ${timeLimitSec}s 解开晃动乱序算术`;
      raider.lastActionNote = `${clock} 对${target.shortName}发起了夺命突袭查岗！`;

      next.activeRaids[target.id] = {
        id: `raid-${target.id}-${next.revision}`,
        raiderId: raider.id,
        targetId: target.id,
        timeLimitSec,
        penaltyCents,
        startedAtClock: clock,
        startedAtMs: action.startedAtMs ?? Date.now(),
        previousTargetStatus: prevTargetStatus,
      };

      appendLedger(next, {
        clock,
        kind: 'raid_launch',
        actorId: raider.id,
        toIds: [target.id],
        amountCents: 0,
        headline: `${raider.shortName} 突袭查岗 ${target.shortName}！`,
        detail: `${target.shortName}须在 ${timeLimitSec} 秒内通过晃动乱序键盘算术核验，否则扣罚 ${formatYuan(penaltyCents)}！`,
      });

      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'danger',
        message: `突袭警报！${raider.shortName}对${target.shortName}发起限时算术查岗！`,
      };
      break;
    }

    case 'SURVIVE_RAID': {
      const target = next.roommates[action.targetId];
      const raid = next.activeRaids[target.id];
      if (!raid) {
        break;
      }
      const raider = next.roommates[raid.raiderId];
      delete next.activeRaids[target.id];

      target.raidsSurvived += 1;
      target.status = 'awake';
      target.wakeupTime = target.wakeupTime ?? clock;

      appendLedger(next, {
        clock,
        kind: 'raid_survive',
        actorId: target.id,
        toIds: [target.id],
        amountCents: 0,
        headline: `${target.shortName}顶住晃动键盘反杀成功 · 押金毫发无损！`,
        detail: `成功化解${raider.shortName}的突袭查岗，保住剩余押金 ${formatYuan(target.balanceCents)} 并正式清醒！`,
      });

      const claimedPool = distributePublicPoolToAwake(
        next,
        [target.id],
        clock,
        `${target.shortName}查岗反杀清醒`
      );

      target.lastActionNote =
        claimedPool > 0
          ? `${clock} 反杀${raider.shortName}的突袭并领走公共奖池 +${formatYuan(claimedPool)}！`
          : `${clock} 顶住乱序键盘算术，成功保本并加入清醒阵营！`;

      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'success',
        message: `${target.shortName}成功算出乱序算术题！保住押金反杀${raider.shortName}！`,
      };
      break;
    }

    case 'FAIL_RAID': {
      const target = next.roommates[action.targetId];
      const raid = next.activeRaids[target.id];
      if (!raid) {
        break;
      }
      const raider = next.roommates[raid.raiderId];
      delete next.activeRaids[target.id];

      target.raidsFailed += 1;
      target.status = 'snoozing';

      // 优先奖励给发起人及已清醒室友；若发起人本身未处于 awake（如导播台强制触发），保底归入发起人或公共池
      const awakeRecipients = getAwakeRoommateIds(next, target.id, raider.id);
      const effectiveRecipients =
        awakeRecipients.length > 0 ? awakeRecipients : [raider.id];

      const actualDeductedCents = Math.min(raid.penaltyCents, target.balanceCents);
      target.balanceCents -= actualDeductedCents;
      target.totalPenaltyPaidCents += actualDeductedCents;

      const splits = splitCentsExact(actualDeductedCents, effectiveRecipients);
      for (const split of splits) {
        const rec = next.roommates[split.roommateId];
        rec.balanceCents += split.amountCents;
        rec.totalBonusEarnedCents += split.amountCents;
      }

      const splitDesc =
        splits.length > 0
          ? splits
              .map(
                (s) => `${next.roommates[s.roommateId].shortName} +${formatYuan(s.amountCents)}`
              )
              .join('、')
          : '押金已扣空（¥0.00）';

      target.lastActionNote = `${clock} 突袭查岗翻车！被扣罚 -${formatYuan(actualDeductedCents)}`;
      raider.lastActionNote = `${clock} 突袭${target.shortName}大获全胜！斩获查岗赏金`;

      appendLedger(next, {
        clock,
        kind: 'raid_penalty',
        actorId: raider.id,
        fromId: target.id,
        toIds: splits.map((s) => s.roommateId),
        amountCents: actualDeductedCents,
        splits,
        headline: `${target.shortName}突袭查岗失败 · 惨扣 ${formatYuan(actualDeductedCents)} 赏金！`,
        detail: `${raider.shortName}突袭得手！赏金分配：${splitDesc}`,
      });

      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'danger',
        message: `${target.shortName}算术核验失败！${formatYuan(actualDeductedCents)} 当场瓜分给清醒室友！`,
        amountCents: actualDeductedCents,
      };
      break;
    }

    case 'FORFEIT_SLEEP_PENALTY': {
      const r = next.roommates[action.roommateId];
      delete next.activeRaids[r.id];
      const penalty = action.penaltyCents ?? DEFAULT_SLACKER_FORFEIT_CENTS;
      const outcome = applyPenaltyTransfer(next, r.id, penalty);
      const summary = formatRecipientSummary(next, outcome);
      r.status = 'settled_slacker';
      r.lastActionNote = `${clock} 彻底赖床摆烂，赞助全寝早餐费 -${formatYuan(outcome.actualDeductedCents)}`;

      appendLedger(next, {
        clock,
        kind: 'slacker_forfeit',
        actorId: r.id,
        fromId: r.id,
        toIds: outcome.splits.map((s) => s.roommateId),
        toPublicPool: outcome.toPublicPool,
        amountCents: outcome.actualDeductedCents,
        splits: outcome.splits,
        headline: `${r.shortName}死睡超时违约 · 扣罚早餐基金 ${formatYuan(outcome.actualDeductedCents)}`,
        detail: `${r.shortName}无视闹钟继续呼呼大睡。${summary}`,
      });

      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'danger',
        message: `${r.shortName}死睡违约！赞助全寝早餐 ${formatYuan(outcome.actualDeductedCents)}`,
        amountCents: outcome.actualDeductedCents,
      };
      break;
    }

    case 'SETTLE_DAY': {
      const absentPenalty =
        action.absentPenaltyCents !== undefined
          ? Math.max(0, Math.trunc(action.absentPenaltyCents))
          : 1000;

      // 清理进行中的查岗并针对仍未起床且未结算的室友执行缺勤扣罚（若配置 absentPenalty > 0）
      next.activeRaids = {};

      for (const id of ROOMMATE_IDS) {
        const r = next.roommates[id];
        if (r.status === 'being_raided') {
          r.status = 'snoozing';
        }
        if (r.status !== 'awake' && r.status !== 'settled_slacker') {
          if (absentPenalty > 0) {
            const outcome = applyPenaltyTransfer(next, id, absentPenalty);
            if (outcome.actualDeductedCents > 0) {
              appendLedger(next, {
                clock,
                kind: 'slacker_forfeit',
                actorId: id,
                fromId: id,
                toIds: outcome.splits.map((s) => s.roommateId),
                toPublicPool: outcome.toPublicPool,
                amountCents: outcome.actualDeductedCents,
                splits: outcome.splits,
                headline: `${r.shortName}早八缺勤收官扣罚 · -${formatYuan(outcome.actualDeductedCents)}`,
                detail: formatRecipientSummary(next, outcome),
              });
            }
          }
          r.status = 'settled_slacker';
          r.lastActionNote = `${clock} 今日早起挑战失败，已计入早餐赞助榜`;
        }
      }

      // 若公共奖池仍有留存且存在已清醒室友，收官全额均分
      const awakeIds = getAwakeRoommateIds(next);
      if (next.publicPoolCents > 0 && awakeIds.length > 0) {
        distributePublicPoolToAwake(next, awakeIds, clock, '每日收官清算');
      }

      next.isDaySettled = true;
      appendLedger(next, {
        clock,
        kind: 'day_settled',
        toIds: awakeIds,
        amountCents: 0,
        headline: `${clock} 404 寝室今日早起鸡腿账单正式出炉！`,
        detail:
          awakeIds.length > 0
            ? `清醒赢家：${awakeIds.map((id) => next.roommates[id].shortName).join('、')}；总资金池 ${formatYuan(next.totalFundCents)} 100% 守恒闭合。`
            : `全员赖床团灭！公共池滚存 ${formatYuan(next.publicPoolCents)}。`,
      });

      next.lastToast = {
        id: `toast-${next.revision}`,
        tone: 'success',
        message: '404 寝室今日鸡腿分红账单已结算生成！',
      };
      break;
    }
  }

  assertMoneyConservation(next);
  return next;
}

export function buildSettlementReport(state: DormState): DailySettlementReport {
  assertMoneyConservation(state);

  const rows: SettlementRow[] = ROOMMATE_IDS.map((id) => {
    const r = state.roommates[id];
    const netProfitCents = r.balanceCents - r.initialDepositCents;
    // 按食堂卤鸡腿 ¥5.00/个 折算直观体感
    const chickenDrumstickEquivalent = Number((netProfitCents / 500).toFixed(1));

    let verdictTitle = '精准保本早八人';
    let verdictTagTone: SettlementRow['verdictTagTone'] = 'neutral';

    if (netProfitCents >= 800) {
      verdictTitle = '404 鸡腿收割机';
      verdictTagTone = 'winner';
    } else if (netProfitCents > 0) {
      verdictTitle = '早起分红赢家';
      verdictTagTone = 'winner';
    } else if (netProfitCents <= -1000) {
      verdictTitle = '全寝早餐慈善总冠名';
      verdictTagTone = 'loser';
    } else if (netProfitCents < 0) {
      verdictTitle = '赖床滴血赞助商';
      verdictTagTone = 'loser';
    }

    return {
      roommateId: id,
      bedNumber: r.bedNumber,
      name: r.name,
      shortName: r.shortName,
      status: r.status,
      initialDepositCents: r.initialDepositCents,
      finalBalanceCents: r.balanceCents,
      netProfitCents,
      totalBonusEarnedCents: r.totalBonusEarnedCents,
      totalPenaltyPaidCents: r.totalPenaltyPaidCents,
      chickenDrumstickEquivalent,
      verdictTitle,
      verdictTagTone,
    };
  });

  const sortedByProfit = [...rows].sort((a, b) => b.netProfitCents - a.netProfitCents);
  const mvpWinner = sortedByProfit[0];
  const topSponsor = sortedByProfit[sortedByProfit.length - 1];

  const totalTransferredCents = ROOMMATE_IDS.reduce(
    (acc, id) => acc + state.roommates[id].totalPenaltyPaidCents,
    0
  );

  return {
    dormName: state.dormName,
    settledClock: state.currentClock,
    totalFundCents: state.totalFundCents,
    publicPoolCents: state.publicPoolCents,
    totalTransferredCents,
    rows,
    mvpWinner,
    topSponsor,
  };
}
