import { describe, expect, it } from 'vitest';
import {
  assertMoneyConservation,
  buildSettlementReport,
  createInitialDormState,
  dormReducer,
  formatSignedYuan,
  formatYuan,
  splitCentsExact,
} from './dormEngine';
import { STORY_ACTS } from './storyActs';
import { DormAction, ROOMMATE_IDS, RoommateId } from '../types/dorm';

describe('404 Dorm Money Conservation Engine', () => {
  it('initializes 4 roommates with ¥50.00 each and ¥200.00 total conserved pool', () => {
    const state = createInitialDormState();
    const report = assertMoneyConservation(state);

    expect(report.valid).toBe(true);
    expect(report.expectedTotalCents).toBe(20000);
    expect(report.totalBalancesCents).toBe(20000);
    expect(report.publicPoolCents).toBe(0);
    expect(ROOMMATE_IDS.map((id) => state.roommates[id].balanceCents)).toEqual([
      5000, 5000, 5000, 5000,
    ]);
    expect(formatYuan(state.totalFundCents)).toBe('¥200.00');
  });

  it('routes penalties into publicPoolCents when nobody is awake yet, then awards 100% to first wake-up pioneer', () => {
    let s = createInitialDormState();
    s = dormReducer(s, { type: 'SIGN_ALL_AND_START_ALARM', clock: '07:00' });

    // 尚无室友起床时：阿强手滑 -¥0.50、贪睡滴血 -¥1.00、完成贪睡 -¥2.00 -> 全部进入公共待分奖池 ¥3.50
    s = dormReducer(s, { type: 'SLIDER_SLIP_PENALTY', roommateId: 'qiang', penaltyCents: 50 });
    s = dormReducer(s, { type: 'OPEN_SNOOZE_TYPER', roommateId: 'qiang' });
    s = dormReducer(s, { type: 'SNOOZE_TICK_PENALTY', roommateId: 'qiang', penaltyCents: 100 });
    s = dormReducer(s, { type: 'COMPLETE_SNOOZE', roommateId: 'qiang', snoozeFeeCents: 200 });

    expect(s.roommates.qiang.balanceCents).toBe(4650);
    expect(s.publicPoolCents).toBe(350);
    assertMoneyConservation(s);

    // 老张率先完成两阶段起床 -> 立即独揽公共奖池 ¥3.50！
    s = dormReducer(s, { type: 'COMPLETE_STAGE1_SLIDER', roommateId: 'zhang', clock: '07:01' });
    s = dormReducer(s, { type: 'COMPLETE_STAGE2_PUZZLE', roommateId: 'zhang', clock: '07:02' });

    expect(s.publicPoolCents).toBe(0);
    expect(s.roommates.zhang.status).toBe('awake');
    expect(s.roommates.zhang.balanceCents).toBe(5350);
    assertMoneyConservation(s);
  });

  it('splits odd cents deterministically with zero floating-point drift when 3 roommates are awake', () => {
    const splits = splitCentsExact(1000, ['zhang', 'qiang', 'li']);
    expect(splits).toEqual([
      { roommateId: 'zhang', amountCents: 334 },
      { roommateId: 'qiang', amountCents: 333 },
      { roommateId: 'li', amountCents: 333 },
    ]);

    let s = createInitialDormState();
    for (const id of ['zhang', 'qiang', 'li'] as RoommateId[]) {
      s = dormReducer(s, { type: 'COMPLETE_STAGE1_SLIDER', roommateId: id });
      s = dormReducer(s, { type: 'COMPLETE_STAGE2_PUZZLE', roommateId: id });
    }

    // 阿伟连续被扣 1 分、7 分、1000 分，验证 3 人平分余数完全守恒
    s = dormReducer(s, { type: 'SNOOZE_TICK_PENALTY', roommateId: 'wei', penaltyCents: 1 });
    s = dormReducer(s, { type: 'SNOOZE_TICK_PENALTY', roommateId: 'wei', penaltyCents: 7 });
    s = dormReducer(s, { type: 'LAUNCH_RAID', raiderId: 'qiang', targetId: 'wei', penaltyCents: 1000 });
    s = dormReducer(s, { type: 'FAIL_RAID', targetId: 'wei' });

    expect(s.roommates.wei.balanceCents).toBe(5000 - 1008);
    // 发起查岗人 qiang 在 FAIL_RAID 时排首位拿余数 1 分 (334)，前两次 zhang 排首位拿余数
    const check = assertMoneyConservation(s);
    expect(check.actualTotalCents).toBe(20000);
  });

  it('caps deductions at remaining balance (never goes negative) under extreme continuous deductions', () => {
    let s = createInitialDormState();
    s = dormReducer(s, { type: 'COMPLETE_STAGE1_SLIDER', roommateId: 'zhang' });
    s = dormReducer(s, { type: 'COMPLETE_STAGE2_PUZZLE', roommateId: 'zhang' });

    // 对阿伟连扣 60 次 ¥1.00（超过其 ¥50.00 本金）
    for (let i = 0; i < 60; i++) {
      s = dormReducer(s, {
        type: 'SNOOZE_TICK_PENALTY',
        roommateId: 'wei',
        penaltyCents: 100,
      });
    }

    expect(s.roommates.wei.balanceCents).toBe(0);
    expect(s.roommates.zhang.balanceCents).toBe(10000);

    // 余额为 0 后再遭 ¥10.00 突袭失败，依然保持 0 元不穿仓
    s = dormReducer(s, {
      type: 'LAUNCH_RAID',
      raiderId: 'zhang',
      targetId: 'wei',
      penaltyCents: 1000,
    });
    s = dormReducer(s, { type: 'FAIL_RAID', targetId: 'wei' });

    expect(s.roommates.wei.balanceCents).toBe(0);
    expect(s.roommates.zhang.balanceCents).toBe(10000);
    assertMoneyConservation(s);

    // 测试非整十残余余额（如仅剩 ¥3.25 = 325 分时遭 ¥10.00 查岗失败）
    let s2 = createInitialDormState();
    s2 = dormReducer(s2, { type: 'COMPLETE_STAGE1_SLIDER', roommateId: 'zhang' });
    s2 = dormReducer(s2, { type: 'COMPLETE_STAGE2_PUZZLE', roommateId: 'zhang' });
    s2 = dormReducer(s2, { type: 'COMPLETE_STAGE1_SLIDER', roommateId: 'qiang' });
    s2 = dormReducer(s2, { type: 'COMPLETE_STAGE2_PUZZLE', roommateId: 'qiang' });
    s2 = dormReducer(s2, {
      type: 'FORFEIT_SLEEP_PENALTY',
      roommateId: 'li',
      penaltyCents: 4675, // 剩余 325 分 (¥3.25)
    });
    s2 = dormReducer(s2, { type: 'ENTER_RELAPSE_SLEEP', roommateId: 'li' });
    s2 = dormReducer(s2, {
      type: 'LAUNCH_RAID',
      raiderId: 'zhang',
      targetId: 'li',
      penaltyCents: 1000,
    });
    s2 = dormReducer(s2, { type: 'FAIL_RAID', targetId: 'li' });

    expect(s2.roommates.li.balanceCents).toBe(0);
    assertMoneyConservation(s2);
  });

  it('supports concurrent multi-roommate raids and protects against duplicate raid race conditions', () => {
    let s = createInitialDormState();
    // 老张与阿强均已清醒
    for (const id of ['zhang', 'qiang'] as RoommateId[]) {
      s = dormReducer(s, { type: 'COMPLETE_STAGE1_SLIDER', roommateId: id });
      s = dormReducer(s, { type: 'COMPLETE_STAGE2_PUZZLE', roommateId: id });
    }

    // 并发突袭：老张查岗小李，同时阿强查岗阿伟
    s = dormReducer(s, {
      type: 'LAUNCH_RAID',
      raiderId: 'zhang',
      targetId: 'li',
      penaltyCents: 1000,
      clock: '07:06',
    });
    s = dormReducer(s, {
      type: 'LAUNCH_RAID',
      raiderId: 'qiang',
      targetId: 'wei',
      penaltyCents: 1000,
      clock: '07:06',
    });

    // 重复对小李发起突袭应幂等忽略，不覆盖进行中的查岗
    const existingRaidId = s.activeRaids.li?.id;
    s = dormReducer(s, {
      type: 'LAUNCH_RAID',
      raiderId: 'qiang',
      targetId: 'li',
      penaltyCents: 2000,
    });
    expect(s.activeRaids.li?.id).toBe(existingRaidId);
    expect(Object.keys(s.activeRaids)).toHaveLength(2);

    // 小李顶住压力反杀保本（成为第 3 名清醒室友！）
    s = dormReducer(s, { type: 'SURVIVE_RAID', targetId: 'li', clock: '07:07' });
    expect(s.roommates.li.status).toBe('awake');
    expect(s.roommates.li.balanceCents).toBe(5000);

    // 阿伟查岗超时失败，¥10.00 由发起人阿强 + 老张 + 刚清醒的小李三人瓜分（334 + 333 + 333）！
    s = dormReducer(s, { type: 'FAIL_RAID', targetId: 'wei', clock: '07:07' });
    expect(s.roommates.wei.balanceCents).toBe(4000);
    expect(s.roommates.qiang.balanceCents).toBe(5334);
    expect(s.roommates.zhang.balanceCents).toBe(5333);
    expect(s.roommates.li.balanceCents).toBe(5333);
    assertMoneyConservation(s);
  });

  it('validates all 5 pitch story acts and daily settlement report generation', () => {
    expect(STORY_ACTS).toHaveLength(5);
    for (const act of STORY_ACTS) {
      const state = act.buildState();
      const check = assertMoneyConservation(state);
      expect(check.valid).toBe(true);
      expect(check.actualTotalCents).toBe(20000);
    }

    // 在第5幕基础上执行查岗失败 + 每日结算汇总单
    let act5 = STORY_ACTS[4].buildState();
    act5 = dormReducer(act5, { type: 'FAIL_RAID', targetId: 'li', clock: '07:09' });
    act5 = dormReducer(act5, { type: 'SETTLE_DAY', absentPenaltyCents: 0, clock: '07:10' });

    const settlement = buildSettlementReport(act5);
    expect(settlement.totalFundCents).toBe(20000);
    expect(settlement.mvpWinner.roommateId).toBe('zhang');
    expect(settlement.topSponsor.roommateId).toBe('wei');
    expect(formatSignedYuan(settlement.mvpWinner.netProfitCents)).toBe('+¥17.50');
    expect(
      settlement.rows.reduce((sum, r) => sum + r.finalBalanceCents, 0) +
        settlement.publicPoolCents
    ).toBe(20000);
  });

  it('passes 1,500-step deterministic pseudo-random fuzzing without ever violating conservation', () => {
    let seed = 4042026;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed;
    };
    const pickRoommate = (): RoommateId => ROOMMATE_IDS[rand() % ROOMMATE_IDS.length];

    let state = createInitialDormState();

    for (let step = 0; step < 1500; step++) {
      const r1 = pickRoommate();
      const r2 = pickRoommate();
      const roll = rand() % 14;
      let action: DormAction;

      switch (roll) {
        case 0:
          action = { type: 'TRIGGER_ALARM', roommateIds: [r1] };
          break;
        case 1:
          action = {
            type: 'SLIDER_SLIP_PENALTY',
            roommateId: r1,
            penaltyCents: (rand() % 237) + 1,
          };
          break;
        case 2:
          action = { type: 'COMPLETE_STAGE1_SLIDER', roommateId: r1 };
          break;
        case 3:
          action = {
            type: 'PUZZLE_COLLISION_PENALTY',
            roommateId: r1,
            penaltyCents: (rand() % 189) + 1,
          };
          break;
        case 4:
          action = { type: 'COMPLETE_STAGE2_PUZZLE', roommateId: r1 };
          break;
        case 5:
          action = { type: 'OPEN_SNOOZE_TYPER', roommateId: r1 };
          break;
        case 6:
          action = {
            type: 'SNOOZE_TICK_PENALTY',
            roommateId: r1,
            penaltyCents: (rand() % 313) + 1,
          };
          break;
        case 7:
          action = {
            type: 'COMPLETE_SNOOZE',
            roommateId: r1,
            snoozeFeeCents: (rand() % 401) + 1,
          };
          break;
        case 8:
          action = { type: 'ENTER_RELAPSE_SLEEP', roommateId: r1 };
          break;
        case 9:
          action = {
            type: 'LAUNCH_RAID',
            raiderId: r1,
            targetId: r2,
            penaltyCents: (rand() % 1500) + 1,
          };
          break;
        case 10:
          action = { type: 'SURVIVE_RAID', targetId: r1 };
          break;
        case 11:
          action = { type: 'FAIL_RAID', targetId: r1 };
          break;
        case 12:
          action = {
            type: 'SETTLE_DAY',
            absentPenaltyCents: rand() % 600,
          };
          break;
        default:
          action = step % 250 === 0 ? { type: 'RESET_DAY' } : { type: 'CANCEL_SNOOZE_TYPER', roommateId: r1 };
          break;
      }

      state = dormReducer(state, action);
      const report = assertMoneyConservation(state);
      expect(report.valid).toBe(true);
      expect(report.actualTotalCents).toBe(20000);
    }
  });
});
