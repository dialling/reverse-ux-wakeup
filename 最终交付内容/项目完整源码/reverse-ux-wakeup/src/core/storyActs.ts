import {
  addMinutesToHHMM,
  assertMoneyConservation,
  createInitialDormState,
  DEFAULT_WAKE_TIME,
  dormReducer,
  isValidHHMM,
} from './dormEngine';
import { DormState, StoryActDefinition } from '../types/dorm';

function resolveWakeTime(wakeTime?: string): string {
  return isValidHHMM(wakeTime) ? wakeTime.trim() : DEFAULT_WAKE_TIME;
}

function buildAct1(wakeTime?: string): DormState {
  const T = resolveWakeTime(wakeTime);
  const s = createInitialDormState({ clock: '23:30', targetWakeTime: T });
  s.currentActId = 1;
  s.actBanner = `23:30 深夜立誓：4人交齐 ¥200.00 押金池，激活明早 ${T} 早起契约！`;
  s.roommates.qiang.contractSigned = false;
  s.roommates.qiang.lastActionNote = `¥50.00 已托管入池，请按下红手印激活明早 ${T} 早起契约`;
  assertMoneyConservation(s);
  return s;
}

function buildAct2(wakeTime?: string): DormState {
  const T = resolveWakeTime(wakeTime);
  const tMinus2 = addMinutesToHHMM(T, -2);
  const tMinus1 = addMinutesToHHMM(T, -1);

  let s = createInitialDormState({ clock: '23:30', targetWakeTime: T });
  s = dormReducer(s, {
    type: 'COMPLETE_STAGE1_SLIDER',
    roommateId: 'zhang',
    clock: tMinus2,
  });
  s = dormReducer(s, {
    type: 'COMPLETE_STAGE2_PUZZLE',
    roommateId: 'zhang',
    clock: tMinus1,
  });
  s = dormReducer(s, {
    type: 'TRIGGER_ALARM',
    roommateIds: ['qiang', 'li'],
    clock: T,
  });
  s.currentActId = 2;
  s.actBanner = `${T} 闹钟拉响：老张已清醒就位，阿强正在与防盲按打卡栓搏斗！`;
  s.lastToast = {
    id: 'toast-act-2',
    tone: 'danger',
    message: `${T} 夺命闹钟拉响！老张已就位等分钱，阿强快稳住打卡滑块！`,
  };
  assertMoneyConservation(s);
  return s;
}

function buildAct3(wakeTime?: string): DormState {
  const T = resolveWakeTime(wakeTime);
  const tPlus1 = addMinutesToHHMM(T, 1);
  const tPlus2 = addMinutesToHHMM(T, 2);

  let s = buildAct2(T);
  s = dormReducer(s, {
    type: 'SLIDER_SLIP_PENALTY',
    roommateId: 'qiang',
    penaltyCents: 100,
    reason: '迷糊直扑滑块连续脱手回弹',
    clock: tPlus1,
  });
  s = dormReducer(s, {
    type: 'OPEN_SNOOZE_TYPER',
    roommateId: 'qiang',
    clock: tPlus2,
  });
  s = dormReducer(s, {
    type: 'SNOOZE_TICK_PENALTY',
    roommateId: 'qiang',
    penaltyCents: 100,
    reason: '面对社死认怂长文犹豫满 10 秒',
    clock: tPlus2,
  });
  s.currentActId = 3;
  s.actBanner = `${tPlus2} 贪睡申请：阿强试图再睡 5 分钟，手打认怂宣言超时每秒给室友发红包！`;
  s.lastToast = {
    id: 'toast-act-3',
    tone: 'warning',
    message: '阿强正在手打认怂长文！每犹豫 10 秒自动给老张滴血转账 ¥1.00！',
    amountCents: 100,
  };
  assertMoneyConservation(s);
  return s;
}

function buildAct4(wakeTime?: string): DormState {
  const T = resolveWakeTime(wakeTime);
  const tPlus3 = addMinutesToHHMM(T, 3);
  const tPlus4 = addMinutesToHHMM(T, 4);

  let s = buildAct3(T);
  s = dormReducer(s, {
    type: 'SNOOZE_TICK_PENALTY',
    roommateId: 'qiang',
    penaltyCents: 100,
    reason: '输错标点整段清空崩溃滴血',
    clock: tPlus3,
  });
  s = dormReducer(s, { type: 'CANCEL_SNOOZE_TYPER', roommateId: 'qiang' });
  s = dormReducer(s, {
    type: 'COMPLETE_STAGE1_SLIDER',
    roommateId: 'qiang',
    preferredGame: 'flow',
    clock: tPlus4,
  });
  s = dormReducer(s, {
    type: 'COMPLETE_SNOOZE',
    roommateId: 'li',
    snoozeFeeCents: 200,
    clock: tPlus4,
  });
  s.currentClock = tPlus4;
  s.currentActId = 4;
  s.actBanner = `${tPlus4} 清醒核验：完成「同色不交叉连线」或「早高峰无碰撞挪车」即可锁定押金！`;
  s.lastToast = {
    id: 'toast-act-4',
    tone: 'info',
    message: '深度清醒核验开启！可在「同色连线」与「无碰撞挪车」间自由切换',
  };
  assertMoneyConservation(s);
  return s;
}

