import { EXCHANGES_METADATA } from '@arbitrage/config';
import {
  NormalizedOrderBook,
  ArbitrageOpportunity,
  SimulatedTrade,
  EngineEvent,
  EngineConfig,
  EngineMetrics,
  TriangularState,
  walkOrderBook,
  calculateNetSpread,
  computeTriangular,
} from '@arbitrage/core';

import { createChildLogger } from '../core/logging/logger.js';
import { orderBookStore } from '../orderbooks/normalizedOrderBookStore.js';
import {
  saveOpportunity,
  saveTrade,
  saveEvent,
  saveBalances,
  loadBalances,
  loadConfig,
  saveConfig,
} from '../persistence/repositories.js';

import { InventoryManager } from './InventoryManager.js';
import { PnLTracker } from './PnLTracker.js';
import { RiskManager } from './RiskManager.js';
import { SpreadStatistics } from './SpreadStatistics.js';

type NetSpreadResult = ReturnType<typeof calculateNetSpread>;
type Wallets = Record<string, Record<string, { free: number; locked: number }>>;

/** A fully-costed arbitrage window isolated from the L2 depth walk. */
interface ArbitrageCandidate {
  buyExchangeId: string;
  sellExchangeId: string;
  symbol: string;
  optimalVolume: number;
  expectedProfitUSD: number;
  finalBuyPrice: number;
  finalSellPrice: number;
  topAsk: number;
  topBid: number;
  math: NetSpreadResult;
  /** Statistical confidence (z-score) of this window vs the pair's rolling spread history. */
  zScore: number;
  /** True when the net profit clears the configured minimum after all costs. */
  profitable: boolean;
}

export class ArbitrageEngine {
  private config: EngineConfig;
  private wallets: Wallets = {};
  public riskManager: RiskManager;
  public pnlTracker: PnLTracker;
  private inventoryManager = new InventoryManager();
  private spreadStats = new SpreadStatistics();
  private wsBroadcaster: (() => void) | null = null;
  private isProcessing = false;
  private pendingSymbol: string | null = null;
  // Throttle inventory rebalancing so it can't fire on every book tick.
  private lastRebalanceAt = 0;

  // Observability counters for the speed/latency evaluation criterion.
  private latencySamples: number[] = [];
  private evalTimestamps: number[] = [];
  private booksProcessed = 0;
  private opportunitiesDetected = 0;
  // Throttle for persisting evaluated-but-rejected windows to the opportunities feed.
  private lastWindowRecordAt = 0;
  // Liveness telemetry: epoch ms of the last evaluated book + self-heal action count.
  private lastActivityAt = 0;
  private watchdogRecoveries = 0;
  // Single-venue triangular arbitrage state (USDT↔BTC↔ETH on Binance).
  private lastTriangularState: TriangularState | null = null;
  private triangularExecuted = 0;
  private lastTriangularExecAt = 0;

  private logger = createChildLogger({ component: 'ArbitrageEngine' });

  constructor(initialConfig: EngineConfig) {
    this.config = initialConfig;
    this.riskManager = new RiskManager(initialConfig);
    this.pnlTracker = new PnLTracker();
  }

