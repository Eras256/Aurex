export interface ExchangeMetadata {
  id: string;
  name: string;
  takerFeeBps: number;
  makerFeeBps: number;
  withdrawalFeeBTC: number;
  hasWebSocket: boolean;
  supportedSymbols: string[];
}

export const EXCHANGES_METADATA: Record<string, ExchangeMetadata> = {
  binance: {
    id: 'binance',
    name: 'Binance Spot',
    takerFeeBps: 10, // 0.1% Spot Taker fee
    makerFeeBps: 10,
    withdrawalFeeBTC: 0.0005, // Network transfer cost simulation
    hasWebSocket: true,
    supportedSymbols: ['BTCUSDT'],
  },
  kraken: {
    id: 'kraken',
    name: 'Kraken Spot',
    takerFeeBps: 26, // 0.26% Spot Taker fee
    makerFeeBps: 16,
    withdrawalFeeBTC: 0.0004,
    hasWebSocket: true,
    supportedSymbols: ['BTCUSDT', 'BTCUSD'],
  },
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase Advanced',
    takerFeeBps: 60, // 0.6% taker fee
    makerFeeBps: 40,
    withdrawalFeeBTC: 0.0001,
    hasWebSocket: false,
    supportedSymbols: ['BTCUSD'],
  },
  okx: {
    id: 'okx',
    name: 'OKX Spot',
    takerFeeBps: 10,
    makerFeeBps: 8,
    withdrawalFeeBTC: 0.0002,
    hasWebSocket: false,
    supportedSymbols: ['BTCUSDT'],
  },
  bybit: {
    id: 'bybit',
    name: 'Bybit Spot',
    takerFeeBps: 10,
    makerFeeBps: 10,
    withdrawalFeeBTC: 0.0005,
    hasWebSocket: false,
    supportedSymbols: ['BTCUSDT'],
  },
  bitfinex: {
    id: 'bitfinex',
    name: 'Bitfinex Spot',
    takerFeeBps: 20,
    makerFeeBps: 10,
    withdrawalFeeBTC: 0.0004,
    hasWebSocket: false,
    supportedSymbols: ['BTCUST', 'BTCUSD'],
  },
  kucoin: {
    id: 'kucoin',
    name: 'KuCoin Spot',
    takerFeeBps: 10,
    makerFeeBps: 10,
    withdrawalFeeBTC: 0.0005,
    hasWebSocket: false,
    supportedSymbols: ['BTCUSDT'],
  },
};

export const INITIAL_WALLET_BALANCES = {
  binance: {
    BTC: { free: 1.5, locked: 0 },
    USDT: { free: 50000, locked: 0 },
  },
  kraken: {
    BTC: { free: 1.5, locked: 0 },
    USDT: { free: 50000, locked: 0 },
  },
};
