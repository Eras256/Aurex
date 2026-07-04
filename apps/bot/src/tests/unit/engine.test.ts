import { DEFAULT_ENGINE_CONFIG } from '@arbitrage/config';
import { walkOrderBook, calculateNetSpread } from '@arbitrage/core';
import { describe, it, expect, beforeEach } from 'vitest';

import { RiskManager } from '../../engine/RiskManager.js';


describe('📐 Arbitrage Pure Math Utilities', () => {
  it('should walk L2 order books correctly and calculate average fill price', () => {
    const asks = [
      { price: 60000, amount: 0.5 },
      { price: 60100, amount: 1.0 },
      { price: 60200, amount: 2.0 },
    ];

    // Case 1: Simple single-level fill
    const fill1 = walkOrderBook(asks, 0.4);
    expect(fill1.avgPrice).toBe(60000);
    expect(fill1.filledVolume).toBe(0.4);
    expect(fill1.levelsConsumed).toBe(1);

    // Case 2: Multi-level fill with weighted average price
    const fill2 = walkOrderBook(asks, 1.2);
    // (0.5 * 60000 + 0.7 * 60100) / 1.2 = 60058.33
    expect(fill2.avgPrice).toBeCloseTo(60058.33, 1);
    expect(fill2.filledVolume).toBe(1.2);
    expect(fill2.levelsConsumed).toBe(2);

    // Case 3: Fill exceeding order book liquidity (partial fill capping)
    const fill3 = walkOrderBook(asks, 5.0);
    expect(fill3.filledVolume).toBe(3.5);
    expect(fill3.levelsConsumed).toBe(3);
  });

  it('should calculate net spread after spot taker fees, latency safety buffers, and slippage buffers', () => {
    const result = calculateNetSpread({
      buyPrice: 60000,
      sellPrice: 60500,
      buyTakerFeeBps: 10,  // Binance: 0.1% = 60 USD
      sellTakerFeeBps: 26, // Kraken: 0.26% = 157.3 USD
      latencySafetyBps: 5,  // 5 BPS = 30.12 USD
      slippageSafetyBps: 2, // 2 BPS = 12.05 USD
      withdrawalFeeBTC: 0.0005, // 30 USD
      btcPriceQuote: 60000,
    });

    expect(result.grossSpread).toBe(500);
    expect(result.withdrawalCostUSD).toBe(30);

    // Buy cost = 60000 * 1.001 = 60060 USD
    // Sell proceeds = 60500 * (1 - 0.0026) = 60342.7 USD
    // Latency = 60250 * 0.0005 = 30.125 USD
    // Slippage = 60250 * 0.0002 = 12.05 USD
    // Net spread = 60342.7 - 60060 - 30.125 - 12.05 = 240.525 USD
    expect(result.netSpread).toBeCloseTo(240.525, 2);
  });
});

describe('🚨 RiskManager Circuit Breakers & Exposures', () => {
  let riskManager: RiskManager;
  let mockWallets: any;

  beforeEach(() => {
    riskManager = new RiskManager({
      ...DEFAULT_ENGINE_CONFIG,
      maxPositionBTCPerExchange: 2.0,
      minNetProfitUSD: 1.5,
    });

    mockWallets = {
      binance: {
        BTC: { free: 1.0, locked: 0 },
        USDT: { free: 50000, locked: 0 },
      },
      kraken: {
        BTC: { free: 1.5, locked: 0 },
        USDT: { free: 50000, locked: 0 },
      },
    };
  });

  it('should approve trade under safe and liquid conditions', () => {
    const res = riskManager.approveTrade({
      buyExchange: 'binance',
      sellExchange: 'kraken',
      volume: 0.5,
      buyPrice: 60000,
      sellPrice: 60500,
      wallets: mockWallets,
      grossSpread: 500,
    });

    expect(res.approved).toBe(true);
  });

  it('should deny trade if buy exchange lacks quote USDT liquidity', () => {
    const res = riskManager.approveTrade({
      buyExchange: 'binance',
      sellExchange: 'kraken',
      volume: 1.0,
      buyPrice: 60000, // Needs 60k USDT, has only 50k
      sellPrice: 60500,
      wallets: mockWallets,
      grossSpread: 500,
    });

    expect(res.approved).toBe(false);
    expect(res.reason).toContain('Insufficient USDT liquidity');
  });

  it('should deny trade if sell exchange lacks BTC reserves', () => {
    const res = riskManager.approveTrade({
      buyExchange: 'binance',
      sellExchange: 'kraken',
      volume: 2.0, // Needs 2.0 BTC, has only 1.5
      buyPrice: 20000,
      sellPrice: 20500,
      wallets: mockWallets,
      grossSpread: 500,
    });

    expect(res.approved).toBe(false);
    expect(res.reason).toContain('Insufficient BTC reserve');
  });

  it('should deny trade if walked size exceeds position caps per exchange', () => {
    // Increase wallets to bypass balance checks
    mockWallets.binance.BTC.free = 1.9; // Already holding 1.9 BTC
    mockWallets.binance.USDT.free = 200000;

    const res = riskManager.approveTrade({
      buyExchange: 'binance',
      sellExchange: 'kraken',
      volume: 0.2, // 1.9 + 0.2 = 2.1 BTC, exceeding the 2.0 cap
      buyPrice: 60000,
      sellPrice: 60500,
      wallets: mockWallets,
      grossSpread: 500,
    });

    expect(res.approved).toBe(false);
    expect(res.reason).toContain('exceeding the limit');
  });

  it('should trigger cooldown halt after 3 consecutive slippage losses', () => {
    // First loss
    riskManager.recordTradeResult(-5.0);
    expect(riskManager.getRiskStatus(mockWallets).status).toBe('WARNING');

    // Second loss
    riskManager.recordTradeResult(-2.0);
    expect(riskManager.getRiskStatus(mockWallets).status).toBe('WARNING');

    // Third loss triggers cooldown breaker
    riskManager.recordTradeResult(-1.5);
    expect(riskManager.getRiskStatus(mockWallets).status).toBe('COOLDOWN');
    expect(riskManager.getRiskStatus(mockWallets).isCoolingDown).toBe(true);

    // Verify trade request is now rejected automatically
    const res = riskManager.approveTrade({
      buyExchange: 'binance',
      sellExchange: 'kraken',
      volume: 0.1,
      buyPrice: 60000,
      sellPrice: 60500,
      wallets: mockWallets,
      grossSpread: 500,
    });
    expect(res.approved).toBe(false);
    expect(res.reason).toContain('risk cooldown');
  });
});

