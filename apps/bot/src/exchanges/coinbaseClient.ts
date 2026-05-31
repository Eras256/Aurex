import { NormalizedOrderBook } from '@arbitrage/core';

import { createChildLogger } from '../core/logging/logger.js';

import { ExchangeAdapter, OrderBookCallback } from './exchangeAdapter.js';

function localMockOrderBook(
  exchangeId: string,
  symbol: string,
  midPrice: number,
  spreadPercent: number = 0.05
): NormalizedOrderBook {
  const spreadHalf = (midPrice * (spreadPercent / 100)) / 2;
  const bestBid = midPrice - spreadHalf;
  const bestAsk = midPrice + spreadHalf;

  const bids = [];
  const asks = [];

  for (let i = 0; i < 10; i++) {
    bids.push({
      price: parseFloat((bestBid - i * (midPrice * 0.0002)).toFixed(2)),
      amount: parseFloat((0.2 + Math.random() * 1.8).toFixed(4)),
    });
    asks.push({
      price: parseFloat((bestAsk + i * (midPrice * 0.0002)).toFixed(2)),
      amount: parseFloat((0.2 + Math.random() * 1.8).toFixed(4)),
    });
  }

  return {
    exchangeId,
    symbol,
    bids,
    asks,
    lastUpdateId: Math.floor(Math.random() * 1000000).toString(),
    updatedAt: Date.now(),
  };
}

export class CoinbaseClient implements ExchangeAdapter {
  id = 'coinbase';
  name = 'Coinbase Advanced';
  private connected = false;
  private callback: OrderBookCallback | null = null;
  private activeSymbol = 'BTCUSD';
  private intervalId: NodeJS.Timeout | null = null;

  // Custom structured child logger for CoinbaseClient
  private logger = createChildLogger({
    component: 'ExchangeClient',
    exchangeId: 'coinbase',
    symbol: 'BTCUSD',
  });

  isConnected(): boolean {
    return this.connected;
  }

  getReconnectCount(): number {
    return 0;
  }

  getLastMessageTimestamp(): number {
    return this.connected ? Date.now() : 0;
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.logger.info({ eventType: 'INFO' }, '🔌 Connected to Coinbase Advanced Trade (Simulation Adapter).');

    // Emit live order books to demonstrate plug-and-play capability
    this.intervalId = setInterval(() => {
      if (this.callback) {
        // Center around typical BTCUSD mid-range
        const mockBook = localMockOrderBook('coinbase', this.activeSymbol, 68050 + (Math.random() - 0.5) * 40, 0.06);
        this.callback(mockBook);
      }
    }, 1500);
  }

  async disconnect(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.connected = false;
    this.logger.info({ eventType: 'INFO' }, '❌ Disconnected Coinbase Advanced Trade.');
  }

  subscribeOrderBook(symbol: string, callback: OrderBookCallback): void {
    this.activeSymbol = symbol;
    this.callback = callback;
    this.logger = createChildLogger({
      component: 'ExchangeClient',
      exchangeId: this.id,
      symbol,
    });
  }
}
