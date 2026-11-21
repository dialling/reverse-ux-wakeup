import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { RaidKeypadProps } from './types';

export interface MathQuestion {
  expression: string;
  answer: number;
}

const DEFAULT_TIME_LIMIT_SEC = 45;
const MAX_ALLOWED_ERRORS = 4;
const REQUIRED_STREAK = 2;

export function shuffleDigits(prev?: number[]): number[] {
  const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    if (!prev || arr.some((d, idx) => d !== prev[idx])) {
      return [...arr];
    }
  }
  return [...arr];
}

export function generateWakeupMathQuestion(excludeExpr?: string): MathQuestion {
  for (let guard = 0; guard < 40; guard++) {
    const mode = guard % 3;
    let expression = '';
    let answer = 0;

    if (mode === 0) {
      // e.g. 16 × 3 - 9 = 39
      const a = 12 + Math.floor(Math.random() * 8); // 12..19
      const b = 2 + Math.floor(Math.random() * 3); // 2..4
      const c = 5 + Math.floor(Math.random() * 14); // 5..18
      answer = a * b - c;
      expression = `${a} × ${b} - ${c}`;
    } else if (mode === 1) {
      // e.g. 28 + 47 = 75 (带进位两位数加法)
      const a = 17 + Math.floor(Math.random() * 38); // 17..54
      const b = 16 + Math.floor(Math.random() * 39); // 16..54
      answer = a + b;
      expression = `${a} + ${b}`;
    } else {
      // e.g. 14 × 3 + 19 = 61
      const a = 11 + Math.floor(Math.random() * 7); // 11..17
      const b = 2 + Math.floor(Math.random() * 3); // 2..4
      const c = 7 + Math.floor(Math.random() * 21); // 7..27
      answer = a * b + c;
      expression = `${a} × ${b} + ${c}`;
    }

    if (answer >= 10 && answer <= 99 && expression !== excludeExpr) {
      return { expression, answer };
    }
  }
  return { expression: '16 × 3 - 9', answer: 39 };
}

