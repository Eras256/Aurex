import { NormalizedOrderBook, OrderBookLevel } from '@arbitrage/core';
import WebSocket from 'ws';

import { createChildLogger } from '../core/logging/logger.js';

import { ExchangeAdapter, OrderBookCallback } from './exchangeAdapter.js';

export class BinanceClient implements ExchangeAdapter {
  id = 'binance';
  name = 'Binance Spot';
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private reconnectCount = 0;
  private lastMessageTimestamp = 0;
  private callback: OrderBookCallback | null = null;
  private activeSymbol = 'BTCUSDT';
  private wsUrl: string;
  private restUrl: string;

  // Custom L2 depth cache
  private localAsks: OrderBookLevel[] = [];
  private localBids: OrderBookLevel[] = [];
  private lastUpdateId = 0;
  private eventBuffer: any[] = [];
  private isSyncing = false;
  private snapshotReceived = false;
  // Cap the sync buffer: if a snapshot fetch stalls (rate limit, network), the diff stream
  // keeps pushing every 100ms and the buffer must not grow unboundedly.
  private static readonly MAX_BUFFERED_EVENTS = 2000;
  // Resync-storm guard: count true sequence-gap resyncs within a rolling window. Stale
  // overlapping events (normal right after a snapshot) are dropped and never count here;
  // only genuine forward gaps do, so hitting the limit means the stream itself is unhealthy
  // and only a fresh socket realigns it.
  private resyncCount = 0;
  private resyncWindowStart = 0;
  // Exchange-stamped event time (ms) from the most recent diff frame's `E` field.
  private lastEventTime = 0;

  // Custom structured child logger for BinanceClient
  private logger = createChildLogger({
    component: 'ExchangeClient',
    exchangeId: 'binance',
    symbol: 'BTCUSDT',
  });

  constructor(
    wsUrl = 'wss://stream.binance.com:9443/ws',
    restUrl = 'https://api.binance.com'
  ) {
    this.wsUrl = wsUrl;
    this.restUrl = restUrl;
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

    this.isSyncing = true;
    this.eventBuffer = [];
    this.snapshotReceived = false;

    // Use official Spot WebSocket diff depth stream pushed every 100ms
    const streamUrl = `${this.wsUrl}/${this.activeSymbol.toLowerCase()}@depth@100ms`;
    this.logger.info({ eventType: 'INFO' }, `🔌 Connecting to Binance Spot WebSocket: ${streamUrl}`);

    return new Promise((resolve) => {
      this.ws = new WebSocket(streamUrl);

      this.ws.on('open', () => {
        this.logger.info({ eventType: 'INFO' }, '✅ Binance Spot WebSocket connected. Commencing REST snapshot fetch...');
        this.wsConnected = true;
        this.reconnectCount = 0;
        this.lastMessageTimestamp = Date.now();

        // Asynchronously trigger depth snapshot fetch
        this.fetchSnapshot()
          .then(() => resolve())
          .catch((error) => {
            this.logger.error({ eventType: 'ERROR', error }, 'Failed to initialize Binance depth snapshot; recycling socket.');
            // Without a snapshot the client would buffer diffs forever; closing the socket
            // hands recovery to the backoff reconnect cycle driven by the 'close' handler.
            this.ws?.close();
            resolve(); // Resolve to avoid stalling bootstrap
          });
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.lastMessageTimestamp = Date.now();
        try {
          const payload = JSON.parse(data.toString());
          if (payload.e === 'depthUpdate') {
            this.handleDepthMessage(payload);
          }
        } catch (error) {
          this.logger.error({ eventType: 'ERROR', error }, 'Failed to parse Binance Spot diff order book message');
        }
      });

      this.ws.on('close', () => {
        this.logger.warn({ eventType: 'WARNING' }, 'Binance Spot WebSocket connection lost. Initiating reconnect cycle...');
        this.wsConnected = false;
        this.handleReconnect();
      });

      this.ws.on('error', (err) => {
        this.logger.error({ eventType: 'ERROR', error: err }, 'Binance Spot WebSocket connection error');
        this.wsConnected = false;
      });
    });
  }

