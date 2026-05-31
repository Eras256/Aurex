import 'dotenv/config';
import { createServer } from 'http';

import { DEFAULT_ENGINE_CONFIG } from '@arbitrage/config';

import { config } from './config.js';
import { ArbitrageEngine } from './engine/ArbitrageEngine.js';
import { BinanceClient, KrakenClient, CoinbaseClient } from './exchanges/index.js';
import { logger } from './logging.js';
import { orderBookStore } from './orderbooks/normalizedOrderBookStore.js';
import { initializeDatabase } from './persistence/repositories.js';
import { createHttpServer } from './server/httpServer.js';
import { DashboardWebSocketServer } from './server/websocketServer.js';

async function bootstrap() {
  logger.info('🚀 Starting Bitcoin Cross-Exchange Arbitrage Simulator...');

  // 1. Initialize local persistent JSON database
  await initializeDatabase();

  // 2. Instantiate exchange clients
  const exchanges = {
    binance: new BinanceClient(config.BINANCE_WS_URL, config.BINANCE_REST_URL),
    kraken: new KrakenClient(config.KRAKEN_WS_URL, config.KRAKEN_REST_URL),
    coinbase: new CoinbaseClient(), // Coinbase Stub Client
  };

  // 3. Initialize engine
  const engine = new ArbitrageEngine(DEFAULT_ENGINE_CONFIG);

  // 4. Construct HTTP & WebSocket servers
  const expressApp = createHttpServer(engine, exchanges);
  const httpServer = createServer(expressApp);
  
  // Dashboard WS Server
  const wsServer = new DashboardWebSocketServer(httpServer, engine, exchanges);

  // Bind the engine's broadcast function to push live StatePayload to the UI
  await engine.initialize(() => {
    wsServer.broadcast();
  });

  // 5. Connect exchange book streams to L2 caches
  exchanges.binance.subscribeOrderBook('BTCUSDT', (book) => {
    orderBookStore.updateBook(book);
  });
  exchanges.kraken.subscribeOrderBook('BTCUSDT', (book) => {
    orderBookStore.updateBook(book);
  });
  exchanges.coinbase.subscribeOrderBook('BTCUSD', (book) => {
    orderBookStore.updateBook(book);
  });

  // 6. Connect exchange sockets
  try {
    await Promise.all([
      exchanges.binance.connect(),
      exchanges.kraken.connect(),
      exchanges.coinbase.connect(),
    ]);
    logger.info('🔌 Connected to all exchange WebSocket feeds.');
  } catch (error) {
    logger.error('Failed to establish connections to some exchanges, starting engine fallback...', error);
  }

  // 7. Start HTTP Server
  httpServer.listen(config.PORT, () => {
    logger.info(`✨ Express HTTP & WS Server active on port: ${config.PORT}`);
  });

  // 8. Dynamic state broadcaster loop
  // Broadcasts states every 300ms to keep charts and visual books ticking in real time
  const broadcastInterval = setInterval(() => {
    wsServer.broadcast();
  }, 300);

  // 9. Elegant Process termination handlers
  const shutdown = async (signal: string) => {
    logger.info(`🚨 Received signal: ${signal}. Commencing elegant shutdown...`);
    clearInterval(broadcastInterval);
    
    // Close servers
    httpServer.close();
    
    // Disconnect sockets
    await Promise.all([
      exchanges.binance.disconnect(),
      exchanges.kraken.disconnect(),
      exchanges.coinbase.disconnect(),
    ]);

    logger.info('👋 Arbitrage bot shut down cleanly. Exiting.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error('CRITICAL: Bot crash in bootstrap phase', err);
  process.exit(1);
});
