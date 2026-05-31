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
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [activeDepthExchange, setActiveDepthExchange] = useState('binance');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Retrieve active books from aggregated state payload
  const binanceBook = state?.orderBooks?.['binance:BTCUSDT'] || { bids: [], asks: [], updatedAt: 0 };
  const krakenBook = state?.orderBooks?.['kraken:BTCUSDT'] || { bids: [], asks: [], updatedAt: 0 };

  const formatLevelRow = (level: any, maxQty = 5) => {
    const qtyPct = Math.min((level.amount / maxQty) * 100, 100);
    return {
      price: level.price,
      amount: level.amount,
      qtyPct,
    };
  };

  // Extract best prices
  const bestBinanceBid = binanceBook.bids[0]?.price || 0;
  const bestBinanceAsk = binanceBook.asks[0]?.price || 0;
  const bestKrakenBid = krakenBook.bids[0]?.price || 0;
  const bestKrakenAsk = krakenBook.asks[0]?.price || 0;

  // Mid prices
  const binanceMid = bestBinanceBid > 0 && bestBinanceAsk > 0 ? (bestBinanceBid + bestBinanceAsk) / 2 : 0;
  const krakenMid = bestKrakenBid > 0 && bestKrakenAsk > 0 ? (bestKrakenBid + bestKrakenAsk) / 2 : 0;

  // Spread calculations
  const grossBtoK = bestKrakenBid > 0 && bestBinanceAsk > 0 ? bestKrakenBid - bestBinanceAsk : 0;
  const grossKtoB = bestBinanceBid > 0 && bestKrakenAsk > 0 ? bestBinanceBid - bestKrakenAsk : 0;

  // Estimated round-trip taker cost per BTC at VIP tiers (Binance 0.04% + Kraken 0.10%).
  const refPrice = binanceMid || krakenMid || 0;
  const estRoundTripCost = (refPrice * (4 + 10)) / 10000;

  // Compute dataset for order book depth chart
  const depthChartData = useMemo(() => {
    const activeBook = activeDepthExchange === 'binance' ? binanceBook : krakenBook;
    const bids = activeBook.bids.slice(0, 15);
    const asks = activeBook.asks.slice(0, 15);

    if (bids.length === 0 && asks.length === 0) {
      return [];
    }

    // Process Bids: Cumulative from best bid (highest price) to deepest bid (lowest price)
    // For rendering, we want ascending price order, so bids will sit on the left side
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
      .reverse(); // Reverse so prices go from lowest to highest

    // Process Asks: Cumulative from best ask (lowest price) to deepest ask (highest price)
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
  }, [activeDepthExchange, binanceBook, krakenBook]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER TITLE */}
      <div className="pb-6 border-b border-white/5">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {t('markets.title')}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {t('markets.subtitle')}
        </p>
      </div>

      {/* 1. REAL-TIME SPREAD CALCULATOR PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Route A: Binance to Kraken */}
        <Card className={`border ${grossBtoK > 0 ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]' : 'border-white/5'}`}>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
            <div>
              <CardTitle className="text-[10px] text-slate-500 font-mono tracking-wider">{t('markets.route_permutation')}</CardTitle>
              <h3 className="font-bold text-sm tracking-wide text-white uppercase mt-1">Binance &rarr; Kraken</h3>
            </div>
            <Badge variant={grossBtoK > 0 ? 'success' : 'secondary'} className="self-start sm:self-auto">
              {grossBtoK > 0 ? t('markets.arb_window') : t('markets.no_spread')}
            </Badge>
          </CardHeader>
          <CardContent className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <span className="text-[10px] text-slate-500 font-mono">{t('markets.gross_spread')}</span>
              <p className={`text-lg font-bold font-mono ${grossBtoK > 0 ? 'text-emerald-400 glow-text-green' : 'text-slate-400'}`}>
                {grossBtoK > 0 ? `+$${grossBtoK.toFixed(2)}` : `-$${Math.abs(grossBtoK).toFixed(2)}`}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-mono">{t('markets.est_fees')}</span>
              <p className="text-lg font-bold font-mono text-slate-400">
                ~${estRoundTripCost.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-mono">{t('markets.net_estimate')}</span>
              <p className={`text-lg font-bold font-mono ${grossBtoK > estRoundTripCost ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                {grossBtoK > estRoundTripCost ? `+$${(grossBtoK - estRoundTripCost).toFixed(2)}` : t('markets.unprofitable')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Route B: Kraken to Binance */}
        <Card className={`border ${grossKtoB > 0 ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]' : 'border-white/5'}`}>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
            <div>
              <CardTitle className="text-[10px] text-slate-500 font-mono tracking-wider">{t('markets.route_permutation')}</CardTitle>
              <h3 className="font-bold text-sm tracking-wide text-white uppercase mt-1">Kraken &rarr; Binance</h3>
            </div>
            <Badge variant={grossKtoB > 0 ? 'success' : 'secondary'} className="self-start sm:self-auto">
              {grossKtoB > 0 ? t('markets.arb_window') : t('markets.no_spread')}
            </Badge>
          </CardHeader>
          <CardContent className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <span className="text-[10px] text-slate-500 font-mono">{t('markets.gross_spread')}</span>
              <p className={`text-lg font-bold font-mono ${grossKtoB > 0 ? 'text-emerald-400 glow-text-green' : 'text-slate-400'}`}>
                {grossKtoB > 0 ? `+$${grossKtoB.toFixed(2)}` : `-$${Math.abs(grossKtoB).toFixed(2)}`}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-mono">{t('markets.est_fees')}</span>
              <p className="text-lg font-bold font-mono text-slate-400">
                ~${estRoundTripCost.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-mono">{t('markets.net_estimate')}</span>
              <p className={`text-lg font-bold font-mono ${grossKtoB > estRoundTripCost ? 'text-emerald-400' : 'text-slate-500'}`}>
                {grossKtoB > estRoundTripCost ? `+$${(grossKtoB - estRoundTripCost).toFixed(2)}` : t('markets.unprofitable')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. DYNAMIC DEPTH CHART VISUALIZER */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-0 border-b-0">
          <div>
            <CardTitle className="text-xs">{t('markets.liquidity_title')}</CardTitle>
            <CardDescription className="text-[10px] font-mono">{t('markets.liquidity_sub')}</CardDescription>
          </div>
          <Tabs value={activeDepthExchange} onValueChange={setActiveDepthExchange} className="w-auto self-start sm:self-auto">
            <TabsList>
              <TabsTrigger value="binance">Binance Spot</TabsTrigger>
              <TabsTrigger value="kraken">Kraken Spot</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-[200px] w-full bg-slate-950/20 border border-white/5 rounded-lg p-2 flex items-center justify-center">
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
                  {/* Bids area (Green) */}
                  <Area
                    type="stepAfter"
                    dataKey="bids"
                    stroke="#139D72"
                    strokeWidth={1.5}
                    fill="rgba(19, 157, 114, 0.12)"
                    connectNulls
                  />
                  {/* Asks area (Red) */}
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

      {/* 3. SIDE-BY-SIDE L2 DEPTH LADDERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Binance Spot order book */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-xs">{t('markets.binance_l2')}</CardTitle>
              <CardDescription className="text-[10px] font-mono">{t('markets.binance_l2_desc')}</CardDescription>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-slate-500 font-mono block">{t('markets.mid_price')}</span>
              <p className="text-sm font-bold font-mono text-amber-500">${binanceMid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Binance Bids (Buy Orders) */}
              <div className="space-y-1">
                <h4 className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-2 border-b border-white/5 pb-1">{t('markets.bids_buy')}</h4>
                {binanceBook.bids.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs font-mono">{t('markets.awaiting_ws')}</div>
                ) : (
                  binanceBook.bids.slice(0, 10).map((b, idx) => {
                    const data = formatLevelRow(b);
                    return (
                      <div key={idx} className="relative flex justify-between items-center text-xs font-mono py-1 px-2 hover:bg-white/5 rounded transition-all">
                        {/* Depth visual fill */}
                        <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 rounded-r" style={{ width: `${data.qtyPct}%` }}></div>
                        <span className="text-emerald-400 font-semibold relative z-10">${data.price.toFixed(2)}</span>
                        <span className="text-slate-400 relative z-10">{data.amount.toFixed(4)}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Binance Asks (Sell Orders) */}
              <div className="space-y-1">
                <h4 className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-2 border-b border-white/5 pb-1">{t('markets.asks_sell')}</h4>
                {binanceBook.asks.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs font-mono">{t('markets.awaiting_ws')}</div>
                ) : (
                  binanceBook.asks.slice(0, 10).map((a, idx) => {
                    const data = formatLevelRow(a);
                    return (
                      <div key={idx} className="relative flex justify-between items-center text-xs font-mono py-1 px-2 hover:bg-white/5 rounded transition-all">
                        {/* Depth visual fill */}
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

        {/* Right: Kraken Spot order book */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-xs">{t('markets.kraken_l2')}</CardTitle>
              <CardDescription className="text-[10px] font-mono">{t('markets.kraken_l2_desc')}</CardDescription>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-slate-500 font-mono block">{t('markets.mid_price')}</span>
              <p className="text-sm font-bold font-mono text-amber-500">${krakenMid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Kraken Bids (Buy Orders) */}
              <div className="space-y-1">
                <h4 className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-2 border-b border-white/5 pb-1">{t('markets.bids_buy')}</h4>
                {krakenBook.bids.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs font-mono">{t('markets.awaiting_ws')}</div>
                ) : (
                  krakenBook.bids.slice(0, 10).map((b, idx) => {
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

              {/* Kraken Asks (Sell Orders) */}
              <div className="space-y-1">
                <h4 className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-2 border-b border-white/5 pb-1">{t('markets.asks_sell')}</h4>
                {krakenBook.asks.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs font-mono">{t('markets.awaiting_ws')}</div>
                ) : (
                  krakenBook.asks.slice(0, 10).map((a, idx) => {
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

      {/* 4. EXTERNAL RESOURCE REFERENCE CARD */}
      <Card>
        <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-5">
          <div>
            <h3 className="font-semibold text-xs tracking-wider text-white uppercase font-mono">{t('markets.reference_aggregators')}</h3>
            <p className="text-xs text-slate-400 mt-1">{t('markets.reference_desc')}</p>
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
