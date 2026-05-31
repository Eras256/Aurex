import { NormalizedOrderBook } from '@arbitrage/core';
import WebSocket from 'ws';

import { createChildLogger } from '../core/logging/logger.js';

import { ExchangeAdapter, OrderBookCallback } from './exchangeAdapter.js';
import { MapOrderBook } from './orderBookUtils.js';

interface OkxLevel {
  0: string; // price
  1: string; // size
}

/**
 * OKX Spot adapter. Consumes the public, unauthenticated `books5` WebSocket channel
 * (wss://ws.okx.com:8443/ws/v5/public), which pushes the full top-5 L2 snapshot every
 * 100ms — no checksum/sequence bookkeeping required, maximising demo reliability.
 * Native instId BTC-USDT is normalised to the canonical `BTCUSDT` symbol so the engine
 * compares it directly against the other USDT-quoted venues.
 */
export class OKXClient implements ExchangeAdapter {
  id = 'okx';
  name = 'OKX Spot';
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private reconnectCount = 0;
  private lastMessageTimestamp = 0;
  private callback: OrderBookCallback | null = null;
  private activeSymbol = 'BTCUSDT';
  private wsUrl: string;
  private pingTimer: NodeJS.Timeout | null = null;
  private book = new MapOrderBook();
  // Exchange-stamped order-book generation time (ms) from the channel `ts` field.
  private lastEventTime = 0;

  private logger = createChildLogger({
    component: 'ExchangeClient',
    exchangeId: 'okx',
    symbol: 'BTCUSDT',
  });

  constructor(wsUrl = 'wss://ws.okx.com:8443/ws/v5/public') {
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

  private mapSymbolToOkx(sym: string): string {
    if (sym === 'BTCUSDT') return 'BTC-USDT';
    if (sym === 'ETHUSDT') return 'ETH-USDT';
    return sym;
  }

  async connect(): Promise<void> {
    if (this.wsConnected) return;
    this.logger.info({ eventType: 'INFO' }, `🔌 Connecting to OKX Spot WebSocket: ${this.wsUrl}`);

    return new Promise((resolve) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        this.logger.info({ eventType: 'INFO' }, '✅ OKX Spot WebSocket connected. Subscribing to books5 channel...');
        this.wsConnected = true;
        this.reconnectCount = 0;
        this.lastMessageTimestamp = Date.now();
        this.book.reset();

        this.ws?.send(
          JSON.stringify({
            op: 'subscribe',
            args: [{ channel: 'books5', instId: this.mapSymbolToOkx(this.activeSymbol) }],
          })
        );

        // OKX closes idle sockets after 30s; send a raw `ping` keepalive every 20s.
        this.pingTimer = setInterval(() => {
          if (this.wsConnected && this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping');
        }, 20000);

        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.lastMessageTimestamp = Date.now();
        const raw = data.toString();
        if (raw === 'pong') return;
        try {
          this.handleMessage(JSON.parse(raw));
        } catch (error) {
          this.logger.error({ eventType: 'ERROR', error }, 'Failed to parse OKX Spot WebSocket message');
        }
      });

      this.ws.on('close', () => {
        this.logger.warn({ eventType: 'WARNING' }, 'OKX Spot WebSocket connection closed. Triggering reconnection...');
        this.wsConnected = false;
        this.clearPing();
        this.handleReconnect();
      });

      this.ws.on('error', (err) => {
        this.logger.error({ eventType: 'ERROR', error: err }, 'OKX Spot WebSocket error');
        this.wsConnected = false;
      });
    });
  }

  private handleMessage(payload: {
    event?: string;
    arg?: { channel?: string };
    data?: { asks: OkxLevel[]; bids: OkxLevel[]; ts?: string }[];
  }): void {
    if (payload.event) {
      if (payload.event === 'error') {
        this.logger.error({ eventType: 'ERROR', payload }, 'OKX subscription error');
      }
      return;
    }
    if (payload.arg?.channel !== 'books5' || !payload.data || payload.data.length === 0) return;

    const snap = payload.data[0];
    // `ts` is OKX's order-book generation time (ms). Capture it for true latency.
    if (snap.ts) {
      const ts = Number(snap.ts);
      if (Number.isFinite(ts)) this.lastEventTime = ts;
    }
    // books5 always pushes a complete top-5 snapshot.
    this.book.loadSnapshot(
      snap.bids.map((b) => [b[0], b[1]] as [string, string]),
      snap.asks.map((a) => [a[0], a[1]] as [string, string])
    );
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
      eventTimestamp: this.lastEventTime || undefined,
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
      this.logger.info({ eventType: 'INFO' }, `🔄 Reconnecting to OKX Spot (Attempt ${this.reconnectCount})...`);
      this.connect().catch((err) => this.logger.error({ eventType: 'ERROR', error: err }, 'Failed to reconnect to OKX Spot'));
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
    this.logger.info({ eventType: 'INFO' }, '❌ Disconnected OKX Spot WebSocket.');
  }

  subscribeOrderBook(symbol: string, callback: OrderBookCallback): void {
    this.activeSymbol = symbol;
    this.callback = callback;
    this.logger = createChildLogger({ component: 'ExchangeClient', exchangeId: this.id, symbol });
  }
}
