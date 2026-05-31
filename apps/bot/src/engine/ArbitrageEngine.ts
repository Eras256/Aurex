import { EXCHANGES_METADATA } from '@arbitrage/config';
import { 
  NormalizedOrderBook, 
  ArbitrageOpportunity, 
  SimulatedTrade, 
  EngineEvent, 
  walkOrderBook, 
  calculateNetSpread 
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
  saveConfig 
} from '../persistence/repositories.js';

import { PnLTracker } from './PnLTracker.js';
import { RiskManager } from './RiskManager.js';

export class ArbitrageEngine {
  private config: any;
  private wallets: Record<string, Record<string, { free: number; locked: number }>> = {};
  public riskManager: RiskManager;
  public pnlTracker: PnLTracker;
  private wsBroadcaster: (() => void) | null = null;
  private isProcessing = false;

  // Custom structured child logger for ArbitrageEngine
  private logger = createChildLogger({ component: 'ArbitrageEngine' });

  constructor(initialConfig: any) {
    this.config = initialConfig;
    this.riskManager = new RiskManager(initialConfig);
    this.pnlTracker = new PnLTracker();
  }

  async initialize(wsBroadcaster: () => void) {
    this.wsBroadcaster = wsBroadcaster;
    
    // Load config from DB if available, else keep initial
    const loadedConfig = await loadConfig();
    if (loadedConfig) {
      this.config = loadedConfig;
      this.riskManager.updateConfig(loadedConfig);
      this.logger.info({ eventType: 'INFO' }, '⚙️ Loaded active Engine Config from database.');
    } else {
      await saveConfig(this.config);
    }

    // Load wallets from DB
    const loadedBalances = await loadBalances();
    if (loadedBalances) {
      this.wallets = loadedBalances;
      this.logger.info({ eventType: 'INFO' }, '💼 Loaded active Wallet Balances from database.');
    }

    await this.pnlTracker.initialize();

    // Subscribe to order book updates
    orderBookStore.addListener((book) => this.onBookUpdate(book));
    this.logger.info({ eventType: 'INFO' }, '🚀 ArbitrageEngine active: subscribed to L2 depth caches.');
  }

  getConfig() {
    return this.config;
  }

  async updateConfig(newCfg: any) {
    this.config = newCfg;
    this.riskManager.updateConfig(newCfg);
    await saveConfig(newCfg);
    this.logger.info({ eventType: 'INFO' }, '⚙️ Engine Config updated and persisted.');
  }

  getWallets() {
    return this.wallets;
  }

  async resetSimulation() {
    await this.pnlTracker.reset();
    this.riskManager.resetBreakers();
    this.wsBroadcaster?.();
  }

  private async onBookUpdate(book: NormalizedOrderBook) {
    if (this.config.isPaused || this.isProcessing) return;

    this.isProcessing = true;
    try {
      await this.evaluateArbitrage(book.symbol);
    } catch (error) {
      this.logger.error({ eventType: 'ERROR', error }, 'Error running arbitrage valuation loop');
    } finally {
      this.isProcessing = false;
    }
  }

  private async evaluateArbitrage(symbol: string) {
    const enabledExchanges = this.config.enabledExchanges;
    if (enabledExchanges.length < 2) return;

    // Evaluate spreads between all permutations of enabled exchanges
    for (let i = 0; i < enabledExchanges.length; i++) {
      for (let j = 0; j < enabledExchanges.length; j++) {
        if (i === j) continue;

        const buyExchangeId = enabledExchanges[i];
        const sellExchangeId = enabledExchanges[j];

        const buyBook = orderBookStore.getBook(buyExchangeId, symbol);
        const sellBook = orderBookStore.getBook(sellExchangeId, symbol);

        if (!buyBook || !sellBook) continue;
        if (buyBook.asks.length === 0 || sellBook.bids.length === 0) continue;

        // Naive top-of-book spread check
        const topAsk = buyBook.asks[0].price;
        const topBid = sellBook.bids[0].price;

        if (topAsk >= topBid) {
          // No arbitrage candidate
          continue;
        }

        // Potential opportunity! Execute walk calculation to determine size and true costs
        await this.evaluateCandidateOpportunity(buyBook, sellBook);
      }
    }
  }

