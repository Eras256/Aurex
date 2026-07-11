import { IncomingMessage, ServerResponse } from 'http';

import { EngineConfigSchema } from '@arbitrage/config';
import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import { pinoHttp } from 'pino-http';

import { config } from '../config.js';
import { baseLogger } from '../core/logging/logger.js';
import { ArbitrageEngine } from '../engine/ArbitrageEngine.js';
import { ExchangeAdapter } from '../exchanges/index.js';
import { logger } from '../logging.js';
import { getTrades, resetSimulation, saveCopilotAuditLog, getCopilotAuditLogs, saveConfig } from '../persistence/repositories.js';
import { buildStatePayload, buildStateSummaryPayload } from '../state/stateAggregator.js';


function jsonToCSV(items: Record<string, unknown>[]): string {
  if (items.length === 0) return '';
  const header = Object.keys(items[0]);
  const csv = [
    header.join(','),
    ...items.map((row) => 
      header.map((fieldName) => {
        const val = row[fieldName];
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    )
  ].join('\r\n');
  return csv;
}

export function createHttpServer(
  engine: ArbitrageEngine,
  exchanges: Record<string, ExchangeAdapter>
): express.Express {
  const app = express();

  // Middleware setups
  app.use(pinoHttp({
    logger: baseLogger,
    serializers: {
      req: (req: IncomingMessage) => ({
        method: req.method,
        url: req.url,
      }),
      res: (res: ServerResponse) => ({
        statusCode: res.statusCode,
      }),
    },
    customLogLevel: (req: IncomingMessage, res: ServerResponse, err?: Error) => {
      if (res.statusCode && res.statusCode >= 500 || err) return 'error';
      if (res.statusCode && res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customProps: () => ({
      component: 'HTTPServer',
    }),
  }));
  app.use(cors({ origin: config.ALLOWED_ORIGINS.split(',') }));
  app.use(express.json());

  // Security guard middleware for write modifications
  const secureGuard = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== config.API_KEY) {
      logger.warn(`🔒 Unauthorized attempt to mutate state on: ${req.path}`);
      return res.status(401).json({ error: 'Unauthorized: Invalid x-api-key' });
    }
    next();
  };

  // 1. HEALTHCHECK
  app.get('/health', (req: Request, res: Response) => {
    const connections: Record<string, boolean> = {};
    for (const [id, adapter] of Object.entries(exchanges)) {
      connections[id] = adapter.isConnected();
    }
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime(),
      connections,
    });
  });

  // 2. STATE SNAPSHOT
  app.get('/state', async (req: Request, res: Response) => {
    try {
      const payload = await buildStatePayload(engine, exchanges);
      res.json(payload);
    } catch (error) {
      res.status(500).json({ error: 'Failed to aggregate state payload' });
    }
  });

  // 2b. STATE SUMMARY SNAPSHOT (lightweight for LLM grounding / chat)
  app.get('/state/summary', async (req: Request, res: Response) => {
    try {
      const payload = await buildStateSummaryPayload(engine, exchanges);
      res.json(payload);
    } catch (error) {
      res.status(500).json({ error: 'Failed to aggregate state summary payload' });
    }
  });

  // 3. ENGINE CONFIG GET
  app.get('/config', (req: Request, res: Response) => {
    res.json(engine.getConfig());
  });

  // 4. ENGINE CONFIG POST
  app.post('/config', secureGuard, async (req: Request, res: Response) => {
    try {
      // Validate config modifications using strict Zod configurations schema
      const parsedConfig = EngineConfigSchema.safeParse(req.body);
      if (!parsedConfig.success) {
        logger.warn('⚠️ Rejected invalid configuration update payload');
        return res.status(400).json({ 
          error: 'Invalid configuration parameters structure', 
          details: parsedConfig.error.format() 
        });
      }

      await engine.updateConfig(parsedConfig.data);
      res.json({ success: true, config: engine.getConfig() });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update engine configuration' });
    }
  });

  // 5. ENGINE SIMULATION RESET
  app.post('/engine/reset', secureGuard, async (req: Request, res: Response) => {
    try {
      await resetSimulation();
      await engine.resetSimulation();
      logger.info('🔄 Simulation database and balances reset.');
      res.json({ success: true, message: 'Simulation reset completed successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reset simulation state' });
    }
  });

  // 6. TRADES EXPORT (CSV SHEET)
  app.get('/trades/export', async (req: Request, res: Response) => {
    try {
      const trades = await getTrades(1000);
      
      // Flatten trades for CSV rows
      const flattened = trades.map((t) => ({
        id: t.id,
        opportunityId: t.opportunityId,
        timestamp: new Date(t.timestamp).toISOString(),
        buyExchange: t.buyExchange,
        sellExchange: t.sellExchange,
        symbol: t.symbol,
        buyPrice: t.buyPrice,
        sellPrice: t.sellPrice,
        volume: t.volume,
        grossProfitUSD: t.grossProfit,
        netProfitUSD: t.netProfit,
        feesPaidUSD: t.feesPaid,
        slippagePaidUSD: t.slippagePaid,
      }));

      const csvContent = jsonToCSV(flattened);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=simulated_trades_${Date.now()}.csv`);
      res.send(csvContent);
    } catch (error) {
      res.status(500).json({ error: 'Failed to compile trade sheet CSV' });
    }
  });

  // 7. BOT DYNAMIC CALIBRATION
  app.post('/api/v1/bot/calibrate', secureGuard, async (req: Request, res: Response) => {
    try {
      const { profitFloor, minSpread, maxExposure, safetyBuffer, source, sessionId, operatorId } = req.body;
      
      if (
        typeof profitFloor !== 'number' ||
        typeof minSpread !== 'number' ||
        typeof maxExposure !== 'number' ||
        typeof safetyBuffer !== 'number'
      ) {
        return res.status(400).json({ error: 'Invalid parameter types for calibration.' });
      }

      const currentConfig = engine.getConfig();
      const updatedConfig = {
        ...currentConfig,
        minNetProfitUSD: profitFloor,
        slippageSafetyBps: minSpread,
        maxPositionBTCPerExchange: maxExposure,
        latencySafetyBps: safetyBuffer
      };

      await engine.updateConfig(updatedConfig);
      await saveConfig(updatedConfig);

      // Log to audit trail in database
      const auditLog = await saveCopilotAuditLog({
        session_id: sessionId || 'calibration-session',
        operator_id: operatorId || 'operator',
        widget_source: source === 'copilot' ? 'COPILOT_WORKSPACE' : 'RISK_CONSOLE',
        scenario_key: 'suggest_params',
        prompt_version: 'AurexQuant-V2.1',
        prompt_language: 'en',
        user_query: 'Calibrate risk parameters dynamically',
        model_identifier: 'Aurex-Quant-Llama-70B',
        model_latency_ms: 0,
        confidence_percentage: 100.0,
        explainability_payload: { rationale: `Dynamic calibration update from ${source || 'operator'}` },
        applied_parameters: {
          minNetProfitUSD: profitFloor,
          slippageSafetyBps: minSpread,
          maxPositionBTCPerExchange: maxExposure,
          latencySafetyBps: safetyBuffer
        },
        operator_action: 'APPLIED_SUGGESTION',
        final_system_decision: 'ACCEPTED'
      });

      res.json({ success: true, config: engine.getConfig(), auditLog });
    } catch (error) {
      logger.error('Failed to calibrate bot parameters', error);
      res.status(500).json({ error: 'Failed to calibrate bot parameters' });
    }
  });

  // 8. COPILOT AUDITS WRITE PROXY
  app.post('/api/v1/copilot/audits', secureGuard, async (req: Request, res: Response) => {
    try {
      const log = await saveCopilotAuditLog(req.body);
      res.json({ success: true, log });
    } catch (error) {
      logger.error('Failed to write copilot audit log', error);
      res.status(500).json({ error: 'Failed to write copilot audit log' });
    }
  });

  // 9. COPILOT AUDITS READ PROXY
  app.get('/api/v1/copilot/audits', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await getCopilotAuditLogs(limit);
      res.json(logs);
    } catch (error) {
      logger.error('Failed to fetch copilot audit logs', error);
      res.status(500).json({ error: 'Failed to fetch copilot audit logs' });
    }
  });

  return app;
}
