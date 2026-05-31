'use client';

import React from 'react';


import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

import { useWebSocket } from '../WebSocketContext';

export default function WalletsPage() {
  const { state } = useWebSocket();

  const wallets = state?.wallets || {};

  // Default initial balances mapping for progress bar sizing
  const maxQuote = 100000;
  const maxBtc = 3.0;

  const venueNames: Record<string, string> = {
    binance: 'Binance Spot',
    kraken: 'Kraken Spot',
    coinbase: 'Coinbase Advanced',
    okx: 'OKX Spot',
    bybit: 'Bybit Spot',
  };

  const venueIds = Object.keys(wallets).length > 0 ? Object.keys(wallets) : ['binance', 'kraken'];

  const aggregateBtc = venueIds.reduce((sum, id) => sum + (wallets[id]?.BTC?.free || 0), 0);
  const aggregateUsdt = venueIds.reduce((sum, id) => sum + (wallets[id]?.USDT?.free || 0), 0);

  const renderExchangeBalances = (exchangeId: string, name: string) => {
    const assets = wallets[exchangeId] || { BTC: { free: 0, locked: 0 }, USDT: { free: 0, locked: 0 } };
    const btcFree = assets.BTC?.free || 0;
    const btcLocked = assets.BTC?.locked || 0;
    const btcTotal = btcFree + btcLocked;

    const usdtFree = assets.USDT?.free || 0;
    const usdtLocked = assets.USDT?.locked || 0;
    const usdtTotal = usdtFree + usdtLocked;

    const btcPct = Math.min((btcTotal / maxBtc) * 100, 100);
    const usdtPct = Math.min((usdtTotal / maxQuote) * 100, 100);

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-xs">{name} Balance Pool</CardTitle>
          <Badge variant="secondary">ACTIVE RESERVE</Badge>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {/* BTC ASSET BAR */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold">Bitcoin (BTC)</span>
              <span className="text-amber-500 font-bold">{btcTotal.toFixed(4)} BTC</span>
            </div>
            <div className="h-2 bg-slate-950/40 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full animate-pulse-slow" style={{ width: `${btcPct}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Free: {btcFree.toFixed(4)}</span>
              <span>Locked: {btcLocked.toFixed(4)}</span>
            </div>
          </div>

          {/* USDT ASSET BAR */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold">Tether USD (USDT)</span>
              <span className="text-emerald-400 font-bold">${usdtTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="h-2 bg-slate-950/40 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full animate-pulse-slow" style={{ width: `${usdtPct}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Free: ${usdtFree.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span>Locked: ${usdtLocked.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER */}
      <div className="pb-6 border-b border-white/5">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Simulated Capital Reserves
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Monitor capital holdings, asset balances, and net quote-base exposures per active exchange.
        </p>
      </div>

      {/* BALANCES GRID — one pool per live venue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {venueIds.map((id) => (
          <React.Fragment key={id}>
            {renderExchangeBalances(id, venueNames[id] ?? id.toUpperCase())}
          </React.Fragment>
        ))}
      </div>

      {/* EXPOSURES CARD */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs">Asset Allocation Oversight</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono pt-2">
          <div className="space-y-1.5">
            <span className="text-slate-500">AGGREGATE BTC SPOT EXPOSURE:</span>
            <p className="text-lg font-bold text-amber-500">
              {aggregateBtc.toFixed(4)} BTC
            </p>
          </div>
          <div className="space-y-1.5">
            <span className="text-slate-500">AGGREGATE QUOTE CASH EXPOSURE:</span>
            <p className="text-lg font-bold text-emerald-400">
              ${aggregateUsdt.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
