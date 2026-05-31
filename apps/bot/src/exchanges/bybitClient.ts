import { NormalizedOrderBook } from '@arbitrage/core';
import WebSocket from 'ws';

import { createChildLogger } from '../core/logging/logger.js';

import { ExchangeAdapter, OrderBookCallback } from './exchangeAdapter.js';
import { MapOrderBook } from './orderBookUtils.js';

/**
 * Bybit Spot adapter. Consumes the public v5 spot stream
 * (wss://stream.bybit.com/v5/public/spot) `orderbook.50.<symbol>` topic, which emits an
 * initial `snapshot` followed by 20ms `delta` frames. Deltas are merged into a local
 * price-keyed book (size `0` removes a level). No authentication required.
 */
export class BybitClient implements ExchangeAdapter {
  id = 'bybit';
  name = 'Bybit Spot';
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private reconnectCount = 0;
  private lastMessageTimestamp = 0;
  private callback: OrderBookCallback | null = null;
  private activeSymbol = 'BTCUSDT';
  private wsUrl: string;
  private pingTimer: NodeJS.Timeout | null = null;
  private book = new MapOrderBook();
  private snapshotReceived = false;

  private logger = createChildLogger({
    component: 'ExchangeClient',
    exchangeId: 'bybit',
    symbol: 'BTCUSDT',
  });

  constructor(wsUrl = 'wss://stream.bybit.com/v5/public/spot') {
    this.wsUrl = wsUrl;
  }

  isConnected(): boolean {
    return this.wsConnected;
  }

  getReconnectCount(): number {
    return this.reconnectCount;
  }

  getLastMessageTimestamp(): number {
    return this.lastMessageTimestamp;
  }

  async connect(): Promise<void> {
    if (this.wsConnected) return;
    this.logger.info({ eventType: 'INFO' }, `🔌 Connecting to Bybit Spot WebSocket: ${this.wsUrl}`);

    return new Promise((resolve) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        this.logger.info({ eventType: 'INFO' }, '✅ Bybit Spot WebSocket connected. Subscribing to orderbook.50...');
        this.wsConnected = true;
        this.reconnectCount = 0;
        this.lastMessageTimestamp = Date.now();
        this.snapshotReceived = false;
        this.book.reset();

        this.ws?.send(JSON.stringify({ op: 'subscribe', args: [`orderbook.50.${this.activeSymbol}`] }));

        // Bybit drops idle sockets after 10 minutes; ping every 20s per docs.
        this.pingTimer = setInterval(() => {
          if (this.wsConnected && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ op: 'ping' }));
          }
        }, 20000);

        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.lastMessageTimestamp = Date.now();
        try {
          this.handleMessage(JSON.parse(data.toString()));
        } catch (error) {
          this.logger.error({ eventType: 'ERROR', error }, 'Failed to parse Bybit Spot WebSocket message');
        }
      });

      this.ws.on('close', () => {
        this.logger.warn({ eventType: 'WARNING' }, 'Bybit Spot WebSocket connection closed. Triggering reconnection...');
        this.wsConnected = false;
        this.clearPing();
        this.handleReconnect();
      });

      this.ws.on('error', (err) => {
        this.logger.error({ eventType: 'ERROR', error: err }, 'Bybit Spot WebSocket error');
        this.wsConnected = false;
      });
    });
  }

  private handleMessage(payload: {
    op?: string;
    topic?: string;
    type?: string;
    data?: { b?: [string, string][]; a?: [string, string][] };
  }): void {
    // Subscription/pong acknowledgements carry an `op` field; ignore them.
    if (payload.op) return;
    if (!payload.topic || !payload.topic.startsWith('orderbook') || !payload.data) return;

    const { b: bids, a: asks } = payload.data;

    if (payload.type === 'snapshot') {
      this.book.loadSnapshot(bids ?? [], asks ?? []);
      this.snapshotReceived = true;
    } else if (payload.type === 'delta') {
      if (!this.snapshotReceived) return; // Wait for the base snapshot before applying deltas
      if (bids) for (const [p, s] of bids) this.book.applyBid(Number(p), Number(s));
      if (asks) for (const [p, s] of asks) this.book.applyAsk(Number(p), Number(s));
    } else {
      return;
    }

    this.notify();
  }

  private notify(): void {
    if (!this.callback || !this.book.hasDepth()) return;
    const normalizedBook: NormalizedOrderBook = {
      exchangeId: this.id,
      symbol: this.activeSymbol,
      bids: this.book.topBids(10),
      asks: this.book.topAsks(10),
      lastUpdateId: Date.now().toString(),
      updatedAt: Date.now(),
    };
    this.callback(normalizedBook);
  }

  private clearPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handleReconnect(): void {
    this.reconnectCount++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectCount), 30000);
    setTimeout(() => {
      this.logger.info({ eventType: 'INFO' }, `🔄 Reconnecting to Bybit Spot (Attempt ${this.reconnectCount})...`);
      this.connect().catch((err) => this.logger.error({ eventType: 'ERROR', error: err }, 'Failed to reconnect to Bybit Spot'));
    }, delay);
  }

  async disconnect(): Promise<void> {
    this.clearPing();
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.wsConnected = false;
    this.snapshotReceived = false;
    this.logger.info({ eventType: 'INFO' }, '❌ Disconnected Bybit Spot WebSocket.');
  }

  subscribeOrderBook(symbol: string, callback: OrderBookCallback): void {
    this.activeSymbol = symbol;
    this.callback = callback;
    this.logger = createChildLogger({ component: 'ExchangeClient', exchangeId: this.id, symbol });
  }
}
