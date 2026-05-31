import { DEFAULT_ENGINE_CONFIG } from '@arbitrage/config';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';

import { ArbitrageEngine } from '../../engine/ArbitrageEngine.js';
import { createHttpServer } from '../../server/httpServer.js';


// Mock Exchange adapter
class MockExchange {
  constructor(public id: string, public name: string) {}
  isConnected() { return true; }
  getReconnectCount() { return 0; }
  getLastMessageTimestamp() { return Date.now(); }
  subscribeOrderBook() {}
  async connect() {}
  async disconnect() {}
}

describe('🌐 REST API Integration Server', () => {
  let app: any;
  let engine: ArbitrageEngine;
  let mockExchanges: any;

  beforeEach(() => {
    engine = new ArbitrageEngine(DEFAULT_ENGINE_CONFIG);
    mockExchanges = {
      binance: new MockExchange('binance', 'Binance Spot'),
      kraken: new MockExchange('kraken', 'Kraken Spot'),
      coinbase: new MockExchange('coinbase', 'Coinbase Advanced'),
    };
    app = createHttpServer(engine, mockExchanges);
  });

  it('GET /health should return 200 and report connection status', async () => {
    const res = await request(app)
      .get('/health')
      .expect(200);

    expect(res.body.status).toBe('healthy');
    expect(res.body.connections.binance).toBe(true);
    expect(res.body.connections.kraken).toBe(true);
  });

  it('GET /config should return current default engine configs', async () => {
    const res = await request(app)
      .get('/config')
      .expect(200);

    expect(res.body.minNetProfitUSD).toBe(DEFAULT_ENGINE_CONFIG.minNetProfitUSD);
    expect(res.body.latencySafetyBps).toBe(DEFAULT_ENGINE_CONFIG.latencySafetyBps);
  });

  it('GET /state should aggregate state variables into complete payload', async () => {
    const res = await request(app)
      .get('/state')
      .expect(200);

    expect(res.body.wallets).toBeDefined();
    expect(res.body.pnl).toBeDefined();
    expect(res.body.connections.binance.connected).toBe(true);
    expect(res.body.risk.status).toBe('SAFE');
  });

  it('POST /config with incorrect API key should return 401 Unauthorized', async () => {
    await request(app)
      .post('/config')
      .send({ ...DEFAULT_ENGINE_CONFIG, minNetProfitUSD: 10.0 })
      .expect(401);
  });

  it('POST /config with correct key should modify engine configurations', async () => {
    // API key default in packages/config is 'dev-api-key-12345'
    const res = await request(app)
      .post('/config')
      .set('x-api-key', 'dev-api-key-12345')
      .send({ ...DEFAULT_ENGINE_CONFIG, minNetProfitUSD: 15.5 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(engine.getConfig().minNetProfitUSD).toBe(15.5);
  });

  it('POST /engine/reset with incorrect API key should return 401 Unauthorized', async () => {
    await request(app)
      .post('/engine/reset')
      .expect(401);
  });

  it('POST /engine/reset with correct API key should reset simulation and return 200', async () => {
    const res = await request(app)
      .post('/engine/reset')
      .set('x-api-key', 'dev-api-key-12345')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('reset completed');
  });
});
