import { StatePayload, OrderBookLevel } from '@arbitrage/core';

import { ArbitrageEngine } from '../engine/ArbitrageEngine.js';
import { ExchangeAdapter } from '../exchanges/index.js';
import { orderBookStore } from '../orderbooks/normalizedOrderBookStore.js';
import {
  getBlendedOpportunities,
  getTrades,
  getEvents,
  getPnlSnapshots,
  getTotalTradesExecuted
} from '../persistence/repositories.js';

const startTime = Date.now();

/**
 * Aggregates state parameters from the active engine, connections, databases,
 * and cash accounts to craft a real-time synchronized StatePayload packet.
 */
export async function buildStatePayload(
  engine: ArbitrageEngine,
  exchanges: Record<string, ExchangeAdapter>
): Promise<StatePayload> {
  const [opportunities, trades, events, pnlHistory] = await Promise.all([
    getBlendedOpportunities(50),
    getTrades(50),
    getEvents(30),
    getPnlSnapshots(),
  ]);

  const pnlMetrics = engine.pnlTracker.calculateMetrics(trades);
  // `calculateMetrics` derives totalTrades from the trade array it is given, and the array
  // above is the last-50 display slice — so left alone the count freezes at 50 and avg
  // profit/trade inflates. Report the true cumulative counter instead (never understate).
  const cumulativeTrades = Math.max(getTotalTradesExecuted(), pnlMetrics.totalTrades);

  // Construct connection telemetry dynamically for every wired venue.
  const connections: StatePayload['connections'] = {};
  for (const [id, adapter] of Object.entries(exchanges)) {
    connections[id] = {
      connected: adapter.isConnected(),
      reconnects: adapter.getReconnectCount(),
      lastMessageAt: adapter.getLastMessageTimestamp(),
    };
  }

  // Compile active L2 snapshots for active tickers
  const orderBooks: Record<string, { bids: OrderBookLevel[]; asks: OrderBookLevel[]; updatedAt: number }> = {};
  for (const [exchangeId, symbolBooks] of Object.entries(orderBookStore.getAllBooks())) {
    for (const [symbol, book] of Object.entries(symbolBooks)) {
      orderBooks[`${exchangeId}:${symbol}`] = {
        bids: book.bids.slice(0, 10), // Send all 10 levels for detailed book visualization
        asks: book.asks.slice(0, 10),
        updatedAt: book.updatedAt,
      };
    }
  }

  const wallets = engine.getWallets();
  const risk = engine.riskManager.getRiskStatus(wallets);

  return {
    config: engine.getConfig(),
    connections,
    orderBooks,
    wallets,
    opportunities,
    trades,
    pnl: {
      ...pnlMetrics,
      totalTrades: cumulativeTrades,
      equityHistory: pnlHistory,
    },
    risk,
    metrics: engine.getMetrics(),
    events,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    triangular: engine.getTriangularState(),
  };
}
