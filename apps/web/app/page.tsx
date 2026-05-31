'use client';

import Link from 'next/link';
import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';


import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

import { useWebSocket } from './WebSocketContext';

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950 border border-white/10 p-3 rounded-lg shadow-2xl font-mono text-[11px] text-slate-100">
        <p className="text-slate-500 uppercase text-[9px] mb-0.5">Timestamp</p>
        <p className="font-semibold text-white mb-2">{payload[0].payload.name}</p>
        <p className="text-slate-500 uppercase text-[9px] mb-0.5">Portfolio Equity</p>
        <p className="font-bold text-amber-500 text-sm">
          ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

export default function OverviewPage() {
  const { state } = useWebSocket();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Metric variables with sensible defaults
  const totalProfit = state?.pnl?.totalProfitUSD ?? 0;
  const equity = 100000 + totalProfit;
  const totalTrades = state?.pnl?.totalTrades ?? 0;
  const winRate = state?.pnl?.winRate ?? 0;
  const sharpeRatio = state?.pnl?.sharpeRatio ?? 0;
  const avgProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;
  
  const trades = state?.trades ?? [];
  const recentTrades = trades.slice(0, 5);

  // Memoize data for the Recharts AreaChart
  const chartData = useMemo(() => {
    const history = state?.pnl?.equityHistory ?? [];
    if (history.length === 0) {
      return [
        { name: 'Baseline', value: 100000 }
      ];
    }
    return history.map((h, i) => {
      const date = new Date(h.timestamp);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return {
        name: timeStr,
        value: h.value,
      };
    });
  }, [state?.pnl?.equityHistory]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. WELCOME BANNER & DESCRIPTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Aurex Console Overview
          </h2>
          <p className="mt-2 text-sm text-slate-400 max-w-3xl">
            Aurex is an institutional-grade platform for real-time Bitcoin arbitrage detection, execution simulation, and risk-aware market monitoring across multiple exchanges.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/markets" passHref legacyBehavior>
            <Button variant="outline" size="default">
              Monitor Order Books
            </Button>
          </Link>
          <Link href="/risk" passHref legacyBehavior>
            <Button variant="default" size="default">
              Adjust Risk Parameters
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. INSTITUTIONAL KPI CARDS */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: Equity */}
        <Card glow className="flex flex-col justify-between min-h-[110px]">
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">PORTFOLIO EQUITY</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-2xl font-bold font-mono tracking-tight text-amber-500 glow-text-gold">
              ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">100k USD Initial Reserve</span>
          </CardContent>
        </Card>

        {/* Card 2: Accumulated P&L */}
        <Card className="flex flex-col justify-between min-h-[110px]">
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">SIMULATED NET P&L</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className={`text-2xl font-bold font-mono tracking-tight ${totalProfit >= 0 ? 'text-emerald-400 glow-text-green' : 'text-rose-500'}`}>
              {totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">After Slippage & Fees</span>
          </CardContent>
        </Card>

        {/* Card 3: Win Rate */}
        <Card className="flex flex-col justify-between min-h-[110px]">
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">WIN RATE</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-2xl font-bold font-mono tracking-tight text-white">
              {winRate.toFixed(1)}%
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Slippage loss checks active</span>
          </CardContent>
        </Card>

        {/* Card 4: Total Trades */}
        <Card className="flex flex-col justify-between min-h-[110px]">
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">TOTAL TRADES</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-2xl font-bold font-mono tracking-tight text-white">
              {totalTrades}
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Avg: +${avgProfit.toFixed(2)} / trade</span>
          </CardContent>
        </Card>

        {/* Card 5: Sharpe Ratio */}
        <Card className="flex flex-col justify-between min-h-[110px]">
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">SHARPE RATIO</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-2xl font-bold font-mono tracking-tight text-white">
              {sharpeRatio.toFixed(2)}
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Risk-free rate: 0.0%</span>
          </CardContent>
        </Card>
      </div>

      {/* 3. PERFORMANCE CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-4">
          <CardHeader className="border-b-0 flex flex-row items-center justify-between pb-0">
            <div>
              <CardTitle className="text-xs">Cumulative PnL</CardTitle>
              <CardDescription className="text-[10px] font-mono">Calculated at each simulated execution block</CardDescription>
            </div>
            <Badge variant="success">REAL-TIME</Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[220px] w-full bg-slate-950/20 border border-white/5 rounded-lg p-2 block">
              {mounted ? (
                typeof window !== 'undefined' && (window as any).IS_PLAYWRIGHT ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-xs">
                    📊 Simulation Chart Active (E2E Mocked)
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#C89B3C" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#C89B3C" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="rgba(255,255,255,0.2)"
                        fontSize={9}
                        tickLine={false}
                        fontFamily="JetBrains Mono, monospace"
                        dy={10}
                      />
                      <YAxis
                        stroke="rgba(255,255,255,0.2)"
                        fontSize={9}
                        tickLine={false}
                        fontFamily="JetBrains Mono, monospace"
                        domain={['auto', 'auto']}
                        tickFormatter={(val) => `$${Math.round(val / 1000)}k`}
                        dx={-10}
                      />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#C89B3C"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorEquity)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )
              ) : (
                <div className="text-slate-500 font-mono text-xs">Initializing chart engine...</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SIDE CONTEXT SUMMARY */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-xs">Simulator Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-500 font-mono">CORE ALGORITHM:</span>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Evaluating multi-level order books to size arbitrage trades, verifying spreads after subtracting taker fees (Binance 0.1%, Kraken 0.26%), slippage safety, and transfer costs.
              </p>
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-500 font-mono">SIMULATION RULES:</span>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Trades are strictly non-custodial and simulation-only. Balances automatically reset when reserves drain or positions cap.
              </p>
            </div>
          </CardContent>
          <CardContent className="text-[10px] font-mono text-slate-500 border-t border-white/5 pt-3 mt-auto">
            Last Update: {state ? new Date().toLocaleTimeString() : 'Awaiting data...'}
          </CardContent>
        </Card>
      </div>

      {/* 4. RECENT TRADES LIST */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-xs">Recent Executions</CardTitle>
            <CardDescription className="text-[10px] font-mono">Real-time trade ledger logs</CardDescription>
          </div>
          <Link href="/trades" passHref legacyBehavior>
            <Button variant="link" size="sm">
              View All Ledger Logs &rarr;
            </Button>
          </Link>
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
                <TableHead className="px-6 py-3 text-right">GROSS P&L</TableHead>
                <TableHead className="px-6 py-3 text-right">NET P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTrades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                    Awaiting candidate trade opportunities... (Adjust risk thresholds to trigger logs)
                  </TableCell>
                </TableRow>
              ) : (
                recentTrades.map((t) => (
                  <TableRow key={t.id} className="hover:bg-white/5 transition-colors flash-row-green">
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
                    <TableCell className="px-6 py-2.5 text-right text-emerald-400 font-medium">
                      +${t.grossProfit.toFixed(2)}
                    </TableCell>
                    <TableCell className="px-6 py-2.5 text-right text-emerald-400 font-semibold glow-text-green">
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
