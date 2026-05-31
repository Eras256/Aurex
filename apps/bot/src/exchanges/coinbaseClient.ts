import { NormalizedOrderBook } from '@arbitrage/core';
import WebSocket from 'ws';

import { createChildLogger } from '../core/logging/logger.js';

import { ExchangeAdapter, OrderBookCallback } from './exchangeAdapter.js';
import { MapOrderBook } from './orderBookUtils.js';

interface CoinbaseL2Update {
  side: 'bid' | 'offer';
  price_level: string;
  new_quantity: string;
}

/**
 * Coinbase Advanced Trade adapter. Consumes the public, unauthenticated market-data
 * WebSocket (wss://advanced-trade-ws.coinbase.com) `level2` channel — as of 2024+ most
 * market-data channels are available without a JWT. It emits an initial `snapshot`
 * followed by incremental `update` events ({ side, price_level, new_quantity }; a
 * new_quantity of 0 removes the level). We also subscribe to `heartbeats` to keep the
 * socket warm during quiet periods. Product BTC-USDT is normalised to `BTCUSDT`.
 */
export class CoinbaseClient implements ExchangeAdapter {
  id = 'coinbase';
  name = 'Coinbase Advanced';
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private reconnectCount = 0;
  private lastMessageTimestamp = 0;
  private callback: OrderBookCallback | null = null;
  private activeSymbol = 'BTCUSDT';
  private wsUrl: string;
  private book = new MapOrderBook();
  private snapshotReceived = false;
  // Exchange-stamped message time (ms) parsed from the level2 frame's ISO `timestamp`.
  private lastEventTime = 0;

  private logger = createChildLogger({
    component: 'ExchangeClient',
    exchangeId: 'coinbase',
    symbol: 'BTCUSDT',
  });

  constructor(wsUrl = 'wss://advanced-trade-ws.coinbase.com') {
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

  private mapSymbolToCoinbase(sym: string): string {
    // Coinbase's deepest, flagship book is BTC-USD. We treat USD and USDT as the same
    // US-dollar quote in this dollar-denominated simulation, so the canonical `BTCUSDT`
    // instrument is served from BTC-USD here — this is also what surfaces the well-known
    // "Coinbase premium/discount" as a genuine cross-venue dislocation signal.
    if (sym === 'BTCUSDT') return 'BTC-USD';
    if (sym === 'ETHUSDT') return 'ETH-USD';
    return sym;
  }

  async connect(): Promise<void> {
    if (this.wsConnected) return;
    this.logger.info({ eventType: 'INFO' }, `🔌 Connecting to Coinbase Advanced Trade WebSocket: ${this.wsUrl}`);

    return new Promise((resolve) => {
      this.ws = new WebSocket(this.wsUrl);
      const productId = this.mapSymbolToCoinbase(this.activeSymbol);

      this.ws.on('open', () => {
        this.logger.info({ eventType: 'INFO' }, '✅ Coinbase WebSocket connected. Subscribing to level2 + heartbeats...');
        this.wsConnected = true;
        this.reconnectCount = 0;
        this.lastMessageTimestamp = Date.now();
        this.snapshotReceived = false;
        this.book.reset();

        this.ws?.send(JSON.stringify({ type: 'subscribe', product_ids: [productId], channel: 'heartbeats' }));
        this.ws?.send(JSON.stringify({ type: 'subscribe', product_ids: [productId], channel: 'level2' }));
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.lastMessageTimestamp = Date.now();
        try {
          this.handleMessage(JSON.parse(data.toString()));
        } catch (error) {
          this.logger.error({ eventType: 'ERROR', error }, 'Failed to parse Coinbase WebSocket message');
        }
      });

      this.ws.on('close', () => {
        this.logger.warn({ eventType: 'WARNING' }, 'Coinbase WebSocket connection closed. Triggering reconnection...');
        this.wsConnected = false;
        this.handleReconnect();
      });

      this.ws.on('error', (err) => {
        this.logger.error({ eventType: 'ERROR', error: err }, 'Coinbase WebSocket error');
        this.wsConnected = false;
      });
    });
  }

  private handleMessage(payload: {
    channel?: string;
    timestamp?: string;
    events?: { type?: string; updates?: CoinbaseL2Update[] }[];
  }): void {
    if (payload.channel !== 'l2_data' || !payload.events) return;

    // Coinbase Advanced Trade stamps each frame with an ISO-8601 `timestamp`.
    if (payload.timestamp) {
      const parsed = Date.parse(payload.timestamp);
      if (Number.isFinite(parsed)) this.lastEventTime = parsed;
    }

    let touched = false;
    for (const event of payload.events) {
      if (event.type === 'snapshot') {
        this.book.reset();
        this.snapshotReceived = true;
      }
      if (!event.updates) continue;
      for (const u of event.updates) {
        const price = Number(u.price_level);
        const size = Number(u.new_quantity);
        if (u.side === 'bid') this.book.applyBid(price, size);
        else this.book.applyAsk(price, size);
      }
      touched = true;
    }

    if (touched && this.snapshotReceived) this.notify();
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
      eventTimestamp: this.lastEventTime || undefined,
    };
    this.callback(normalizedBook);
  }

  private handleReconnect(): void {
    this.reconnectCount++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectCount), 30000);
    setTimeout(() => {
      this.logger.info({ eventType: 'INFO' }, `🔄 Reconnecting to Coinbase Advanced Trade (Attempt ${this.reconnectCount})...`);
      this.connect().catch((err) => this.logger.error({ eventType: 'ERROR', error: err }, 'Failed to reconnect to Coinbase'));
    }, delay);
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.wsConnected = false;
    this.snapshotReceived = false;
    this.logger.info({ eventType: 'INFO' }, '❌ Disconnected Coinbase Advanced Trade WebSocket.');
  }

  subscribeOrderBook(symbol: string, callback: OrderBookCallback): void {
    this.activeSymbol = symbol;
    this.callback = callback;
    this.logger = createChildLogger({ component: 'ExchangeClient', exchangeId: this.id, symbol });
  }
}
