import { StatePayload } from '@arbitrage/core';

import { ArbitrageEngine } from '../engine/ArbitrageEngine.js';
import { BinanceClient, KrakenClient, CoinbaseClient } from '../exchanges/index.js';
import { orderBookStore } from '../orderbooks/normalizedOrderBookStore.js';
import { 
  getOpportunities, 
  getTrades, 
  getEvents, 
  getPnlSnapshots 
} from '../persistence/repositories.js';

const startTime = Date.now();

/**
 * Aggregates state parameters from the active engine, connections, databases, 
 * and cash accounts to craft a real-time synchronized StatePayload packet.
 */
export async function buildStatePayload(
  engine: ArbitrageEngine,
  exchanges: { binance: BinanceClient; kraken: KrakenClient; coinbase: CoinbaseClient }
): Promise<StatePayload> {
  const [opportunities, trades, events, pnlHistory] = await Promise.all([
    getOpportunities(50),
    getTrades(50),
    getEvents(30),
    getPnlSnapshots(),
  ]);

  const pnlMetrics = engine.pnlTracker.calculateMetrics(trades);
  
  // Construct connection logs
  const connections = {
    binance: {
      connected: exchanges.binance.isConnected(),
      reconnects: exchanges.binance.getReconnectCount(),
      lastMessageAt: exchanges.binance.getLastMessageTimestamp(),
    },
    kraken: {
      connected: exchanges.kraken.isConnected(),
      reconnects: exchanges.kraken.getReconnectCount(),
      lastMessageAt: exchanges.kraken.getLastMessageTimestamp(),
    },
    coinbase: {
      connected: exchanges.coinbase.isConnected(),
      reconnects: exchanges.coinbase.getReconnectCount(),
      lastMessageAt: exchanges.coinbase.getLastMessageTimestamp(),
    },
  };

  // Compile active L2 snapshots for active tickers
  const orderBooks: Record<string, { bids: any[]; asks: any[]; updatedAt: number }> = {};
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
      equityHistory: pnlHistory,
    },
    risk,
    events,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };
}
