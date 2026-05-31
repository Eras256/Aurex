/* eslint-disable @typescript-eslint/no-explicit-any */
import { NormalizedOrderBook } from '@arbitrage/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { BinanceClient } from '../../exchanges/binanceClient.js';
import { KrakenClient } from '../../exchanges/krakenClient.js';

// Mock ws module to prevent real network socket open attempts
vi.mock('ws', () => {
  return {
    default: class MockWebSocket {
      public listeners: Record<string, ((...args: any[]) => void)[]> = {};
      
      constructor(public url: string) {}
      
      on(event: string, cb: (...args: any[]) => void) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(cb);
      }
      
      send(_data: string) {}
      close() {}
      removeAllListeners() {}
      
      // Test helper to simulate events
      emit(event: string, ...args: any[]) {
        if (this.listeners[event]) {
          for (const cb of this.listeners[event]) {
            cb(...args);
          }
        }
      }
    }
  };
});

describe('🤖 BinanceClient Local Order Book Integration', () => {
  let client: BinanceClient;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    client = new BinanceClient('wss://stream.binance.com:9443/ws', 'https://api.binance.com');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should successfully build book from REST snapshot and subsequent WS diffs', async () => {
    // 1. Setup mocked REST snapshot payload
    const mockSnapshot = {
      lastUpdateId: 100,
      bids: [
        ['60000.00', '1.5000'],
        ['59900.00', '2.0000'],
      ],
      asks: [
        ['60100.00', '0.5000'],
        ['60200.00', '1.0000'],
      ]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSnapshot
    });

    let lastBookReceived: NormalizedOrderBook | null = null;
    client.subscribeOrderBook('BTCUSDT', (book) => {
      lastBookReceived = book;
    });

    // 2. Start connection (resolves after REST snapshot is fetched)
    const connectPromise = client.connect();
    
    // Simulate WS open event
    const wsInstance = (client as any).ws;
    expect(wsInstance).toBeDefined();
    wsInstance.emit('open');

    await connectPromise;

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(lastBookReceived).not.toBeNull();
    expect(lastBookReceived!.bids[0].price).toBe(60000);
    expect(lastBookReceived!.asks[0].price).toBe(60100);
    expect(lastBookReceived!.lastUpdateId).toBe('100');

    // 3. Emit a sequential diff update event via WS
    // U = 101, u = 102 (perfect sequential fit for lastUpdateId = 100)
    const mockEvent = {
      e: 'depthUpdate',
      E: Date.now(),
      s: 'BTCUSDT',
      U: 101,
      u: 102,
      b: [
        ['60000.00', '1.8000'], // update amount at existing level
        ['59800.00', '0.5000'], // new level
      ],
      a: [
        ['60100.00', '0.0000'], // remove level
        ['60300.00', '2.5000'], // new level
      ]
    };

    wsInstance.emit('message', JSON.stringify(mockEvent));

    expect(lastBookReceived).not.toBeNull();
    expect(lastBookReceived!.lastUpdateId).toBe('102');
    
    // Bid level 60000 should be updated to 1.8
    expect(lastBookReceived!.bids.find(b => b.price === 60000)!.amount).toBe(1.8);
    // Bid level 59800 should be added
    expect(lastBookReceived!.bids.find(b => b.price === 59800)!.amount).toBe(0.5);
    // Ask level 60100 should be removed
    expect(lastBookReceived!.asks.find(a => a.price === 60100)).toBeUndefined();
    // Ask level 60300 should be added
    expect(lastBookReceived!.asks.find(a => a.price === 60300)!.amount).toBe(2.5);
  });

  it('should trigger resync when it detects sequence gaps in diff updates', async () => {
    const mockSnapshot = {
      lastUpdateId: 200,
      bids: [['60000.00', '1.0']],
      asks: [['60100.00', '1.0']]
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSnapshot
    });

    client.subscribeOrderBook('BTCUSDT', () => {});
    const connectPromise = client.connect();
    
    const wsInstance = (client as any).ws;
    wsInstance.emit('open');
    await connectPromise;

    // First sequence fetches snapshot correctly
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Emit a gap update event via WS
    // expected U = 201, but we receive U = 205 (gap of 4 update IDs)
    const gapEvent = {
      e: 'depthUpdate',
      s: 'BTCUSDT',
      U: 205,
      u: 206,
      b: [['60000.00', '1.5']],
      a: [['60100.00', '1.5']]
    };

    wsInstance.emit('message', JSON.stringify(gapEvent));

    // Verify that a resync fetch request was dispatched (total fetch = 2)
    // Wait for resync fetch to execute (which runs asynchronously after triggerResync)
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('🦈 KrakenClient REST Fallback snapshot recovery', () => {
  let client: KrakenClient;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    client = new KrakenClient('wss://ws.kraken.com', 'https://api.kraken.com');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should pull REST fallback and correctly populate the local order book', async () => {
    const mockRestResponse = {
      error: [],
      result: {
        XBTUSDT: {
          asks: [
            ['60200.00', '0.5000', '16123456'],
            ['60300.00', '1.2000', '16123457'],
          ],
          bids: [
            ['60100.00', '1.5000', '16123456'],
            ['60000.00', '2.0000', '16123457'],
          ]
        }
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRestResponse
    });

    let bookReceived: NormalizedOrderBook | null = null;
    client.subscribeOrderBook('BTCUSDT', (book) => {
      bookReceived = book;
    });

    await client.fetchRestSnapshot();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(bookReceived).not.toBeNull();
    expect(bookReceived!.exchangeId).toBe('kraken');
    expect(bookReceived!.bids.length).toBe(2);
    expect(bookReceived!.asks.length).toBe(2);
    expect(bookReceived!.bids[0].price).toBe(60100);
    expect(bookReceived!.bids[0].amount).toBe(1.5);
    expect(bookReceived!.asks[0].price).toBe(60200);
  });
});
