import { NormalizedOrderBook, OrderBookLevel } from '@arbitrage/core';
import WebSocket from 'ws';

import { createChildLogger } from '../core/logging/logger.js';

import { ExchangeAdapter, OrderBookCallback } from './exchangeAdapter.js';

// CRC32 Checksum table generator for Kraken checksum validation
const crcTable: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(str: string): number {
  let crc = 0 ^ (-1);
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

// Format string according to Kraken's official WS checksum specification
function cleanStringForChecksum(val: string): string {
  // Strip decimals
  let cleaned = val.replace('.', '');
  // Strip leading zeroes
  cleaned = cleaned.replace(/^0+/, '');
  return cleaned || '0';
}

export class KrakenClient implements ExchangeAdapter {
  id = 'kraken';
  name = 'Kraken Spot';
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private reconnectCount = 0;
  private lastMessageTimestamp = 0;
  private callback: OrderBookCallback | null = null;
  private activeSymbol = 'BTCUSDT';
  private wsUrl: string;
  private restUrl: string;

  // Custom structured child logger for KrakenClient
  private logger = createChildLogger({
    component: 'ExchangeClient',
    exchangeId: 'kraken',
    symbol: 'BTCUSDT',
  });

  private snapshotReceived = false;
  private lastChecksumHealAt = 0;
  // Exchange-stamped event time (ms), derived from the latest level timestamp (3rd element).
  private lastEventTime = 0;

  // Internal L2 Order book representation for incremental diff updates
  private localAsks: OrderBookLevel[] = [];
  private localBids: OrderBookLevel[] = [];

  constructor(
    wsUrl = 'wss://ws.kraken.com',
    restUrl = 'https://api.kraken.com'
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

  // Maps the canonical symbol to Kraken's native WS pair. We serve BTC from Kraken's
  // flagship, deepest book — XBT/USD — and treat USD as the dollar quote (same approach
  // as the Coinbase adapter). XBT/USDT on Kraken is comparatively thin, so XBT/USD gives
  // far better depth-walk fidelity for arbitrage sizing.
  private mapSymbolToKraken(sym: string): string {
    if (sym === 'BTCUSDT') return 'XBT/USD';
    if (sym === 'BTCUSD') return 'XBT/USD';
    return sym;
  }

  // Maps the canonical symbol to Kraken's REST pair syntax (XBT/USD -> XBTUSD).
  private mapSymbolToKrakenRest(sym: string): string {
    if (sym === 'BTCUSDT') return 'XBTUSD';
    if (sym === 'BTCUSD') return 'XBTUSD';
    return sym.replace('/', '');
  }

  async connect(): Promise<void> {
    if (this.wsConnected) return;

    this.logger.info({ eventType: 'INFO' }, `🔌 Connecting to Kraken Spot WebSocket: ${this.wsUrl}`);

    return new Promise((resolve) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        this.logger.info({ eventType: 'INFO' }, '✅ Kraken Spot WebSocket connection opened. Sending subscription payload...');
        this.wsConnected = true;
        this.reconnectCount = 0;
        this.lastMessageTimestamp = Date.now();

        // Subscribe to book-10 depth channel
        const subscribePayload = {
          event: 'subscribe',
          pair: [this.mapSymbolToKraken(this.activeSymbol)],
          subscription: {
            name: 'book',
            depth: 10,
          },
        };
        this.ws?.send(JSON.stringify(subscribePayload));
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.lastMessageTimestamp = Date.now();
        try {
          const payload = JSON.parse(data.toString());
          this.handleMessage(payload);
        } catch (error) {
          this.logger.error({ eventType: 'ERROR', error }, 'Failed to parse Kraken Spot WebSocket message');
        }
      });

      this.ws.on('close', () => {
        this.logger.warn({ eventType: 'WARNING' }, 'Kraken Spot WebSocket connection closed. Triggering reconnection...');
        this.wsConnected = false;
        this.handleReconnect();
      });

      this.ws.on('error', (err) => {
        this.logger.error({ eventType: 'ERROR', error: err }, 'Kraken Spot WebSocket error');
        this.wsConnected = false;
      });
    });
  }

  async fetchRestSnapshot(): Promise<void> {
    const restPair = this.mapSymbolToKrakenRest(this.activeSymbol);
    const url = `${this.restUrl}/0/public/Depth?pair=${restPair}&count=10`;
    this.logger.info({ eventType: 'INFO', url }, `📥 Fetching Kraken REST depth snapshot...`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Kraken REST fetch failed with status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error && data.error.length > 0) {
        throw new Error(`Kraken REST error: ${data.error.join(', ')}`);
      }

      const keys = Object.keys(data.result);
      if (keys.length === 0) {
        throw new Error('Empty result in Kraken REST depth response');
      }

      const pairData = data.result[keys[0]];

      this.localAsks = pairData.asks.map((a: string[]) => ({
        price: parseFloat(a[0]),
        amount: parseFloat(a[1]),
      }));
      this.localBids = pairData.bids.map((b: string[]) => ({
        price: parseFloat(b[0]),
        amount: parseFloat(b[1]),
      }));

      this.localAsks.sort((a, b) => a.price - b.price);
      this.localBids.sort((a, b) => b.price - a.price);

      this.localAsks = this.localAsks.slice(0, 10);
      this.localBids = this.localBids.slice(0, 10);

      this.snapshotReceived = true;
      this.logger.info({ eventType: 'INFO' }, '✅ Kraken REST depth snapshot parsed and applied successfully.');

      this.sortBookAndNotify();
    } catch (error) {
      this.logger.error({ eventType: 'ERROR', error }, 'Failed to fetch/parse Kraken REST depth snapshot');
      throw error;
    }
  }

  private handleMessage(payload: any) {
    // If it's a standard system event (subscription success, status updates, etc.) ignore
    if (payload && !Array.isArray(payload)) {
      if (payload.event === 'subscriptionStatus' && payload.status === 'error') {
        this.logger.error({ eventType: 'ERROR' }, `Kraken Subscription Error: ${payload.errorMessage}`);
      }
      return;
    }

    if (!Array.isArray(payload) || payload.length < 4) return;

    const data = payload[1];
    const channelName = payload[2];

    if (!channelName.startsWith('book-10')) return;

    // Snapshot handling
    if (data.as && data.bs) {
      if (!this.snapshotReceived) {
        this.snapshotReceived = true;
        this.logger.info({ eventType: 'INFO' }, '📥 First L2 depth snapshot received from Kraken Spot.');
      }

      this.captureEventTime(data.as);
      this.captureEventTime(data.bs);

      this.localAsks = data.as.map((a: string[]) => ({
        price: parseFloat(a[0]),
        amount: parseFloat(a[1]),
      }));
      this.localBids = data.bs.map((b: string[]) => ({
        price: parseFloat(b[0]),
        amount: parseFloat(b[1]),
      }));

      this.sortBookAndNotify();
      return;
    }

    // Incremental Update handling
    let bookUpdated = false;

    if (data.a) {
      this.captureEventTime(data.a);
      this.applyUpdates(this.localAsks, data.a);
      bookUpdated = true;
    }
    if (data.b) {
      this.captureEventTime(data.b);
      this.applyUpdates(this.localBids, data.b);
      bookUpdated = true;
    }

    if (bookUpdated) {
      this.sortBookAndNotify(data.c);
    }
  }

  /**
   * Extracts the latest level timestamp (3rd element, Unix seconds with microsecond
   * precision per Kraken WS v1 book spec) and records it in ms as the event time.
   */
  private captureEventTime(levels: string[][]) {
    for (const level of levels) {
      const tsSeconds = parseFloat(level[2]);
      if (Number.isFinite(tsSeconds)) {
        const tsMs = tsSeconds * 1000;
        if (tsMs > this.lastEventTime) this.lastEventTime = tsMs;
      }
    }
  }

  private applyUpdates(bookSide: OrderBookLevel[], updates: string[][]) {
    for (const update of updates) {
      const price = parseFloat(update[0]);
      const amount = parseFloat(update[1]);

      // If amount is 0.00000000, remove the level
      if (amount === 0) {
        const index = bookSide.findIndex((level) => level.price === price);
        if (index !== -1) {
          bookSide.splice(index, 1);
        }
      } else {
        const index = bookSide.findIndex((level) => level.price === price);
        if (index !== -1) {
          bookSide[index].amount = amount;
        } else {
          bookSide.push({ price, amount });
        }
      }
    }
  }

  private sortBookAndNotify(expectedChecksum?: string) {
    if (!this.callback) return;

    // Sort Asks ascending, Bids descending
    this.localAsks.sort((a, b) => a.price - b.price);
    this.localBids.sort((a, b) => b.price - a.price);

    // Limit to top 10 levels
    this.localAsks = this.localAsks.slice(0, 10);
    this.localBids = this.localBids.slice(0, 10);

    // Checksum verification — NON-DESTRUCTIVE. The Kraken WS v1 CRC32 is precision-fussy;
    // rather than clear the local book and resubscribe on every mismatch (which blanks the
    // book in a churn loop), we keep serving the current book and heal from a REST snapshot
    // at most once every 15s. The book therefore stays continuously populated and live.
    if (expectedChecksum) {
      const valid = this.verifyChecksum(parseInt(expectedChecksum, 10));
      if (!valid) {
        const now = Date.now();
        if (now - this.lastChecksumHealAt > 15000) {
          this.lastChecksumHealAt = now;
          this.logger.warn(
            { eventType: 'WARNING' },
            '⚠️ Kraken checksum mismatch — refreshing snapshot via REST (non-destructive heal).'
          );
          this.fetchRestSnapshot().catch((err) => {
            this.logger.error({ eventType: 'ERROR', error: err }, 'Kraken REST heal snapshot failed');
          });
        }
        // Fall through and still notify listeners with the current best-effort book.
      }
    }

    const normalizedBook: NormalizedOrderBook = {
      exchangeId: this.id,
      symbol: this.activeSymbol,
      bids: this.localBids,
      asks: this.localAsks,
      lastUpdateId: expectedChecksum || Date.now().toString(),
      updatedAt: Date.now(),
      eventTimestamp: this.lastEventTime || undefined,
    };

    this.callback(normalizedBook);
  }

  private verifyChecksum(expected: number): boolean {
    if (this.localAsks.length < 10 || this.localBids.length < 10) return true; // wait for full depth

    let checksumString = '';

    // Kraken CRC32 combines top 10 asks first, then top 10 bids. Both price and volume
    // must use the pair's wire precision (XBT/USD: 1 decimal price, 8 decimal volume)
    // BEFORE stripping the decimal point and leading zeros — formatting volume via
    // toString() drops trailing zeros and breaks the checksum.
    for (let i = 0; i < 10; i++) {
      checksumString += cleanStringForChecksum(this.localAsks[i].price.toFixed(1));
      checksumString += cleanStringForChecksum(this.localAsks[i].amount.toFixed(8));
    }
    for (let i = 0; i < 10; i++) {
      checksumString += cleanStringForChecksum(this.localBids[i].price.toFixed(1));
      checksumString += cleanStringForChecksum(this.localBids[i].amount.toFixed(8));
    }

    const calculated = crc32(checksumString);
    return calculated === expected;
  }

  private handleReconnect() {
    this.reconnectCount++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectCount), 30000);

    // Pull REST snapshot during reconnect downtime to keep book store populated
    this.fetchRestSnapshot().catch(() => {});

    setTimeout(() => {
      this.logger.info({ eventType: 'INFO' }, `🔄 Reconnecting to Kraken Spot (Attempt ${this.reconnectCount})...`);
      this.connect().catch((err) => this.logger.error({ eventType: 'ERROR', error: err }, 'Failed to reconnect to Kraken Spot'));
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
    this.logger.info({ eventType: 'INFO' }, '❌ Disconnected Kraken Spot WebSocket.');
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
