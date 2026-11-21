import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ShameTyperProps } from './types';

export const SHAME_DECLARATIONS: string[] = [
  '我是404寝室最能赖床的菜狗，我自愿用早饭钱请室友吃豪华大鸡腿，绝不嘴硬耍赖皮！',
  '全寝室就我一个人还在被窝孵蘑菇，我向清醒的义父们低头认怂，求批准再眯五分钟！',
  '早八铃声响了八百遍我还不起，我的床垫涂了强力胶水，我愿掏押金给室友买冰美式！',
  '我承认我是被窝封印的懒猪本猪，室友去卷绩点我去梦周公，这波罚款分红我心服口服！',
  '宿管阿姨都在扫地了我还在流口水，感谢室友监督我早起，今天寝室奶茶基金由我赞助！',
];

interface FloatingBill {
  id: number;
  text: string;
}

export const ShameTyperModal: React.FC<ShameTyperProps> = ({
  roommateName,
  onCompleteSnooze,
  onTickPenalty,
  onCancel,
}) => {
  const [phraseIdx, setPhraseIdx] = useState<number>(0);
  const [inputValue, setInputValue] = useState<string>('');
  const [verifiedLen, setVerifiedLen] = useState<number>(0);
  const [mistakes, setMistakes] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [penaltyPaid, setPenaltyPaid] = useState<number>(0);

  const [cheatAlert, setCheatAlert] = useState<string | null>(null);
  const [typoAlert, setTypoAlert] = useState<string | null>(null);
  const [screenRedFlash, setScreenRedFlash] = useState<boolean>(false);
  const [floatingBills, setFloatingBills] = useState<FloatingBill[]>([]);
  const [isDone, setIsDone] = useState<boolean>(false);

  const isComposingRef = useRef<boolean>(false);
  const doneRef = useRef<boolean>(false);
  const penaltyPaidRef = useRef<number>(0);
  const mistakesRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const onTickPenaltyRef = useRef(onTickPenalty);
  onTickPenaltyRef.current = onTickPenalty;

  const billSeqRef = useRef<number>(1);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const targetText = SHAME_DECLARATIONS[phraseIdx];

  const triggerRedShake = useCallback(() => {
    setScreenRedFlash(true);
    setTimeout(() => {
      setScreenRedFlash(false);
    }, 520);
  }, []);

  // 每秒滴血计时器：每满 10 秒划扣 1 元犹豫税
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (doneRef.current) return;
      const nextSec = elapsedRef.current + 1;
      elapsedRef.current = nextSec;
      setElapsedSeconds(nextSec);

      if (nextSec > 0 && nextSec % 10 === 0) {
        const nextTotal = penaltyPaidRef.current + 1;
        penaltyPaidRef.current = nextTotal;
        setPenaltyPaid(nextTotal);
        onTickPenaltyRef.current(1, nextTotal, '犹豫税：贪睡磨蹭满10秒');

        const id = billSeqRef.current++;
        setFloatingBills((prev) => [
          ...prev.slice(-3),
          { id, text: '-¥1.00 分给清醒室友' },
        ]);
        window.setTimeout(() => {
          setFloatingBills((prev) => prev.filter((item) => item.id !== id));
        }, 1800);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // 自动聚焦输入框
  useEffect(() => {
    textareaRef.current?.focus();
  }, [phraseIdx]);

  // 触发反粘贴作弊惩罚：换一句更羞耻的宣言并清空重来
  const triggerPasteCheatPenalty = useCallback(() => {
    if (doneRef.current) return;
    isComposingRef.current = false;
    const nextMistakes = mistakesRef.current + 1;
    mistakesRef.current = nextMistakes;
    setMistakes(nextMistakes);
    setInputValue('');
    setVerifiedLen(0);
    setTypoAlert(null);
    setCheatAlert('检测到企图复制粘贴作弊！换一句更羞耻的重打！');
    setPhraseIdx((prev) => (prev + 1) % SHAME_DECLARATIONS.length);
    triggerRedShake();
  }, [triggerRedShake]);

  // 精确逐字符校验核心函数（兼容中文拼音输入法合成结束与直接键入）
  const validateCommittedString = useCallback(
    (candidate: string) => {
      if (doneRef.current) return;

      if (candidate.length === 0) {
        setVerifiedLen(0);
        return;
      }

      if (targetText.startsWith(candidate)) {
        setVerifiedLen(candidate.length);
        setCheatAlert(null);
        setTypoAlert(null);

        if (candidate === targetText) {
          doneRef.current = true;
          setIsDone(true);
          onCompleteSnooze({
            elapsedSeconds: elapsedRef.current,
            mistakes: mistakesRef.current,
            penaltyPaid: penaltyPaidRef.current,
          });
        }
        return;
      }

      // 定位第一个打错的字符位置，制造极致抓狂但清晰可感知的归零反馈
      let mismatchIdx = 0;
      while (
        mismatchIdx < candidate.length &&
        mismatchIdx < targetText.length &&
        candidate[mismatchIdx] === targetText[mismatchIdx]
      ) {
        mismatchIdx++;
      }
      const expectedChar = targetText[mismatchIdx] ?? '（已末尾）';
      const actualChar = candidate[mismatchIdx] ?? '';
      const isHalfWidthPunctMismatch =
        (expectedChar === '，' && actualChar === ',') ||
        (expectedChar === '！' && actualChar === '!');

      const nextMistakes = mistakesRef.current + 1;
      mistakesRef.current = nextMistakes;
      setMistakes(nextMistakes);
      setInputValue('');
      setVerifiedLen(0);
      setCheatAlert(null);
      setTypoAlert(
        isHalfWidthPunctMismatch
          ? `💥 标点半角错误！第 ${mismatchIdx + 1} 字必须用中文全角「${expectedChar}」，你打成了英文「${actualChar}」，整段瞬间归零！`
          : `💥 一字打错满盘皆输！第 ${mismatchIdx + 1} 字应为「${expectedChar}」，你打成了「${actualChar}」，已清空归零重打！`
      );
      triggerRedShake();
    },
    [onCompleteSnooze, targetText, triggerRedShake]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    // 检测突发超长插入（例如手机输入法剪贴板联想条一键粘贴整句）
    if (!isComposingRef.current && val.length - inputValue.length > 6) {
      triggerPasteCheatPenalty();
      return;
    }

    setInputValue(val);
    const nativeComposing =
      isComposingRef.current ||
      Boolean((e.nativeEvent as InputEvent | undefined)?.isComposing);

    if (!nativeComposing) {
      validateCommittedString(val);
    } else {
      // 拼音输入法组词期间，校验之前已确认的前缀未遭破坏
      const prefixToCheck = val.slice(0, verifiedLen);
      if (!targetText.startsWith(prefixToCheck)) {
        isComposingRef.current = false;
        validateCommittedString(val);
      }
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    validateCommittedString(e.currentTarget.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'x'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      if (e.key.toLowerCase() === 'v') {
        triggerPasteCheatPenalty();
      }
    }
  };

  const nextExpectedChar = targetText[verifiedLen] ?? '';
  const isNextFullWidthPunct = nextExpectedChar === '，' || nextExpectedChar === '！';
  const secondsToNextTax = 10 - (elapsedSeconds % 10);
  const taxBarPct = ((elapsedSeconds % 10) / 10) * 100;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={`relative w-full rounded-2xl border-2 p-4 transition-colors ${
        screenRedFlash
          ? 'border-[#EF4444] bg-[#450A0A]'
          : 'border-[#EF4444]/80 bg-[#0F172A]'
      } text-slate-100 shadow-2xl overflow-hidden`}
    >
      <style>{`
        @keyframes shame-quake {
          0%, 100% { transform: translate(0, 0); }
          15% { transform: translate(-7px, 2px); }
          30% { transform: translate(7px, -2px); }
          45% { transform: translate(-6px, -2px); }
          60% { transform: translate(6px, 2px); }
          80% { transform: translate(-4px, 0); }
        }
        @keyframes float-bill-up {
          0% { opacity: 0; transform: translateY(10px) scale(0.9); }
          18% { opacity: 1; transform: translateY(0px) scale(1.05); }
          80% { opacity: 1; transform: translateY(-22px) scale(1); }
          100% { opacity: 0; transform: translateY(-34px) scale(0.95); }
        }
      `}</style>

      {/* 头顶飘血动效：-¥1.00 分给清醒室友 */}
      <div className="pointer-events-none absolute top-2 right-3 z-30 flex flex-col items-end gap-1">
        {floatingBills.map((bill) => (
          <div
            key={bill.id}
            style={{ animation: 'float-bill-up 1.75s ease-out forwards' }}
            className="rounded-full bg-[#EF4444] px-3 py-1 text-xs font-black text-white shadow-[0_0_16px_rgba(239,68,68,0.8)] border border-[#FACC15]"
          >
            💸 {bill.text}
          </div>
        ))}
      </div>

      {/* 主体容器（支持打错瞬间剧烈抖动） */}
      <div style={screenRedFlash ? { animation: 'shame-quake 0.42s ease-in-out' } : undefined}>
        {/* 顶部标题与滴血状态 */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-[#EF4444] text-white text-xs font-black">
              贪睡认怂申请书
            </span>
            <span className="text-xs font-bold text-[#FACC15]">
              申请人：{roommateName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-300">⏱ {elapsedSeconds}s</span>
            <span className="px-2 py-0.5 rounded bg-red-950/90 border border-[#EF4444]/70 text-red-300 font-bold">
              已滴血 ¥{penaltyPaid.toFixed(2)}
            </span>
          </div>
        </div>

        {/* 10秒犹豫税倒计时条 */}
        <div className="mb-3 rounded-xl bg-slate-900/95 border border-slate-800 px-3 py-2">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-red-300 font-bold">
              🩸 犹豫磨蹭税：每满 10 秒自动扣 ¥1.00 分给清醒室友
            </span>
            <span className="font-mono font-bold text-[#FACC15]">
              {secondsToNextTax}s 后 -¥1.00
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FACC15] to-[#EF4444] transition-all duration-300"
              style={{ width: `${taxBarPct}%` }}
            />
          </div>
        </div>

        {/* 反复制粘贴红字警报 */}
        {cheatAlert && (
          <div className="mb-3 rounded-xl border-2 border-[#FACC15] bg-[#EF4444] px-3 py-2.5 text-center shadow-lg">
            <div className="text-sm font-black text-white tracking-wide">
              🚫 {cheatAlert}
            </div>
            <div className="text-[11px] text-amber-100 mt-0.5">
              系统已为您刷新社死宣言（第 {phraseIdx + 1}/{SHAME_DECLARATIONS.length} 套），请虔诚手打！
            </div>
          </div>
        )}

        {/* 错别字归零警报 */}
        {typoAlert && (
          <div className="mb-3 rounded-xl border border-[#EF4444] bg-[#EF4444]/20 px-3 py-2 text-xs font-bold text-red-200 leading-relaxed">
            {typoAlert}
          </div>
        )}

        {/* 逐字符实时高亮对照区（彻底禁止选中复制） */}
        <div className="mb-2.5 rounded-xl border border-slate-700 bg-slate-950/90 p-3 select-none">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
            <span>📜 请一字不差手打以下社死宣言（禁粘贴 · 错一字归零）：</span>
            <span className="font-mono text-[#FACC15] font-bold">
              {verifiedLen}/{targetText.length} 字
            </span>
          </div>

          <div className="flex flex-wrap gap-y-1.5 text-[15px] leading-relaxed font-bold tracking-wide">
            {Array.from(targetText).map((ch, idx) => {
              const isMatched = idx < verifiedLen;
              const isCurrent = idx === verifiedLen && !isDone;
              const isPunct = ch === '，' || ch === '！';
              return (
                <span
                  key={idx}
                  className={`inline-flex items-center justify-center min-w-[20px] px-0.5 rounded transition-colors ${
                    isMatched
                      ? 'bg-emerald-500/25 text-emerald-300 border-b-2 border-emerald-400'
                      : isCurrent
                        ? 'bg-[#FACC15] text-[#0F172A] font-black scale-110 shadow-[0_0_10px_#FACC15]'
                        : isPunct
                          ? 'text-[#FACC15] underline decoration-dotted'
                          : 'text-slate-300'
                  }`}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        </div>

        {/* 下一个待打字符醒目提示（解决全角/半角标点痛点，保证 100% 明确可通关） */}
        {!isDone && (
          <div className="mb-2.5 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-1.5 border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">当前第 {verifiedLen + 1} 字：</span>
              <span className="px-2 py-0.5 rounded bg-[#FACC15]/20 border border-[#FACC15]/60 text-[#FACC15] font-black text-sm">
                {nextExpectedChar}
              </span>
              {isNextFullWidthPunct && (
                <span className="text-[11px] font-bold text-amber-300">
                  （中文全角标点，勿输英文半角）
                </span>
              )}
            </div>
            <span className="text-[11px] font-mono text-red-300">
              累计归零 {mistakes} 次
            </span>
          </div>
        )}

        {/* 手打输入区 */}
        <textarea
          ref={textareaRef}
          rows={3}
          value={inputValue}
          disabled={isDone}
          onChange={handleChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleKeyDown}
          onPaste={(e) => {
            e.preventDefault();
            triggerPasteCheatPenalty();
          }}
          onDrop={(e) => {
            e.preventDefault();
            triggerPasteCheatPenalty();
          }}
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="在此老老实实逐字手打上方认怂书（粘贴必换题，打错一字立刻清空）…"
          className="w-full rounded-xl border-2 border-slate-700 focus:border-[#FACC15] focus:outline-none bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-500 leading-relaxed resize-none"
        />

        {/* 底部操作按钮：放弃贪睡立即起床 vs 状态说明 */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-emerald-400/70 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-2.5 text-xs font-extrabold text-emerald-300 transition-colors cursor-pointer"
          >
            😤 不睡了！放弃贪睡直接起床保押金
          </button>
          <div className="text-right text-[11px] text-slate-400 shrink-0">
            <div>全字匹配自动获批</div>
            <div className="text-[#FACC15] font-semibold">再睡 5 分钟特权</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShameTyperModal;
