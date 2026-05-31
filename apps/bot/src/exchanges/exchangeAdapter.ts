import { NormalizedOrderBook } from '@arbitrage/core';

export interface OrderBookCallback {
  (book: NormalizedOrderBook): void;
}

export interface ExchangeAdapter {
  id: string;
  name: string;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribeOrderBook(symbol: string, callback: OrderBookCallback): void;
  getReconnectCount(): number;
  getLastMessageTimestamp(): number;
}
