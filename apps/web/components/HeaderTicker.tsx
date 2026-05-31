'use client';

import React from 'react';

import { useWebSocket } from '../app/WebSocketContext';

/**
 * Live header ticker. Every value is derived from the real-time StatePayload — no
 * hardcoded figures — so it stays consistent with the order books and P&L on the page.
 */
export function HeaderTicker() {
  const { state, connected } = useWebSocket();

  const binance = state?.orderBooks?.['binance:BTCUSDT'];
  const btcSpot =
    binance && binance.bids[0] && binance.asks[0]
      ? (binance.bids[0].price + binance.asks[0].price) / 2
      : null;

  const latency = state?.metrics?.detectionLatencyMs ?? null;
  const equity = 100000 + (state?.pnl?.totalProfitUSD ?? 0);

  const connectedVenues = state?.connections
    ? Object.values(state.connections).filter((c) => c.connected).length
    : 0;

  return (
    <div className="flex items-center gap-6 overflow-x-auto py-2 no-scrollbar">
      {/* BTC reference ticker (live Binance mid) */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500 font-mono">BTC SPOT:</span>
        <span className="text-slate-300 font-mono font-medium">
          {btcSpot ? `$${btcSpot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
        </span>
      </div>
      {/* Live detection latency */}
      <div className="flex items-center gap-2 text-xs border-l border-white/5 pl-6">
        <span className="text-slate-500 font-mono">DETECTION:</span>
        <span className="text-sky-400 font-mono font-medium">
          {latency !== null ? `${latency.toFixed(2)} ms` : '—'}
        </span>
      </div>
      {/* Connected live venues */}
      <div className="flex items-center gap-2 text-xs border-l border-white/5 pl-6">
        <span className="text-slate-500 font-mono">FEEDS:</span>
        <span className="text-emerald-400 font-mono font-medium">{connectedVenues}/5 live</span>
      </div>
      {/* Portfolio equity */}
      <div className="flex items-center gap-2 text-xs border-l border-white/5 pl-6">
        <span className="text-slate-500 font-mono">SIM EQUITY:</span>
        <span className="text-amber-500 font-mono font-medium glow-text-gold">
          ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      {/* Socket status dot */}
      <div className="flex items-center gap-2 text-xs border-l border-white/5 pl-6">
        <span className={`font-mono font-medium ${connected ? 'text-emerald-400' : 'text-rose-400'}`}>
          {connected ? '● STREAMING' : '○ CONNECTING'}
        </span>
      </div>
    </div>
  );
}
