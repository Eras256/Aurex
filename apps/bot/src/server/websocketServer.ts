import { Server } from 'http';

import { WebSocketServer, WebSocket } from 'ws';

import { ArbitrageEngine } from '../engine/ArbitrageEngine.js';
import { ExchangeAdapter } from '../exchanges/index.js';
import { logger } from '../logging.js';
import { getOpportunities, getTrades } from '../persistence/repositories.js';
import { buildStatePayload } from '../state/stateAggregator.js';

export class DashboardWebSocketServer {
  private wss: WebSocketServer;
  private engine: ArbitrageEngine;
  private exchanges: Record<string, ExchangeAdapter>;

  constructor(server: Server | WebSocketServer, engine: ArbitrageEngine, exchanges: Record<string, ExchangeAdapter>) {
    if (server instanceof WebSocketServer) {
      this.wss = server;
    } else {
      this.wss = new WebSocketServer({ server });
    }
    this.engine = engine;
    this.exchanges = exchanges;
    this.initialize();
  }

  private initialize() {
    this.wss.on('connection', async (ws: WebSocket) => {
      logger.info('🔌 Dashboard client linked via WebSocket.');
      
      // Push immediate initial state snapshot on connect
      await this.sendState(ws);

      ws.on('error', (err) => logger.error('WebSocket client connection error', err));
      ws.on('close', () => logger.info('🔌 Dashboard client connection terminated.'));
    });

    // Run active ping interval to verify connection integrity and purge dead sockets
    setInterval(() => {
      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        }
      });
    }, 30000);
  }

  /**
   * Broadcasts the current aggregated StatePayload to all active visual client dashboards.
   */
  async broadcast() {
    if (this.wss.clients.size === 0) return;
    
    try {
      const payload = await buildStatePayload(this.engine, this.exchanges);
      const dataStr = JSON.stringify(payload);
      
      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(dataStr);
        }
      });
    } catch (error) {
      logger.error('Failed to broadcast real-time StatePayload', error);
    }
  }

  private async sendState(ws: WebSocket) {
    try {
      const payload = await buildStatePayload(this.engine, this.exchanges);
      ws.send(JSON.stringify(payload));
    } catch (error) {
      logger.error('Failed to push state snapshot to client', error);
    }
  }
}

export class TelemetryWebSocketServer {
  private wss: WebSocketServer;
  private engine: ArbitrageEngine;
  private exchanges: Record<string, ExchangeAdapter>;

  constructor(wss: WebSocketServer, engine: ArbitrageEngine, exchanges: Record<string, ExchangeAdapter>) {
    this.wss = wss;
    this.engine = engine;
    this.exchanges = exchanges;
    this.initialize();
  }

  private initialize() {
    this.wss.on('connection', async (ws: WebSocket) => {
      logger.info('📡 Browser linked to Telemetry WebSocket stream.');

      // Immediate payload push
      await this.sendTelemetry(ws);

      ws.on('error', (err) => logger.error('Telemetry WebSocket client connection error', err));
      ws.on('close', () => logger.info('📡 Telemetry WebSocket client disconnected.'));
    });

    // Broadcast stream every 1 second
    setInterval(async () => {
      if (this.wss.clients.size === 0) return;
      try {
        const payload = await this.buildTelemetryPayload();
        const dataStr = JSON.stringify(payload);
        
        this.wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(dataStr);
          }
        });
      } catch (err) {
        logger.error('Failed to broadcast real-time telemetry logs', err);
      }
    }, 1000);
  }

  private async sendTelemetry(ws: WebSocket) {
    try {
      const payload = await this.buildTelemetryPayload();
      ws.send(JSON.stringify(payload));
    } catch (err) {
      logger.error('Failed to send initial telemetry payload to client', err);
    }
  }

  private async buildTelemetryPayload() {
    const metrics = this.engine.getMetrics();
    
    // 1. Calculate WebSocket lag per exchange
    const exchangeLag: Record<string, number> = {};
    const warnings: string[] = [];
    const now = Date.now();
    for (const [id, adapter] of Object.entries(this.exchanges)) {
      const lastMsg = adapter.getLastMessageTimestamp();
      const lag = lastMsg > 0 ? now - lastMsg : 99999;
      exchangeLag[id] = lag;
      if (!adapter.isConnected()) {
        warnings.push(`Exchange connection offline: ${id}`);
      } else if (lag > 15000) {
        warnings.push(`High latency/stale feed detected on exchange: ${id} (${(lag/1000).toFixed(1)}s delay)`);
      }
    }

    // 2. Fetch opportunities and calculate discarded ones & reasons
    const recentOpps = await getOpportunities(200);
    const discardedOpps = recentOpps.filter((o: any) => o.status === 'SKIPPED');
    const opportunitiesDiscarded = discardedOpps.length;
    
    const discardReasons: Record<string, number> = {};
    discardedOpps.forEach((o: any) => {
      const r = o.reason || 'UNKNOWN';
      discardReasons[r] = (discardReasons[r] || 0) + 1;
    });

    // 3. Attribution for fees & slippage (sum from recent trades or estimated averages)
    const recentTrades = await getTrades(100);
    let totalFeesUSD = 0;
    let totalSlippageUSD = 0;
    recentTrades.forEach((t: any) => {
      totalFeesUSD += t.feesPaid || 0;
      totalSlippageUSD += t.slippagePaid || 0;
    });

    return {
      timestamp: now,
      engineLatencyMs: metrics.detectionLatencyMs,
      computeLatencyMs: metrics.computeLatencyMs,
      exchangeLag,
      opportunitiesDiscarded,
      discardReasons,
      attributions: {
        feesPaidUSD: totalFeesUSD,
        slippagePaidUSD: totalSlippageUSD,
      },
      warnings,
    };
  }
}

