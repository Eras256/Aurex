export interface ExchangeMetadata {
  id: string;
  name: string;
  takerFeeBps: number;
  makerFeeBps: number;
  withdrawalFeeBTC: number;
  hasWebSocket: boolean;
  /**
   * Whether this venue's order book is sourced from a live public exchange feed.
   * Every venue below streams real, unauthenticated production market data.
   */
  isLiveFeed: boolean;
  /**
   * The fiat/stablecoin the venue's flagship BTC book is denominated in. Binance, OKX
   * and Bybit stream BTC-USDT; Coinbase (BTC-USD) and Kraken (XBT/USD) stream BTC-USD.
   * Used to charge a realistic USDT↔USD conversion (basis) cost when an arbitrage leg
   * crosses quote currencies — without it, the well-known "Coinbase premium" would be
   * booked as free profit it is not.
   */
  quoteCurrency: 'USD' | 'USDT';
  supportedSymbols: string[];
}

/**
 * Taker fees below model competitive VIP / high-volume execution tiers — the tiers
 * a real cross-exchange arbitrage desk actually operates under (each venue publishes
 * these schedules publicly). They are intentionally conservative-but-realistic so the
 * simulator captures the genuinely thin windows that clear after costs, and they remain
 * fully configurable per-engine. All venues stream live public L2 data over WebSocket.
 */
export const EXCHANGES_METADATA: Record<string, ExchangeMetadata> = {
  binance: {
    id: 'binance',
    name: 'Binance Spot',
    takerFeeBps: 4, // 0.040% — VIP-tier spot taker
    makerFeeBps: 2,
    withdrawalFeeBTC: 0.00002,
    hasWebSocket: true,
    isLiveFeed: true,
    quoteCurrency: 'USDT',
    supportedSymbols: ['BTCUSDT'],
  },
  kraken: {
    id: 'kraken',
    name: 'Kraken Spot',
    takerFeeBps: 10, // 0.10% — Kraken Pro high-volume taker
    makerFeeBps: 6,
    withdrawalFeeBTC: 0.00002,
    hasWebSocket: true,
    isLiveFeed: true,
    quoteCurrency: 'USD', // Kraken flagship book is XBT/USD
    supportedSymbols: ['BTCUSDT', 'BTCUSD'],
  },
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase Advanced',
    takerFeeBps: 6, // 0.060% — Advanced Trade high-volume taker
    makerFeeBps: 4,
    withdrawalFeeBTC: 0.00001,
    hasWebSocket: true,
    isLiveFeed: true,
    quoteCurrency: 'USD', // Coinbase Advanced flagship book is BTC-USD
    supportedSymbols: ['BTCUSDT', 'BTCUSD'],
  },
  okx: {
    id: 'okx',
    name: 'OKX Spot',
    takerFeeBps: 5, // 0.050% — OKX VIP taker
    makerFeeBps: 2,
    withdrawalFeeBTC: 0.00002,
    hasWebSocket: true,
    isLiveFeed: true,
    quoteCurrency: 'USDT',
    supportedSymbols: ['BTCUSDT'],
  },
  bybit: {
    id: 'bybit',
    name: 'Bybit Spot',
    takerFeeBps: 5, // 0.050% — Bybit VIP spot taker
    makerFeeBps: 2,
    withdrawalFeeBTC: 0.00003,
    hasWebSocket: true,
    isLiveFeed: true,
    quoteCurrency: 'USDT',
    supportedSymbols: ['BTCUSDT'],
  },
};

// Seed inventory per venue. BTC must stay below maxPositionBTCPerExchange so the buy
// side has room to accumulate; USDT is generous so the simulation sustains a long run
// of real captures before draining (the Reset control rebalances back to these seeds).
const seedWallet = () => ({
  BTC: { free: 1.5, locked: 0 },
  USDT: { free: 200000, locked: 0 },
});

export const INITIAL_WALLET_BALANCES: Record<
  string,
  { BTC: { free: number; locked: number }; USDT: { free: number; locked: number } }
> = {
  binance: seedWallet(),
  kraken: seedWallet(),
  coinbase: seedWallet(),
  okx: seedWallet(),
  bybit: seedWallet(),
};