export const RaidShakingKeypad: React.FC<RaidKeypadProps> = ({
  raiderName,
  targetName,
  timeLimitSec = DEFAULT_TIME_LIMIT_SEC,
  onSurvive,
  onFailRaid,
}) => {
  const [remainingSec, setRemainingSec] = useState<number>(timeLimitSec);
  const [question, setQuestion] = useState<MathQuestion>(() => generateWakeupMathQuestion());
  const [digits, setDigits] = useState<number[]>(() => shuffleDigits());
  const [inputStr, setInputStr] = useState<string>('');
  const [streak, setStreak] = useState<number>(0);
  const [mistakes, setMistakes] = useState<number>(0);
  const [shufflePulse, setShufflePulse] = useState<number>(0);
  const [feedback, setFeedback] = useState<{
    tone: 'neutral' | 'ok' | 'err';
    text: string;
  }>({
    tone: 'neutral',
    text: '⚠️ 每按一次数字或退格键，0–9 键位都会立即重新洗牌！请看准再按！',
  });
  const [resolved, setResolved] = useState<'none' | 'survived' | 'failed'>('none');

  const resolvedRef = useRef<boolean>(false);
  const remainingRef = useRef<number>(timeLimitSec);
  const mistakesRef = useRef<number>(0);
  const onFailRaidRef = useRef(onFailRaid);
  onFailRaidRef.current = onFailRaid;

  // 倒计时核验：归零立即触发 onFailRaid('timeout')
  useEffect(() => {
    remainingRef.current = timeLimitSec;
    setRemainingSec(timeLimitSec);

    const timer = window.setInterval(() => {
      if (resolvedRef.current) return;
      const next = remainingRef.current - 1;
      remainingRef.current = Math.max(0, next);
      setRemainingSec(Math.max(0, next));

      if (next <= 0) {
        resolvedRef.current = true;
        setResolved('failed');
        setFeedback({
          tone: 'err',
          text: '⏰ 查岗倒计时归零！判定装醒回笼觉实锤，押金当场瓜分！',
        });
        onFailRaidRef.current('timeout');
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [timeLimitSec]);

  const reshuffleNow = useCallback(() => {
    setDigits((prev) => shuffleDigits(prev));
    setShufflePulse((n) => n + 1);
  }, []);

  // 点击任意数字键：写入输入并立即重排 0–9 网格
  const handlePressDigit = (d: number) => {
    if (resolvedRef.current) return;
    setInputStr((prev) => {
      const next = prev.length >= 2 ? `${prev[1]}${d}` : `${prev}${d}`;
      return next;
    });
    reshuffleNow();
  };

  // 点击退格键：删一位并同样重排 0–9 网格
  const handleBackspace = () => {
    if (resolvedRef.current) return;
    setInputStr((prev) => prev.slice(0, -1));
    reshuffleNow();
  };

  // 提交当前算术答案
  const handleSubmit = () => {
    if (resolvedRef.current || inputStr.length === 0) return;
    const numericVal = Number.parseInt(inputStr, 10);

    if (numericVal === question.answer) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setInputStr('');

      if (nextStreak >= REQUIRED_STREAK) {
        resolvedRef.current = true;
        setResolved('survived');
        setFeedback({
          tone: 'ok',
          text: `🎉 连对 ${REQUIRED_STREAK} 题核验通过！${targetName} 头脑清醒，成功保住押金！`,
        });
        onSurvive({
          remainingSec: remainingRef.current,
          mistakes: mistakesRef.current,
        });
        return;
      }

      const nextQ = generateWakeupMathQuestion(question.expression);
      setQuestion(nextQ);
      reshuffleNow();
      setFeedback({
        tone: 'ok',
        text: '✅ 第 1 题正确！稳住心态，再算对最后 1 题即可击退查岗！',
      });
    } else {
      const nextMistakes = mistakesRef.current + 1;
      mistakesRef.current = nextMistakes;
      setMistakes(nextMistakes);
      setStreak(0);
      setInputStr('');

      if (nextMistakes >= MAX_ALLOWED_ERRORS) {
        resolvedRef.current = true;
        setResolved('failed');
        setFeedback({
          tone: 'err',
          text: `💥 累计答错满 ${MAX_ALLOWED_ERRORS} 次！查岗防御崩溃，押金被室友瓜分！`,
        });
        onFailRaid('too_many_errors');
        return;
      }

      const nextQ = generateWakeupMathQuestion(question.expression);
      setQuestion(nextQ);
      reshuffleNow();
      setFeedback({
        tone: 'err',
        text: `❌ 算错啦（刚才正解是 ${question.answer}）！连对进度归零，换题重算（失误 ${nextMistakes}/${MAX_ALLOWED_ERRORS}）！`,
      });
    }
  };

  const isUrgent = remainingSec <= 12 && resolved === 'none';

  return (
    <div className="w-full rounded-2xl border-2 border-[#EF4444] bg-[#0F172A] p-3.5 text-slate-100 shadow-2xl select-none overflow-hidden">
      <style>{`
        @keyframes raid-siren-blink {
          0%, 100% { background-color: rgba(239, 68, 68, 0.28); border-color: #EF4444; }
          50% { background-color: rgba(250, 204, 21, 0.25); border-color: #FACC15; }
        }
        @keyframes raid-keypad-sway {
          0%   { transform: translate(-5px, -2px) rotate(-3.2deg); }
          25%  { transform: translate(5px, 2px) rotate(3.4deg); }
          50%  { transform: translate(-6px, 2px) rotate(-2.8deg); }
          75%  { transform: translate(6px, -2px) rotate(3.5deg); }
          100% { transform: translate(-5px, -2px) rotate(-3.2deg); }
        }
      `}</style>

      {/* 顶部红灯爆闪突袭警报横幅 */}
      <div
        style={{ animation: 'raid-siren-blink 0.85s infinite ease-in-out' }}
        className="rounded-xl border-2 px-3 py-2.5 mb-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs font-black leading-snug text-white">
            🚨 {raiderName} 怀疑你在装醒回笼觉，发起突袭查岗！
          </div>
          <span
            className={`shrink-0 rounded-lg px-2 py-1 font-mono text-sm font-black ${
              isUrgent
                ? 'bg-[#EF4444] text-white animate-bounce'
                : 'bg-slate-950 text-[#FACC15] border border-[#FACC15]/60'
            }`}
          >
            {remainingSec}s
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-amber-200/90">
          <span>被查岗：{targetName}</span>
          <span>
            连对进度：<strong className="text-emerald-300">{streak}/{REQUIRED_STREAK}</strong> ·
            容错剩余：<strong className="text-red-300">{MAX_ALLOWED_ERRORS - mistakes}</strong> 次
          </span>
        </div>
      </div>

      {/* 算术题显示面板 + 当前输入显示屏 */}
      <div className="mb-2.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            第 {streak + 1} / {REQUIRED_STREAK} 道清醒算术（答案 10–99）
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-[#FACC15] mt-0.5">
            {question.expression} = ?
          </div>
        </div>

        {/* 两位答案输入液晶框 */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-400 mb-0.5">你的输入</span>
          <div className="min-w-[76px] h-11 rounded-xl border-2 border-[#FACC15] bg-slate-900 px-3 flex items-center justify-center font-mono text-2xl font-black text-white shadow-inner">
            {inputStr ? (
              <span>{inputStr}</span>
            ) : (
              <span className="text-slate-600 text-base">__</span>
            )}
          </div>
        </div>
      </div>

      {/* 反馈与乱序提示条 */}
      <div
        className={`mb-3 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold flex items-center justify-between gap-2 border ${
          feedback.tone === 'err'
            ? 'bg-[#EF4444]/20 border-[#EF4444] text-red-200'
            : feedback.tone === 'ok'
              ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200'
              : 'bg-slate-900 border-slate-700 text-slate-300'
        }`}
      >
        <span className="leading-snug">{feedback.text}</span>
        {shufflePulse > 0 && (
          <span className="shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FACC15]/20 text-[#FACC15]">
            洗牌#{shufflePulse}
          </span>
        )}
      </div>

      {/* 持续摇摆倾斜 + 按键即洗牌的数字键盘 */}
      <div className="px-2 py-2">
        <div
          style={
            resolved === 'none'
              ? { animation: 'raid-keypad-sway 2.3s infinite ease-in-out' }
              : undefined
          }
          className="grid grid-cols-3 gap-2"
        >
          {digits.slice(0, 9).map((digit) => (
            <button
              key={`slot-${digit}`}
              type="button"
              disabled={resolved !== 'none'}
              onClick={() => handlePressDigit(digit)}
              className="h-12 rounded-xl border-2 border-slate-700 bg-slate-800/95 hover:border-[#FACC15] active:bg-[#FACC15] active:text-[#0F172A] text-xl font-black font-mono text-white shadow-md transition-colors cursor-pointer"
            >
              {digit}
            </button>
          ))}

          {/* 第 4 行：退格（同样触发洗牌） | 第 10 个随机数字 | 确认核验 */}
          <button
            type="button"
            disabled={resolved !== 'none'}
            onClick={handleBackspace}
            className="h-12 rounded-xl border-2 border-amber-500/70 bg-amber-950/60 hover:bg-amber-900/60 active:scale-95 text-xs font-extrabold text-[#FACC15] shadow-md cursor-pointer flex items-center justify-center gap-1"
          >
            <span>⌫</span>
            <span>退格</span>
          </button>

          <button
            type="button"
            disabled={resolved !== 'none'}
            onClick={() => handlePressDigit(digits[9])}
            className="h-12 rounded-xl border-2 border-slate-700 bg-slate-800/95 hover:border-[#FACC15] active:bg-[#FACC15] active:text-[#0F172A] text-xl font-black font-mono text-white shadow-md transition-colors cursor-pointer"
          >
            {digits[9]}
          </button>

          <button
            type="button"
            disabled={resolved !== 'none' || inputStr.length === 0}
            onClick={handleSubmit}
            className={`h-12 rounded-xl border-2 text-xs font-black shadow-md transition-all flex items-center justify-center gap-1 ${
              inputStr.length > 0 && resolved === 'none'
                ? 'border-[#FACC15] bg-[#FACC15] text-[#0F172A] hover:bg-amber-300 active:scale-95 cursor-pointer'
                : 'border-slate-700 bg-slate-900 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>✓</span>
            <span>提交</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RaidShakingKeypad;