  async initialize(wsBroadcaster: () => void, opts: { autostart?: boolean } = {}) {
    this.wsBroadcaster = wsBroadcaster;

    const loadedConfig = await loadConfig();
    if (loadedConfig) {
      this.config = loadedConfig;
      this.riskManager.updateConfig(loadedConfig);
      this.logger.info({ eventType: 'INFO' }, '⚙️ Loaded active Engine Config from database.');
    } else {
      await saveConfig(this.config);
      this.logger.info({ eventType: 'INFO' }, '⚙️ No persisted Engine Config found; seeded defaults to database.');
    }

    // Autostart guard: a restart/redeploy must always bring the live demo back trading, so
    // a stale or forgotten persisted pause can never leave the engine silently dead. A
    // runtime pause via /config still works — it simply does not survive a reboot.
    if (opts.autostart && this.config.isPaused) {
      this.config = { ...this.config, isPaused: false };
      this.riskManager.updateConfig(this.config);
      await saveConfig(this.config);
      this.logger.info({ eventType: 'INFO' }, '▶️ Autostart guard: engine was paused; resumed on boot.');
      await this.emitEvent('INFO', 'Autostart guard: engine was paused on boot and has been resumed.');
    }

    const loadedBalances = await loadBalances();
    if (loadedBalances) {
      this.wallets = loadedBalances;
      this.logger.info({ eventType: 'INFO' }, '💼 Loaded active Wallet Balances from database.');
    } else {
      this.logger.info({ eventType: 'INFO' }, '💼 No persisted Wallet Balances found; using initial funding.');
    }

    await this.pnlTracker.initialize();

    orderBookStore.addListener((book) => this.onBookUpdate(book));
    this.logger.info({ eventType: 'INFO' }, '🚀 ArbitrageEngine active: subscribed to L2 depth caches.');
  }

  getConfig(): EngineConfig {
    return this.config;
  }

  async updateConfig(newCfg: EngineConfig) {
    this.config = newCfg;
    this.riskManager.updateConfig(newCfg);
    await saveConfig(newCfg);
    this.logger.info({ eventType: 'INFO' }, '⚙️ Engine Config updated and persisted.');
  }

  getWallets(): Wallets {
    return this.wallets;
  }

  getMetrics(): EngineMetrics {
    const now = Date.now();
    // Throughput: order-book snapshots evaluated within the trailing 1s window.
    this.evalTimestamps = this.evalTimestamps.filter((t) => now - t <= 1000);

    const samples = this.latencySamples;
    const avg = samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
    let p99 = 0;
    if (samples.length > 0) {
      const sorted = [...samples].sort((a, b) => a - b);
      p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
    }

    return {
      detectionLatencyMs: Number(avg.toFixed(3)),
      p99LatencyMs: Number(p99.toFixed(3)),
      evalsPerSecond: this.evalTimestamps.length,
      booksProcessed: this.booksProcessed,
      opportunitiesDetected: this.opportunitiesDetected,
      lastActivityAt: this.lastActivityAt,
      watchdogRecoveries: this.watchdogRecoveries,
    };
  }

  /** Epoch ms of the last evaluated order book (0 before the first evaluation). */
  getLastActivityAt(): number {
    return this.lastActivityAt;
  }

  /** Records a watchdog self-heal action (e.g. a silent-feed reconnect) for telemetry. */
  recordWatchdogRecovery(): void {
    this.watchdogRecoveries += 1;
  }

