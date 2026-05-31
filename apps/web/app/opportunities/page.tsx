'use client';

import React, { useState, useEffect } from 'react';


import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MockDiagnostics } from '@/lib/ai/mock/mockDiagnostics';
import { OpportunityAIOutput } from '@/lib/ai/types';

import { useLanguage } from '../LanguageContext';
import { useWebSocket } from '../WebSocketContext';

export default function OpportunitiesPage() {
  const { state } = useWebSocket();
  const { t, language } = useLanguage();
  const [filter, setFilter] = useState<'ALL' | 'EXECUTED' | 'SKIPPED'>('ALL');

  const opportunities = state?.opportunities || [];

  const filteredOpps = opportunities.filter((o) => {
    if (filter === 'ALL') return true;
    return o.status === filter;
  });

  // AI Explainability State (Phase 1)
  const [selectedOpp, setSelectedOpp] = useState<any | null>(null);
  const [aiExplain, setAiExplain] = useState<OpportunityAIOutput | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!selectedOpp) {
      setAiExplain(null);
      return;
    }
    const fetchExplainability = async () => {
      setAiLoading(true);
      try {
        const grossVal = selectedOpp.grossSpread || 0;
        const netVal = selectedOpp.expectedNetProfitUSD || selectedOpp.netSpread || 0;
        const res = await MockDiagnostics.explainOpportunity({
          opportunityId: selectedOpp.id,
          buyVenue: selectedOpp.buyExchange,
          sellVenue: selectedOpp.sellExchange,
          grossSpreadUSD: grossVal,
          estimatedCostUSD: Math.max(0.5, grossVal - netVal),
        });
        setAiExplain(res);
      } catch (err) {
        console.error(err);
      } finally {
        setAiLoading(false);
      }
    };
    fetchExplainability();
  }, [selectedOpp]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER */}
      <div className="pb-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t('opps.title_header')}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {t('opps.subtitle_header')}
          </p>
        </div>

        {/* Tab Filters */}
        <Tabs value={filter} onValueChange={(val) => setFilter(val as 'ALL' | 'EXECUTED' | 'SKIPPED')} className="self-start">
          <TabsList>
            <TabsTrigger value="ALL">{t('opps.filter_all_label')}</TabsTrigger>
            <TabsTrigger value="EXECUTED">{t('opps.filter_executed_label')}</TabsTrigger>
            <TabsTrigger value="SKIPPED">{t('opps.filter_skipped_label')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* OPPORTUNITIES TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: OPPORTUNITIES TABLE */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs">{t('opps.title')}</CardTitle>
              <CardDescription className="text-[10px] font-mono">{t('opps.table_sub')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4 py-3">{t('table.timestamp')}</TableHead>
                    <TableHead className="px-4 py-3">{t('table.route')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('opps.col_ask_buy')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('opps.col_bid_sell')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('opps.col_gross')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('opps.col_net')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('opps.col_volume')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('opps.col_profit')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('opps.col_confidence')}</TableHead>
                    <TableHead className="px-4 py-3">{t('opps.col_status')}</TableHead>
                    <TableHead className="px-4 py-3">{t('opps.col_reason')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOpps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-10 text-center text-slate-500">
                        {t('opps.no_opps_filter')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOpps.map((opp) => (
                      <TableRow 
                        key={opp.id} 
                        onClick={() => setSelectedOpp(opp)}
                        className={`cursor-pointer hover:bg-white/5 transition-all ${
                          selectedOpp?.id === opp.id ? 'bg-amber-500/10 border-l-2 border-gold font-medium' : ''
                        }`}
                      >
                        <TableCell className="px-4 py-2.5 text-slate-500">
                          {new Date(opp.timestamp).toLocaleTimeString()}
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          <Badge variant="secondary">
                            {opp.buyExchange} &rarr; {opp.sellExchange}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right font-medium text-slate-200">
                          ${opp.buyAsk.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right font-medium text-slate-200">
                          ${opp.sellBid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right text-slate-400">
                          ${opp.grossSpread.toFixed(2)}
                        </TableCell>
                        <TableCell className={`px-4 py-2.5 text-right font-semibold ${opp.netSpread >= 0 ? 'text-amber-500' : 'text-slate-500'}`}>
                          {opp.netSpread >= 0 ? '' : '-'}${Math.abs(opp.netSpread).toFixed(2)}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right text-slate-200 font-medium">
                          {opp.executableVolume.toFixed(2)} BTC
                        </TableCell>
                        <TableCell className={`px-4 py-2.5 text-right font-bold ${opp.expectedNetProfitUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {opp.expectedNetProfitUSD >= 0 ? '+' : '-'}${Math.abs(opp.expectedNetProfitUSD).toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={`px-4 py-2.5 text-right font-mono text-[11px] ${
                            (opp.zScore ?? 0) >= 2
                              ? 'text-cyan-300'
                              : (opp.zScore ?? 0) >= 1
                                ? 'text-cyan-500/70'
                                : 'text-slate-500'
                          }`}
                          title={t('opps.zscore_tooltip')}
                        >
                          {opp.zScore !== undefined ? `${opp.zScore.toFixed(2)}σ` : '—'}
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          <Badge variant={opp.status === 'EXECUTED' ? 'success' : 'destructive'}>
                            {opp.status === 'EXECUTED' ? t('opps.executed') : t('opps.skipped')}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 max-w-[200px] truncate text-slate-400 text-[11px]" title={opp.reason}>
                          {opp.reason || t('opps.success_reason')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: AI EXPLAINABILITY */}
        <div className="lg:col-span-1">
          <Card glow className="border-amber-500/10 bg-slate-950/20 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
                <CardTitle className="text-xs uppercase font-mono tracking-wider">{t('widget.ai_explain')}</CardTitle>
              </div>
              <CardDescription className="text-[10px] font-mono mt-0.5">{t('widget.ai_explain_sub')}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-4">
              {aiLoading ? (
                <div className="space-y-3 animate-pulse py-4 font-mono text-[10px]">
                  <div className="h-4 bg-white/5 rounded w-3/4"></div>
                  <div className="h-4 bg-white/5 rounded w-1/2"></div>
                  <div className="h-20 bg-white/5 rounded w-full mt-4"></div>
                </div>
              ) : aiExplain && selectedOpp ? (
                <div className="space-y-4 font-mono text-[11px] leading-relaxed">
                  
                  {/* Rating Badge */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Execution Risk</span>
                    <Badge variant={aiExplain.executionRating === 'EXCELLENT' ? 'success' : aiExplain.executionRating === 'HIGH_RISK' ? 'warning' : 'destructive'} className="text-[9px] font-bold py-0.5 px-2 uppercase rounded">
                      {aiExplain.executionRating}
                    </Badge>
                  </div>

                  {/* Summary Text */}
                  <div className="border-t border-white/5 pt-3">
                    <span className="text-slate-500 font-bold uppercase text-[9px] block mb-1">Algorithmic Rationale</span>
                    <p className="text-slate-300 font-sans text-xs leading-normal bg-slate-950/40 p-3 rounded border border-white/5">
                      {language === 'es' ? aiExplain.explainabilitySummary.es : aiExplain.explainabilitySummary.en}
                    </p>
                  </div>

                  {/* Cost breakdown */}
                  <div className="border-t border-white/5 pt-3 space-y-2">
                    <span className="text-slate-500 font-bold uppercase text-[9px] block">Cost Drag Attribution</span>
                    <div className="space-y-1.5 text-[10px] text-slate-300">
                      <div className="flex justify-between">
                        <span>Taker Fee Drag:</span>
                        <span className="text-slate-100 font-bold">${aiExplain.costBreakdown.takerFeeUSD.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Slippage Safety Cushion:</span>
                        <span className="text-slate-100 font-bold">${aiExplain.costBreakdown.slippageBufferUSD.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Latency Risk Buffer:</span>
                        <span className="text-slate-100 font-bold">${aiExplain.costBreakdown.latencyRiskUSD.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4 text-[9px] text-slate-500 flex justify-between items-center">
                    <span>Audit Ref: AX-OPP-{selectedOpp.id.substring(0,6)}</span>
                    <Badge variant="outline" className="text-[8px] text-slate-400 font-mono py-0 px-1">{t('widget.ai_advisory_only')}</Badge>
                  </div>

                </div>
              ) : (
                <div className="text-slate-500 font-mono text-[10px] text-center py-12 leading-relaxed">
                  {language === 'es'
                    ? 'Seleccione una oportunidad de spread de la bitácora para auditar su explicación matemática y desglose de costos de ejecución.'
                    : 'Select a candidate spread from the log to audit its mathematical explainability and execution cost attribution.'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
