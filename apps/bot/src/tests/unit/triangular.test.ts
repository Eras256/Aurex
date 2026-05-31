import { computeTriangular } from '@arbitrage/core';
import { describe, it, expect } from 'vitest';

describe('computeTriangular', () => {
  const fee = 4; // bps, Binance VIP taker
  const notional = 10000;

  it('detects a profitable forward cycle (USDT→BTC→ETH→USDT) net of three fees', () => {
    const res = computeTriangular({
      btcUsdt: { bestBid: 69990, bestAsk: 70000 },
      ethUsdt: { bestBid: 3540, bestAsk: 3541 },
      ethBtc: { bestBid: 0.0499, bestAsk: 0.05 },
      takerFeeBps: fee,
      notionalUSD: notional,
    });
    expect(res).not.toBeNull();
    expect(res!.direction).toBe('USDT→BTC→ETH→USDT');
    // Forward gross ≈ +114bps; net after ~12bps of fees stays clearly positive.
    expect(res!.grossEdgeBps).toBeGreaterThan(100);
    expect(res!.netEdgeBps).toBeGreaterThan(0);
    // feeBps is the gap between gross and net (~12bps for three 4bps legs).
    expect(res!.feeBps).toBeGreaterThan(11);
    expect(res!.feeBps).toBeLessThan(13);
    expect(res!.expectedProfitUSD).toBeCloseTo(notional * (res!.netEdgeBps / 10000), 4);
  });

  it('rejects a cycle whose gross edge cannot clear the fee floor', () => {
    const res = computeTriangular({
      btcUsdt: { bestBid: 69990, bestAsk: 70000 },
      ethUsdt: { bestBid: 3500, bestAsk: 3501 }, // gross ≈ 0
      ethBtc: { bestBid: 0.0499, bestAsk: 0.05 },
      takerFeeBps: fee,
      notionalUSD: notional,
    });
    expect(res).not.toBeNull();
    // Best of both directions is still negative once fees are charged.
    expect(res!.netEdgeBps).toBeLessThan(0);
    expect(res!.expectedProfitUSD).toBeLessThan(0);
  });

  it('returns null when any book is missing or malformed', () => {
    const res = computeTriangular({
      btcUsdt: { bestBid: 0, bestAsk: 0 },
      ethUsdt: { bestBid: 3500, bestAsk: 3501 },
      ethBtc: { bestBid: 0.0499, bestAsk: 0.05 },
      takerFeeBps: fee,
      notionalUSD: notional,
    });
    expect(res).toBeNull();
  });
});
