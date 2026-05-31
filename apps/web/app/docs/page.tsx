'use client';

import React from 'react';

import { Card, CardHeader, CardContent } from '@/components/ui/card';

export default function DocsPage() {
  return (
    <div className="space-y-8 animate-fadeIn max-w-[1000px]">
      {/* HEADER */}
      <div className="pb-6 border-b border-white/5">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Platform Documentation
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Core concepts, architectural overviews, L2 math algorithms, and cost modeling profiles.
        </p>
      </div>

      {/* DOCUMENTATION CONTENT BODY */}
      <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
        
        {/* Section 1: Concept */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">1. What is Cross-Exchange Arbitrage?</h3>
          <p>
            Cross-exchange arbitrage involves exploiting price discrepancies for the same asset across different centralized trading venues. Because markets operate 24/7 independently, buying demand on one exchange might briefly spike price structures, while selling pressure on another venue depresses them.
          </p>
          <p>
            The simulator continuously monitors live L2 order book spreads. When the best Ask (Sell offer) on exchange A is lower than the best Bid (Buy offer) on exchange B, a potential arbitrage window opens.
          </p>
        </section>

        {/* Section 2: Mathematical Sizing & Walk */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">2. L2 Depth Sizing & Slippage</h3>
          <p>
            Standard arbitrage detectors calculate spreads naively using only top-of-book levels (Level 1: best Bid/Ask). If a strategy attempts to execute a larger block size (e.g. 1.5 BTC) on a top-level size that has only 0.1 BTC available, the transaction suffers massive slippage as it consumes deeper levels at increasingly worse prices.
          </p>
          <Card className="border border-amber-500/20 bg-slate-900/40">
            <CardHeader className="pb-1">
              <span className="text-[10px] text-amber-500 font-mono tracking-wider uppercase">L2 Book-Walk Algorithm</span>
            </CardHeader>
            <CardContent className="font-mono text-xs text-slate-300 space-y-1 pt-2">
              <p>1. Start with test block volume V = 0.05 BTC</p>
              <p>2. Query cumulative asks on Cheap venue and bids on Expensive venue up to V</p>
              <p>3. Calculate weighted average walked prices (BuyPrice & SellPrice)</p>
              <p>4. Subtract costs (taker fees, real walked slippage, latency safety bps)</p>
              <p>5. If Net profit is positive, increment size V = V + 0.05 BTC and repeat</p>
              <p>6. Stop walking once net profit decreases, ensuring optimal sizing</p>
            </CardContent>
          </Card>
        </section>

        {/* Section 3: Cost Modeling */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">3. Realistic Cost Modeling</h3>
          <p>
            Trading profitability is heavily eroded by fees and latency in live markets. Our simulator addresses this by applying a detailed cost structure:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              <strong className="text-white">Exchange Taker Fees:</strong> Applied on both sides since arbitrage executes against existing order book liquidity, at competitive VIP / high-volume tiers (Binance ~0.04%, OKX/Bybit ~0.05%, Coinbase ~0.06%, Kraken ~0.10%). All are configurable per-engine.
            </li>
            <li>
              <strong className="text-white">Withdrawal fees (network rebalancing):</strong> Flat fee deducted per-opportunity representing network transfer costs to balance portfolios across venues.
            </li>
            <li>
              <strong className="text-white">Latency safety buffer (BPS):</strong> Configure a safety shield (default 1 BPS). Deducts expected sell price and inflates expected buy price to represent spread drift during socket transmission hops.
            </li>
            <li>
              <strong className="text-white">Real depth-walk slippage:</strong> The L2 book-walk prices slippage directly from the consumed depth (volume-weighted average fill price), so no artificial cushion is double-counted on top.
            </li>
          </ul>
        </section>

        {/* Section 4: Monorepo Workspace Design */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">4. Monorepo Workspace Structure</h3>
          <p>
            The project is architected as an industrial-grade pnpm workspace monorepo:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs font-mono text-slate-400">
            <li>
              <span className="text-white font-sans font-semibold">packages/core</span> &mdash; Holds shared typescript typings and pure math calculator tools.
            </li>
            <li>
              <span className="text-white font-sans font-semibold">packages/config</span> &mdash; Exposes static exchange properties and Zod validation rules.
            </li>
            <li>
              <span className="text-white font-sans font-semibold">packages/testing</span> &mdash; Fabrication templates for mocking order books.
            </li>
            <li>
              <span className="text-white font-sans font-semibold">apps/bot</span> &mdash; Backend bot running Express server endpoints and managing 5 live exchange WS connections (Binance, Kraken, Coinbase, OKX, Bybit).
            </li>
            <li>
              <span className="text-white font-sans font-semibold">apps/web</span> &mdash; Institutional Next.js 14 glassmorphic real-time dashboard terminal.
            </li>
          </ul>
        </section>

        {/* Section 5: Double-Fallback Database */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">5. Dynamic Dual-Engine Persistence Fallback</h3>
          <p>
            To provide the ultimate plug-and-play developer experience:
          </p>
          <p>
            When no database environment keys are present, the bot initializes in <strong className="text-white">Local persistent mode</strong>, maintaining zero-latency memory databases and writing backups asynchronously to a <code className="font-mono text-amber-500 bg-white/5 px-1.5 py-0.5 rounded text-[11px] border border-white/5">db.json</code> file on disk. This preserves portfolio stats and logs across restarts.
          </p>
          <p>
            When `SUPABASE_KEY` is loaded, the bot seamlessly escalates transactions, saving histories directly into Supabase Postgres database tables.
          </p>
        </section>

      </div>
    </div>
  );
}
