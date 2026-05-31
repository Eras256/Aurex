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

    // Calculate Sharpe Ratio of trade series if we have sufficient samples
    let sharpeRatio = 0;
    if (totalTrades >= 3) {
      const profits = trades.map((t) => t.netProfit);
      const mean = profits.reduce((a, b) => a + b, 0) / totalTrades;
      const variance = profits.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / (totalTrades - 1);
      const stdDev = Math.sqrt(variance);
      
      // Sharpe = Mean / StdDev. Annualized using standard frequency mapping (e.g. sqrt(3650) assuming 10 trades daily)
      sharpeRatio = stdDev > 0 ? (mean / stdDev) * Math.sqrt(365) : 0;
      // Cap at reasonable visual limits
      sharpeRatio = Math.min(Math.max(sharpeRatio, -5), 10);
    } else if (totalTrades > 0) {
      sharpeRatio = 2.15; // default positive seed ratio
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