function buildAct5(wakeTime?: string): DormState {
  const T = resolveWakeTime(wakeTime);
  const tPlus5 = addMinutesToHHMM(T, 5);
  const tPlus7 = addMinutesToHHMM(T, 7);
  const tPlus8 = addMinutesToHHMM(T, 8);

  let s = buildAct4(T);
  s = dormReducer(s, {
    type: 'COMPLETE_STAGE2_PUZZLE',
    roommateId: 'qiang',
    clock: tPlus5,
  });
  s = dormReducer(s, {
    type: 'FORFEIT_SLEEP_PENALTY',
    roommateId: 'wei',
    penaltyCents: 1500,
    clock: tPlus7,
  });
  s = dormReducer(s, {
    type: 'ENTER_RELAPSE_SLEEP',
    roommateId: 'li',
    clock: tPlus7,
  });
  s = dormReducer(s, {
    type: 'LAUNCH_RAID',
    raiderId: 'zhang',
    targetId: 'li',
    timeLimitSec: 40,
    penaltyCents: 1000,
    clock: tPlus8,
  });
  s.currentActId = 5;
  s.actBanner = `${tPlus8} 寝室查岗与早餐分红：老张发起限时算术查岗，实时结算今日鸡腿账单！`;
  s.lastToast = {
    id: 'toast-act-5',
    tone: 'danger',
    message: '老张对回笼觉小李发起突袭查岗！阿强已逆袭回本并坐等瓜分 ¥10.00 赏金！',
    amountCents: 1000,
  };
  assertMoneyConservation(s);
  return s;
}

export function getStoryActsForWakeTime(targetWakeTime?: string): StoryActDefinition[] {
  const T = resolveWakeTime(targetWakeTime);
  const t2 = addMinutesToHHMM(T, 2);
  const t4 = addMinutesToHHMM(T, 4);
  const t8 = addMinutesToHHMM(T, 8);

  return [
    {
      actId: 1,
      clock: '23:30',
      shortTitle: '深夜签约',
      title: '23:30 · 深夜签约',
      subtitle: `4人交齐 ¥200.00 押金池，锁定明早 ${T} 早起铁血契约`,
      pitchCue: '四人寝室内部契约托管，押金分红实时清算。',
      recommendedRole: 'qiang',
      buildState: (wt?: string) => buildAct1(wt ?? T),
    },
    {
      actId: 2,
      clock: T,
      shortTitle: '闹钟响起',
      title: `${T} · 闹钟响起`,
      subtitle: '阿强被闹钟唤醒，扣死安全栓匀速推过防盲按重力滑块',
      pitchCue: '拦截肌肉记忆盲划，按住锚点匀速推进解锁。',
      recommendedRole: 'qiang',
      buildState: (wt?: string) => buildAct2(wt ?? T),
    },
    {
      actId: 3,
      clock: t2,
      shortTitle: '申请贪睡',
      title: `${t2} · 申请贪睡`,
      subtitle: '申请再睡 5 分钟须手打认怂长文，超时犹豫每秒给清醒室友发红包',
      pitchCue: '把廉价的贪睡操作转化为高门槛手打与即时分红扣款。',
      recommendedRole: 'qiang',
      buildState: (wt?: string) => buildAct3(wt ?? T),
    },
    {
      actId: 4,
      clock: t4,
      shortTitle: '清醒核验',
      title: `${t4} · 清醒核验`,
      subtitle: '30–60 秒完成「同色小球不交叉连线」或「早高峰无碰撞挪车」打卡',
      pitchCue: '验证清醒专注度，通关立即保本并加入分红阵营。',
      recommendedRole: 'qiang',
      buildState: (wt?: string) => buildAct4(wt ?? T),
    },
    {
      actId: 5,
      clock: t8,
      shortTitle: '查岗结算',
      title: `${t8} · 查岗结算`,
      subtitle: '老张对回笼觉小李发起晃动乱序算术查岗，结算今日鸡腿分红账单',
      pitchCue: '室友实时互查防装醒，早起成员共享违约奖金。',
      recommendedRole: 'li',
      buildState: (wt?: string) => buildAct5(wt ?? T),
    },
  ];
}

export const STORY_ACTS: StoryActDefinition[] = getStoryActsForWakeTime(DEFAULT_WAKE_TIME);

export function getStoryActById(
  actId: number,
  targetWakeTime?: string
): StoryActDefinition {
  const acts = getStoryActsForWakeTime(targetWakeTime);
  return acts.find((a) => a.actId === actId) ?? acts[0];
}
