import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  EvasiveGravitySlider,
  FlowConnectGame,
  FLOW_LEVELS,
  generateWakeupMathQuestion,
  ParkingJamGame,
  PARKING_LEVELS,
  RaidShakingKeypad,
  SHAME_DECLARATIONS,
  ShameTyperModal,
  shuffleDigits,
} from './index';

describe('Reverse UX Mechanisms Barrel & Data Integrity', () => {
  it('exports all 5 mechanism React function components and renders clean SSR markup', () => {
    expect(typeof EvasiveGravitySlider).toBe('function');
    expect(typeof ShameTyperModal).toBe('function');
    expect(typeof RaidShakingKeypad).toBe('function');
    expect(typeof FlowConnectGame).toBe('function');
    expect(typeof ParkingJamGame).toBe('function');

    const sliderHtml = renderToStaticMarkup(
      React.createElement(EvasiveGravitySlider, {
        roommateName: '早八阿强',
        onComplete: () => {},
      })
    );
    expect(sliderHtml).toContain('防梦游安全栓');
    expect(sliderHtml).toContain('绿色安全速度区');

    const typerHtml = renderToStaticMarkup(
      React.createElement(ShameTyperModal, {
        roommateName: '早八阿强',
        onCompleteSnooze: () => {},
        onTickPenalty: () => {},
        onCancel: () => {},
      })
    );
    expect(typerHtml).toContain('贪睡认怂申请书');
    expect(typerHtml).toContain('早八阿强');

    const raidHtml = renderToStaticMarkup(
      React.createElement(RaidShakingKeypad, {
        raiderName: '卷王老张',
        targetName: '回笼觉小李',
        onSurvive: () => {},
        onFailRaid: () => {},
      })
    );
    expect(raidHtml).toContain('卷王老张 怀疑你在装醒回笼觉，发起突袭查岗！');

    const flowHtml = renderToStaticMarkup(
      React.createElement(FlowConnectGame, {
        onWin: () => {},
      })
    );
    expect(flowHtml).toContain('清醒核验 · 连线');

    const parkingHtml = renderToStaticMarkup(
      React.createElement(ParkingJamGame, {
        onWin: () => {},
      })
    );
    expect(parkingHtml).toContain('清醒核验 · 挪车');
    expect(parkingHtml).toContain('E');
  });

  it('validates SHAME_DECLARATIONS length (36-46 chars) and full-width Chinese punctuation', () => {
    expect(SHAME_DECLARATIONS.length).toBeGreaterThanOrEqual(4);
    for (const sentence of SHAME_DECLARATIONS) {
      const charLen = Array.from(sentence).length;
      expect(charLen).toBeGreaterThanOrEqual(36);
      expect(charLen).toBeLessThanOrEqual(46);
      expect(sentence).toContain('，');
      expect(sentence).toContain('！');
    }
  });

  it('generates arithmetic questions strictly within positive integer range 10..99 and shuffles 0..9', () => {
    let prevDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < 120; i++) {
      const q = generateWakeupMathQuestion();
      expect(Number.isInteger(q.answer)).toBe(true);
      expect(q.answer).toBeGreaterThanOrEqual(10);
      expect(q.answer).toBeLessThanOrEqual(99);

      const nextDigits = shuffleDigits(prevDigits);
      expect(nextDigits).toHaveLength(10);
      expect([...nextDigits].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(nextDigits).not.toEqual(prevDigits);
      prevDigits = nextDigits;
    }
  });

  it('validates FlowConnect and ParkingJam level specs match tournament constraints', () => {
    expect(FLOW_LEVELS.map((l) => [l.size, l.pairs.length])).toEqual([
      [5, 5],
      [6, 5],
      [6, 6],
    ]);

    expect(PARKING_LEVELS).toHaveLength(3);
    for (const lv of PARKING_LEVELS) {
      expect(lv.gridSize).toBe(6);
      expect(lv.exitRow).toBe(2);
      expect(lv.optimalMoves).toBeGreaterThanOrEqual(9);
      expect(lv.optimalMoves).toBeLessThanOrEqual(15);
      const hero = lv.vehicles.find((v) => v.isHero);
      expect(hero).toBeDefined();
      expect(hero?.row).toBe(2);
      expect(hero?.axis).toBe('h');
      const obstacles = lv.vehicles.filter((v) => !v.isHero);
      expect(obstacles.length).toBeGreaterThanOrEqual(7);
      expect(obstacles.length).toBeLessThanOrEqual(9);
    }
  });
});
