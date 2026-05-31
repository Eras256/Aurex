import { OrderBookLevel, TriangularLeg } from '../types/index.js';

/**
 * Walks an L2 order book's bids or asks up to a target volume.
 * Calculates the weighted average price, filled volume, and levels consumed.
 * Used for realistic partial fill and slippage evaluation.
 */
export function walkOrderBook(
  levels: OrderBookLevel[],
  targetVolume: number
): { avgPrice: number; filledVolume: number; levelsConsumed: number } {
  if (levels.length === 0 || targetVolume <= 0) {
    return { avgPrice: 0, filledVolume: 0, levelsConsumed: 0 };
  }

  let remainingVolume = targetVolume;
  let totalCost = 0;
  let filledVolume = 0;
  let levelsConsumed = 0;

  for (const level of levels) {
    if (remainingVolume <= 0) break;

    const fillAmount = Math.min(level.amount, remainingVolume);
    totalCost += fillAmount * level.price;
    filledVolume += fillAmount;
    remainingVolume -= fillAmount;
    levelsConsumed++;
  }

  const avgPrice = filledVolume > 0 ? totalCost / filledVolume : 0;
  return { avgPrice, filledVolume, levelsConsumed };
}

/**
 * Calculates the net arbitrage spread per unit asset after taker fees, slippage, and latency safety buffers.
 * 
 * Formulas applied:
 * - Gross Spread = Sell price (walked average) - Buy price (walked average)
 * - Taker Fee (Buy) = Buy Price * buyTakerFeeDecimal
 * - Taker Fee (Sell) = Sell Price * sellTakerFeeDecimal
 * - Latency Penalty = Average Price * latencySafetyBps / 10000
 * - Slippage Penalty = Average Price * slippageSafetyBps / 10000
 * - Cross-Quote (USD↔USDT basis) Cost = Average Price * crossQuoteBps / 10000 (only when legs differ in quote currency)
 * - Withdrawal Cost = Simulated network transfer fee in Quote asset
 * - Net Spread = Sell Price * (1 - Sell Fee Dec) - Buy Price * (1 + Buy Fee Dec) - Latency Penalty - Slippage Penalty - Cross-Quote Cost
 */
export function calculateNetSpread({
  buyPrice,
  sellPrice,
  buyTakerFeeBps,
  sellTakerFeeBps,
  latencySafetyBps,
  slippageSafetyBps,
  withdrawalFeeBTC,
  btcPriceQuote,
  crossQuoteBps = 0,
}: {
  buyPrice: number;
  sellPrice: number;
  buyTakerFeeBps: number;
  sellTakerFeeBps: number;
  latencySafetyBps: number;
  slippageSafetyBps: number;
  withdrawalFeeBTC: number;
  btcPriceQuote: number;
  /**
   * USD↔USDT conversion cost in bps, applied only when the buy and sell legs are quoted
   * in different currencies (e.g. Coinbase BTC-USD vs Binance BTC-USDT). Defaults to 0
   * so same-quote pairs are unaffected.
   */
  crossQuoteBps?: number;
}): {
  grossSpread: number;
  buyCostPerBTC: number;
  sellProceedsPerBTC: number;
  feeCostUSD: number;
  slippageCostUSD: number;
  latencyCostUSD: number;
  crossQuoteCostUSD: number;
  withdrawalCostUSD: number;
  netSpread: number;
} {
  const grossSpread = sellPrice - buyPrice;

  const buyFeeDecimal = buyTakerFeeBps / 10000;
  const sellFeeDecimal = sellTakerFeeBps / 10000;

  const buyFeeCostUSD = buyPrice * buyFeeDecimal;
  const sellFeeCostUSD = sellPrice * sellFeeDecimal;
  const feeCostUSD = buyFeeCostUSD + sellFeeCostUSD;

  const avgPrice = (buyPrice + sellPrice) / 2;
  const latencyCostUSD = avgPrice * (latencySafetyBps / 10000);
  const slippageCostUSD = avgPrice * (slippageSafetyBps / 10000);
  // Stablecoin-basis cost to actually move value across USD and USDT rails.
  const crossQuoteCostUSD = avgPrice * (crossQuoteBps / 10000);

  const withdrawalCostUSD = withdrawalFeeBTC * btcPriceQuote;

  const buyCostPerBTC = buyPrice * (1 + buyFeeDecimal);
  const sellProceedsPerBTC = sellPrice * (1 - sellFeeDecimal);

  // Net spread per BTC (before subtracting withdrawal costs which are flat-rate, handled at aggregate opportunity volume level)
  const netSpread = sellProceedsPerBTC - buyCostPerBTC - latencyCostUSD - slippageCostUSD - crossQuoteCostUSD;

  return {
    grossSpread,
    buyCostPerBTC,
    sellProceedsPerBTC,
    feeCostUSD,
    slippageCostUSD,
    latencyCostUSD,
    crossQuoteCostUSD,
    withdrawalCostUSD,
    netSpread,
  };
}