  private async evaluateCandidateOpportunity(buyBook: NormalizedOrderBook, sellBook: NormalizedOrderBook) {
    const buyExchangeId = buyBook.exchangeId;
    const sellExchangeId = sellBook.exchangeId;
    const symbol = buyBook.symbol;

    const buyMeta = EXCHANGES_METADATA[buyExchangeId];
    const sellMeta = EXCHANGES_METADATA[sellExchangeId];

    // Iterative depth walk to find optimal executable size
    let optimalVolume = 0;
    let expectedProfitUSD = 0;
    let finalBuyPrice = 0;
    let finalSellPrice = 0;
    let finalMathResult: any = null;

    const stepSize = 0.05; // Walk step size in BTC
    const maxBtcCap = Math.min(
      this.config.maxPositionBTCPerExchange,
      this.wallets[sellExchangeId]?.BTC?.free || 0
    );

    // Iteratively test larger size increments until net spread turns negative or we hit limits
    for (let testVol = stepSize; testVol <= maxBtcCap; testVol += stepSize) {
      const walkBuy = walkOrderBook(buyBook.asks, testVol);
      const walkSell = walkOrderBook(sellBook.bids, testVol);

      if (walkBuy.filledVolume < testVol || walkSell.filledVolume < testVol) {
        // Capped by order book liquidity depth
        break;
      }

      // Compute net spread
      const math = calculateNetSpread({
        buyPrice: walkBuy.avgPrice,
        sellPrice: walkSell.avgPrice,
        buyTakerFeeBps: buyMeta.takerFeeBps,
        sellTakerFeeBps: sellMeta.takerFeeBps,
        latencySafetyBps: this.config.latencySafetyBps,
        slippageSafetyBps: this.config.slippageSafetyBps,
        withdrawalFeeBTC: buyMeta.withdrawalFeeBTC, // Transfer simulated rebalance penalty
        btcPriceQuote: walkBuy.avgPrice,
      });

      const netProfitUSD = math.netSpread * testVol - math.withdrawalCostUSD;

      if (netProfitUSD > expectedProfitUSD && math.netSpread > 0) {
        optimalVolume = testVol;
        expectedProfitUSD = netProfitUSD;
        finalBuyPrice = walkBuy.avgPrice;
        finalSellPrice = walkSell.avgPrice;
        finalMathResult = math;
      } else {
        // Profits began decreasing or net spread turned negative, stop walking
        break;
      }
    }

    if (optimalVolume <= 0 || expectedProfitUSD < this.config.minNetProfitUSD) {
      return; // Skip candidates that fail minimal profit thresholds after fees
    }

    // Candidate opportunity isolated! Run risk clearances
    const oppId = `opp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const topAsk = buyBook.asks[0].price;
    const topBid = sellBook.bids[0].price;
    const grossSpread = topBid - topAsk;

    const approval = this.riskManager.approveTrade({
      buyExchange: buyExchangeId,
      sellExchange: sellExchangeId,
      volume: optimalVolume,
      buyPrice: finalBuyPrice,
      sellPrice: finalSellPrice,
      wallets: this.wallets,
      grossSpread,
    });

    const oppRecord: ArbitrageOpportunity = {
      id: oppId,
      timestamp: Date.now(),
      buyExchange: buyExchangeId,
      sellExchange: sellExchangeId,
      symbol,
      buyAsk: topAsk,
      sellBid: topBid,
      grossSpread,
      netSpread: finalMathResult.netSpread,
      executableVolume: optimalVolume,
      expectedNetProfitUSD: expectedProfitUSD,
      status: approval.approved ? 'EXECUTED' : 'SKIPPED',
      reason: approval.approved ? undefined : approval.reason,
    };

    await saveOpportunity(oppRecord);

    if (approval.approved) {
      // 1. Simulate execution on wallets
      this.executeSimulatedBalances(buyExchangeId, sellExchangeId, optimalVolume, finalBuyPrice, finalSellPrice, finalMathResult.feeCostUSD);

      // 2. Compute true trade logs
      // Slippage paid is the difference between execution walked prices and top-of-book prices
      const slippageBuy = (finalBuyPrice - topAsk) * optimalVolume;
      const slippageSell = (topBid - finalSellPrice) * optimalVolume;
      const slippagePaid = slippageBuy + slippageSell;

      const tradeRecord: SimulatedTrade = {
        id: `trade-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        opportunityId: oppId,
        timestamp: Date.now(),
        buyExchange: buyExchangeId,
        sellExchange: sellExchangeId,
        symbol,
        buyPrice: finalBuyPrice,
        sellPrice: finalSellPrice,
        volume: optimalVolume,
        grossProfit: grossSpread * optimalVolume,
        netProfit: expectedProfitUSD,
        feesPaid: finalMathResult.feeCostUSD * optimalVolume,
        slippagePaid,
      };

