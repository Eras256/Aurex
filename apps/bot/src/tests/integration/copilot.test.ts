import { createServer, Server } from 'http';
import url from 'url';

import { DEFAULT_ENGINE_CONFIG } from '@arbitrage/config';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';

import { config } from '../../config.js';
import { ArbitrageEngine } from '../../engine/ArbitrageEngine.js';
import { createHttpServer } from '../../server/httpServer.js';
import { TelemetryWebSocketServer } from '../../server/websocketServer.js';

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

describe('🔒 Quant Copilot API & WS Integration Validation Suite', () => {
  let app: any;
  let engine: ArbitrageEngine;
  let mockExchanges: any;
  let server: Server;
  let wss: WebSocketServer;
  let telemetryServer: TelemetryWebSocketServer;
  
  const testApiKey = 'dev-api-key-12345';

  beforeEach(async () => {
    // Configure API key in memory
    config.API_KEY = testApiKey;
    
    engine = new ArbitrageEngine(DEFAULT_ENGINE_CONFIG);
    mockExchanges = {
      binance: new MockExchange('binance', 'Binance Spot'),
      kraken: new MockExchange('kraken', 'Kraken Spot'),
      coinbase: new MockExchange('coinbase', 'Coinbase Advanced'),
    };
    
    app = createHttpServer(engine, mockExchanges);
    server = createServer(app);
    
    // Setup telemetry WebSocket server
    wss = new WebSocketServer({ noServer: true });
    telemetryServer = new TelemetryWebSocketServer(wss, engine, mockExchanges);
    
    server.on('upgrade', (req, socket, head) => {
      const parsedUrl = url.parse(req.url || '', true);
      const pathname = parsedUrl.pathname;
      
      if (pathname === '/api/v1/telemetry/logs') {
        const token = parsedUrl.query.token;
        if (token !== config.API_KEY) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      wss.close(() => {
        server.close(() => resolve());
      });
    });
  });

  describe('1. Endpoint de Calibración (POST /api/v1/bot/calibrate)', () => {
    it('Debe rechazar solicitudes sin cabecera x-api-key', async () => {
      const res = await request(app)
        .post('/api/v1/bot/calibrate')
        .send({
          profitFloor: 2.5,
          minSpread: 3.0,
          maxExposure: 0.5,
          safetyBuffer: 5.0,
          source: 'copilot'
        })
        .expect(401);

      expect(res.body.error).toContain('Unauthorized');
    });

    it('Debe rechazar solicitudes con x-api-key inválida', async () => {
      const res = await request(app)
        .post('/api/v1/bot/calibrate')
        .set('x-api-key', 'incorrect-key')
        .send({
          profitFloor: 2.5,
          minSpread: 3.0,
          maxExposure: 0.5,
          safetyBuffer: 5.0,
          source: 'copilot'
        })
        .expect(401);

      expect(res.body.error).toContain('Unauthorized');
    });

    it('Debe rechazar payloads con tipos de parámetros inválidos', async () => {
      const res = await request(app)
        .post('/api/v1/bot/calibrate')
        .set('x-api-key', testApiKey)
        .send({
          profitFloor: 'invalid-string', // should be number
          minSpread: 3.0,
          maxExposure: 0.5,
          safetyBuffer: 5.0,
          source: 'copilot'
        })
        .expect(400);

      expect(res.body.error).toContain('Invalid parameter types');
    });

    it('Debe calibrar los parámetros en memoria y retornar éxito ante payload correcto', async () => {
      const res = await request(app)
        .post('/api/v1/bot/calibrate')
        .set('x-api-key', testApiKey)
        .send({
          profitFloor: 4.5,
          minSpread: 2.0,
          maxExposure: 0.8,
          safetyBuffer: 10.0,
          source: 'copilot',
          sessionId: 'test-session',
          operatorId: 'test-operator'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.config.minNetProfitUSD).toBe(4.5);
      expect(res.body.config.slippageSafetyBps).toBe(2.0);
      expect(res.body.config.maxPositionBTCPerExchange).toBe(0.8);
      expect(res.body.config.latencySafetyBps).toBe(10.0);
      expect(res.body.auditLog).toBeDefined();
      expect(res.body.auditLog.widget_source).toBe('COPILOT_WORKSPACE');
      expect(res.body.auditLog.operator_action).toBe('APPLIED_SUGGESTION');
      
      // Confirm memory change
      const currentConfig = engine.getConfig();
      expect(currentConfig.minNetProfitUSD).toBe(4.5);
      expect(currentConfig.slippageSafetyBps).toBe(2.0);
    });
  });

  describe('2. Persistencia de Auditoría (POST & GET /api/v1/copilot/audits)', () => {
    it('Debe requerir x-api-key válida para registrar un log de auditoría', async () => {
      await request(app)
        .post('/api/v1/copilot/audits')
        .send({
          session_id: 'test-session',
          operator_id: 'test-operator',
          widget_source: 'COPILOT_WORKSPACE',
          scenario_key: 'test_scenario',
          prompt_version: 'AurexQuant-V2.1',
          prompt_language: 'en',
          user_query: 'Test insert',
          model_identifier: 'TestModel',
          model_latency_ms: 100,
          confidence_percentage: 95.5,
          explainability_payload: { rationale: 'Unit validation' },
          applied_parameters: { val: 123 },
          operator_action: 'APPLIED_SUGGESTION',
          final_system_decision: 'ACCEPTED'
        })
        .expect(401);
    });

    it('Debe insertar un log de auditoría exitosamente con fallback local si Supabase no está configurado', async () => {
      const auditPayload = {
        session_id: 'session-e2e',
        operator_id: 'operator-1',
        widget_source: 'COPILOT_WORKSPACE',
        scenario_key: 'suggest_params',
        prompt_version: 'AurexQuant-V2.1',
        prompt_language: 'en',
        user_query: 'Execute fallback check',
        model_identifier: 'Llama-70b',
        model_latency_ms: 450,
        confidence_percentage: 98.2,
        explainability_payload: { rationale: 'Graceful fallback test' },
        applied_parameters: { minNetProfitUSD: 3.5 },
        operator_action: 'APPLIED_SUGGESTION',
        final_system_decision: 'ACCEPTED'
      };

      const res = await request(app)
        .post('/api/v1/copilot/audits')
        .set('x-api-key', testApiKey)
        .send(auditPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.log.id).toBeDefined();
      expect(res.body.log.session_id).toBe('session-e2e');
      expect(res.body.log.created_at).toBeDefined();
    });

    it('Debe leer los logs de auditoría sin requerir autenticación (GET /api/v1/copilot/audits)', async () => {
      const res = await request(app)
        .get('/api/v1/copilot/audits?limit=5')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // It should contain the logs we inserted
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].session_id).toBeDefined();
    });
  });

  describe('3. WebSocket de Telemetría (GET /api/v1/telemetry/logs)', () => {
    it('Debe rechazar solicitudes de upgrade sin token válido', async () => {
      const address = server.address() as any;
      const port = address.port;

      const ws = new WebSocket(`ws://localhost:${port}/api/v1/telemetry/logs?token=wrong-token`);
      
      const closed = await new Promise<boolean>((resolve) => {
        ws.on('error', () => {
          // Socket write 401 triggers connection error/abort
          resolve(true);
        });
        ws.on('close', () => {
          resolve(true);
        });
        ws.on('open', () => {
          ws.close();
          resolve(false);
        });
      });

      expect(closed).toBe(true);
    });

    it('Debe aceptar upgrade con token válido y emitir métricas en JSON estructurado', async () => {
      const address = server.address() as any;
      const port = address.port;

      const ws = new WebSocket(`ws://localhost:${port}/api/v1/telemetry/logs?token=${testApiKey}`);
      
      const payload: any = await new Promise((resolve, reject) => {
        ws.on('message', (data) => {
          try {
            const parsed = JSON.parse(data.toString());
            resolve(parsed);
            ws.close();
          } catch (e) {
            reject(e);
          }
        });
        ws.on('error', (err) => {
          reject(err);
        });
      });

      expect(payload).toBeDefined();
      expect(payload.timestamp).toBeDefined();
      expect(payload.engineLatencyMs).toBeDefined();
      expect(payload.computeLatencyMs).toBeDefined();
      expect(payload.exchangeLag).toBeDefined();
      expect(payload.exchangeLag.binance).toBeDefined();
      expect(payload.opportunitiesDiscarded).toBeDefined();
      expect(payload.warnings).toBeDefined();
    });
  });
});
