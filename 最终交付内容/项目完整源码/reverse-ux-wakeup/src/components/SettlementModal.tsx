import React from 'react';
import { Award, CheckCircle2, Coins, ReceiptText, Skull, X } from 'lucide-react';
import {
  assertMoneyConservation,
  buildSettlementReport,
  formatSignedYuan,
  formatYuan,
} from '../core/dormEngine';
import { DormState } from '../types/dorm';

interface SettlementModalProps {
  dormState: DormState;
  onClose: () => void;
  onResetDay: () => void;
}

export function SettlementModal({
  dormState,
  onClose,
  onResetDay,
}: SettlementModalProps) {
  const report = buildSettlementReport(dormState);
  const conservation = assertMoneyConservation(dormState);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="flex max-h-[90%] w-full max-w-md flex-col overflow-hidden rounded-3xl border-2 border-[#FACC15] bg-[#0F172A] shadow-2xl">
        {/* Top Hazard Header */}
        <div className="hazard-stripes h-2.5 w-full shrink-0" />
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-3">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-[#FACC15]" />
            <div>
              <h3 className="text-sm font-black tracking-wide text-white">
                404 寝室今日鸡腿分红结算单
              </h3>
              <p className="text-[11px] text-slate-400">
                结算时刻 {report.settledClock} · 累计流转罚金{' '}
                <span className="font-mono font-bold text-[#FACC15]">
                  {formatYuan(report.totalTransferredCents)}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {/* MVP & Charity Highlights */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/25 p-3">
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <Award className="h-3.5 w-3.5" /> 今日鸡腿收割王
              </div>
              <div className="mt-1 text-sm font-black text-white">
                {report.mvpWinner.name}
              </div>
              <div className="mt-0.5 font-mono text-base font-black text-emerald-400">
                {formatSignedYuan(report.mvpWinner.netProfitCents)}
              </div>
              <div className="mt-0.5 text-[10px] text-emerald-300/80">
                约白嫖 {Math.max(0, report.mvpWinner.chickenDrumstickEquivalent)} 个大鸡腿
              </div>
            </div>

            <div className="rounded-2xl border border-red-500/40 bg-red-950/25 p-3">
              <div className="flex items-center gap-1 text-[11px] font-bold text-red-400">
                <Skull className="h-3.5 w-3.5" /> 早餐慈善总冠名
              </div>
              <div className="mt-1 text-sm font-black text-white">
                {report.topSponsor.name}
              </div>
              <div className="mt-0.5 font-mono text-base font-black text-red-400">
                {formatSignedYuan(report.topSponsor.netProfitCents)}
              </div>
              <div className="mt-0.5 text-[10px] text-red-300/80">
                痛失早饭钱，造福全寝室友
              </div>
            </div>
          </div>

          {/* 4 Roommates Balance Sheet */}
          <div className="space-y-2">
            {report.rows.map((row) => {
              const isGain = row.netProfitCents > 0;
              const isLoss = row.netProfitCents < 0;
              return (
                <div
                  key={row.roommateId}
                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/90 px-3.5 py-2.5"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                        {row.bedNumber}号床
                      </span>
                      <span className="text-xs font-extrabold text-white">
                        {row.name}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          row.verdictTagTone === 'winner'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : row.verdictTagTone === 'loser'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {row.verdictTitle}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      本金 {formatYuan(row.initialDepositCents)} · 分红 +
                      {formatYuan(row.totalBonusEarnedCents)} · 扣罚 -
                      {formatYuan(row.totalPenaltyPaidCents)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-black text-white">
                      {formatYuan(row.finalBalanceCents)}
                    </div>
                    <div
                      className={`font-mono text-xs font-bold ${
                        isGain
                          ? 'text-emerald-400'
                          : isLoss
                            ? 'text-red-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {formatSignedYuan(row.netProfitCents)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Strict Conservation Audit Stamp */}
          <div className="rounded-2xl border border-[#FACC15]/40 bg-[#FACC15]/10 px-3.5 py-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#FACC15]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> 契约账本守恒校验 100% 通过
              </span>
              <span className="font-mono">{formatYuan(conservation.actualTotalCents)}</span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-slate-300">
              4人余额合计 {formatYuan(conservation.totalBalancesCents)} + 公共待分池{' '}
              {formatYuan(conservation.publicPoolCents)} === 初始总池{' '}
              {formatYuan(conservation.expectedTotalCents)}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 border-t border-slate-800 bg-slate-950/95 p-3">
          <button
            type="button"
            onClick={() => {
              onResetDay();
              onClose();
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            <Coins className="h-4 w-4 text-[#FACC15]" /> 开启明日新一轮对赌
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-[#FACC15] py-2.5 text-xs font-black text-slate-950 hover:bg-yellow-300"
          >
            返回寝室账本
          </button>
        </div>
      </div>
    </div>
  );
}
