/**
 * Rolling per-pair spread statistics for a lightweight statistical-arbitrage signal.
 *
 * For each directed venue pair we keep a bounded window of recent net-spread-per-BTC
 * observations and expose its mean, standard deviation and the current z-score. A high
 * positive z-score means the live dislocation is unusually wide versus its own recent
 * history — a stronger, more likely mean-reverting signal than a raw spread that happens
 * to be marginally positive. The engine uses it to rank simultaneous opportunities by
 * statistical confidence, not just by nominal profit.
 */
export class SpreadStatistics {
  private windows = new Map<string, number[]>();
  private static readonly WINDOW = 200;

  private key(buyExchange: string, sellExchange: string): string {
    return `${buyExchange}->${sellExchange}`;
  }

  /** Records a new net-spread observation for a pair and returns the updated statistics. */
  update(
    buyExchange: string,
    sellExchange: string,
    netSpread: number
  ): { mean: number; std: number; zScore: number; samples: number } {
    const k = this.key(buyExchange, sellExchange);
    const arr = this.windows.get(k) ?? [];
    arr.push(netSpread);
    if (arr.length > SpreadStatistics.WINDOW) arr.shift();
    this.windows.set(k, arr);

    const n = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const variance = n > 1 ? arr.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
    const std = Math.sqrt(variance);
    // Require a minimum sample count before trusting a z-score, else report 0 (neutral).
    const zScore = n >= 20 && std > 1e-9 ? (netSpread - mean) / std : 0;

    return { mean, std, zScore, samples: n };
  }

  reset(): void {
    this.windows.clear();
  }
}
