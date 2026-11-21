import {
  assertMoneyConservation,
  createInitialDormState,
  dormReducer,
} from './dormEngine';
import { DormState, StoryActDefinition } from '../types/dorm';

function buildAct1(): DormState {
  const s = createInitialDormState({ clock: '23:30' });
  s.currentActId = 1;
  s.actBanner =
    '第1幕 · 23:30 深夜立毒誓：4人交齐 ¥200.00 押金池，立下 07:00 早起军令状！';
  // 让主角阿强保留待按手印状态，方便现场评委/演讲者第一幕亲手按下红手印开启挑战
  s.roommates.qiang.contractSigned = false;
  s.roommates.qiang.lastActionNote = '¥50.00 已托管入池，请按下红手印激活明早 07:00 夺命闹钟';
  assertMoneyConservation(s);
  return s;
}

function buildAct2(): DormState {
  let s = createInitialDormState({ clock: '23:30' });
  // 06:59 卷王老张抢先通关，坐等室友掉钱
  s = dormReducer(s, {
    type: 'COMPLETE_STAGE1_SLIDER',
    roommateId: 'zhang',
    clock: '06:58',
  });
  s = dormReducer(s, {
    type: 'COMPLETE_STAGE2_PUZZLE',
    roommateId: 'zhang',
    clock: '06:59',
  });
  // 07:00 闹钟全面炸响：阿强与小李进入第一关「逃跑滑块」，阿伟继续沉睡
  s = dormReducer(s, {
    type: 'TRIGGER_ALARM',
    roommateIds: ['qiang', 'li'],
    clock: '07:00',
  });
  s.currentActId = 2;
  s.actBanner =
    '第2幕 · 07:00 夺命闹钟与逃跑滑块：阿强被吵醒，面对躲避手指+松手急速倒退的打卡滑块！';
  s.lastToast = {
    id: 'toast-act-2',
    tone: 'danger',
    message: '07:00 夺命闹钟拉响！老张已就位等分钱，阿强快稳住逃跑滑块！',
  };
  assertMoneyConservation(s);
  return s;
}

function buildAct3(): DormState {
  let s = buildAct2();
  // 阿强手滑两次被扣 ¥1.00 给老张，崩溃点开「贪睡 5 分钟」进入手打羞耻认怂书
  s = dormReducer(s, {
    type: 'SLIDER_SLIP_PENALTY',
    roommateId: 'qiang',
    penaltyCents: 100,
    reason: '迷糊直扑滑块连续脱手回弹',
    clock: '07:01',
  });
  s = dormReducer(s, {
    type: 'OPEN_SNOOZE_TYPER',
    roommateId: 'qiang',
    clock: '07:02',
  });
  s = dormReducer(s, {
    type: 'SNOOZE_TICK_PENALTY',
    roommateId: 'qiang',
    penaltyCents: 100,
    reason: '面对社死认怂长文犹豫满 10 秒',
    clock: '07:02',
  });
  s.currentActId = 3;
  s.actBanner =
    '第3幕 · 07:02 贪睡的代价：阿强想再睡 5 分钟，被迫禁粘贴手打社死认怂书并滴血给老张发红包！';
  s.lastToast = {
    id: 'toast-act-3',
    tone: 'warning',
    message: '阿强正在手打认怂长文！每犹豫 10 秒自动给老张滴血转账 ¥1.00！',
    amountCents: 100,
  };
  assertMoneyConservation(s);
  return s;
}

function buildAct4(): DormState {
  let s = buildAct3();
  // 阿强被扣肉疼后取消贪睡，咬牙过掉滑块，进入深度清醒小游戏大考（连线/挪车二选一）
  s = dormReducer(s, {
    type: 'SNOOZE_TICK_PENALTY',
    roommateId: 'qiang',
    penaltyCents: 100,
    reason: '输错标点整段清空崩溃滴血',
    clock: '07:03',
  });
  s = dormReducer(s, { type: 'CANCEL_SNOOZE_TYPER', roommateId: 'qiang' });
  s = dormReducer(s, {
    type: 'COMPLETE_STAGE1_SLIDER',
    roommateId: 'qiang',
    preferredGame: 'flow',
    clock: '07:04',
  });
  // 同时小李交了贪睡税躲回被窝
  s = dormReducer(s, {
    type: 'COMPLETE_SNOOZE',
    roommateId: 'li',
    snoozeFeeCents: 200,
    clock: '07:04',
  });
  s.currentClock = '07:04';
  s.currentActId = 4;
  s.actBanner =
    '第4幕 · 07:04 深度清醒小游戏大考：阿强须在 30–60 秒内完成「同色不交叉连线」或「无碰撞挪车出库」才算真醒！';
  s.lastToast = {
    id: 'toast-act-4',
    tone: 'info',
    message: '深度清醒核验开启！可在「同色连线」与「无碰撞挪车」间自由切换挑战',
  };
  assertMoneyConservation(s);
  return s;
}