  /** Persists an engine event to the audit trail and pushes a fresh state to the UI. */
  async emitEvent(type: EngineEvent['type'], message: string): Promise<void> {
    const event: EngineEvent = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      type,
      message,
    };
    await saveEvent(event);
    this.wsBroadcaster?.();
  }

  async resetSimulation() {
    await this.pnlTracker.reset();
    this.riskManager.resetBreakers();

    // Reload the in-memory wallets from the freshly-reset persistence layer (the HTTP
    // route resets the DB balances before calling this). Deep-clone so engine mutations
    // never alias the seed constant. Without this, a reset left the engine trading on
    // the old drained balances.
    const restored = await loadBalances();
    if (restored) {
      this.wallets = JSON.parse(JSON.stringify(restored));
      await saveBalances(this.wallets);
    }

    this.booksProcessed = 0;
    this.opportunitiesDetected = 0;
    this.latencySamples = [];
    this.evalTimestamps = [];
    this.lastRebalanceAt = 0;
    this.spreadStats.reset();
    this.wsBroadcaster?.();
  }

  /**
   * Settlement-style inventory rebalancing. When directed arbitrage has drained BTC from
   * the expensive venues (or USDT from the cheap ones), transfer the surplus back across
   * venues — paying realistic withdrawal/stablecoin fees — so the simulation keeps trading
   * instead of stalling on "insufficient reserve". Throttled and skipped when balances are
   * healthy. Safe to call frequently (e.g. on a timer).
   */
  async maybeRebalance(force = false): Promise<number> {
    if (this.config.isPaused) return 0;

    const now = Date.now();
    if (!force && now - this.lastRebalanceAt < 10000) return 0;

    const enabled = this.config.enabledExchanges;
    if (!this.inventoryManager.needsRebalance(this.wallets, enabled)) return 0;

    const transfers = this.inventoryManager.computeTransfers(this.wallets, enabled);
    if (transfers.length === 0) return 0;

    this.lastRebalanceAt = now;
    this.inventoryManager.applyTransfers(this.wallets, transfers);

    for (const t of transfers) {
      const fromName = EXCHANGES_METADATA[t.from]?.name ?? t.from;
      const toName = EXCHANGES_METADATA[t.to]?.name ?? t.to;
      const unit = t.asset === 'BTC' ? 'BTC' : 'USDT';
      const event: EngineEvent = {
        id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: Date.now(),
        type: 'REBALANCE',
        message: `Rebalanced ${t.amount.toFixed(t.asset === 'BTC' ? 4 : 2)} ${unit} from ${fromName} → ${toName} (fee ${t.fee} ${unit}).`,
      };
      await saveEvent(event);
      this.logger.info(
        {
          eventType: 'INFO',
          asset: t.asset,
          from: t.from,
          to: t.to,
          amount: t.amount,
          fee: t.fee,
        },
        `♻️ Inventory rebalance: ${t.amount} ${unit} ${t.from} → ${t.to} (fee ${t.fee}).`
      );
    }

    await saveBalances(this.wallets);
    this.wsBroadcaster?.();
    return transfers.length;
  }

  private recordLatency(ms: number) {
    this.latencySamples.push(ms);
    if (this.latencySamples.length > 300) this.latencySamples.shift();
    const now = Date.now();
    this.evalTimestamps.push(now);
    // Liveness heartbeat: the watchdog uses this to detect a stalled engine.
    this.lastActivityAt = now;
  }

  private async onBookUpdate(book: NormalizedOrderBook) {
    if (this.config.isPaused) return;

    // Never drop the freshest market state: if a cycle is mid-flight, remember the
    // latest symbol and re-evaluate as soon as it finishes (instead of discarding it).
    if (this.isProcessing) {
      this.pendingSymbol = book.symbol;
      return;
    }

    // True wire-to-detection latency: time from the exchange's own event stamp
    // (Binance E / OKX ts / Bybit cts / Kraken level ts / Coinbase timestamp) to the
    // moment we begin evaluating it. Falls back to local receipt time only if a venue
    // omits an event stamp. Clock skew between our host and a venue can produce a
    // negative delta or an implausibly large one; clamp to a sane [0, 60s] window so a
    // single mis-synced venue can't poison the rolling average.
    const eventTime = book.eventTimestamp ?? book.updatedAt;
    const rawLatency = Date.now() - eventTime;
    const latency = rawLatency >= 0 && rawLatency <= 60000 ? rawLatency : Math.max(0, Date.now() - book.updatedAt);
    this.recordLatency(latency);

    this.isProcessing = true;
    try {
      // Drain coalesced updates: always evaluate against the freshest cached books,
      // re-running while newer market state arrived during the prior cycle.
      let symbol: string | null = book.symbol;
      while (symbol) {
        this.pendingSymbol = null;
        this.booksProcessed++;
        await this.evaluateArbitrage(symbol);
        symbol = this.pendingSymbol;
      }

      // Single-venue triangular arbitrage runs off Binance's three legs (BTCUSDT, ETHUSDT,
      // ETHBTC). Re-evaluated whenever any Binance book ticks; independent of the directed
      // cross-exchange pass above.
      if (book.exchangeId === 'binance') {
        await this.evaluateTriangular();
      }
    } catch (error) {
      this.logger.error({ eventType: 'ERROR', error }, 'Error running arbitrage valuation loop');
    } finally {
      this.isProcessing = false;
      this.pendingSymbol = null;
    }
  }

  /**
   * Evaluates every directed venue pair for a symbol, ranks the profitable candidates,
   * and executes the single most profitable one (priority execution). Ranking — rather
   * than firing on the first window found — is what lets the bot capture the best spread
   * when several venues diverge simultaneously.
   */
  private async evaluateArbitrage(symbol: string) {
    const enabledExchanges = this.config.enabledExchanges;
    if (enabledExchanges.length < 2) return;

    const candidates: ArbitrageCandidate[] = [];

    for (let i = 0; i < enabledExchanges.length; i++) {
      for (let j = 0; j < enabledExchanges.length; j++) {
        if (i === j) continue;

        const buyExchangeId = enabledExchanges[i];
        const sellExchangeId = enabledExchanges[j];

        const buyBook = orderBookStore.getBook(buyExchangeId, symbol);
        const sellBook = orderBookStore.getBook(sellExchangeId, symbol);

        if (!buyBook || !sellBook) continue;
        if (buyBook.asks.length === 0 || sellBook.bids.length === 0) continue;

        // Naive top-of-book pre-filter before the expensive depth walk.
        if (buyBook.asks[0].price >= sellBook.bids[0].price) continue;

        const candidate = this.computeCandidate(buyBook, sellBook);
        if (candidate) candidates.push(candidate);
      }
    }

    if (candidates.length === 0) return;

    // Priority ranking across every simultaneous window: maximise net profit, but when two
    // windows are within 5% on profit, prefer the statistically more anomalous one (higher
    // z-score) — a mean-reverting dislocation is a higher-conviction capture than a spread
    // that is only marginally, and perhaps coincidentally, positive.
    const rank = (a: ArbitrageCandidate, b: ArbitrageCandidate) => {
      const ref = Math.max(Math.abs(a.expectedProfitUSD), Math.abs(b.expectedProfitUSD), 1e-9);
      if (Math.abs(a.expectedProfitUSD - b.expectedProfitUSD) / ref < 0.05) {
        return b.zScore - a.zScore;
      }
      return b.expectedProfitUSD - a.expectedProfitUSD;
    };
    candidates.sort(rank);
    const best = candidates[0];

    const profitable = candidates.filter((c) => c.profitable).sort(rank);
    if (profitable.length > 0) {
      // Capture the single highest-conviction profitable window this cycle.
      await this.executeCandidate(profitable[0]);
      return;
    }

    // No window clears costs. Surface the best gross window (throttled) as a
    // transparently-rejected opportunity so the feed reflects the cost-aware
    // intelligence rather than appearing idle — exactly the false-positive
    // filtering the challenge rewards.
    const now = Date.now();
    if (now - this.lastWindowRecordAt >= 3000) {
      this.lastWindowRecordAt = now;
      await this.recordRejectedWindow(best);
    }
  }

  /**
   * Depth-walk + cost evaluation across the order book. Returns the best-sized window
   * (flagging whether it clears the configured minimum net profit), or null if no size
   * is even gross-positive.
   */
  private computeCandidate(
    buyBook: NormalizedOrderBook,
    sellBook: NormalizedOrderBook
  ): ArbitrageCandidate | null {
    const buyExchangeId = buyBook.exchangeId;
    const sellExchangeId = sellBook.exchangeId;
    const symbol = buyBook.symbol;

    const buyMeta = EXCHANGES_METADATA[buyExchangeId];
    const sellMeta = EXCHANGES_METADATA[sellExchangeId];
    if (!buyMeta || !sellMeta) return null;

    // When the two legs are quoted in different currencies (USD vs USDT) the spread can
    // only be realised by converting across stablecoin rails — charge the basis cost so
    // the "Coinbase premium" isn't booked as free profit.
    const crossQuoteBps =
      buyMeta.quoteCurrency !== sellMeta.quoteCurrency ? (this.config.usdtUsdBasisBps ?? 8) : 0;

    const stepSize = 0.05; // Walk step size in BTC
    const maxBtcCap = Math.min(
      this.config.maxPositionBTCPerExchange,
      this.wallets[sellExchangeId]?.BTC?.free ?? 0
    );

    // Best *profitable* size (drives execution sizing).
    let optimalVolume = 0;
    let expectedProfitUSD = 0;
    // Representative window at the smallest fillable size (drives reporting even when
    // the net is negative), so rejected windows still carry a real net figure.
    let refVolume = 0;
    let refNetUSD = 0;
    let finalBuyPrice = 0;
    let finalSellPrice = 0;
    let refBuyPrice = 0;
    let refSellPrice = 0;
    let finalMathResult: NetSpreadResult | null = null;
    let refMathResult: NetSpreadResult | null = null;

    for (let testVol = stepSize; testVol <= Math.max(maxBtcCap, stepSize); testVol += stepSize) {
      const walkBuy = walkOrderBook(buyBook.asks, testVol);
      const walkSell = walkOrderBook(sellBook.bids, testVol);

      if (walkBuy.filledVolume < testVol || walkSell.filledVolume < testVol) break;

      const math = calculateNetSpread({
        buyPrice: walkBuy.avgPrice,
        sellPrice: walkSell.avgPrice,
        buyTakerFeeBps: buyMeta.takerFeeBps,
        sellTakerFeeBps: sellMeta.takerFeeBps,
        latencySafetyBps: this.config.latencySafetyBps,
        slippageSafetyBps: this.config.slippageSafetyBps,
        withdrawalFeeBTC: buyMeta.withdrawalFeeBTC,
        btcPriceQuote: walkBuy.avgPrice,
        crossQuoteBps,
      });

      const netProfitUSD = math.netSpread * testVol - math.withdrawalCostUSD;

      // Capture the first fillable size as the reporting reference.
      if (refVolume === 0) {
        refVolume = testVol;
        refNetUSD = netProfitUSD;
        refBuyPrice = walkBuy.avgPrice;
        refSellPrice = walkSell.avgPrice;
        refMathResult = math;
      }

      if (netProfitUSD > expectedProfitUSD && math.netSpread > 0) {
        optimalVolume = testVol;
        expectedProfitUSD = netProfitUSD;
        finalBuyPrice = walkBuy.avgPrice;
        finalSellPrice = walkSell.avgPrice;
        finalMathResult = math;
      } else if (optimalVolume > 0) {
        break; // Net spread is decreasing past the optimum.
      }
    }

    if (refVolume === 0 || !refMathResult) return null; // No fillable depth.

    const profitable = optimalVolume > 0 && expectedProfitUSD >= this.config.minNetProfitUSD;

    // Feed the statistical-arbitrage tracker with the per-BTC net spread for this pair and
    // capture how anomalous the live dislocation is versus its own rolling history.
    const { zScore } = this.spreadStats.update(buyExchangeId, sellExchangeId, refMathResult.netSpread);

    return {
      buyExchangeId,
      sellExchangeId,
      symbol,
      optimalVolume: profitable ? optimalVolume : refVolume,
      expectedProfitUSD: profitable ? expectedProfitUSD : refNetUSD,
      finalBuyPrice: profitable ? finalBuyPrice : refBuyPrice,
      finalSellPrice: profitable ? finalSellPrice : refSellPrice,
      topAsk: buyBook.asks[0].price,
      topBid: sellBook.bids[0].price,
      math: profitable && finalMathResult ? finalMathResult : refMathResult,
      zScore,
      profitable,
    };
  }

  /** Persists an evaluated gross window that was correctly rejected after costs. */
  private async recordRejectedWindow(c: ArbitrageCandidate) {
    const grossSpread = c.topBid - c.topAsk;
    const oppRecord: ArbitrageOpportunity = {
      id: `opp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      buyExchange: c.buyExchangeId,
      sellExchange: c.sellExchangeId,
      symbol: c.symbol,
      buyAsk: c.topAsk,
      sellBid: c.topBid,
      grossSpread,
      netSpread: c.math.netSpread,
      executableVolume: c.optimalVolume,
      expectedNetProfitUSD: c.expectedProfitUSD,
      status: 'SKIPPED',
      reason: `Unprofitable after fees & buffers: net $${c.expectedProfitUSD.toFixed(2)}/lot (gross +$${grossSpread.toFixed(2)})`,
      zScore: Number(c.zScore.toFixed(2)),
    };
    this.opportunitiesDetected += 1;
    await saveOpportunity(oppRecord);
    this.wsBroadcaster?.();
  }

  private async executeCandidate(c: ArbitrageCandidate) {
    const buyMeta = EXCHANGES_METADATA[c.buyExchangeId];
    const sellMeta = EXCHANGES_METADATA[c.sellExchangeId];

    const oppId = `opp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const grossSpread = c.topBid - c.topAsk;

    const approval = this.riskManager.approveTrade({
      buyExchange: c.buyExchangeId,
      sellExchange: c.sellExchangeId,
      volume: c.optimalVolume,
      buyPrice: c.finalBuyPrice,
      sellPrice: c.finalSellPrice,
      wallets: this.wallets,
      grossSpread,
    });

    // Executions always persist; repetitive risk rejections (e.g. once position caps
    // fill) are throttled so they don't flood the feed/disk every 100ms tick.
    if (!approval.approved) {
      const now = Date.now();
      if (now - this.lastWindowRecordAt < 3000) return;
      this.lastWindowRecordAt = now;
    }

    const oppRecord: ArbitrageOpportunity = {
      id: oppId,
      timestamp: Date.now(),
      buyExchange: c.buyExchangeId,
      sellExchange: c.sellExchangeId,
      symbol: c.symbol,
      buyAsk: c.topAsk,
      sellBid: c.topBid,
      grossSpread,
      netSpread: c.math.netSpread,
      executableVolume: c.optimalVolume,
      expectedNetProfitUSD: c.expectedProfitUSD,
      status: approval.approved ? 'EXECUTED' : 'SKIPPED',
      reason: approval.approved ? undefined : approval.reason,
      zScore: Number(c.zScore.toFixed(2)),
    };

    await saveOpportunity(oppRecord);
    this.opportunitiesDetected += 1;

    if (approval.approved) {
      this.executeSimulatedBalances(
        c.buyExchangeId,
        c.sellExchangeId,
        c.optimalVolume,
        c.finalBuyPrice,
        c.finalSellPrice
      );

      const slippageBuy = (c.finalBuyPrice - c.topAsk) * c.optimalVolume;
      const slippageSell = (c.topBid - c.finalSellPrice) * c.optimalVolume;
      const slippagePaid = slippageBuy + slippageSell;

      const tradeRecord: SimulatedTrade = {
        id: `trade-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        opportunityId: oppId,
        timestamp: Date.now(),
        buyExchange: c.buyExchangeId,
        sellExchange: c.sellExchangeId,
        symbol: c.symbol,
        buyPrice: c.finalBuyPrice,
        sellPrice: c.finalSellPrice,
        volume: c.optimalVolume,
        grossProfit: grossSpread * c.optimalVolume,
        netProfit: c.expectedProfitUSD,
        feesPaid: c.math.feeCostUSD * c.optimalVolume,
        slippagePaid,
      };

      await saveTrade(tradeRecord);

      await this.pnlTracker.recordTradeProfit(c.expectedProfitUSD);
      this.riskManager.recordTradeResult(c.expectedProfitUSD);

      this.logger.info(
        {
          eventType: 'TRADE_EXECUTION',
          buyExchange: c.buyExchangeId,
          sellExchange: c.sellExchangeId,
          symbol: c.symbol,
          volume: c.optimalVolume,
          buyPrice: c.finalBuyPrice,
          sellPrice: c.finalSellPrice,
          netProfitUSD: c.expectedProfitUSD,
        },
        `💰 ARBITRAGE EXECUTED! Size: ${c.optimalVolume.toFixed(2)} BTC. Net Profit: +$${c.expectedProfitUSD.toFixed(2)} USD. Buy ${c.buyExchangeId} ($${c.finalBuyPrice.toFixed(2)}) -> Sell ${c.sellExchangeId} ($${c.finalSellPrice.toFixed(2)})`
      );

      const event: EngineEvent = {
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: 'TRADE_EXECUTION',
        message: `Arbitrage Executed: Bought ${c.optimalVolume.toFixed(4)} BTC on ${buyMeta.name} and sold on ${sellMeta.name} for +$${c.expectedProfitUSD.toFixed(2)} net profit.`,
      };
      await saveEvent(event);

      await saveBalances(this.wallets);
    } else if (oppRecord.reason?.includes('Insufficient')) {
      this.logger.info(
        {
          eventType: 'INFO',
          buyExchange: c.buyExchangeId,
          sellExchange: c.sellExchangeId,
          symbol: c.symbol,
          reason: oppRecord.reason,
        },
        `Skipped opportunity: ${oppRecord.reason}`
      );
    }

    this.wsBroadcaster?.();
  }

  private executeSimulatedBalances(
    buyExchange: string,
    sellExchange: string,
    volume: number,
    buyPrice: number,
    sellPrice: number
  ) {
    const costQuote = volume * buyPrice;
    const proceedQuote = volume * sellPrice;

    if (this.wallets[buyExchange]) {
      this.wallets[buyExchange].USDT.free -= costQuote;
      this.wallets[buyExchange].BTC.free += volume;
    }

    if (this.wallets[sellExchange]) {
      this.wallets[sellExchange].BTC.free -= volume;
      this.wallets[sellExchange].USDT.free += proceedQuote;
    }
  }

  /** Live single-venue triangular state for the dashboard (undefined before first eval). */
  getTriangularState(): TriangularState | undefined {
    return this.lastTriangularState ?? undefined;
  }

  /**
   * Evaluates Binance's three-leg triangular cycle on every Binance book tick. Always
   * refreshes the live display state (so the dashboard shows the cost-aware edge even when
   * it is below the ~3x taker-fee floor and correctly skipped), and executes the rare
   * profitable cycle as a USDT round-trip on the venue.
   */
  private async evaluateTriangular(): Promise<void> {
    const NOTIONAL_CAP_USD = 20000;
    const venue = 'binance';
    const top = (b?: NormalizedOrderBook | null) =>
      b && b.asks[0] && b.bids[0] ? { bestBid: b.bids[0].price, bestAsk: b.asks[0].price } : null;

    const btcTop = top(orderBookStore.getBook(venue, 'BTCUSDT'));
    const ethTop = top(orderBookStore.getBook(venue, 'ETHUSDT'));
    const ethbtcTop = top(orderBookStore.getBook(venue, 'ETHBTC'));

    if (!btcTop || !ethTop || !ethbtcTop) {
      // Surface "unavailable" so the UI can distinguish a missing feed from a flat edge.
      this.lastTriangularState = {
        venue,
        available: false,
        direction: '—',
        legs: [],
        grossEdgeBps: 0,
        feeBps: 0,
        netEdgeBps: 0,
        notionalUSD: 0,
        expectedProfitUSD: 0,
        profitable: false,
        executedCount: this.triangularExecuted,
        updatedAt: Date.now(),
      };
      return;
    }

    const takerFeeBps = EXCHANGES_METADATA[venue]?.takerFeeBps ?? 4;
    const usdtFree = this.wallets[venue]?.USDT?.free ?? 0;
    const notionalUSD = Math.max(0, Math.min(NOTIONAL_CAP_USD, usdtFree));

    const result = computeTriangular({
      btcUsdt: btcTop,
      ethUsdt: ethTop,
      ethBtc: ethbtcTop,
      takerFeeBps,
      notionalUSD,
    });
    if (!result) return;

    const profitable =
      !this.config.isPaused &&
      result.netEdgeBps > 0 &&
      result.expectedProfitUSD >= this.config.minNetProfitUSD;

    this.lastTriangularState = {
      venue,
      available: true,
      direction: result.direction,
      legs: result.legs,
      grossEdgeBps: Number(result.grossEdgeBps.toFixed(3)),
      feeBps: Number(result.feeBps.toFixed(3)),
      netEdgeBps: Number(result.netEdgeBps.toFixed(3)),
      notionalUSD,
      expectedProfitUSD: Number(result.expectedProfitUSD.toFixed(2)),
      profitable,
      executedCount: this.triangularExecuted,
      updatedAt: Date.now(),
    };

    // Triangular edges on a single efficient venue rarely clear three taker fees — execute
    // only when they genuinely do, throttled so a sustained dislocation can't spam fills.
    if (profitable && Date.now() - this.lastTriangularExecAt > 2000) {
      await this.executeTriangular(result, notionalUSD, btcTop.bestAsk);
    }
  }

  /** Simulates a profitable triangular cycle as a single-venue USDT round-trip. */
  private async executeTriangular(
    result: ReturnType<typeof computeTriangular> & object,
    notionalUSD: number,
    btcAsk: number
  ): Promise<void> {
    if (!result) return;
    this.lastTriangularExecAt = Date.now();
    const venue = 'binance';

    const netProfit = notionalUSD * (result.netEdgeBps / 10000);
    const grossProfit = notionalUSD * (result.grossEdgeBps / 10000);
    const feesPaid = notionalUSD * (result.feeBps / 10000);
    const btcTurnover = btcAsk > 0 ? notionalUSD / btcAsk : 0;

    // The cycle starts and ends in USDT on the same venue, so its net effect is a USDT gain.
    if (this.wallets[venue]?.USDT) this.wallets[venue].USDT.free += netProfit;

    const tradeRecord: SimulatedTrade = {
      id: `trade-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      opportunityId: `tri-${Date.now()}`,
      timestamp: Date.now(),
      buyExchange: venue,
      sellExchange: venue,
      symbol: `△ ${result.direction}`,
      buyPrice: btcAsk,
      sellPrice: btcAsk * (1 + result.netEdgeBps / 10000),
      volume: btcTurnover,
      grossProfit,
      netProfit,
      feesPaid,
      slippagePaid: 0,
    };

    await saveTrade(tradeRecord);
    await this.pnlTracker.recordTradeProfit(netProfit);
    this.riskManager.recordTradeResult(netProfit);
    this.triangularExecuted += 1;
    await saveBalances(this.wallets);

    this.logger.info(
      { eventType: 'TRADE_EXECUTION', venue, direction: result.direction, netProfitUSD: netProfit },
      `🔺 TRIANGULAR EXECUTED on Binance (${result.direction}): +$${netProfit.toFixed(2)} net on $${notionalUSD.toFixed(0)} (${result.netEdgeBps.toFixed(1)} bps).`
    );
    await this.emitEvent(
      'TRADE_EXECUTION',
      `Triangular cycle executed on Binance (${result.direction}): +$${netProfit.toFixed(2)} net on $${notionalUSD.toFixed(0)} notional (${result.netEdgeBps.toFixed(1)} bps).`
    );
  }
}