      await saveTrade(tradeRecord);

      // 3. Update PnL & RiskManager
      await this.pnlTracker.recordTradeProfit(expectedProfitUSD);
      this.riskManager.recordTradeResult(expectedProfitUSD);

      // 4. Log trade to logs with structured fields
      this.logger.info({
        eventType: 'TRADE_EXECUTION',
        buyExchange: buyExchangeId,
        sellExchange: sellExchangeId,
        symbol,
        volume: optimalVolume,
        buyPrice: finalBuyPrice,
        sellPrice: finalSellPrice,
        netProfitUSD: expectedProfitUSD,
      }, `💰 ARBITRAGE EXECUTED! Size: ${optimalVolume.toFixed(2)} BTC. Net Profit: +$${expectedProfitUSD.toFixed(2)} USD. Buy ${buyExchangeId} ($${finalBuyPrice.toFixed(2)}) -> Sell ${sellExchangeId} ($${finalSellPrice.toFixed(2)})`);
      
      const event: EngineEvent = {
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        type: 'TRADE_EXECUTION',
        message: `Arbitrage Executed: Bought ${optimalVolume.toFixed(4)} BTC on ${buyMeta.name} and sold on ${sellMeta.name} for +$${expectedProfitUSD.toFixed(2)} net profit.`,
      };
      await saveEvent(event);

      // Save updated balances
      await saveBalances(this.wallets);
    } else {
      // If skipped because of structural limitations (like wallets lacking balance), log info
      if (oppRecord.reason?.includes('Insufficient')) {
        this.logger.info({
          eventType: 'INFO',
          buyExchange: buyExchangeId,
          sellExchange: sellExchangeId,
          symbol,
          reason: oppRecord.reason,
        }, `Skipped opportunity: ${oppRecord.reason}`);
      }
    }

    // Broadcast updated state to all connected dashboard websockets
    this.wsBroadcaster?.();
  }

  private executeSimulatedBalances(
    buyExchange: string,
    sellExchange: string,
    volume: number,
    buyPrice: number,
    sellPrice: number,
    feeCostUSD: number
  ) {
    const costQuote = volume * buyPrice;
    const proceedQuote = volume * sellPrice;

    // Buy Exchange updates: deduct USDT, add BTC (minus taker fee)
    if (this.wallets[buyExchange]) {
      this.wallets[buyExchange].USDT.free -= costQuote;
      this.wallets[buyExchange].BTC.free += volume;
    }

    // Sell Exchange updates: deduct BTC, add USDT (minus taker fee)
    if (this.wallets[sellExchange]) {
      this.wallets[sellExchange].BTC.free -= volume;
      this.wallets[sellExchange].USDT.free += proceedQuote;
    }
  }
}
