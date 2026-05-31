'use client';

import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

import { useLanguage } from '../LanguageContext';
import { useWebSocket } from '../WebSocketContext';

export default function WalletsPage() {
  const { state } = useWebSocket();
  const { t } = useLanguage();

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

  const venueIds = ['binance', 'kraken', 'coinbase', 'okx', 'bybit'];

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
      <Card key={exchangeId} className="border border-white/5 bg-slate-950/20 backdrop-blur-md hover:border-white/10 transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-white/5 bg-slate-950/10">
          <CardTitle className="text-xs font-mono font-bold text-white uppercase tracking-wider">{name} {t('wallets.pool_title')}</CardTitle>
          <Badge variant="secondary" className="font-mono text-[9px] uppercase tracking-wider">{t('wallets.active_reserve')}</Badge>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          {/* BTC ASSET BAR */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 font-medium">Bitcoin (BTC)</span>
              <span className="text-amber-500 font-bold">{btcTotal.toFixed(4)} BTC</span>
            </div>
            <div className="h-2 bg-slate-950/40 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full animate-pulse-slow" style={{ width: `${btcPct}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>{t('wallets.free_label')}: {btcFree.toFixed(4)}</span>
              <span>{t('wallets.locked_label')}: {btcLocked.toFixed(4)}</span>
            </div>
          </div>

          {/* USDT ASSET BAR */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 font-medium">Tether USD (USDT)</span>
              <span className="text-emerald-400 font-bold">${usdtTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="h-2 bg-slate-950/40 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full animate-pulse-slow" style={{ width: `${usdtPct}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>{t('wallets.free_label')}: ${usdtFree.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span>{t('wallets.locked_label')}: ${usdtLocked.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-[1400px] mx-auto pb-10">
      {/* HEADER */}
      <div className="pb-6 border-b border-white/5">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl font-mono uppercase">
          {t('wallets.title_header')}
        </h2>
        <p className="mt-2 text-sm text-slate-400 font-sans">
          {t('wallets.subtitle_header')}
        </p>
      </div>

      {/* BALANCES GRID — one pool per live venue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {venueIds.map((id) => renderExchangeBalances(id, venueNames[id] ?? id.toUpperCase()))}
      </div>

      {/* EXPOSURES CARD */}
      <Card className="border border-white/5 bg-slate-950/15 backdrop-blur-md">
        <CardHeader className="border-b border-white/5 bg-slate-950/10">
          <CardTitle className="text-xs font-mono font-bold text-white uppercase tracking-wider">{t('wallets.oversight_title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono pt-5 pb-5">
          <div className="space-y-2 p-4 bg-slate-950/20 border border-white/5 rounded-xl">
            <span className="text-slate-500 uppercase tracking-widest text-[9px]">{t('wallets.agg_btc')}</span>
            <p className="text-2xl font-bold text-amber-500 glow-text-gold">
              {aggregateBtc.toFixed(4)} BTC
            </p>
          </div>
          <div className="space-y-2 p-4 bg-slate-950/20 border border-white/5 rounded-xl">
            <span className="text-slate-500 uppercase tracking-widest text-[9px]">{t('wallets.agg_quote')}</span>
            <p className="text-2xl font-bold text-emerald-400 glow-text-green">
              ${aggregateUsdt.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
