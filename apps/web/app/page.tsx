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


import { TriangularPanel } from '@/components/TriangularPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { RealAiAgent } from '@/lib/ai/realAiAgent';
import { DashboardAIOutput } from '@/lib/ai/types';

import { useLanguage } from './LanguageContext';
import { useWebSocket } from './WebSocketContext';

interface EquityTooltipEntry {
  value: number;
  payload: { name: string; value: number };
}
interface CustomTooltipProps {
  active?: boolean;
  payload?: EquityTooltipEntry[];
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
  const { t, language } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [aiAdvisory, setAiAdvisory] = useState<DashboardAIOutput | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const fetchAdvisory = async () => {
      setAiLoading(true);
      try {
        const latency = state?.metrics?.detectionLatencyMs ?? 0.85;
        const res = await RealAiAgent.generateAdvisory({
          rollingVolume24hUSD: 14500,
          currentSlippageBps: Math.round(latency * 8), // simulated slippage proxy from latency spikes
          meanComputeLatencyMs: latency,
          recentSpreads: [
            { venuePair: 'Binance-Bybit', grossSpreadBps: 12.4 },
            { venuePair: 'OKX-Kraken', grossSpreadBps: 8.5 }
          ]
        });
        setAiAdvisory(res);
      } catch (err) {
        console.error(err);
      } finally {
        setAiLoading(false);
      }
    };
    fetchAdvisory();
  }, [mounted, state?.metrics?.detectionLatencyMs]);

  // Metric variables with sensible defaults
  const totalProfit = state?.pnl?.totalProfitUSD ?? 0;
  
  let liveEquity = 100000 + totalProfit;
  if (state?.wallets && Object.keys(state.wallets).length > 0) {
    const btcPrice = state?.orderBooks?.['binance:BTCUSDT']?.asks?.[0]?.price || 62000;
    const venueIds = ['binance', 'kraken', 'coinbase', 'okx', 'bybit'];
    let totalUsdt = 0;
    let totalBtc = 0;
    venueIds.forEach((id) => {
      const w = state.wallets[id];
      if (w) {
        totalUsdt += (w.USDT?.free || 0) + (w.USDT?.locked || 0);
        totalBtc += (w.BTC?.free || 0) + (w.BTC?.locked || 0);
      }
    });
    liveEquity = totalUsdt + (totalBtc * btcPrice);
  }
  const equity = liveEquity;
  const totalTrades = state?.pnl?.totalTrades ?? 0;
  const winRate = state?.pnl?.winRate ?? 0;
  const sharpeRatio = state?.pnl?.sharpeRatio ?? 0;
  const avgProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;
  // A Sharpe ratio is only statistically meaningful with a real sample; below this many
  // trades we show "building (n/MIN)" rather than overstate a figure from a thin history.
  const SHARPE_MIN_TRADES = 20;
  const sharpeReady = totalTrades >= SHARPE_MIN_TRADES;

  // Real-time engine throughput / latency telemetry (criterion: speed of detection)
  const detectionLatency = state?.metrics?.detectionLatencyMs ?? 0;
  const evalsPerSecond = state?.metrics?.evalsPerSecond ?? 0;
  const opportunitiesDetected = state?.metrics?.opportunitiesDetected ?? 0;
  // Pure in-process evaluation time (the algorithm), reported sub-millisecond → show in µs.
  const computeLatencyUs = Math.round((state?.metrics?.computeLatencyMs ?? 0) * 1000);
  
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

  // Max drawdown: largest peak-to-trough decline of the equity curve, as a percent.
  // Computed client-side from the same equity history that drives the chart.
  const maxDrawdownPct = useMemo(() => {
    const history = state?.pnl?.equityHistory ?? [];
    if (history.length < 2) return 0;
    let peak = history[0].value;
    let maxDd = 0;
    for (const h of history) {
      if (h.value > peak) peak = h.value;
      if (peak > 0) {
        const dd = (peak - h.value) / peak;
        if (dd > maxDd) maxDd = dd;
      }
    }
    return maxDd * 100;
  }, [state?.pnl?.equityHistory]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* PREMIUM HERO SECTION */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl -z-10 pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl -z-10 pointer-events-none"></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                {t('home.terminal_badge')}
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mt-3">
                Aurex
              </h1>
              <p className="text-slate-300 text-sm md:text-base font-medium max-w-2xl mt-1.5 leading-relaxed">
                {t('home.hero_subtitle')}
              </p>
            </div>
            
            {/* Quick Metrics Strip */}
            <div className="flex flex-wrap gap-3 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                <span>{t('home.metric_venues')}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                <span>{t('home.metric_books')}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{t('home.metric_execution')}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse"></span>
                <span>{t('home.metric_strategy')}</span>
              </div>
            </div>
          </div>
          
          {/* CTA Navigation Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 self-start lg:self-center">
            <Link href="/opportunities" passHref legacyBehavior>
              <Button variant="default" size="lg" className="flex items-center gap-2 shadow-xl shadow-amber-500/10 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border border-amber-600/30">
                ⚡ {t('home.cta_opportunities')}
              </Button>
            </Link>
            <Link href="/trades" passHref legacyBehavior>
              <Button variant="outline" size="lg" className="flex items-center gap-2 border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold backdrop-blur-sm">
                💼 {t('home.cta_trades')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* INSTITUTIONAL CONTEXT BLOCK */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/20 border border-white/5 rounded-xl p-4 md:p-5">
        <div className="flex gap-3">
          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 text-sm">
            📡
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">{t('home.inst_bullet1_title')}</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-normal">
              {t('home.inst_bullet1_desc')}
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-sky-400/10 text-sky-400 border border-sky-400/20 text-sm">
            🧮
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">{t('home.inst_bullet2_title')}</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-normal">
              {t('home.inst_bullet2_desc')}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 text-sm">
            📈
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">{t('home.inst_bullet3_title')}</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-normal">
              {t('home.inst_bullet3_desc')}
            </p>
          </div>
        </div>
      </div>

      {/* 2. INSTITUTIONAL KPI CARDS */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
        {/* Card 1: Equity */}
        <Card glow className="flex flex-col justify-between min-h-[110px]">
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">{t('overview.portfolio_equity')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-2xl font-bold font-mono tracking-tight text-amber-500 glow-text-gold">
              ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">{t('overview.initial_reserve')}</span>
          </CardContent>
        </Card>

        {/* Card 2: Accumulated P&L */}
        <Card className="flex flex-col justify-between min-h-[110px]">
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">{t('overview.sim_net_pnl')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className={`text-2xl font-bold font-mono tracking-tight ${totalProfit >= 0 ? 'text-emerald-400 glow-text-green' : 'text-rose-500'}`}>
              {totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">{t('overview.after_slippage_fees')}</span>
          </CardContent>
        </Card>

        {/* Card 3: Win Rate */}
        <Card className="flex flex-col justify-between min-h-[110px]">
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">{t('overview.win_rate_label')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-2xl font-bold font-mono tracking-tight text-white">
              {winRate.toFixed(1)}%
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">{t('overview.win_rate_sub')}</span>
          </CardContent>
        </Card>

        {/* Card 4: Total Trades */}
        <Card className="flex flex-col justify-between min-h-[110px]">
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">{t('overview.total_trades')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-2xl font-bold font-mono tracking-tight text-white">
              {totalTrades}
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              {t('overview.avg_trade_prefix')} +${avgProfit.toFixed(2)} {t('overview.avg_trade_suffix')}
            </span>
          </CardContent>
        </Card>

        {/* Card 5: Sharpe Ratio */}
        <Card className="flex flex-col justify-between min-h-[110px]">
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">{t('overview.sharpe_ratio')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-2xl font-bold font-mono tracking-tight text-white">
              {sharpeReady ? sharpeRatio.toFixed(2) : '—'}
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              {sharpeReady ? t('overview.sharpe_sub') : `${t('overview.sharpe_building')} ${totalTrades}/${SHARPE_MIN_TRADES}`}
            </span>
          </CardContent>
        </Card>

        {/* Card 6: Detection Latency (speed criterion) */}
        <Card glow className="flex flex-col justify-between min-h-[110px]">
          <CardHeader className="p-4 border-b-0 pb-0">
            <CardTitle className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">{t('overview.detection_latency')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-2xl font-bold font-mono tracking-tight text-sky-400 glow-text-blue">
              {detectionLatency.toFixed(2)}<span className="text-sm text-slate-500"> ms</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              <span className="text-emerald-400/80">~{computeLatencyUs}µs {t('overview.compute')}</span> · {evalsPerSecond}/s {t('overview.books')} · {opportunitiesDetected.toLocaleString()} {t('overview.windows')}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 2b. TRIANGULAR ARBITRAGE (sophisticated single-venue strategy) */}
      <TriangularPanel />

      {/* 2c. INTEGRATED AI QUANT ADVISORY WIDGET (Phase 1) */}
      <Card glow className="border-amber-500/10 bg-slate-950/20 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
              <CardTitle className="text-xs uppercase font-mono tracking-wider">{t('widget.ai_advisor')}</CardTitle>
            </div>
            <CardDescription className="text-[10px] font-mono mt-0.5">{t('widget.ai_advisor_sub')}</CardDescription>
          </div>
          <Badge variant="outline" className="text-[9px] border-amber-500/25 text-amber-500 font-mono tracking-wider font-semibold uppercase animate-pulse">
            🛡️ {t('widget.ai_advisory_only')}
          </Badge>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          {aiLoading && !aiAdvisory ? (
            <div className="space-y-2 animate-pulse py-2">
              <div className="h-4 bg-white/5 rounded w-3/4"></div>
              <div className="h-3 bg-white/5 rounded w-1/2"></div>
            </div>
          ) : aiAdvisory ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
              
              {/* Telemetry Analysis */}
              <div className="md:col-span-2 space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block font-mono">
                  {language === 'es' ? 'Diagnósticos Continuos' : 'Rolling Diagnostics'}
                </span>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {language === 'en' ? aiAdvisory.telemetrySummary.en : aiAdvisory.telemetrySummary.es}
                </p>
              </div>

              {/* Sizing Recommendations */}
              <div className="space-y-1 font-mono text-center md:text-left border-t md:border-t-0 md:border-l border-white/5 md:pl-6 pt-3 md:pt-0">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                  {language === 'es' ? 'Suelo de Beneficio Recomendado' : 'Recommended Profit Floor'}
                </span>
                <h3 className="text-2xl font-bold tracking-tight text-amber-500 glow-text-gold">
                  ${aiAdvisory.recommendedProfitFloorUSD.toFixed(2)} <span className="text-xs text-slate-400 font-normal">USD</span>
                </h3>
                <span className="text-[9px] text-slate-500 block">
                  {language === 'es' ? 'Puntuación de Confianza:' : 'Confidence Score:'} {(aiAdvisory.sizingConfidenceScore * 100).toFixed(0)}%
                </span>
              </div>

              {/* Supervised Interaction Gate */}
              <div className="flex justify-end border-t md:border-t-0 md:border-l border-white/5 md:pl-6 pt-3 md:pt-0 shrink-0">
                <Link href="/copilot" passHref legacyBehavior>
                  <Button variant="default" className="w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border border-amber-600/30 text-[10px] px-4 py-2 rounded-lg font-mono">
                    ⚡ {t('widget.ai_review_btn')}
                  </Button>
                </Link>
              </div>

            </div>
          ) : (
            <div className="text-[10px] text-slate-500 font-mono text-center py-4">
              {language === 'es' ? 'Reconciliando feeds de telemetría limpios... Asesor de IA fuera de línea.' : 'Reconciling clean telemetry feeds... AI advisor offline.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. PERFORMANCE CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-4">
          <CardHeader className="border-b-0 flex flex-row items-center justify-between pb-0">
            <div>
              <CardTitle className="text-xs">{t('overview.pnl_chart_title')}</CardTitle>
              <CardDescription className="text-[10px] font-mono">{t('overview.pnl_chart_sub')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                {language === 'es' ? 'Drawdown máx' : 'Max drawdown'}:{' '}
                <span className="font-bold text-rose-400">{maxDrawdownPct.toFixed(2)}%</span>
              </span>
              <Badge variant="success">{t('overview.real_time')}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[220px] w-full bg-slate-950/20 border border-white/5 rounded-lg p-2 block">
              {mounted ? (
                typeof window !== 'undefined' && (window as unknown as { IS_PLAYWRIGHT?: boolean }).IS_PLAYWRIGHT ? (
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
            <CardTitle className="text-xs">{t('overview.sim_context')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-500 font-mono">{t('overview.core_algorithm')}</span>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {t('overview.core_algorithm_desc')}
              </p>
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-500 font-mono">{t('overview.sim_rules')}</span>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {t('overview.sim_rules_desc')}
              </p>
            </div>
          </CardContent>
          <CardContent className="text-[10px] font-mono text-slate-500 border-t border-white/5 pt-3 mt-auto">
            {t('overview.last_update')} {state ? new Date().toLocaleTimeString() : t('overview.awaiting_data')}
          </CardContent>
        </Card>
      </div>

      {/* 4. RECENT TRADES LIST */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-xs">{t('overview.recent_executions')}</CardTitle>
            <CardDescription className="text-[10px] font-mono">{t('overview.trade_ledger_sub')}</CardDescription>
          </div>
          <Link href="/trades" passHref legacyBehavior>
            <Button variant="link" size="sm">
              {t('overview.view_all_btn')}
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6 py-3">{t('table.timestamp')}</TableHead>
                <TableHead className="px-6 py-3">{t('table.route')}</TableHead>
                <TableHead className="px-6 py-3 text-right">{t('table.volume')}</TableHead>
                <TableHead className="px-6 py-3 text-right">{t('table.buy_price')}</TableHead>
                <TableHead className="px-6 py-3 text-right">{t('table.sell_price')}</TableHead>
                <TableHead className="px-6 py-3 text-right">{t('table.gross_pnl')}</TableHead>
                <TableHead className="px-6 py-3 text-right">{t('table.net_pnl')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTrades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                    {t('overview.awaiting_trades')}
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
