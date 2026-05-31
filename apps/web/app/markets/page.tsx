'use client';

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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useLanguage } from '../LanguageContext';
import { useWebSocket } from '../WebSocketContext';

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
}

const DepthTooltip = ({ active, payload }: CustomTooltipProps) => {
  const { t } = useLanguage();
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isBid = data.bids !== null;
    const type = isBid ? t('markets.top_bids') : t('markets.top_asks');
    const qty = isBid ? data.bids : data.asks;
    const colorClass = isBid ? 'text-emerald-400' : 'text-rose-400';

    return (
      <div className="bg-slate-950 border border-white/10 p-3 rounded-lg shadow-2xl font-mono text-[11px] text-slate-100">
        <p className="text-slate-500 uppercase text-[9px] mb-0.5">{t('markets.price')}</p>
        <p className="font-bold text-white mb-2">${data.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        <p className="text-slate-500 uppercase text-[9px] mb-0.5">{type}</p>
        <p className={`font-bold ${colorClass} text-sm`}>
          {qty.toFixed(4)} BTC
        </p>
      </div>
    );
  }
  return null;
};

export default function MarketsPage() {
  const { state } = useWebSocket();
  const { t, language } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [activeDepthExchange, setActiveDepthExchange] = useState('binance');

  // Interactive CEX comparative selectors
  const [sourceId, setSourceId] = useState('binance');
  const [targetId, setTargetId] = useState('kraken');

  useEffect(() => {
    setMounted(true);
  }, []);

  const EXCHANGES = useMemo(() => [
    { id: 'binance', name: 'Binance Spot', fee: 0.0004, key: 'binance:BTCUSDT', desc: 'VIP Taker: 0.04% | Refreshed @ 100ms' },
    { id: 'kraken', name: 'Kraken Spot', fee: 0.0010, key: 'kraken:BTCUSDT', desc: 'VIP Taker: 0.10% | Checksums Valid' },
    { id: 'coinbase', name: 'Coinbase Advanced', fee: 0.0006, key: 'coinbase:BTCUSDT', desc: 'VIP Taker: 0.06% | L2 Websocket' },
    { id: 'okx', name: 'OKX Spot', fee: 0.0005, key: 'okx:BTCUSDT', desc: 'VIP Taker: 0.05% | Top-5 Snapshot' },
    { id: 'bybit', name: 'Bybit Spot', fee: 0.0005, key: 'bybit:BTCUSDT', desc: 'VIP Taker: 0.05% | 20ms delta stream' },
  ], []);

  const sourceEx = useMemo(() => EXCHANGES.find(e => e.id === sourceId) || EXCHANGES[0], [EXCHANGES, sourceId]);
  const targetEx = useMemo(() => EXCHANGES.find(e => e.id === targetId) || EXCHANGES[1], [EXCHANGES, targetId]);

  const sourceBook = state?.orderBooks?.[sourceEx.key] || { bids: [], asks: [], updatedAt: 0 };
  const targetBook = state?.orderBooks?.[targetEx.key] || { bids: [], asks: [], updatedAt: 0 };

  const formatLevelRow = (level: any, maxQty = 5) => {
    const qtyPct = Math.min((level.amount / maxQty) * 100, 100);
    return {
      price: level.price,
      amount: level.amount,
      qtyPct,
    };
  };

  // Extract best pricing details
  const bestSourceBid = sourceBook.bids[0]?.price || 0;
  const bestSourceAsk = sourceBook.asks[0]?.price || 0;
  const bestTargetBid = targetBook.bids[0]?.price || 0;
  const bestTargetAsk = targetBook.asks[0]?.price || 0;

  // Mid prices
  const sourceMid = bestSourceBid > 0 && bestSourceAsk > 0 ? (bestSourceBid + bestSourceAsk) / 2 : 0;
  const targetMid = bestTargetBid > 0 && bestTargetAsk > 0 ? (bestTargetBid + bestTargetAsk) / 2 : 0;

  // Spread calculations (Buy cheap Ask on Source, sell expensive Bid on Target)
  const grossSpread = bestTargetBid > 0 && bestSourceAsk > 0 ? bestTargetBid - bestSourceAsk : 0;

  // CEX Round-trip taker fee cost
  const refPrice = sourceMid || targetMid || 0;
  const estRoundTripCost = refPrice * (sourceEx.fee + targetEx.fee);

  // Stablecoin conversions (USD vs USDT cross basis costs)
  const isSourceUSD = sourceId === 'coinbase' || sourceId === 'kraken';
  const isTargetUSD = targetId === 'coinbase' || targetId === 'kraken';
  const crossesBasis = isSourceUSD !== isTargetUSD;
  const basisCost = crossesBasis ? refPrice * 0.0008 : 0; // standard 8 basis points cost

  const totalCalculatedCosts = estRoundTripCost + basisCost;

  const handleSwapExchanges = () => {
    const temp = sourceId;
    setSourceId(targetId);
    setTargetId(temp);
  };

  // Compute dataset for active order book depth chart
  const depthChartData = useMemo(() => {
    const activeEx = EXCHANGES.find(e => e.id === activeDepthExchange) || EXCHANGES[0];
    const activeBook = state?.orderBooks?.[activeEx.key] || { bids: [], asks: [], updatedAt: 0 };
    const bids = activeBook.bids.slice(0, 15);
    const asks = activeBook.asks.slice(0, 15);

    if (bids.length === 0 && asks.length === 0) {
      return [];
    }

    let cumulativeBidQty = 0;
    const processedBids = bids
      .map((b) => {
        cumulativeBidQty += b.amount;
        return {
          price: b.price,
          bids: cumulativeBidQty,
          asks: null,
        };
      })
      .reverse();

    let cumulativeAskQty = 0;
    const processedAsks = asks.map((a) => {
      cumulativeAskQty += a.amount;
      return {
        price: a.price,
        bids: null,
        asks: cumulativeAskQty,
      };
    });

    return [...processedBids, ...processedAsks];
  }, [activeDepthExchange, EXCHANGES, state?.orderBooks]);

  return (
    <div className="space-y-8 animate-fadeIn max-w-[1400px] mx-auto pb-10">
      
      {/* HEADER TITLE */}
      <div className="pb-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl font-mono uppercase">
            {t('markets.title')}
          </h2>
          <p className="mt-2 text-sm text-slate-400 font-sans">
            {t('markets.subtitle')}
          </p>
        </div>

        {/* Dynamic Selector Panel for all 5 CEX Platforms */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950/40 p-2 border border-white/5 rounded-xl backdrop-blur-md shrink-0">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-slate-500 uppercase px-1 mb-0.5">SOURCE VENUE</span>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-amber-500/50"
            >
              {EXCHANGES.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSwapExchanges}
            className="w-8 h-8 rounded border border-white/10 bg-white/5 text-slate-300 hover:text-amber-400 hover:bg-white/10 transition-colors flex items-center justify-center self-end"
            title="Swap route directions"
          >
            ⇆
          </button>

          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-slate-500 uppercase px-1 mb-0.5">TARGET VENUE</span>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-amber-500/50"
            >
              {EXCHANGES.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* A. LIVE 5-CEX SPOT TICKER GRID */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            {t('markets.cex_grid_title')}
          </h3>
        </div>
        <p className="text-xs text-slate-400 font-sans -mt-1 pl-3.5">
          {t('markets.cex_grid_desc')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {EXCHANGES.map((ex) => {
            const book = state?.orderBooks?.[ex.key] || { bids: [], asks: [], updatedAt: 0 };
            const bestBid = book.bids[0]?.price || 0;
            const bestAsk = book.asks[0]?.price || 0;
            const mid = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : 0;
            const spread = bestBid > 0 && bestAsk > 0 ? bestAsk - bestBid : 0;
            
            // Calculate total volume in first 10 levels for bid/ask
            const totalBidVol = book.bids.slice(0, 10).reduce((acc: number, level: any) => acc + level.amount, 0);
            const totalAskVol = book.asks.slice(0, 10).reduce((acc: number, level: any) => acc + level.amount, 0);
            const totalL2Vol = totalBidVol + totalAskVol;

            // Connection state from WebSocket state
            const isExConnected = state?.connections?.[ex.id]?.connected ?? false;

            return (
              <Card key={ex.id} className="border border-white/5 bg-slate-950/20 backdrop-blur-md p-4 flex flex-col justify-between hover:border-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.02)] transition-all duration-300">
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                  <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">{ex.name.split(' ')[0]}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${isExConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
                    <span className="text-[8px] font-mono font-semibold text-slate-500 tracking-wider uppercase">
                      {isExConnected ? 'LIVE' : 'CONN...'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 font-mono text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 uppercase tracking-widest text-[9px]">{t('markets.mid_short')}</span>
                    <span className="text-amber-500 font-bold text-xs">
                      {mid > 0 ? `$${mid.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 uppercase tracking-widest text-[9px]">{t('markets.bid_short')}</span>
                    <span className="text-slate-300">
                      {bestBid > 0 ? `$${bestBid.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 uppercase tracking-widest text-[9px]">{t('markets.ask_short')}</span>
                    <span className="text-slate-300">
                      {bestAsk > 0 ? `$${bestAsk.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 uppercase tracking-widest text-[9px]">{t('markets.spread_short')}</span>
                    <span className={spread > 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {spread > 0 ? `$${spread.toFixed(2)}` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-white/5 pt-2 mt-2">
                    <span className="text-slate-500 uppercase tracking-widest text-[9px]">{t('markets.depth_short')}</span>
                    <span className="text-slate-300 font-semibold">
                      {totalL2Vol > 0 ? `${totalL2Vol.toFixed(2)} BTC` : '—'}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* B. 5x5 CROSS-VENUE NET SPREAD MATRIX */}
      <Card className="border border-white/5 bg-slate-950/15 backdrop-blur-md">
        <CardHeader className="pb-3 border-b border-white/5 bg-slate-950/20">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <CardTitle className="text-xs uppercase tracking-wider font-mono">
              {t('markets.spread_matrix_title')}
            </CardTitle>
          </div>
          <CardDescription className="text-[10px] font-mono mt-1 text-slate-400">
            {t('markets.spread_matrix_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-white/5 bg-slate-950/40 text-[9px] font-mono text-slate-500 uppercase">
                <th className="px-4 py-3 font-semibold text-slate-400 tracking-wider">{t('markets.exchange_short')} (ASK &rarr; BID)</th>
                {EXCHANGES.map((ex) => (
                  <th key={ex.id} className="px-4 py-3 font-semibold text-center tracking-wider">{ex.name.split(' ')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {EXCHANGES.map((rowEx) => {
                const rowBook = state?.orderBooks?.[rowEx.key] || { bids: [], asks: [], updatedAt: 0 };
                const rowAsk = rowBook.asks[0]?.price || 0;
                
                return (
                  <tr key={rowEx.id} className="hover:bg-white/[0.02] transition-all">
                    <td className="px-4 py-3.5 font-bold text-slate-300 flex items-center gap-2 bg-slate-950/10">
                      <span className="w-1 h-3.5 rounded bg-amber-500/50 shrink-0" />
                      <span>{rowEx.name.split(' ')[0]} <span className="text-[9px] text-slate-500 font-normal font-sans">(${rowAsk > 0 ? rowAsk.toFixed(1) : '—'})</span></span>
                    </td>
                    
                    {EXCHANGES.map((colEx) => {
                      if (rowEx.id === colEx.id) {
                        return (
                          <td key={colEx.id} className="px-4 py-3.5 bg-slate-950/30 text-center text-slate-600 font-sans">
                            —
                          </td>
                        );
                      }
                      
                      const colBook = state?.orderBooks?.[colEx.key] || { bids: [], asks: [], updatedAt: 0 };
                      const colBid = colBook.bids[0]?.price || 0;

                      // Mid references
                      const rowMid = rowAsk > 0 && rowBook.bids[0]?.price > 0 ? (rowAsk + rowBook.bids[0]?.price) / 2 : 0;
                      const colMid = colBid > 0 && colBook.asks[0]?.price > 0 ? (colBid + colBook.asks[0]?.price) / 2 : 0;
                      const refMid = rowMid || colMid || 0;

                      // Gross spread
                      const rawSpread = colBid > 0 && rowAsk > 0 ? colBid - rowAsk : 0;

                      // Costs
                      const exCost = refMid * (rowEx.fee + colEx.fee);
                      const isRowUSD = rowEx.id === 'coinbase' || rowEx.id === 'kraken';
                      const isColUSD = colEx.id === 'coinbase' || colEx.id === 'kraken';
                      const crossStableBasis = isRowUSD !== isColUSD;
                      const basisPenalty = crossStableBasis ? refMid * 0.0008 : 0;
                      
                      const netSpread = rawSpread > 0 ? rawSpread - (exCost + basisPenalty) : 0;
                      const isProfitable = netSpread > 0 && rawSpread > 0;

                      return (
                        <td 
                          key={colEx.id} 
                          className={`px-4 py-3.5 text-center transition-all ${
                            isProfitable 
                              ? 'bg-emerald-500/10 text-emerald-400 font-bold border-x border-emerald-500/20' 
                              : rawSpread > 0 
                                ? 'text-amber-500/70 bg-amber-500/[0.02]' 
                                : 'text-slate-600 bg-slate-950/5'
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center">
                            {rawSpread > 0 ? (
                              <>
                                <span className={isProfitable ? 'text-emerald-400 glow-text-green text-xs font-bold' : 'text-slate-400'}>
                                  {isProfitable ? `+$${netSpread.toFixed(2)}` : `-$${Math.abs(netSpread).toFixed(2)}`}
                                </span>
                                <span className="text-[7.5px] uppercase tracking-widest mt-0.5 font-sans font-semibold text-slate-500">
                                  {isProfitable ? t('markets.profitable') : t('markets.unprofitable')}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-600 text-[10px] font-sans">SIN SPREAD</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 1. REAL-TIME MULTI-VENUE CALCULATOR PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className={`md:col-span-2 border ${grossSpread > totalCalculatedCosts ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'border-white/5'} bg-slate-950/20 backdrop-blur-md`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-[10px] text-slate-500 font-mono tracking-wider">{t('markets.route_permutation')}</CardTitle>
              <h3 className="font-bold text-sm tracking-wide text-white uppercase mt-1 flex items-center gap-2 font-mono">
                <span className="text-amber-500">{sourceEx.name}</span> 
                <span className="text-slate-600">&rarr;</span> 
                <span className="text-emerald-400">{targetEx.name}</span>
              </h3>
            </div>
            <Badge variant={grossSpread > totalCalculatedCosts ? 'success' : 'secondary'} className="shrink-0">
              {grossSpread > totalCalculatedCosts ? t('markets.arb_window') : t('markets.no_spread')}
            </Badge>
          </CardHeader>
          <CardContent className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">{t('markets.gross_spread')}</span>
              <p className={`text-base font-bold font-mono mt-1 ${grossSpread > 0 ? 'text-emerald-400 glow-text-green' : 'text-slate-400'}`}>
                {grossSpread > 0 ? `+$${grossSpread.toFixed(2)}` : `-$${Math.abs(grossSpread).toFixed(2)}`}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">{t('markets.est_fees')}</span>
              <p className="text-base font-bold font-mono text-slate-400 mt-1">
                ~${estRoundTripCost.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-mono block uppercase">CROSS BASIS (8 BPS)</span>
              <p className={`text-base font-bold font-mono mt-1 ${crossesBasis ? 'text-amber-500/80' : 'text-slate-500'}`}>
                {crossesBasis ? `+$${basisCost.toFixed(2)}` : '—'}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">{t('markets.net_estimate')}</span>
              <p className={`text-base font-bold font-mono mt-1 ${grossSpread > totalCalculatedCosts ? 'text-emerald-400 font-semibold glow-text-green' : 'text-slate-500'}`}>
                {grossSpread > totalCalculatedCosts ? `+$${(grossSpread - totalCalculatedCosts).toFixed(2)}` : t('markets.unprofitable')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Active permissable mid values */}
        <Card className="border border-white/5 bg-slate-950/20 backdrop-blur-md flex flex-col justify-between">
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Exchange Mid Points</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono text-slate-400 uppercase">{sourceEx.name}:</span>
              <span className="font-mono font-bold text-amber-500">${sourceMid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono text-slate-400 uppercase">{targetEx.name}:</span>
              <span className="font-mono font-bold text-emerald-400">${targetMid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="border-t border-white/5 pt-3 flex justify-between items-center text-[10px] text-slate-500 font-mono uppercase">
              <span>Spread differential:</span>
              <span className="text-slate-300 font-bold">${Math.abs(sourceMid - targetMid).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. DYNAMIC CUMULATIVE LIQUIDITY DEPTH CHART */}
      <Card className="border border-white/5 bg-slate-950/10 backdrop-blur-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-0 border-b-0">
          <div>
            <CardTitle className="text-xs">{t('markets.liquidity_title')}</CardTitle>
            <CardDescription className="text-[10px] font-mono">{t('markets.liquidity_sub')}</CardDescription>
          </div>
          
          {/* Dynamic tabs supporting all 5 exchanges */}
          <div className="overflow-x-auto w-full sm:w-auto pb-1.5 sm:pb-0">
            <Tabs value={activeDepthExchange} onValueChange={setActiveDepthExchange} className="w-auto">
              <TabsList className="bg-slate-950/60 p-0.5 border border-white/5 rounded-lg flex gap-1 whitespace-nowrap min-w-max">
                <TabsTrigger value="binance" className="px-3 py-1 text-xs">Binance</TabsTrigger>
                <TabsTrigger value="kraken" className="px-3 py-1 text-xs">Kraken</TabsTrigger>
                <TabsTrigger value="coinbase" className="px-3 py-1 text-xs">Coinbase</TabsTrigger>
                <TabsTrigger value="okx" className="px-3 py-1 text-xs">OKX</TabsTrigger>
                <TabsTrigger value="bybit" className="px-3 py-1 text-xs">Bybit</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-[220px] w-full bg-slate-950/40 border border-white/5 rounded-xl p-2 flex items-center justify-center">
            {mounted && depthChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={depthChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis
                    dataKey="price"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    stroke="rgba(255,255,255,0.2)"
                    fontSize={9}
                    tickLine={false}
                    fontFamily="JetBrains Mono, monospace"
                    tickFormatter={(val) => `$${val.toFixed(0)}`}
                    dy={10}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    fontSize={9}
                    tickLine={false}
                    fontFamily="JetBrains Mono, monospace"
                    orientation="right"
                    dx={10}
                  />
                  <RechartsTooltip content={<DepthTooltip />} />
                  <Area
                    type="stepAfter"
                    dataKey="bids"
                    stroke="#139D72"
                    strokeWidth={1.5}
                    fill="rgba(19, 157, 114, 0.12)"
                    connectNulls
                  />
                  <Area
                    type="stepAfter"
                    dataKey="asks"
                    stroke="#CF4259"
                    strokeWidth={1.5}
                    fill="rgba(207, 66, 89, 0.12)"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-500 font-mono text-xs">{t('markets.awaiting_books')}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. SIDE-BY-SIDE L2 DEPTH LADDERS FOR SELECTED CEXs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Source Venue Ladder */}
        <Card className="border border-white/5 bg-slate-950/10">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3 border-b border-white/5 bg-slate-950/30 rounded-t-xl">
            <div>
              <span className="text-[10px] text-amber-500 font-mono uppercase font-bold tracking-wider">Source exchange L2 book</span>
              <CardTitle className="text-sm mt-0.5 font-mono">{sourceEx.name}</CardTitle>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-mono block">{t('markets.mid_price')}</span>
              <p className="text-sm font-bold font-mono text-amber-500">${sourceMid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-2 gap-6">
              
              {/* Bids */}
              <div className="space-y-1">
                <h4 className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-2 border-b border-white/5 pb-1">{t('markets.bids_buy')}</h4>
                {sourceBook.bids.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs font-mono">{t('markets.awaiting_ws')}</div>
                ) : (
                  sourceBook.bids.slice(0, 10).map((b, idx) => {
                    const data = formatLevelRow(b);
                    return (
                      <div key={idx} className="relative flex justify-between items-center text-xs font-mono py-1 px-2 hover:bg-white/5 rounded transition-all">
                        <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 rounded-r" style={{ width: `${data.qtyPct}%` }}></div>
                        <span className="text-emerald-400 font-semibold relative z-10">${data.price.toFixed(2)}</span>
                        <span className="text-slate-400 relative z-10">{data.amount.toFixed(4)}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Asks */}
              <div className="space-y-1">
                <h4 className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-2 border-b border-white/5 pb-1">{t('markets.asks_sell')}</h4>
                {sourceBook.asks.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs font-mono">{t('markets.awaiting_ws')}</div>
                ) : (
                  sourceBook.asks.slice(0, 10).map((a, idx) => {
                    const data = formatLevelRow(a);
                    return (
                      <div key={idx} className="relative flex justify-between items-center text-xs font-mono py-1 px-2 hover:bg-white/5 rounded transition-all">
                        <div className="absolute left-0 top-0 bottom-0 bg-rose-500/10 rounded-l" style={{ width: `${data.qtyPct}%` }}></div>
                        <span className="text-slate-400 relative z-10">{data.amount.toFixed(4)}</span>
                        <span className="text-rose-400 font-semibold relative z-10">${data.price.toFixed(2)}</span>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Target Venue Ladder */}
        <Card className="border border-white/5 bg-slate-950/10">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3 border-b border-white/5 bg-slate-950/30 rounded-t-xl">
            <div>
              <span className="text-[10px] text-emerald-400 font-mono uppercase font-bold tracking-wider">Target exchange L2 book</span>
              <CardTitle className="text-sm mt-0.5 font-mono">{targetEx.name}</CardTitle>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-mono block">{t('markets.mid_price')}</span>
              <p className="text-sm font-bold font-mono text-amber-500">${targetMid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-2 gap-6">
              
              {/* Bids */}
              <div className="space-y-1">
                <h4 className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-2 border-b border-white/5 pb-1">{t('markets.bids_buy')}</h4>
                {targetBook.bids.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs font-mono">{t('markets.awaiting_ws')}</div>
                ) : (
                  targetBook.bids.slice(0, 10).map((b, idx) => {
                    const data = formatLevelRow(b);
                    return (
                      <div key={idx} className="relative flex justify-between items-center text-xs font-mono py-1 px-2 hover:bg-white/5 rounded transition-all">
                        <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 rounded-r" style={{ width: `${data.qtyPct}%` }}></div>
                        <span className="text-emerald-400 font-semibold relative z-10">${data.price.toFixed(2)}</span>
                        <span className="text-slate-400 relative z-10">{data.amount.toFixed(4)}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Asks */}
              <div className="space-y-1">
                <h4 className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-2 border-b border-white/5 pb-1">{t('markets.asks_sell')}</h4>
                {targetBook.asks.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs font-mono">{t('markets.awaiting_ws')}</div>
                ) : (
                  targetBook.asks.slice(0, 10).map((a, idx) => {
                    const data = formatLevelRow(a);
                    return (
                      <div key={idx} className="relative flex justify-between items-center text-xs font-mono py-1 px-2 hover:bg-white/5 rounded transition-all">
                        <div className="absolute left-0 top-0 bottom-0 bg-rose-500/10 rounded-l" style={{ width: `${data.qtyPct}%` }}></div>
                        <span className="text-slate-400 relative z-10">{data.amount.toFixed(4)}</span>
                        <span className="text-rose-400 font-semibold relative z-10">${data.price.toFixed(2)}</span>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. REFERENCE GLOBAL AGGREGATORS */}
      <Card className="border border-white/5 bg-slate-950/20 backdrop-blur-md">
        <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-5">
          <div>
            <h3 className="font-semibold text-xs tracking-wider text-white uppercase font-mono">{t('markets.reference_aggregators')}</h3>
            <p className="text-xs text-slate-400 mt-1 font-sans">{t('markets.reference_desc')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://coinmarketcap.com/currencies/bitcoin/#Markets"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-8 rounded-lg bg-white/5 border border-white/10 px-4 text-[10px] font-semibold font-mono tracking-wider text-slate-300 hover:text-white hover:bg-white/10 transition-all uppercase"
            >
              CoinMarketCap &rarr;
            </a>
            <a
              href="https://www.coingecko.com/en/coins/bitcoin#markets"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-8 rounded-lg bg-white/5 border border-white/10 px-4 text-[10px] font-semibold font-mono tracking-wider text-slate-300 hover:text-white hover:bg-white/10 transition-all uppercase"
            >
              CoinGecko &rarr;
            </a>
            <a
              href="https://www.tradingview.com/symbols/BTCUSD/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-8 rounded-lg bg-white/5 border border-white/10 px-4 text-[10px] font-semibold font-mono tracking-wider text-slate-300 hover:text-white hover:bg-white/10 transition-all uppercase"
            >
              TradingView &rarr;
            </a>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