describe('⚙️ Configurable Circuit Breakers (runtime parametrization)', () => {
  // A ~2% gross spread vs mid: mid = 60600, grossSpread = 1200 → 1.98%.
  const spikeTrade = {
    buyExchange: 'binance',
    sellExchange: 'kraken',
    volume: 0.1,
    buyPrice: 60000,
    sellPrice: 61200,
    grossSpread: 1200,
  };
  const wallets = {
    binance: { BTC: { free: 1.0, locked: 0 }, USDT: { free: 50000, locked: 0 } },
    kraken: { BTC: { free: 1.5, locked: 0 }, USDT: { free: 50000, locked: 0 } },
  };

  it('does NOT trip the volatility breaker when the spread is below the configured %', () => {
    // Default 8% threshold: a ~2% spread is well within bounds and is approved.
    const rm = new RiskManager({ ...DEFAULT_ENGINE_CONFIG, maxPositionBTCPerExchange: 2.0 });
    const res = rm.approveTrade({ ...spikeTrade, wallets });
    expect(res.approved).toBe(true);
  });

  it('trips the volatility breaker at the configured % (tightened to 1%)', () => {
    const rm = new RiskManager({
      ...DEFAULT_ENGINE_CONFIG,
      maxPositionBTCPerExchange: 2.0,
      volatilityBreakerPct: 1.0, // tighten so the same ~2% spread is now a spike
    });
    const res = rm.approveTrade({ ...spikeTrade, wallets });
    expect(res.approved).toBe(false);
    expect(res.reason).toContain('exceeds 1%');
    expect(rm.getRiskStatus(wallets).status).toBe('COOLDOWN');
  });

  it('trips the consecutive-loss breaker at the configured limit (2 instead of 3)', () => {
    const rm = new RiskManager({ ...DEFAULT_ENGINE_CONFIG, consecutiveLossLimit: 2 });
    rm.recordTradeResult(-1.0);
    expect(rm.getRiskStatus(wallets).status).toBe('WARNING');
    rm.recordTradeResult(-1.0); // second loss now trips (limit = 2)
    expect(rm.getRiskStatus(wallets).status).toBe('COOLDOWN');
    expect(rm.getRiskStatus(wallets).isCoolingDown).toBe(true);
  });

  it('does not trip before the configured limit is reached', () => {
    const rm = new RiskManager({ ...DEFAULT_ENGINE_CONFIG, consecutiveLossLimit: 5 });
    for (let i = 0; i < 4; i++) rm.recordTradeResult(-1.0);
    expect(rm.getRiskStatus(wallets).status).toBe('WARNING'); // 4 < 5, still only a warning
  });

  it('resets the consecutive-loss counter after a winning trade', () => {
    const rm = new RiskManager({ ...DEFAULT_ENGINE_CONFIG, consecutiveLossLimit: 3 });
    rm.recordTradeResult(-1.0);
    rm.recordTradeResult(-1.0);
    rm.recordTradeResult(5.0); // a win clears the streak
    expect(rm.getRiskStatus(wallets).status).toBe('SAFE');
    expect(rm.getRiskStatus(wallets).consecutiveLosses).toBe(0);
  });
});
