export interface OrderBookLevel {
  price: number;
  amount: number;
}

export interface NormalizedOrderBook {
  exchangeId: string;
  symbol: string;
  bids: OrderBookLevel[]; // Sorted descending by price
  asks: OrderBookLevel[]; // Sorted ascending by price
  lastUpdateId: string;
  updatedAt: number; // Local receipt timestamp in milliseconds (when this process built the book)
  /**
   * Exchange-stamped event time in milliseconds, taken from the venue's own payload
   * (Binance `E`, OKX `ts`, Bybit `cts`, Kraken level timestamp, Coinbase `timestamp`).
   * Enables true wire-to-detection latency measurement rather than measuring against
   * our own receipt time. Optional: falls back to `updatedAt` when a venue omits it.
   */
  eventTimestamp?: number;
}

export interface WalletBalance {
  exchangeId: string;
  asset: string; // BTC, USDT, USD
  free: number;
  locked: number;
}

export type OpportunityStatus = 'EXECUTED' | 'SKIPPED';

export interface ArbitrageOpportunity {
  id: string;
  timestamp: number;
  buyExchange: string;
  sellExchange: string;
  symbol: string;
  buyAsk: number; // Top ask on cheap exchange
  sellBid: number; // Top bid on expensive exchange
  grossSpread: number; // sellBid - buyAsk
  netSpread: number; // Net profit per BTC after all costs
  executableVolume: number; // Max size that can be executed based on order book + wallet depth
  expectedNetProfitUSD: number; // Net profit in USD
  status: OpportunityStatus;
  reason?: string; // Skip reason (e.g. 'UNPROFITABLE', 'RISK_MAX_EXPOSURE', 'INSUFFICIENT_LIQUIDITY', etc.)
  /**
   * Statistical-arbitrage confidence: z-score of this window's net spread versus the
   * rolling history for the same directed pair. Higher = more anomalously wide (a
   * stronger mean-reversion signal). 0 when there is not yet enough history.
   */
  zScore?: number;
}

export interface SimulatedTrade {
  id: string;
  opportunityId: string;
  timestamp: number;
  buyExchange: string;
  sellExchange: string;
  symbol: string;
  buyPrice: number; // Weighted average fill price on Buy Exchange
  sellPrice: number; // Weighted average fill price on Sell Exchange
  volume: number; // Executed size
  grossProfit: number;
  netProfit: number;
  feesPaid: number; // Total taker fees paid across both sides
  slippagePaid: number; // Total slippage incurred compared to top-of-book prices
}

export interface EngineConfig {
  minNetProfitUSD: number;
  maxPositionBTCPerExchange: number;
  maxPositionQuotePerExchange: number;
  latencySafetyBps: number; // Latency penalty (e.g. 5 bps = 0.0005)
  slippageSafetyBps: number; // Buffer to pad expected fill prices
  usdtUsdBasisBps: number; // USD↔USDT conversion cost charged on cross-quote legs
  maxTradesPerMinute: number;
  enabledExchanges: string[];
  enabledPairs: string[];
  isPaused: boolean;
}

export interface RiskStatus {
  isCoolingDown: boolean;
  cooldownUntil: number;
  globalBtcExposure: number;
  globalQuoteExposure: number;
  consecutiveLosses: number;
  status: 'SAFE' | 'WARNING' | 'BREACHED' | 'COOLDOWN';
  reason?: string;
}

export interface EngineEvent {
  id: string;
  timestamp: number;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'RISK_ALERT' | 'TRADE_EXECUTION' | 'REBALANCE';
  message: string;
}

export interface EngineMetrics {
  detectionLatencyMs: number; // Rolling average: book-event timestamp -> opportunity evaluation completion
  p99LatencyMs: number; // Worst-case (p99) detection latency in the rolling window
  evalsPerSecond: number; // Order-book snapshots evaluated per second
  booksProcessed: number; // Total order-book snapshots evaluated since boot
  opportunitiesDetected: number; // Total profitable windows isolated since boot
}

export interface StatePayload {
  config: EngineConfig;
  connections: Record<string, { connected: boolean; reconnects: number; lastMessageAt: number }>;
  orderBooks: Record<string, { bids: OrderBookLevel[]; asks: OrderBookLevel[]; updatedAt: number }>;
  wallets: Record<string, Record<string, { free: number; locked: number }>>;
  opportunities: ArbitrageOpportunity[];
  trades: SimulatedTrade[];
  pnl: {
    totalProfitUSD: number;
    dailyProfitUSD: number;
    winRate: number;
    totalTrades: number;
    sharpeRatio: number;
    equityHistory: { timestamp: number; value: number }[];
  };
  risk: RiskStatus;
  metrics: EngineMetrics;
  events: EngineEvent[];
  uptime: number;
}
