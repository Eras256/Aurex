'use client';

import React from 'react';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

import { useLanguage } from '../app/LanguageContext';
import { useWebSocket } from '../app/WebSocketContext';

/**
 * Live single-venue triangular arbitrage panel (Binance USDT·BTC·ETH). Renders the cost-
 * aware cycle on every tick: the three taker legs, the gross edge, the ~3x fee drag, and
 * the resulting net edge — so the cycle is visibly skipped when it cannot clear its fees.
 */
export function TriangularPanel() {
  const { state } = useWebSocket();
  const { t } = useLanguage();
  const tri = state?.triangular;

  const fmtBps = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} bps`;

  return (
    <Card className="border border-white/5 bg-slate-950/20 backdrop-blur-md">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 text-lg">△</div>
          <div>
            <CardTitle className="text-sm font-mono font-bold uppercase tracking-wider text-slate-100">{t('tri.title')}</CardTitle>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5">{t('tri.subtitle')}</p>
          </div>
        </div>
        {tri?.available && (
          <span
            className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border uppercase tracking-wider self-start sm:self-auto ${
              tri.profitable
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-amber-500/90 bg-amber-500/5 border-amber-500/10'
            }`}
          >
            {tri.profitable ? t('tri.profitable') : t('tri.below_floor')}
          </span>
        )}
      </CardHeader>

      <CardContent className="pt-5">
        {!tri?.available ? (
          <p className="text-xs font-mono text-slate-500 py-4 text-center">{t('tri.unavailable')}</p>
        ) : (
          <div className="space-y-5">
            {/* Cycle legs */}
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">{tri.direction}</div>
              <div className="flex flex-wrap items-center gap-2">
                {tri.legs.map((leg, i) => (
                  <React.Fragment key={`${leg.pair}-${i}`}>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] font-mono text-xs">
                      <span className={leg.action === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>{leg.action}</span>
                      <span className="text-slate-200">{leg.pair}</span>
                      <span className="text-slate-500">@ {leg.price.toLocaleString('en-US', { maximumFractionDigits: 8 })}</span>
                    </div>
                    {i < tri.legs.length - 1 && <span className="text-slate-600 font-mono">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Edge math */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
              <div className="p-3 rounded-lg border border-white/5 bg-white/[0.01]">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">{t('tri.gross_edge')}</div>
                <div className="text-sm font-bold text-slate-200 mt-1">{fmtBps(tri.grossEdgeBps)}</div>
              </div>
              <div className="p-3 rounded-lg border border-white/5 bg-white/[0.01]">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">{t('tri.fee_cost')}</div>
                <div className="text-sm font-bold text-rose-400 mt-1">-{tri.feeBps.toFixed(2)} bps</div>
              </div>
              <div className="p-3 rounded-lg border border-white/5 bg-white/[0.01]">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">{t('tri.net_edge')}</div>
                <div className={`text-sm font-bold mt-1 ${tri.netEdgeBps > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtBps(tri.netEdgeBps)}</div>
              </div>
              <div className="p-3 rounded-lg border border-white/5 bg-white/[0.01]">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">{t('tri.notional')}</div>
                <div className="text-sm font-bold text-slate-200 mt-1">${tri.notionalUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="p-3 rounded-lg border border-white/5 bg-white/[0.01]">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">{t('tri.exp_profit')}</div>
                <div className={`text-sm font-bold mt-1 ${tri.expectedProfitUSD > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {tri.expectedProfitUSD >= 0 ? '+' : ''}${tri.expectedProfitUSD.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-white/5 bg-white/[0.01]">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">{t('tri.executed')}</div>
                <div className="text-sm font-bold text-sky-400 mt-1">{tri.executedCount}</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
