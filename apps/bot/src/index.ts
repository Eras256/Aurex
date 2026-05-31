import 'dotenv/config';
import { createServer } from 'http';

import { DEFAULT_ENGINE_CONFIG } from '@arbitrage/config';

import { config } from './config.js';
import { ArbitrageEngine } from './engine/ArbitrageEngine.js';
import {
  ExchangeAdapter,
  BinanceClient,
  KrakenClient,
  CoinbaseClient,
  OKXClient,
  BybitClient,
} from './exchanges/index.js';
import { logger } from './logging.js';
import { orderBookStore } from './orderbooks/normalizedOrderBookStore.js';
import { initializeDatabase } from './persistence/repositories.js';
import { createHttpServer } from './server/httpServer.js';
import { DashboardWebSocketServer } from './server/websocketServer.js';

async function bootstrap() {
  logger.info('🚀 Starting Bitcoin Cross-Exchange Arbitrage Simulator...');

  // 1. Initialize local persistent JSON database
  await initializeDatabase();

  // 2. Instantiate live exchange clients (all real public WebSocket L2 feeds).
  const exchanges: Record<string, ExchangeAdapter> = {
    binance: new BinanceClient(config.BINANCE_WS_URL, config.BINANCE_REST_URL),
    kraken: new KrakenClient(config.KRAKEN_WS_URL, config.KRAKEN_REST_URL),
    coinbase: new CoinbaseClient(config.COINBASE_WS_URL),
    okx: new OKXClient(config.OKX_WS_URL),
    bybit: new BybitClient(config.BYBIT_WS_URL),
  };

  // 3. Initialize engine
  const engine = new ArbitrageEngine(DEFAULT_ENGINE_CONFIG);

  // 4. Construct HTTP & WebSocket servers
  const expressApp = createHttpServer(engine, exchanges);
  const httpServer = createServer(expressApp);

  // Dashboard WS Server
  const wsServer = new DashboardWebSocketServer(httpServer, engine, exchanges);

  // Bind the engine's broadcast function to push live StatePayload to the UI. The autostart
  // guard ensures a restart/redeploy always resumes trading (never boots silently paused).
  await engine.initialize(() => {
    wsServer.broadcast();
  }, { autostart: config.ENGINE_AUTOSTART });

  // 5. Connect every venue's BTC/USDT book stream into the shared L2 cache.
  for (const adapter of Object.values(exchanges)) {
    adapter.subscribeOrderBook('BTCUSDT', (book) => orderBookStore.updateBook(book));
  }

  // 5b. Extra Binance legs (ETHUSDT, ETHBTC) feed the single-venue triangular detector. They
  // reuse the generic Binance client (same venue/fees, id 'binance') and write into the same
  // L2 cache under binance:ETHUSDT / binance:ETHBTC. Kept out of the primary venue-health map
  // (one socket per venue already answers "is Binance reachable"); if they fail to open the
  // engine simply reports the triangular cycle as unavailable and cross-exchange is untouched.
  const triangularFeeds: ExchangeAdapter[] = [
    new BinanceClient(config.BINANCE_WS_URL, config.BINANCE_REST_URL),
    new BinanceClient(config.BINANCE_WS_URL, config.BINANCE_REST_URL),
  ];
  triangularFeeds[0].subscribeOrderBook('ETHUSDT', (book) => orderBookStore.updateBook(book));
  triangularFeeds[1].subscribeOrderBook('ETHBTC', (book) => orderBookStore.updateBook(book));

  // 6. Connect exchange sockets. Each connect() is raced against a timeout: an adapter
  // whose socket never reaches 'open' (e.g. a venue geo-blocking the host region) would
  // otherwise leave its promise pending forever and stall bootstrap before the HTTP
  // server binds. Bounding each connect guarantees the server always comes up and the
  // engine trades on whatever venues are reachable (it only needs >=2). Unreachable
  // venues keep retrying in the background via their own reconnect cycles.
  const CONNECT_TIMEOUT_MS = 8000;
  const withTimeout = (p: Promise<void>) =>
    Promise.race([p, new Promise<void>((resolve) => setTimeout(resolve, CONNECT_TIMEOUT_MS))]);
  try {
    await Promise.allSettled(
      [...Object.values(exchanges), ...triangularFeeds].map((a) => withTimeout(a.connect()))
    );
    logger.info('🔌 Exchange WebSocket feed connections initiated (incl. Binance triangular legs).');
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

  // 8b. Settlement-style inventory rebalancing loop. Keeps cross-venue reserves solvent so
  // directed arbitrage doesn't stall on "insufficient reserve" after draining one side.
  const rebalanceInterval = setInterval(() => {
    engine.maybeRebalance().catch((err) =>
      logger.error('Inventory rebalance cycle failed', err)
    );
  }, 10000);

  // 8c. Liveness watchdog. The per-socket reconnect cycle only fires on a 'close' event; a
  // socket that stays open but goes silent (a stalled stream, a half-open TCP connection)
  // would otherwise feed a stale book forever. Every 15s we force-reconnect any venue that
  // is marked connected yet hasn't delivered a message in FEED_STALE_MS, and surface an
  // engine stall (live feeds but no evaluations) so the demo self-heals and stays honest.
  const FEED_STALE_MS = 30000;
  const watchdogInterval = setInterval(async () => {
    const now = Date.now();
    for (const [id, adapter] of Object.entries(exchanges)) {
      if (adapter.isConnected() && now - adapter.getLastMessageTimestamp() > FEED_STALE_MS) {
        const silentForS = ((now - adapter.getLastMessageTimestamp()) / 1000).toFixed(0);
        logger.warn(`🩺 Watchdog: ${id} feed silent for ${silentForS}s while connected; forcing reconnect.`);
        try {
          await adapter.disconnect();
          await adapter.connect();
          engine.recordWatchdogRecovery();
          await engine.emitEvent('WARNING', `Auto-recovery: ${id} feed was silent for ${silentForS}s and was reconnected.`);
        } catch (err) {
          logger.error(`Watchdog failed to reconnect ${id}`, err);
        }
      }
    }

    // Same silent-feed self-heal for the Binance triangular legs (ETHUSDT, ETHBTC).
    const triLabels = ['binance ETHUSDT', 'binance ETHBTC'];
    for (let i = 0; i < triangularFeeds.length; i++) {
      const adapter = triangularFeeds[i];
      if (adapter.isConnected() && now - adapter.getLastMessageTimestamp() > FEED_STALE_MS) {
        logger.warn(`🩺 Watchdog: ${triLabels[i]} leg silent; forcing reconnect.`);
        try {
          await adapter.disconnect();
          await adapter.connect();
          engine.recordWatchdogRecovery();
          await engine.emitEvent('WARNING', `Auto-recovery: ${triLabels[i]} triangular leg was silent and was reconnected.`);
        } catch (err) {
          logger.error(`Watchdog failed to reconnect ${triLabels[i]}`, err);
        }
      }
    }

    // Engine stall: feeds are live and the engine is running, yet nothing is being evaluated.
    const connectedCount = Object.values(exchanges).filter((a) => a.isConnected()).length;
    const lastActivity = engine.getLastActivityAt();
    if (
      !engine.getConfig().isPaused &&
      connectedCount >= 2 &&
      lastActivity > 0 &&
      now - lastActivity > FEED_STALE_MS
    ) {
      const idleForS = ((now - lastActivity) / 1000).toFixed(0);
      logger.warn(`🩺 Watchdog: engine idle ${idleForS}s despite ${connectedCount} live feeds.`);
      await engine.emitEvent('WARNING', `Engine stall detected: no order books evaluated in ${idleForS}s despite ${connectedCount} live feeds.`);
    }
  }, 15000);

  // 9. Elegant Process termination handlers
  const shutdown = async (signal: string) => {
    logger.info(`🚨 Received signal: ${signal}. Commencing elegant shutdown...`);
    clearInterval(broadcastInterval);
    clearInterval(rebalanceInterval);
    clearInterval(watchdogInterval);
    
    // Close servers
    httpServer.close();
    
    // Disconnect sockets
    await Promise.all([
      exchanges.binance.disconnect(),
      exchanges.kraken.disconnect(),
      exchanges.coinbase.disconnect(),
      ...triangularFeeds.map((f) => f.disconnect()),
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
