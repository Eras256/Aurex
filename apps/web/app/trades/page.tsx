'use client';

import React from 'react';


import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

import { useWebSocket } from '../WebSocketContext';

export default function TradesPage() {
  const { state, backendUrl } = useWebSocket();

  const trades = state?.trades || [];
  const totalTrades = state?.pnl?.totalTrades || 0;
  const winRate = state?.pnl?.winRate || 0;
  const accumulatedPnl = state?.pnl?.totalProfitUSD || 0;

  // Aggregate totals
  const totalFees = trades.reduce((acc, t) => acc + t.feesPaid, 0);
  const totalSlippage = trades.reduce((acc, t) => acc + t.slippagePaid, 0);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER */}
      <div className="pb-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Simulated Trade Ledger
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Audit logs of all risk-mitigated cross-venue arbitrage executions completed by the engine.
          </p>
        </div>

        {/* CSV Export Trigger */}
        <a href={`${backendUrl}/trades/export`} download className="self-start">
          <Button variant="default" className="flex items-center gap-2">
            📥 Export Trades CSV
          </Button>
        </a>
      </div>

      {/* SUMMARY STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">SIM ACCUMULATED P&L</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className={`text-xl font-bold font-mono mt-1 ${accumulatedPnl >= 0 ? 'text-emerald-400 glow-text-green' : 'text-rose-400'}`}>
              {accumulatedPnl >= 0 ? '+' : ''}${accumulatedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">WIN RATE / COUNT</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-xl font-bold font-mono mt-1 text-white">
              {winRate.toFixed(1)}% <span className="text-xs text-slate-500 font-normal font-sans">({totalTrades} trades)</span>
            </h3>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">TOTAL TAKER FEES PAID</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-xl font-bold font-mono mt-1 text-slate-400">
              ${totalFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">SLIPPAGE SLIDE LOSS</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-xl font-bold font-mono mt-1 text-slate-400">
              ${totalSlippage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </CardContent>
        </Card>
      </div>

      {/* TRADES LIST TABLE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xs">Execution Ledger</CardTitle>
          <CardDescription className="text-[10px] font-mono">Real-time trade ledger logs</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6 py-3">TIMESTAMP</TableHead>
                <TableHead className="px-6 py-3">ROUTE</TableHead>
                <TableHead className="px-6 py-3 text-right">VOLUME</TableHead>
                <TableHead className="px-6 py-3 text-right">BUY PRICE</TableHead>
                <TableHead className="px-6 py-3 text-right">SELL PRICE</TableHead>
                <TableHead className="px-6 py-3 text-right">TAKER FEES</TableHead>
                <TableHead className="px-6 py-3 text-right">SLIPPAGE PAID</TableHead>
                <TableHead className="px-6 py-3 text-right font-semibold">NET PROFIT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                    No transactions executed yet. Awaiting a cross-venue window that clears all costs — adjust risk thresholds in Settings to widen the capture band.
                  </TableCell>
                </TableRow>
              ) : (
                trades.map((t) => (
                  <TableRow key={t.id} className="hover:bg-white/5 transition-colors">
                    <TableCell className="px-6 py-2.5 text-slate-500">
                      {new Date(t.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="px-6 py-2.5">
                      <Badge variant="secondary">
                        {t.buyExchange} &rarr; {t.sellExchange}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-2.5 text-right font-medium text-slate-200">
                      {t.volume.toFixed(4)} BTC
                    </TableCell>
                    <TableCell className="px-6 py-2.5 text-right font-medium text-slate-300">
                      ${t.buyPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="px-6 py-2.5 text-right font-medium text-slate-300">
                      ${t.sellPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="px-6 py-2.5 text-right text-slate-500">${t.feesPaid.toFixed(2)}</TableCell>
                    <TableCell className="px-6 py-2.5 text-right text-slate-500">${t.slippagePaid.toFixed(2)}</TableCell>
                    <TableCell className="px-6 py-2.5 text-right text-emerald-400 font-bold glow-text-green">
                      +${t.netProfit.toFixed(2)}
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
