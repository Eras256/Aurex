import { NormalizedOrderBook, OrderBookLevel } from '@arbitrage/core';

/**
 * Creates a synthetic NormalizedOrderBook centered around a midPrice.
 * Generates 10 levels of bid/ask depth with minor price and liquidity increments.
 */
export function createMockOrderBook(
  exchangeId: string,
  symbol: string,
  midPrice: number,
  spreadPercent: number = 0.05 // Spacing in percentage (e.g. 0.05%)
): NormalizedOrderBook {
  const spreadHalf = (midPrice * (spreadPercent / 100)) / 2;
  const bestBid = midPrice - spreadHalf;
  const bestAsk = midPrice + spreadHalf;

  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

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

/**
 * Generates default, mock wallet balances with symmetric funding pools for testing engine responses.
 */
export function createMockWalletBalances() {
  return {
    binance: {
      BTC: { free: 2.0, locked: 0 },
      USDT: { free: 100000, locked: 0 },
    },
    kraken: {
      BTC: { free: 2.0, locked: 0 },
      USDT: { free: 100000, locked: 0 },
    },
  };
}
export * from './mocks.js';
