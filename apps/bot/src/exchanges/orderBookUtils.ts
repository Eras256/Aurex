import { OrderBookLevel } from '@arbitrage/core';

/**
 * Price-keyed L2 order book accumulator shared by the snapshot/delta exchange
 * adapters (OKX, Bybit, Coinbase). Maintains bid/ask maps and emits the sorted
 * top-N levels. Centralising this keeps every venue's depth-merge logic identical
 * and correct.
 */
export class MapOrderBook {
  private bids = new Map<number, number>();
  private asks = new Map<number, number>();

  reset(): void {
    this.bids.clear();
    this.asks.clear();
  }

  /** Apply a single level. A size of 0 removes the price level. */
  applyBid(price: number, size: number): void {
    if (size <= 0) this.bids.delete(price);
    else this.bids.set(price, size);
  }

  applyAsk(price: number, size: number): void {
    if (size <= 0) this.asks.delete(price);
    else this.asks.set(price, size);
  }

  /** Replace the full book from snapshot arrays of [price, size] string/number tuples. */
  loadSnapshot(
    bids: [string | number, string | number][],
    asks: [string | number, string | number][]
  ): void {
    this.reset();
    for (const [p, s] of bids) this.applyBid(Number(p), Number(s));
    for (const [p, s] of asks) this.applyAsk(Number(p), Number(s));
  }

  /** Bids sorted descending by price, capped to `depth` levels. */
  topBids(depth = 10): OrderBookLevel[] {
    return [...this.bids.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, depth)
      .map(([price, amount]) => ({ price, amount }));
  }

  /** Asks sorted ascending by price, capped to `depth` levels. */
  topAsks(depth = 10): OrderBookLevel[] {
    return [...this.asks.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(0, depth)
      .map(([price, amount]) => ({ price, amount }));
  }

  hasDepth(): boolean {
    return this.bids.size > 0 && this.asks.size > 0;
  }
}
