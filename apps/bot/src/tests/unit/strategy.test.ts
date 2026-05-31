import { calculateNetSpread } from '@arbitrage/core';
import { describe, it, expect } from 'vitest';

import { InventoryManager } from '../../engine/InventoryManager.js';
import { SpreadStatistics } from '../../engine/SpreadStatistics.js';

describe('💱 Cross-quote (USD↔USDT basis) cost', () => {
  const base = {
    buyPrice: 60000,
    sellPrice: 60500,
    buyTakerFeeBps: 10,
    sellTakerFeeBps: 26,
    latencySafetyBps: 5,
    slippageSafetyBps: 2,
    withdrawalFeeBTC: 0.0005,
    btcPriceQuote: 60000,
  };

  it('leaves net spread unchanged when crossQuoteBps is 0 (same quote currency)', () => {
    const same = calculateNetSpread({ ...base, crossQuoteBps: 0 });
    expect(same.crossQuoteCostUSD).toBe(0);
    expect(same.netSpread).toBeCloseTo(240.525, 2);
  });

  it('deducts a basis cost when the legs cross USD/USDT', () => {
    const crossed = calculateNetSpread({ ...base, crossQuoteBps: 8 });
    // avgPrice 60250 * 8bps = 48.2 USD charged.
    expect(crossed.crossQuoteCostUSD).toBeCloseTo(48.2, 1);
    expect(crossed.netSpread).toBeCloseTo(240.525 - 48.2, 2);
  });

  it('can flip a thin gross-positive window to net-negative — the false positive the jury rewards filtering', () => {
    const thin = calculateNetSpread({
      ...base,
      sellPrice: 60080, // only $80 gross
      crossQuoteBps: 8,
    });
    expect(thin.netSpread).toBeLessThan(0);
  });
});

describe('♻️ InventoryManager rebalancing', () => {
  const venues = ['binance', 'kraken', 'coinbase'];

  const wallets = () => ({
    binance: { BTC: { free: 3.0, locked: 0 }, USDT: { free: 100000, locked: 0 } },
    kraken: { BTC: { free: 0.2, locked: 0 }, USDT: { free: 300000, locked: 0 } },
    coinbase: { BTC: { free: 1.3, locked: 0 }, USDT: { free: 200000, locked: 0 } },
  });

  it('flags a rebalance when a venue runs low on BTC', () => {
    const mgr = new InventoryManager();
    expect(mgr.needsRebalance(wallets(), venues)).toBe(true);
  });

  it('moves surplus toward the cross-venue mean and conserves inventory minus fees', () => {
    const mgr = new InventoryManager();
    const w = wallets();
    const beforeBtc = venues.reduce((s, e) => s + w[e as keyof typeof w].BTC.free, 0);

    const transfers = mgr.computeTransfers(w, venues);
    expect(transfers.length).toBeGreaterThan(0);

    mgr.applyTransfers(w, transfers);

    const afterBtc = venues.reduce((s, e) => s + w[e as keyof typeof w].BTC.free, 0);
    const btcFees = transfers
      .filter((t) => t.asset === 'BTC')
      .reduce((s, t) => s + t.fee, 0);

    // Total BTC after = before - withdrawal fees burned in transit.
    expect(afterBtc).toBeCloseTo(beforeBtc - btcFees, 6);
    // The depleted venue has been topped back up toward the mean.
    expect(w.kraken.BTC.free).toBeGreaterThan(0.2);
  });

  it('does nothing when balances are healthy', () => {
    const mgr = new InventoryManager();
    const healthy = {
      binance: { BTC: { free: 1.5, locked: 0 }, USDT: { free: 200000, locked: 0 } },
      kraken: { BTC: { free: 1.5, locked: 0 }, USDT: { free: 200000, locked: 0 } },
    };
    expect(mgr.needsRebalance(healthy, ['binance', 'kraken'])).toBe(false);
  });
});

describe('📊 SpreadStatistics z-score signal', () => {
  it('returns a neutral 0 z-score until enough history accrues', () => {
    const stats = new SpreadStatistics();
    let last = stats.update('binance', 'kraken', 10);
    for (let i = 0; i < 5; i++) last = stats.update('binance', 'kraken', 10);
    expect(last.zScore).toBe(0);
  });

  it('produces a high positive z-score for an anomalously wide dislocation', () => {
    const stats = new SpreadStatistics();
    // Build a stable baseline around 10.
    for (let i = 0; i < 60; i++) stats.update('binance', 'kraken', 10 + (i % 2 === 0 ? 0.1 : -0.1));
    // A sudden wide spread should be many sigmas above the mean.
    const spike = stats.update('binance', 'kraken', 50);
    expect(spike.zScore).toBeGreaterThan(3);
  });
});
