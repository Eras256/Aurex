import { Server } from 'http';

import { WebSocketServer, WebSocket } from 'ws';

import { ArbitrageEngine } from '../engine/ArbitrageEngine.js';
import { ExchangeAdapter } from '../exchanges/index.js';
import { logger } from '../logging.js';
import { buildStatePayload } from '../state/stateAggregator.js';

export class DashboardWebSocketServer {
  private wss: WebSocketServer;
  private engine: ArbitrageEngine;
  private exchanges: Record<string, ExchangeAdapter>;

  constructor(server: Server, engine: ArbitrageEngine, exchanges: Record<string, ExchangeAdapter>) {
    this.wss = new WebSocketServer({ server });
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
