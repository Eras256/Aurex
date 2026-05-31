import { SimulatedTrade } from '@arbitrage/core';

import { savePnlSnapshot, getPnlSnapshots } from '../persistence/repositories.js';

export class PnLTracker {
  private initialEquity = 100000; // Mock USD funding base
  private currentEquity = 100000;

  async initialize() {
    const history = await getPnlSnapshots();
    if (history.length > 0) {
      this.currentEquity = history[history.length - 1].value;
    }
  }

  getCurrentEquity(): number {
    return this.currentEquity;
  }

  async recordTradeProfit(netProfitUSD: number): Promise<void> {
    this.currentEquity += netProfitUSD;
    await savePnlSnapshot(this.currentEquity);
  }

  async reset(): Promise<void> {
    this.currentEquity = this.initialEquity;
    await savePnlSnapshot(this.currentEquity);
  }

  calculateMetrics(trades: SimulatedTrade[]): {
    totalProfitUSD: number;
    dailyProfitUSD: number;
    winRate: number;
    totalTrades: number;
    sharpeRatio: number;
  } {
    const totalTrades = trades.length;
    const winningTrades = trades.filter((t) => t.netProfit > 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const totalProfitUSD = this.currentEquity - this.initialEquity;

    // Sharpe ratio of the trade series. A ratio is only statistically meaningful with a
    // real sample, so we withhold it (return 0) until at least MIN_SHARPE_TRADES have
    // executed — rather than seeding a flattering placeholder. The frontend renders 0 as
    // "building (n/MIN)" so the number is never overstated on a thin history.
    const MIN_SHARPE_TRADES = 20;
    let sharpeRatio = 0;
    if (totalTrades >= MIN_SHARPE_TRADES) {
      const profits = trades.map((t) => t.netProfit);
      const mean = profits.reduce((a, b) => a + b, 0) / totalTrades;
      const variance = profits.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / (totalTrades - 1);
      const stdDev = Math.sqrt(variance);

      // Sharpe = Mean / StdDev, annualised assuming ~10 trades/day (sqrt(365) frequency map).
      sharpeRatio = stdDev > 0 ? (mean / stdDev) * Math.sqrt(365) : 0;
      // Clamp to a sane display window so a near-zero variance can't print an absurd value.
      sharpeRatio = Math.min(Math.max(sharpeRatio, -5), 10);
    }

    return {
      totalProfitUSD,
      dailyProfitUSD: totalProfitUSD, // Spot daily is cumulative in this simulation
      winRate,
      totalTrades,
      sharpeRatio,
    };
  }
}
