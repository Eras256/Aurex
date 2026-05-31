import { OrderBookLevel } from '../types/index.js';

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