  private handleDepthMessage(payload: any) {
    if (this.isSyncing) {
      if (this.eventBuffer.length >= BinanceClient.MAX_BUFFERED_EVENTS) {
        this.logger.warn(
          { eventType: 'WARNING', buffered: this.eventBuffer.length },
          '⚠️ Diff buffer overflow while awaiting snapshot; recycling socket.'
        );
        this.ws?.close();
        return;
      }
      this.eventBuffer.push(payload);
      return;
    }

    const result = this.applySequencedEvent(payload);
    if (result === 'gap') {
      this.logger.warn(
        { eventType: 'WARNING', expectedU: this.lastUpdateId + 1, receivedU: payload.U },
        '⚠️ Binance sequence gap detected. Triggering resync...'
      );
      this.triggerResync();
      return;
    }
    if (result === 'applied') {
      // A clean in-sequence diff means the stream is healthy again; clear the desync streak.
      this.resyncCount = 0;
      this.notifyListeners();
    }
    // 'stale' events — replays of updates already covered by the snapshot, normal for a few
    // hundred ms after each (re)sync — are dropped silently. Treating them as desync is what
    // previously caused an infinite resync/reconnect storm.
  }

  /**
   * Applies one diff event under the official Spot local-order-book sequence rules:
   * - `u <= lastUpdateId`              → stale replay of already-applied updates: drop.
   * - `U > lastUpdateId + 1`           → true forward gap (missed updates): caller resyncs.
   * - `U <= lastUpdateId + 1 <= u`     → apply. Levels carry absolute amounts, so an event
   *                                      partially overlapping our state applies idempotently.
   * The strict `U === lastUpdateId + 1` continuity is the healthy steady-state subcase of
   * the third rule.
   */
  private applySequencedEvent(payload: any): 'applied' | 'stale' | 'gap' {
    if (payload.u <= this.lastUpdateId) return 'stale';
    if (payload.U > this.lastUpdateId + 1) return 'gap';

    this.applyDiffs(payload.b, payload.a);
    this.lastUpdateId = payload.u;
    // `E` is Binance's event time in ms (per Spot WS diff-depth spec).
    if (typeof payload.E === 'number') this.lastEventTime = payload.E;
    return 'applied';
  }