function buildAct5(): DormState {
  let s = buildAct4();
  // 07:05 阿强硬核通关小游戏，成功加入清醒分钱阵营！
  s = dormReducer(s, {
    type: 'COMPLETE_STAGE2_PUZZLE',
    roommateId: 'qiang',
    clock: '07:05',
  });
  // 07:07 死睡阿伟彻底赖床违约，¥15.00 早餐费当场均分给老张(+¥7.50)与阿强(+¥7.50)！
  s = dormReducer(s, {
    type: 'FORFEIT_SLEEP_PENALTY',
    roommateId: 'wei',
    penaltyCents: 1500,
    clock: '07:07',
  });
  // 07:07 小李偷偷眯眼睡回笼觉，07:08 被卷王老张发起「突袭查岗」！
  s = dormReducer(s, {
    type: 'ENTER_RELAPSE_SLEEP',
    roommateId: 'li',
    clock: '07:07',
  });
  s = dormReducer(s, {
    type: 'LAUNCH_RAID',
    raiderId: 'zhang',
    targetId: 'li',
    timeLimitSec: 40,
    penaltyCents: 1000,
    clock: '07:08',
  });
  s.currentActId = 5;
  s.actBanner =
    '第5幕 · 07:08 突袭查岗与鸡腿结算：小李遭晃动乱序键盘算术突袭，揭晓 404 寝室今日分红账单！';
  s.lastToast = {
    id: 'toast-act-5',
    tone: 'danger',
    message: '老张对回笼觉小李发起突袭查岗！阿强已逆袭回本并坐等瓜分 ¥10.00 赏金！',
    amountCents: 1000,
  };
  assertMoneyConservation(s);
  return s;
}

export const STORY_ACTS: StoryActDefinition[] = [
  {
    actId: 1,
    clock: '23:30',
    shortTitle: '幕一 · 深夜毒誓',
    title: '第1幕：23:30 深夜立毒誓',
    subtitle: '4人交齐 ¥200.00 押金池，立下 07:00 早起铁血契约',
    pitchCue: '展示小圈子熟人契约绑定，无需外部流量即可运转自愿受虐闭环。',
    recommendedRole: 'qiang',
    buildState: buildAct1,
  },
  {
    actId: 2,
    clock: '07:00',
    shortTitle: '幕二 · 逃跑滑块',
    title: '第2幕：07:00 夺命闹钟与逃跑滑块',
    subtitle: '阿强被吵醒，直扑会闪避、松手即倒退归零的反人类滑块',
    pitchCue: '演示机制一：专治半梦半醒肌肉记忆盲划，按住锚点匀速推进即可通关。',
    recommendedRole: 'qiang',
    buildState: buildAct2,
  },
  {
    actId: 3,
    clock: '07:02',
    shortTitle: '幕三 · 认怂滴血',
    title: '第3幕：07:02 贪睡的代价',
    subtitle: '想再睡 5 分钟？禁粘贴手打社死认怂书，犹豫每秒都在给老张发红包',
    pitchCue: '演示机制二：把廉价的贪睡按钮变成高精神成本+真实金钱滴血惩罚。',
    recommendedRole: 'qiang',
    buildState: buildAct3,
  },
  {
    actId: 4,
    clock: '07:04',
    shortTitle: '幕四 · 清醒大考',
    title: '第4幕：07:04 深度清醒小游戏大考',
    subtitle: '30–60 秒完成「同色小球不交叉连线」或「无碰撞挪车出库」才算真醒',
    pitchCue: '演示机制四 & 五：大脑皮层未开机绝对过不去，清醒人类 45 秒稳过。',
    recommendedRole: 'qiang',
    buildState: buildAct4,
  },
  {
    actId: 5,
    clock: '07:08',
    shortTitle: '幕五 · 突袭分钱',
    title: '第5幕：07:08 突袭查岗 & 早餐分红结算',
    subtitle: '老张突袭回笼觉小李（晃动乱序算术），揭晓 404 寝室今日鸡腿账单',
    pitchCue: '演示机制三 + 押金守恒结算单：早起阿强从亏钱逆袭成加鸡腿赢家！',
    recommendedRole: 'li',
    buildState: buildAct5,
  },
];

export function getStoryActById(actId: number): StoryActDefinition {
  return STORY_ACTS.find((a) => a.actId === actId) ?? STORY_ACTS[0];
}
