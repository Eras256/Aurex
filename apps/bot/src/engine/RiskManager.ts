import { RiskStatus, EngineConfig } from '@arbitrage/core';

import { createChildLogger } from '../core/logging/logger.js';

export class RiskManager {
  private config: EngineConfig;
  private consecutiveLosses = 0;
  private isCoolingDown = false;
  private cooldownUntil = 0;
  private globalBtcExposure = 0;
  private globalQuoteExposure = 0;
  
  // Track consecutive spreads to detect volatility anomalies
  private lastSpreads: number[] = [];

  // Custom structured child logger for RiskManager
  private logger = createChildLogger({ component: 'RiskManager' });

  constructor(config: EngineConfig) {
    this.config = config;
  }

  updateConfig(cfg: EngineConfig) {
    this.config = cfg;
  }

  getRiskStatus(wallets: Record<string, Record<string, { free: number; locked: number }>>): RiskStatus {
    // Calculate global exposures
    let totalBTC = 0;
    let totalUSDT = 0;

    for (const assets of Object.values(wallets)) {
      totalBTC += (assets.BTC?.free || 0) + (assets.BTC?.locked || 0);
      totalUSDT += (assets.USDT?.free || 0) + (assets.USDT?.locked || 0);
    }

    this.globalBtcExposure = totalBTC;
    this.globalQuoteExposure = totalUSDT;

    // Check if cooldown has expired
    if (this.isCoolingDown && Date.now() > this.cooldownUntil) {
      this.isCoolingDown = false;
      this.consecutiveLosses = 0;
      this.logger.info({ eventType: 'INFO' }, '🚨 RiskManager: Cooldown period expired. Circuit breakers reset to SAFE.');
    }

    let status: 'SAFE' | 'WARNING' | 'BREACHED' | 'COOLDOWN' = 'SAFE';
    let reason: string | undefined;

    if (this.isCoolingDown) {
      status = 'COOLDOWN';
      reason = `Trading paused due to consecutive slippage losses. Cooldown until ${new Date(this.cooldownUntil).toLocaleTimeString()}`;
    } else if (this.consecutiveLosses > 0) {
      status = 'WARNING';
      reason = `Warning: ${this.consecutiveLosses} consecutive trades incurred minor slippage losses.`;
    }

    return {
      isCoolingDown: this.isCoolingDown,
      cooldownUntil: this.cooldownUntil,
      globalBtcExposure: this.globalBtcExposure,
      globalQuoteExposure: this.globalQuoteExposure,
      consecutiveLosses: this.consecutiveLosses,
      status,
      reason,
    };
  }

  /**
   * Approves or denies a candidate trade based on exposure thresholds and circuit breakers.
   */
  approveTrade({
    buyExchange,
    sellExchange,
    volume,
    buyPrice,
    sellPrice,
    wallets,
    grossSpread,
  }: {
    buyExchange: string;
    sellExchange: string;
    volume: number;
    buyPrice: number;
    sellPrice: number;
    wallets: Record<string, Record<string, { free: number; locked: number }>>;
    grossSpread: number;
  }): { approved: boolean; reason?: string } {
    // 1. Check general pause state
    if (this.config.isPaused) {
      return { approved: false, reason: 'Engine is manually paused by settings' };
    }

    // 2. Check Cooldown state
    if (this.isCoolingDown) {
      if (Date.now() < this.cooldownUntil) {
        return { approved: false, reason: 'Trading engine locked in risk cooldown' };
      }
      this.isCoolingDown = false;
      this.consecutiveLosses = 0;
    }

    // 3. Volatility Spike Breaker
    // If the gross price difference is greater than 8% of the midprice, it represents a massive data lag or flash crash
    const midPrice = (buyPrice + sellPrice) / 2;
    const spreadPercentage = (grossSpread / midPrice) * 100;
    
    if (spreadPercentage > this.config.volatilityBreakerPct) {
      this.triggerCooldown(this.config.volatilityCooldownSeconds);
      this.logger.warn({
        eventType: 'RISK_ALERT',
        buyExchange,
        sellExchange,
        grossSpread,
        spreadPercentage,
      }, `🚨 Circuit Breaker: Spike detected! Spread percentage is ${spreadPercentage.toFixed(2)}%. Triggering risk halt.`);
      return { approved: false, reason: `Spike Breaker: Spread of ${spreadPercentage.toFixed(2)}% exceeds ${this.config.volatilityBreakerPct}% limit` };
    }

    // 4. Position & Exposure caps validation
    const buyQuoteBalance = wallets[buyExchange]?.USDT?.free || 0;
    const sellBtcBalance = wallets[sellExchange]?.BTC?.free || 0;

    // Check if buy exchange has enough USD/USDT to buy the asset
    const requiredQuote = volume * buyPrice;
    if (requiredQuote > buyQuoteBalance) {
      return { approved: false, reason: `Insufficient USDT liquidity on cheaper exchange ${buyExchange} (needs ${requiredQuote.toFixed(2)}, has ${buyQuoteBalance.toFixed(2)})` };
    }

    // Check if sell exchange has enough BTC to sell
    if (volume > sellBtcBalance) {
      return { approved: false, reason: `Insufficient BTC reserve on expensive exchange ${sellExchange} (needs ${volume.toFixed(4)}, has ${sellBtcBalance.toFixed(4)})` };
    }

    // Check position limits per exchange to prevent structural imbalance
    const buyBtcBalance = wallets[buyExchange]?.BTC?.free || 0;
    const postBuyBtc = buyBtcBalance + volume;
    if (postBuyBtc > this.config.maxPositionBTCPerExchange) {
      return { approved: false, reason: `Trade size pushes BTC holding on ${buyExchange} to ${postBuyBtc.toFixed(4)}, exceeding the limit of ${this.config.maxPositionBTCPerExchange}` };
    }

    return { approved: true };
  }

  /**
   * Tracks simulated trade outcome. If it results in a net loss, increments loss breaker.
   * If losses hit 3, triggers a 60 second cooling cooldown period.
   */
  recordTradeResult(netProfitUSD: number) {
    if (netProfitUSD < 0) {
      this.consecutiveLosses++;
      this.logger.warn({
        eventType: 'WARNING',
        netProfitUSD,
        consecutiveLosses: this.consecutiveLosses,
      }, `⚠️ RiskManager: Incurred simulated trade loss of ${netProfitUSD.toFixed(2)} USD. Consecutive losses: ${this.consecutiveLosses}`);
      
      if (this.consecutiveLosses >= this.config.consecutiveLossLimit) {
        this.triggerCooldown(this.config.lossCooldownSeconds);
      }
    } else {
      this.consecutiveLosses = 0; // reset
    }
  }

  private triggerCooldown(seconds: number) {
    this.isCoolingDown = true;
    this.cooldownUntil = Date.now() + seconds * 1000;
    this.logger.warn({
      eventType: 'RISK_ALERT',
      cooldownDurationSeconds: seconds,
    }, `🚨 RiskManager: Circuit breaker tripped. All simulations paused for ${seconds} seconds.`);
  }

  resetBreakers() {
    this.consecutiveLosses = 0;
    this.isCoolingDown = false;
    this.cooldownUntil = 0;
    this.logger.info({ eventType: 'INFO' }, '🔄 RiskManager: Circuit breakers manually reset.');
  }
}