  private async fetchSnapshot() {
    this.logger.info({ eventType: 'INFO' }, `📥 Fetching REST depth snapshot from: ${this.restUrl}`);
    
    const url = `${this.restUrl}/api/v3/depth?symbol=${this.activeSymbol.toUpperCase()}&limit=100`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch Binance depth snapshot. Status: ${response.status}`);
    }

    const snapshot = await response.json();
    this.lastUpdateId = snapshot.lastUpdateId;

    this.localBids = snapshot.bids.map((b: [string, string]) => ({
      price: parseFloat(b[0]),
      amount: parseFloat(b[1]),
    }));

    this.localAsks = snapshot.asks.map((a: [string, string]) => ({
      price: parseFloat(a[0]),
      amount: parseFloat(a[1]),
    }));

    this.logger.info(
      { eventType: 'INFO', lastUpdateId: this.lastUpdateId },
      `📥 Binance depth snapshot received. Processing ${this.eventBuffer.length} buffered diff events...`
    );

    // Replay buffered events through the same sequence rules as live events: stale ones
    // (u <= snapshot lastUpdateId) are dropped, a genuine forward gap forces a resync.
    const buffered = this.eventBuffer;
    this.eventBuffer = [];
    for (const ev of buffered) {
      if (this.applySequencedEvent(ev) === 'gap') {
        this.logger.warn(
          { eventType: 'WARNING', expectedU: this.lastUpdateId + 1, receivedU: ev.U },
          '⚠️ Buffered events sequence gap detected. Triggering resync...'
        );
        this.triggerResync();
        return;
      }
    }

    this.isSyncing = false;
    this.snapshotReceived = true;
    this.notifyListeners();
  }

  private applyDiffs(bidsUpdate: [string, string][], asksUpdate: [string, string][]) {
    // Process Bids
    for (const b of bidsUpdate) {
      const price = parseFloat(b[0]);
      const amount = parseFloat(b[1]);

      if (amount === 0) {
        const index = this.localBids.findIndex((level) => level.price === price);
        if (index !== -1) {
          this.localBids.splice(index, 1);
        }
      } else {
        const index = this.localBids.findIndex((level) => level.price === price);
        if (index !== -1) {
          this.localBids[index].amount = amount;
        } else {
          this.localBids.push({ price, amount });
        }
      }
    }

    // Process Asks
    for (const a of asksUpdate) {
      const price = parseFloat(a[0]);
      const amount = parseFloat(a[1]);

      if (amount === 0) {
        const index = this.localAsks.findIndex((level) => level.price === price);
        if (index !== -1) {
          this.localAsks.splice(index, 1);
        }
      } else {
        const index = this.localAsks.findIndex((level) => level.price === price);
        if (index !== -1) {
          this.localAsks[index].amount = amount;
        } else {
          this.localAsks.push({ price, amount });
        }
      }
    }

    // Sort Asks ascending, Bids descending
    this.localBids.sort((x, y) => y.price - x.price);
    this.localAsks.sort((x, y) => x.price - y.price);

    // Slice to top 10 levels
    this.localBids = this.localBids.slice(0, 10);
    this.localAsks = this.localAsks.slice(0, 10);
  }

  private triggerResync() {
    this.isSyncing = true;
    this.eventBuffer = [];
    this.snapshotReceived = false;

    // Count resyncs inside a 10s rolling window.
    const now = Date.now();
    if (now - this.resyncWindowStart > 10_000) {
      this.resyncWindowStart = now;
      this.resyncCount = 0;
    }
    this.resyncCount++;

    // Persistent desync: re-fetching snapshots is futile because the WS stream is lagging
    // behind real time. Tear the socket down — the 'close' handler drives the backoff
    // reconnect cycle, which re-snapshots against a fresh, real-time stream.
    if (this.resyncCount >= 5) {
      this.logger.warn(
        { eventType: 'WARNING', resyncCount: this.resyncCount },
        '⚠️ Persistent Binance diff-stream desync; reconnecting WebSocket to realign.'
      );
      this.resyncCount = 0;
      this.resyncWindowStart = 0;
      this.ws?.close();
      return;
    }

    this.fetchSnapshot().catch((err) => {
      this.logger.error({ eventType: 'ERROR', error: err }, 'Failed to resync Binance local order book; recycling socket.');
      // A failed resync snapshot would leave the client buffering forever (isSyncing stays
      // true). Close the socket so the backoff reconnect cycle owns recovery.
      this.ws?.close();
    });
  }

  private notifyListeners() {
    if (!this.callback) return;

    const normalizedBook: NormalizedOrderBook = {
      exchangeId: this.id,
      symbol: this.activeSymbol,
      bids: this.localBids,
      asks: this.localAsks,
      lastUpdateId: this.lastUpdateId.toString(),
      updatedAt: Date.now(),
      eventTimestamp: this.lastEventTime || undefined,
    };

    this.callback(normalizedBook);
  }

  private handleReconnect() {
    this.reconnectCount++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectCount), 30000);
    setTimeout(() => {
      this.logger.info({ eventType: 'INFO' }, `🔄 Reconnecting to Binance Spot (Attempt ${this.reconnectCount})...`);
      this.connect().catch((err) => this.logger.error({ eventType: 'ERROR', error: err }, 'Failed to reconnect to Binance Spot'));
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
    this.isSyncing = false;
    this.eventBuffer = [];
    this.logger.info({ eventType: 'INFO' }, '❌ Disconnected Binance Spot WebSocket.');
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