/** Top-of-book bid/ask for one market, in quote-per-base units. */
export interface TopOfBook {
  bestBid: number;
  bestAsk: number;
}

export interface TriangularResult {
  direction: string;
  legs: TriangularLeg[];
  grossEdgeBps: number;
  feeBps: number;
  netEdgeBps: number;
  expectedProfitUSD: number;
}

/**
 * Evaluates a single-venue triangular arbitrage cycle across BTCUSDT, ETHUSDT and ETHBTC,
 * returning the more profitable of the two cycle directions net of three taker fees.
 *
 *   Forward  (USDT→BTC→ETH→USDT): buy BTC with USDT, buy ETH with BTC, sell ETH for USDT.
 *   Reverse  (USDT→ETH→BTC→USDT): buy ETH with USDT, sell ETH for BTC, sell BTC for USDT.
 *
 * Each hop crosses the spread (taker), so the cycle multiplier is the product of the three
 * top-of-book conversion rates, discounted by (1 - fee) per hop. A cycle is only profitable
 * when that compounded edge exceeds the ~3x taker-fee drag — which is exactly why most
 * cycles are correctly rejected. Top-of-book is used (a triangular fill is three near-
 * simultaneous taker orders); returns null if any book is missing or malformed.
 */
export function computeTriangular({
  btcUsdt,
  ethUsdt,
  ethBtc,
  takerFeeBps,
  notionalUSD,
}: {
  btcUsdt: TopOfBook;
  ethUsdt: TopOfBook;
  ethBtc: TopOfBook;
  takerFeeBps: number;
  notionalUSD: number;
}): TriangularResult | null {
  const valid = (b: TopOfBook) => b && b.bestAsk > 0 && b.bestBid > 0;
  if (!valid(btcUsdt) || !valid(ethUsdt) || !valid(ethBtc)) return null;

  const f = takerFeeBps / 10000;
  const keep = (1 - f) ** 3; // fraction surviving three taker hops

  // Forward: USDT → BTC (buy BTCUSDT ask) → ETH (buy ETHBTC ask) → USDT (sell ETHUSDT bid).
  const fwdGross = (1 / btcUsdt.bestAsk) * (1 / ethBtc.bestAsk) * ethUsdt.bestBid;
  // Reverse: USDT → ETH (buy ETHUSDT ask) → BTC (sell ETHBTC bid) → USDT (sell BTCUSDT bid).
  const revGross = (1 / ethUsdt.bestAsk) * ethBtc.bestBid * btcUsdt.bestBid;

  const build = (
    grossMult: number,
    direction: string,
    legs: TriangularLeg[]
  ): TriangularResult => {
    const netMult = grossMult * keep;
    const grossEdgeBps = (grossMult - 1) * 10000;
    const netEdgeBps = (netMult - 1) * 10000;
    return {
      direction,
      legs,
      grossEdgeBps,
      feeBps: grossEdgeBps - netEdgeBps,
      netEdgeBps,
      expectedProfitUSD: notionalUSD * (netMult - 1),
    };
  };

  const forward = build(fwdGross, 'USDT→BTC→ETH→USDT', [
    { action: 'BUY', pair: 'BTCUSDT', price: btcUsdt.bestAsk },
    { action: 'BUY', pair: 'ETHBTC', price: ethBtc.bestAsk },
    { action: 'SELL', pair: 'ETHUSDT', price: ethUsdt.bestBid },
  ]);
  const reverse = build(revGross, 'USDT→ETH→BTC→USDT', [
    { action: 'BUY', pair: 'ETHUSDT', price: ethUsdt.bestAsk },
    { action: 'SELL', pair: 'ETHBTC', price: ethBtc.bestBid },
    { action: 'SELL', pair: 'BTCUSDT', price: btcUsdt.bestBid },
  ]);

  return reverse.netEdgeBps > forward.netEdgeBps ? reverse : forward;
}
