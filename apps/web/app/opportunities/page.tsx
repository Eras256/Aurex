'use client';

import React, { useState } from 'react';


import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useWebSocket } from '../WebSocketContext';

export default function OpportunitiesPage() {
  const { state } = useWebSocket();
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
            Live Arbitrage Opportunities
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Real-time feed of candidate spreads evaluated by the core valuation loops.
          </p>
        </div>

        {/* Tab Filters */}
        <Tabs value={filter} onValueChange={(val) => setFilter(val as any)} className="self-start">
          <TabsList>
            <TabsTrigger value="ALL">All Feeds</TabsTrigger>
            <TabsTrigger value="EXECUTED">Executed</TabsTrigger>
            <TabsTrigger value="SKIPPED">Skipped</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* OPPORTUNITIES TABLE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xs">Live Opportunities</CardTitle>
          <CardDescription className="text-[10px] font-mono">Calculated from order book snapshots</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 py-3">TIMESTAMP</TableHead>
                <TableHead className="px-4 py-3">DIRECTION</TableHead>
                <TableHead className="px-4 py-3 text-right">ASK (BUY)</TableHead>
                <TableHead className="px-4 py-3 text-right">BID (SELL)</TableHead>
                <TableHead className="px-4 py-3 text-right">GROSS SPREAD</TableHead>
                <TableHead className="px-4 py-3 text-right">NET SPREAD</TableHead>
                <TableHead className="px-4 py-3 text-right">MAX VOLUME</TableHead>
                <TableHead className="px-4 py-3 text-right">EST PROFIT</TableHead>
                <TableHead className="px-4 py-3">STATUS</TableHead>
                <TableHead className="px-4 py-3">DECISION REASON</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOpps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-slate-500">
                    No evaluated opportunities found matching active filter.
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
                    <TableCell className="px-4 py-2.5 text-right text-amber-500 font-semibold">
                      ${opp.netSpread.toFixed(2)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right text-slate-200 font-medium">
                      {opp.executableVolume.toFixed(2)} BTC
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right text-emerald-400 font-bold">
                      +${opp.expectedNetProfitUSD.toFixed(2)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <Badge variant={opp.status === 'EXECUTED' ? 'success' : 'destructive'}>
                        {opp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 max-w-[200px] truncate text-slate-400 text-[11px]" title={opp.reason}>
                      {opp.reason || 'Sized and Executed Successfully'}
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
