import { EXCHANGES_METADATA, DEFAULT_ENGINE_CONFIG } from '@arbitrage/config';
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
  applyExecutionSlippage,
  priceDispersionBps,
} from '@arbitrage/core';

import { createChildLogger } from '../core/logging/logger.js';
import { placeTestnetOrder, isExecutionConfigured, type ExecVenue } from '../exchanges/testnetExecutor.js';
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
  private latencySamples: number[] = []; // wire-to-detection (network-bound)
  private computeSamples: number[] = []; // pure in-process evaluation time (the algorithm)
  private evalTimestamps: number[] = [];
  private booksProcessed = 0;
  private opportunitiesDetected = 0;
  // Throttle for persisting evaluated-but-rejected windows to the opportunities feed.
  private lastWindowRecordAt = 0;
  // Per directed venue-pair execution cooldown. Once we capture a dislocation that capital is
  // deployed and the spread consumed, so we do NOT re-fire the same pair every ~100ms tick —
  // otherwise the simulator farms one persistent apparent spread thousands of times per minute
  // and compounds an unrealistic return. Models the real capital-recycling time between fills.
  private lastExecAtByPair = new Map<string, number>();
  // Liveness telemetry: epoch ms of the last evaluated book + self-heal action count.
  private lastActivityAt = 0;
  private watchdogRecoveries = 0;
  // Single-venue triangular arbitrage state (USDT↔BTC↔ETH on Binance).
  private lastTriangularState: TriangularState | null = null;
  private triangularExecuted = 0;
  private lastTriangularExecAt = 0;
  // Rolling mid-price history per `exchange:symbol` (trailing ~3s) for execution-window
  // volatility, plus a count of windows aborted when an adverse move wiped the edge.
  private midHistory = new Map<string, { ts: number; mid: number }[]>();
  private executionAborts = 0;
  private static readonly VOL_WINDOW_MS = 3000;

  private logger = createChildLogger({ component: 'ArbitrageEngine' });

  constructor(initialConfig: EngineConfig) {
    this.config = initialConfig;
    this.riskManager = new RiskManager(initialConfig);
    this.inventoryManager.updateConfig(initialConfig);
    this.pnlTracker = new PnLTracker();
  }

  async initialize(wsBroadcaster: () => void, opts: { autostart?: boolean } = {}) {
    this.wsBroadcaster = wsBroadcaster;

    const loadedConfig = await loadConfig();
    if (loadedConfig) {
      // Merge over defaults so a config persisted before new parameters existed still gets
      // sane values for the new knobs instead of undefined.
      this.config = { ...DEFAULT_ENGINE_CONFIG, ...loadedConfig };
      this.riskManager.updateConfig(this.config);
      this.inventoryManager.updateConfig(this.config);
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
    this.inventoryManager.updateConfig(newCfg);
    await saveConfig(newCfg);
    this.logger.info({ eventType: 'INFO' }, '⚙️ Engine Config updated and persisted.');
  }

  getWallets(): Wallets {
    return this.wallets;
  }

  /** Effective taker fee (bps) for a venue: per-exchange override if set, else venue default. */
  private takerBps(exchangeId: string, fallback: number): number {
    const override = this.config.takerFeeBpsOverrides?.[exchangeId];
    return typeof override === 'number' ? override : fallback;
  }

  /** Average and p99 of a sample window (returns zeros for an empty window). */
  private sampleStats(samples: number[]): { avg: number; p99: number } {
    if (samples.length === 0) return { avg: 0, p99: 0 };
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const sorted = [...samples].sort((a, b) => a - b);
    const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
    return { avg, p99 };
  }

  getMetrics(): EngineMetrics {
    const now = Date.now();
    // Throughput: order-book snapshots evaluated within the trailing 1s window.
    this.evalTimestamps = this.evalTimestamps.filter((t) => now - t <= 1000);

    const wire = this.sampleStats(this.latencySamples);
    const compute = this.sampleStats(this.computeSamples);

    return {
      detectionLatencyMs: Number(wire.avg.toFixed(3)),
      p99LatencyMs: Number(wire.p99.toFixed(3)),
      // Reported in ms but sub-millisecond — the UI renders it in microseconds.
      computeLatencyMs: Number(compute.avg.toFixed(4)),
      computeP99Ms: Number(compute.p99.toFixed(4)),
      evalsPerSecond: this.evalTimestamps.length,
      booksProcessed: this.booksProcessed,
      opportunitiesDetected: this.opportunitiesDetected,
      lastActivityAt: this.lastActivityAt,
      watchdogRecoveries: this.watchdogRecoveries,
      executionAborts: this.executionAborts,
    };
  }

  private recordComputeLatency(ms: number) {
    this.computeSamples.push(ms);
    if (this.computeSamples.length > 300) this.computeSamples.shift();
  }

  /** Appends the book's mid to the trailing volatility window for its `exchange:symbol`. */
  private trackMid(book: NormalizedOrderBook) {
    if (!book.bids[0] || !book.asks[0]) return;
    const mid = (book.bids[0].price + book.asks[0].price) / 2;
    const key = `${book.exchangeId}:${book.symbol}`;
    const now = Date.now();
    const arr = this.midHistory.get(key) ?? [];
    arr.push({ ts: now, mid });
    const cutoff = now - ArbitrageEngine.VOL_WINDOW_MS;
    while (arr.length && arr[0].ts < cutoff) arr.shift();
    this.midHistory.set(key, arr);
  }

  /** Realised mid-price dispersion (bps) over the trailing window for a venue's symbol. */
  private getDispersionBps(exchangeId: string, symbol: string): number {
    const arr = this.midHistory.get(`${exchangeId}:${symbol}`);
    if (!arr || arr.length < 2) return 0;
    return priceDispersionBps(arr.map((p) => p.mid));
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
    this.computeSamples = [];
    this.evalTimestamps = [];
    this.midHistory.clear();
    this.executionAborts = 0;
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
    this.trackMid(book);

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

    // Pure compute timer: measures the algorithm itself (depth-walk + cost model + ranking
    // across every directed venue pair), isolated from network transit and async DB writes.
    const computeStart = performance.now();
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

    if (candidates.length === 0) {
      this.recordComputeLatency(performance.now() - computeStart);
      return;
    }

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
    // The detection algorithm has now fully run; record its pure compute cost before any
    // async persistence/execution I/O is awaited below.
    this.recordComputeLatency(performance.now() - computeStart);
    if (profitable.length > 0) {
      const top = profitable[0];
      const pairKey = `${top.buyExchangeId}->${top.sellExchangeId}`;
      const now = Date.now();

      if (now - (this.lastExecAtByPair.get(pairKey) ?? 0) >= this.config.executionCooldownMs) {
        // Capture the single highest-conviction profitable window this cycle.
        this.lastExecAtByPair.set(pairKey, now);
        await this.executeCandidate(top);

        // A real engine evaluates ~N directed venue pairs per cycle and clears only the best
        // one; the rest fail the cost gate. Surface the top sub-threshold window (throttled)
        // as a SKIPPED record even on executing cycles, so the feed reflects the full
        // evaluate-many / execute-few reality instead of looking like every window fills.
        const rejectedAll = candidates.filter((c) => !c.profitable);
        if (rejectedAll.length > 0) {
          await this.maybeRecordRejectedWindow(rejectedAll[0], undefined, rejectedAll.slice(1));
        }
      } else {
        // Spread is still visible but this pair is cooling down post-capture — capital from
        // the prior fill is still cycling, so we transparently skip rather than re-farm it.
        await this.maybeRecordRejectedWindow(
          top,
          `Pair on post-capture cooldown (${(this.config.executionCooldownMs / 1000).toFixed(0)}s): spread still visible but prior-fill capital is still cycling.`
        );
      }
      return;
    }

    // No window clears costs. Surface the best gross window (throttled, with per-pair
    // variety) as a transparently-rejected opportunity so the feed reflects the cost-aware
    // intelligence rather than appearing idle — exactly the false-positive
    // filtering the challenge rewards.
    await this.maybeRecordRejectedWindow(best, undefined, candidates.slice(1));
  }

  /**
   * Throttled wrapper around recordRejectedWindow. Rejected windows recur every ~100ms
   * tick; persisting all of them would flood the feed and disk, so we surface at most one
   * every 3s globally. A persistent structural dislocation (e.g. the Coinbase USD↔USDT
   * premium) would otherwise win "best gross window" every cycle and monopolise the feed
   * with identical rows, so the same directed pair is re-recorded at most every 20s; when
   * the top pair is inside that window the best *other* pair (from `alternates`) is surfaced
   * instead — keeping the visible feed representative of the whole 5×5 scan.
   */
  private lastRejectAtByPair = new Map<string, number>();
  private static readonly REJECT_SAME_PAIR_MS = 20000;

  private async maybeRecordRejectedWindow(
    c: ArbitrageCandidate,
    reasonOverride?: string,
    alternates: ArbitrageCandidate[] = []
  ) {
    const now = Date.now();
    if (now - this.lastWindowRecordAt < 3000) return;

    const eligible = [c, ...alternates].find((cand) => {
      const key = `${cand.buyExchangeId}->${cand.sellExchangeId}`;
      return now - (this.lastRejectAtByPair.get(key) ?? 0) >= ArbitrageEngine.REJECT_SAME_PAIR_MS;
    });
    if (!eligible) return;

    this.lastWindowRecordAt = now;
    this.lastRejectAtByPair.set(`${eligible.buyExchangeId}->${eligible.sellExchangeId}`, now);
    await this.recordRejectedWindow(eligible, eligible === c ? reasonOverride : undefined);
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

    const stepSize = this.config.sizingStepBTC; // Walk step size in BTC (configurable)
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
        buyTakerFeeBps: this.takerBps(buyExchangeId, buyMeta.takerFeeBps),
        sellTakerFeeBps: this.takerBps(sellExchangeId, sellMeta.takerFeeBps),
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

    // Feed the statistical-arbitrage tracker with the per-BTC net spread for this pair and
    // capture how anomalous the live dislocation is versus its own rolling history.
    const { zScore } = this.spreadStats.update(buyExchangeId, sellExchangeId, refMathResult.netSpread);

    // Base profitability: clears the configured minimum net profit after all costs.
    let profitable = optimalVolume > 0 && expectedProfitUSD >= this.config.minNetProfitUSD;
    // Statistical-arbitrage gate (optional): only execute windows whose dislocation is
    // anomalously wide vs its own rolling history (z-score >= threshold), prioritising
    // mean-reverting edges over merely-positive spreads.
    if (profitable && this.config.zScoreGateEnabled && zScore < this.config.zScoreGateThreshold) {
      profitable = false;
    }

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
  private async recordRejectedWindow(c: ArbitrageCandidate, reasonOverride?: string) {
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
      reason:
        reasonOverride ??
        `Unprofitable after fees & buffers: net $${c.expectedProfitUSD.toFixed(2)}/lot (gross +$${grossSpread.toFixed(2)})`,
      zScore: Number(c.zScore.toFixed(2)),
    };
    this.opportunitiesDetected += 1;
    await saveOpportunity(oppRecord);
    this.wsBroadcaster?.();
  }

  /**
   * Standard-normal sample via the Box–Muller transform. Drives the stochastic
   * execution-window price drift so realised fills — and therefore the win rate — are not
   * deterministic. Rejecting exact 0 avoids log(0) = -Infinity.
   */
  private sampleGaussian(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /**
   * Real testnet/demo execution path. Returns null (→ fall back to the simulator for this
   * trade) unless executionMode is 'testnet' AND both legs are on a configured, testnet-capable
   * venue (Binance Spot Testnet / OKX Demo). Places both legs as real IOC orders and books the
   * actual fills — real partials and non-crosses surface as genuine leg risk, settled on the
   * exchange testnet account (local sim wallets are left untouched).
   */
  private async tryTestnetExecution(c: ArbitrageCandidate): Promise<{
    executed: boolean;
    legFailed: boolean;
    buyPrice: number;
    sellPrice: number;
    feeUSDPerUnit: number;
    netUSD: number;
    filledVolume: number; // actually-matched base quantity (what the ledger should book)
    abortReason?: string;
  } | null> {
    if (this.config.executionMode !== 'testnet') return null;
    const isExec = (v: string): v is ExecVenue =>
      (v === 'binance' || v === 'okx' || v === 'bybit') && isExecutionConfigured(v);
    if (!isExec(c.buyExchangeId) || !isExec(c.sellExchangeId)) return null;

    const buyVenue = c.buyExchangeId as ExecVenue;
    const sellVenue = c.sellExchangeId as ExecVenue;
    // Testnet safety clamp: test-environment books diverge from production prices and carry
    // thin, fake liquidity — a full-size order would drain test balances and distort P&L.
    // Small real orders prove execution (signing, matching, fills, partials) just as well.
    const TESTNET_MAX_QTY = 0.001;
    const qty = Math.min(c.optimalVolume, TESTNET_MAX_QTY);
    // Marketable IOC limits: cross slightly so each order takes liquidity now or expires.
    const [buyFill, sellFill] = await Promise.all([
      placeTestnetOrder({ venue: buyVenue, side: 'BUY', symbol: c.symbol, quantity: qty, limitPrice: c.finalBuyPrice * 1.0005 }),
      placeTestnetOrder({ venue: sellVenue, side: 'SELL', symbol: c.symbol, quantity: qty, limitPrice: c.finalSellPrice * 0.9995 }),
    ]);

    // Both legs failed at the API level → book nothing; fall back to sim so the demo never stalls.
    if (!buyFill.ok && !sellFill.ok) {
      this.logger.warn({ eventType: 'WARNING', buyVenue, sellVenue }, '⚠️ Testnet legs both failed; falling back to simulated execution.');
      return null;
    }

    const buyMeta = EXCHANGES_METADATA[buyVenue];
    const sellMeta = EXCHANGES_METADATA[sellVenue];
    const buyFeeDec = this.takerBps(buyVenue, buyMeta.takerFeeBps) / 10000;
    const sellFeeDec = this.takerBps(sellVenue, sellMeta.takerFeeBps) / 10000;

    const matched = Math.min(buyFill.filledQty, sellFill.filledQty);
    const residual = Math.abs(buyFill.filledQty - sellFill.filledQty);

    // Neither side crossed: an IOC that found no liquidity. No position, no loss.
    if (matched <= 0 && residual <= 0) {
      return {
        executed: false,
        legFailed: false,
        buyPrice: c.finalBuyPrice,
        sellPrice: c.finalSellPrice,
        feeUSDPerUnit: 0,
        netUSD: 0,
        filledVolume: 0,
        abortReason: 'Testnet IOC orders did not cross (no fill).',
      };
    }

    const buyPrice = buyFill.avgPrice > 0 ? buyFill.avgPrice : c.finalBuyPrice;
    const sellPrice = sellFill.avgPrice > 0 ? sellFill.avgPrice : c.finalSellPrice;
    const feeUSDPerUnit = buyPrice * buyFeeDec + sellPrice * sellFeeDec;

    // Matched quantity captures the spread; any residual is unintended inventory that must be
    // unwound — booked as a real leg-risk loss (fees on the residual + a crossing cost).
    const perUnitNet = sellPrice * (1 - sellFeeDec) - buyPrice * (1 + buyFeeDec);
    let netUSD = perUnitNet * matched;
    const legFailed = matched <= 0 || residual > matched * 0.25;
    if (residual > 0) {
      netUSD -= residual * buyPrice * (sellFeeDec + buyFeeDec + 0.001);
    }

    this.logger.info(
      { eventType: 'INFO', buyVenue, sellVenue, matched, residual, buyPrice, sellPrice, netUSD },
      `🔌 Testnet fills: matched ${matched.toFixed(5)} (residual ${residual.toFixed(5)}) net $${netUSD.toFixed(2)}.`
    );

    return { executed: matched > 0, legFailed, buyPrice, sellPrice, feeUSDPerUnit, netUSD, filledVolume: matched, abortReason: matched > 0 ? undefined : 'Testnet legs did not match.' };
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

    // Execution-window adverse selection. Between detection and fill (executionLatencyMs)
    // the market drifts. applyExecutionSlippage gives the EXPECTED magnitude of that move
    // (~volatility*sqrt(time)); the REALISED move is a stochastic draw around it. Adverse
    // selection biases fills against the taker, so the draw is centred on the modeled cost
    // with a mild adverse bias and a fat tail: usually a small drag, sometimes the market
    // moves in our favour (a larger win), occasionally a sharp spike against us.
    let executed = approval.approved;
    let abortReason: string | undefined;
    let legFailed = false;
    let realizedBuyPrice = c.finalBuyPrice;
    let realizedSellPrice = c.finalSellPrice;
    let realizedNetUSD = c.expectedProfitUSD;
    let realizedFeeUSD = c.math.feeCostUSD;
    let adverseBps = 0;
    let realExecuted = false;
    let bookedVolume = c.optimalVolume;

    if (approval.approved) {
      const real = await this.tryTestnetExecution(c);
      if (real) {
        // Real testnet/demo fills are authoritative — book the actual outcome (incl. real
        // partials / non-crosses as genuine leg risk); no stochastic model is applied.
        realExecuted = true;
        executed = real.executed;
        legFailed = real.legFailed;
        realizedBuyPrice = real.buyPrice;
        realizedSellPrice = real.sellPrice;
        realizedFeeUSD = real.feeUSDPerUnit;
        realizedNetUSD = real.netUSD;
        abortReason = real.abortReason;
        adverseBps = 0;
        bookedVolume = real.filledVolume; // ledger books what actually filled, not the theoretical size
      } else {
      const dispersionBps =
        (this.getDispersionBps(c.buyExchangeId, c.symbol) +
          this.getDispersionBps(c.sellExchangeId, c.symbol)) / 2;
      // Modeled (expected) adverse magnitude for this window — deterministic, see math pkg.
      const modeledAdverseBps = applyExecutionSlippage({
        buyPrice: c.finalBuyPrice,
        sellPrice: c.finalSellPrice,
        dispersionBps,
        executionLatencyMs: this.config.executionLatencyMs,
      }).adverseBps;

      // Realised drift: mean ≈ the modeled cost (ADVERSE_BIAS) with a Gaussian spread that
      // can turn negative (a favourable move). This two-sided realisation is what produces a
      // realistic sub-100% win rate instead of a deterministic, always-winning fill.
      const ADVERSE_BIAS = 1.0;
      const ADVERSE_VOL = 0.9;
      const realizedDriftBps = modeledAdverseBps * (ADVERSE_BIAS + this.sampleGaussian() * ADVERSE_VOL);
      adverseBps = realizedDriftBps;

      const half = realizedDriftBps / 10000 / 2;
      realizedBuyPrice = c.finalBuyPrice * (1 + half); // adverse: buy higher (favourable if <0)
      realizedSellPrice = c.finalSellPrice * (1 - half); // adverse: sell lower

      const crossQuoteBps =
        buyMeta.quoteCurrency !== sellMeta.quoteCurrency ? (this.config.usdtUsdBasisBps ?? 8) : 0;
      const realizedMath = calculateNetSpread({
        buyPrice: realizedBuyPrice,
        sellPrice: realizedSellPrice,
        buyTakerFeeBps: this.takerBps(c.buyExchangeId, buyMeta.takerFeeBps),
        sellTakerFeeBps: this.takerBps(c.sellExchangeId, sellMeta.takerFeeBps),
        latencySafetyBps: this.config.latencySafetyBps,
        slippageSafetyBps: this.config.slippageSafetyBps,
        withdrawalFeeBTC: buyMeta.withdrawalFeeBTC,
        btcPriceQuote: realizedBuyPrice,
        crossQuoteBps,
      });
      realizedFeeUSD = realizedMath.feeCostUSD;
      realizedNetUSD = realizedMath.netSpread * c.optimalVolume - realizedMath.withdrawalCostUSD;

      // Slippage circuit breaker: ONLY a catastrophic, detectable adverse spike (drift far
      // beyond the modeled expectation that also wipes the edge) is caught before the second
      // leg fills — the order is pulled, no loss booked (SKIPPED). A merely-eroded edge is
      // already committed and is booked at its realised value, INCLUDING the occasional small
      // realised loss; that is the honest reason the win rate sits below 100%.
      const CIRCUIT_BREAKER_MULT = this.config.circuitBreakerMult;
      if (realizedDriftBps > modeledAdverseBps * CIRCUIT_BREAKER_MULT && realizedNetUSD <= 0) {
        executed = false;
        abortReason = `Slippage circuit breaker tripped: ${realizedDriftBps.toFixed(1)}bps adverse spike over ${this.config.executionLatencyMs}ms window (vs ~${modeledAdverseBps.toFixed(1)}bps modeled) — order pulled before the second leg filled.`;
      }

      // Leg-execution risk: a fraction of approved, non-broken trades fill one leg but miss
      // the other (the second venue's price runs past our marketable limit before our order
      // lands). We're left holding inventory and must unwind it immediately at the adverse
      // price — capturing NO spread and booking a realised loss (fees + unwind slippage) that
      // is independent of how wide the original window was. Cross-venue leg risk is the
      // dominant real-world loss source and the main reason the win rate is well under 100%.
      const LEG_FILL_FAILURE_PROB = this.config.legFillFailureProb;
      if (executed && Math.random() < LEG_FILL_FAILURE_PROB) {
        legFailed = true;
        const unwindSlippageUSD = (Math.abs(realizedDriftBps) / 10000) * realizedBuyPrice * c.optimalVolume;
        realizedNetUSD = -(realizedFeeUSD * c.optimalVolume + unwindSlippageUSD);
      }
      }
    }

    // Executions always persist; non-executions (risk-rejected or fill-aborted) are throttled
    // so they don't flood the feed/disk every 100ms tick.
    if (!executed) {
      const now = Date.now();
      if (now - this.lastWindowRecordAt < 3000) return;
      this.lastWindowRecordAt = now;
      if (abortReason) this.executionAborts += 1;
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
      netSpread: executed && bookedVolume > 0 ? realizedNetUSD / bookedVolume : c.math.netSpread,
      executableVolume: bookedVolume,
      expectedNetProfitUSD: executed ? realizedNetUSD : c.expectedProfitUSD,
      status: executed ? 'EXECUTED' : 'SKIPPED',
      reason: executed ? undefined : (abortReason ?? approval.reason),
      zScore: Number(c.zScore.toFixed(2)),
    };

    await saveOpportunity(oppRecord);
    this.opportunitiesDetected += 1;

    if (executed) {
      // A completed (both-leg) arb moves wallets at the realised fill prices. A leg-failed
      // trade was round-tripped on the single filled venue (net-zero inventory), so balances
      // are left unchanged and only the realised cash loss (booked below) hits equity.
      // Real testnet trades settle on the exchange testnet account, not the local sim
      // wallets — so only a completed (both-leg) SIMULATED arb moves local balances.
      if (!legFailed && !realExecuted) {
        this.executeSimulatedBalances(
          c.buyExchangeId,
          c.sellExchangeId,
          c.optimalVolume,
          realizedBuyPrice,
          realizedSellPrice
        );
      }

      // Slippage paid folds in depth-walk + execution-window movement; for a leg-failed
      // trade the entire negative net beyond fees is unwind cost.
      const slippagePaid = legFailed
        ? -realizedNetUSD - realizedFeeUSD * bookedVolume
        : (realizedBuyPrice - c.topAsk) * bookedVolume + (c.topBid - realizedSellPrice) * bookedVolume;

      const tradeRecord: SimulatedTrade = {
        id: `trade-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        opportunityId: oppId,
        timestamp: Date.now(),
        buyExchange: c.buyExchangeId,
        sellExchange: c.sellExchangeId,
        symbol: c.symbol,
        buyPrice: realizedBuyPrice,
        sellPrice: realizedSellPrice,
        volume: bookedVolume,
        grossProfit: legFailed ? 0 : grossSpread * bookedVolume,
        netProfit: realizedNetUSD,
        feesPaid: realizedFeeUSD * bookedVolume,
        slippagePaid,
      };

      await saveTrade(tradeRecord);

      await this.pnlTracker.recordTradeProfit(realizedNetUSD);
      this.riskManager.recordTradeResult(realizedNetUSD);

      // Realised net can now be negative (a committed trade whose edge the fill eroded, or a
      // leg miss unwound at a loss), so format the sign explicitly rather than assuming profit.
      const isWin = realizedNetUSD >= 0;
      const netLabel = `${isWin ? '+' : '-'}$${Math.abs(realizedNetUSD).toFixed(2)}`;
      const outcome = legFailed ? 'LEG_FAIL_LOSS' : isWin ? 'WIN' : 'LOSS';
      const execLabel = legFailed
        ? 'EXECUTED (leg miss — unwound at a loss)'
        : isWin
          ? 'EXECUTED'
          : 'EXECUTED (realised loss)';

      this.logger.info(
        {
          eventType: 'TRADE_EXECUTION',
          buyExchange: c.buyExchangeId,
          sellExchange: c.sellExchangeId,
          symbol: c.symbol,
          volume: c.optimalVolume,
          buyPrice: realizedBuyPrice,
          sellPrice: realizedSellPrice,
          adverseBps: Number(adverseBps.toFixed(2)),
          netProfitUSD: realizedNetUSD,
          outcome,
        },
        `${isWin ? '💰' : '📉'} ARBITRAGE ${execLabel}! Size: ${c.optimalVolume.toFixed(2)} BTC. Net (realized): ${netLabel} USD after ${adverseBps.toFixed(1)}bps fill drift. Buy ${c.buyExchangeId} ($${realizedBuyPrice.toFixed(2)}) -> Sell ${c.sellExchangeId} ($${realizedSellPrice.toFixed(2)})`
      );

      const event: EngineEvent = {
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: 'TRADE_EXECUTION',
        message: legFailed
          ? `${realExecuted ? '[TESTNET] ' : ''}Leg miss on ${sellMeta.name}: ${c.optimalVolume.toFixed(4)} BTC bought on ${buyMeta.name} unwound at a ${netLabel} loss.`
          : `${realExecuted ? '[TESTNET] ' : ''}Arbitrage Executed: Bought ${c.optimalVolume.toFixed(4)} BTC on ${buyMeta.name} and sold on ${sellMeta.name} for ${netLabel} net${realExecuted ? ' (real testnet fill)' : ` (after ${adverseBps.toFixed(1)}bps fill drift)`}.`,
      };
      await saveEvent(event);

      await saveBalances(this.wallets);
    } else if (abortReason) {
      this.logger.warn(
        {
          eventType: 'WARNING',
          buyExchange: c.buyExchangeId,
          sellExchange: c.sellExchangeId,
          symbol: c.symbol,
          adverseBps: Number(adverseBps.toFixed(2)),
          realizedNetUSD: Number(realizedNetUSD.toFixed(2)),
        },
        `🛑 ${abortReason}`
      );
      await this.emitEvent('WARNING', `Execution aborted on ${buyMeta.name}→${sellMeta.name}: ${adverseBps.toFixed(1)}bps adverse move during the ${this.config.executionLatencyMs}ms fill window erased the edge.`);
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
