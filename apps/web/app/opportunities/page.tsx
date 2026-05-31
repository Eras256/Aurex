'use client';

import React, { useState } from 'react';


import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useLanguage } from '../LanguageContext';
import { useWebSocket } from '../WebSocketContext';

export default function OpportunitiesPage() {
  const { state } = useWebSocket();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<'ALL' | 'EXECUTED' | 'SKIPPED'>('ALL');

  const opportunities = state?.opportunities || [];

  const filteredOpps = opportunities.filter((o) => {
    if (filter === 'ALL') return true;
    return o.status === filter;
  });

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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xs">{t('opps.title')}</CardTitle>
          <CardDescription className="text-[10px] font-mono">{t('opps.table_sub')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
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
                  <TableRow key={opp.id} className="hover:bg-white/5 transition-colors">
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
                      title="Statistical confidence: z-score of this spread vs the pair's rolling history. Higher = more anomalously wide (stronger mean-reversion signal)."
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
  );
}
