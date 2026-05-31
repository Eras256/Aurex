'use client';

import React, { useState, useEffect } from 'react';


import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { MockDiagnostics } from '@/lib/ai/mock/mockDiagnostics';
import { TradeCritiqueOutput } from '@/lib/ai/types';

import { useLanguage } from '../LanguageContext';
import { useWebSocket } from '../WebSocketContext';

export default function TradesPage() {
  const { state, backendUrl } = useWebSocket();
  const { t, language } = useLanguage();

  const trades = state?.trades || [];
  const totalTrades = state?.pnl?.totalTrades || 0;
  const winRate = state?.pnl?.winRate || 0;
  const accumulatedPnl = state?.pnl?.totalProfitUSD || 0;

  // AI Critique State (Phase 1)
  const [selectedTrade, setSelectedTrade] = useState<any | null>(null);
  const [aiCritique, setAiCritique] = useState<TradeCritiqueOutput | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!selectedTrade) {
      setAiCritique(null);
      return;
    }
    const fetchCritique = async () => {
      setAiLoading(true);
      try {
        const res = await MockDiagnostics.critiqueTrade({
          tradeId: selectedTrade.id,
          elapsedExecutionMs: Math.round(selectedTrade.slippagePaid > 2.0 ? 65 : 12), // simulated latency based on actual slippage in row
          slippageUSD: selectedTrade.slippagePaid || 0,
        });
        setAiCritique(res);
      } catch (err) {
        console.error(err);
      } finally {
        setAiLoading(false);
      }
    };
    fetchCritique();
  }, [selectedTrade]);

  // Aggregate totals
  const totalFees = trades.reduce((acc, t) => acc + t.feesPaid, 0);
  const totalSlippage = trades.reduce((acc, t) => acc + t.slippagePaid, 0);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER */}
      <div className="pb-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t('trades.title_header')}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {t('trades.subtitle_header')}
          </p>
        </div>

        {/* CSV Export Trigger */}
        <a href={`${backendUrl}/trades/export`} download className="self-start">
          <Button variant="default" className="flex items-center gap-2">
            📥 {t('trades.export_btn')}
          </Button>
        </a>
      </div>

      {/* SUMMARY STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{t('trades.accumulated_pnl')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className={`text-xl font-bold font-mono mt-1 ${accumulatedPnl >= 0 ? 'text-emerald-400 glow-text-green' : 'text-rose-400'}`}>
              {accumulatedPnl >= 0 ? '+' : ''}${accumulatedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{t('trades.win_rate_count')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-xl font-bold font-mono mt-1 text-white">
              {winRate.toFixed(1)}% <span className="text-xs text-slate-500 font-normal font-sans">({totalTrades} {t('opps.filter_executed_label').toLowerCase()})</span>
            </h3>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{t('trades.total_fees')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-xl font-bold font-mono mt-1 text-slate-400">
              ${totalFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{t('trades.slippage_loss')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-xl font-bold font-mono mt-1 text-slate-400">
              ${totalSlippage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </CardContent>
        </Card>
      </div>

      {/* TRADES LIST TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: TRADES TABLE */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs">{t('trades.table_title')}</CardTitle>
              <CardDescription className="text-[10px] font-mono">{t('trades.table_sub')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="min-w-[850px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-6 py-3">{t('table.timestamp')}</TableHead>
                    <TableHead className="px-6 py-3">{t('table.route')}</TableHead>
                    <TableHead className="px-6 py-3 text-right">{t('trades.col_volume').toUpperCase()}</TableHead>
                    <TableHead className="px-6 py-3 text-right">{t('trades.col_buy_price').toUpperCase()}</TableHead>
                    <TableHead className="px-6 py-3 text-right">{t('trades.col_sell_price').toUpperCase()}</TableHead>
                    <TableHead className="px-6 py-3 text-right">{t('trades.col_fees').toUpperCase()}</TableHead>
                    <TableHead className="px-6 py-3 text-right">{t('trades.col_slippage').toUpperCase()}</TableHead>
                    <TableHead className="px-6 py-3 text-right font-semibold">{t('table.net_pnl')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                        {t('trades.no_trades_message')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    trades.map((tr) => (
                      <TableRow 
                        key={tr.id} 
                        onClick={() => setSelectedTrade(tr)}
                        className={`cursor-pointer hover:bg-white/5 transition-all ${
                          selectedTrade?.id === tr.id ? 'bg-amber-500/10 border-l-2 border-gold font-medium' : ''
                        }`}
                      >
                        <TableCell className="px-6 py-2.5 text-slate-500">
                          {new Date(tr.timestamp).toLocaleTimeString()}
                        </TableCell>
                        <TableCell className="px-6 py-2.5">
                          <Badge variant="secondary">
                            {tr.buyExchange === tr.sellExchange ? tr.symbol : `${tr.buyExchange} → ${tr.sellExchange}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-2.5 text-right font-medium text-slate-200">
                          {tr.volume.toFixed(4)} BTC
                        </TableCell>
                        <TableCell className="px-6 py-2.5 text-right font-medium text-slate-300">
                          ${tr.buyPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="px-6 py-2.5 text-right font-medium text-slate-300">
                          ${tr.sellPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="px-6 py-2.5 text-right text-slate-500">${tr.feesPaid.toFixed(2)}</TableCell>
                        <TableCell className="px-6 py-2.5 text-right text-slate-500">${tr.slippagePaid.toFixed(2)}</TableCell>
                        <TableCell className="px-6 py-2.5 text-right text-emerald-400 font-bold glow-text-green">
                          +${tr.netProfit.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: AI TRADE CRITIQUE */}
        <div className="lg:col-span-1">
          <Card glow className="border-amber-500/10 bg-slate-950/20 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
                <CardTitle className="text-xs uppercase font-mono tracking-wider">{t('widget.ai_critique')}</CardTitle>
              </div>
              <CardDescription className="text-[10px] font-mono mt-0.5">{t('widget.ai_critique_sub')}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-4">
              {aiLoading ? (
                <div className="space-y-3 animate-pulse py-4 font-mono text-[10px]">
                  <div className="h-4 bg-white/5 rounded w-3/4"></div>
                  <div className="h-4 bg-white/5 rounded w-1/2"></div>
                  <div className="h-20 bg-white/5 rounded w-full mt-4"></div>
                </div>
              ) : aiCritique && selectedTrade ? (
                <div className="space-y-4 font-mono text-[11px] leading-relaxed">
                  
                  {/* Efficiency Gauge score */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">VWAP Fill Efficiency</span>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {aiCritique.vwapEfficiencyScore}%
                      </span>
                      <Badge variant={aiCritique.vwapEfficiencyScore >= 90 ? 'success' : aiCritique.vwapEfficiencyScore >= 75 ? 'warning' : 'destructive'} className="text-[9px] font-bold py-0.5 px-2 uppercase rounded">
                        {aiCritique.vwapEfficiencyScore >= 90 ? 'EXCELLENT' : aiCritique.vwapEfficiencyScore >= 75 ? 'MARGINAL' : 'INEFFICIENT'}
                      </Badge>
                    </div>
                  </div>

                  {/* Summary Details Critique */}
                  <div className="border-t border-white/5 pt-3">
                    <span className="text-slate-500 font-bold uppercase text-[9px] block mb-1">Execution Post-Mortem</span>
                    <p className="text-slate-300 font-sans text-xs leading-normal bg-slate-950/40 p-3 rounded border border-white/5">
                      {language === 'es' ? aiCritique.critiqueDetails.es : aiCritique.critiqueDetails.en}
                    </p>
                  </div>

                  {/* Transaction info */}
                  <div className="border-t border-white/5 pt-3 space-y-1 text-[10px] text-slate-300">
                    <div className="flex justify-between">
                      <span>Latency Window:</span>
                      <span className="text-slate-100 font-bold">{selectedTrade.slippagePaid > 2.0 ? '65 ms' : '12 ms'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Slippage Paid:</span>
                      <span className="text-rose-400 font-bold">${selectedTrade.slippagePaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taker Fees Paid:</span>
                      <span className="text-slate-100 font-bold">${selectedTrade.feesPaid.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4 text-[9px] text-slate-500 flex justify-between items-center">
                    <span>Audit Ref: TX-{selectedTrade.id.substring(0,6)}</span>
                    <Badge variant="outline" className="text-[8px] text-slate-400 font-mono py-0 px-1">{t('widget.ai_advisory_only')}</Badge>
                  </div>

                </div>
              ) : (
                <div className="text-slate-500 font-mono text-[10px] text-center py-12 leading-relaxed">
                  {language === 'es'
                    ? 'Seleccione una transacción del libro de historial de ejecuciones para auditar su crítica de eficiencia y análisis de deslizamiento.'
                    : 'Select a transaction from the trade ledger to audit its execution efficiency critique and slippage analysis.'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
