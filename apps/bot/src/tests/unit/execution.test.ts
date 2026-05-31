import { applyExecutionSlippage, priceDispersionBps } from '@arbitrage/core';
import { describe, it, expect } from 'vitest';

describe('priceDispersionBps', () => {
  it('is zero for a flat or single-sample window', () => {
    expect(priceDispersionBps([100, 100, 100])).toBe(0);
    expect(priceDispersionBps([100])).toBe(0);
    expect(priceDispersionBps([])).toBe(0);
  });

  it('measures relative dispersion in basis points', () => {
    // mean 100, sample stdev sqrt(2) ≈ 1.4142 → 141.42 bps
    expect(priceDispersionBps([99, 101])).toBeCloseTo(141.42, 1);
  });
});

describe('applyExecutionSlippage', () => {
  it('drifts the fill against the taker, scaled by sqrt(time)', () => {
    // scale = sqrt(750/3000) = 0.5 → adverse = 100 * 0.5 = 50 bps
    const r = applyExecutionSlippage({
      buyPrice: 100,
      sellPrice: 100,
      dispersionBps: 100,
      executionLatencyMs: 750,
      referenceWindowMs: 3000,
    });
    expect(r.adverseBps).toBeCloseTo(50, 6);
    expect(r.realizedBuyPrice).toBeGreaterThan(100); // we buy higher
    expect(r.realizedSellPrice).toBeLessThan(100); // we sell lower
    // half of 50bps each side
    expect(r.realizedBuyPrice).toBeCloseTo(100 * (1 + 0.0025), 6);
    expect(r.realizedSellPrice).toBeCloseTo(100 * (1 - 0.0025), 6);
  });

  it('is a no-op with zero latency or zero volatility', () => {
    expect(applyExecutionSlippage({ buyPrice: 50, sellPrice: 51, dispersionBps: 200, executionLatencyMs: 0 }).adverseBps).toBe(0);
    expect(applyExecutionSlippage({ buyPrice: 50, sellPrice: 51, dispersionBps: 0, executionLatencyMs: 500 }).adverseBps).toBe(0);
  });
});
