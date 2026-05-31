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
  // Modeled time (ms) to route and fill both legs. During this window the market can move
  // against the detected edge; the engine prices that adverse selection at execution time.
  executionLatencyMs: number;
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
  detectionLatencyMs: number; // Rolling average wire-to-detection: venue event timestamp -> evaluation (network-bound)
  p99LatencyMs: number; // Worst-case (p99) wire-to-detection latency in the rolling window
  computeLatencyMs: number; // Rolling average pure in-process evaluation time (the algorithm itself; network-independent)
  computeP99Ms: number; // Worst-case (p99) in-process evaluation time
  evalsPerSecond: number; // Order-book snapshots evaluated per second
  booksProcessed: number; // Total order-book snapshots evaluated since boot
  opportunitiesDetected: number; // Total profitable windows isolated since boot
  lastActivityAt: number; // Epoch ms of the most recent order-book evaluation (engine liveness)
  watchdogRecoveries: number; // Count of self-heal actions (silent-feed reconnects) since boot
  executionAborts: number; // Windows aborted because adverse price movement during the fill window wiped the edge
}

/** One hop of a triangular cycle (e.g. BUY BTCUSDT, then BUY ETHBTC, then SELL ETHUSDT). */
export interface TriangularLeg {
  action: 'BUY' | 'SELL';
  pair: string; // 'BTCUSDT' | 'ETHBTC' | 'ETHUSDT'
  price: number; // Top-of-book price used for the hop
}

/**
 * Live single-venue triangular arbitrage state (USDT→BTC→ETH→USDT and its reverse). A
 * triangular cycle converts a quote currency through two crosses and back, profiting from
 * an internal mispricing between the three books — net of the three taker fees it pays.
 * Surfaced live (computed on each book tick) so the dashboard shows the cost-aware edge
 * even when it is below the ~12bps round-trip fee floor and therefore correctly skipped.
 */
export interface TriangularState {
  venue: string;
  available: boolean; // true when all three books are present
  direction: string; // human-readable cycle, e.g. 'USDT→BTC→ETH→USDT'
  legs: TriangularLeg[];
  grossEdgeBps: number; // cycle return before fees, in basis points
  feeBps: number; // total round-trip taker fee cost, in basis points
  netEdgeBps: number; // grossEdgeBps - feeBps (the executable edge)
  notionalUSD: number; // test notional used to size the cycle
  expectedProfitUSD: number; // notionalUSD * netEdge
  profitable: boolean; // netEdge clears the configured minimum
  executedCount: number; // triangular cycles executed since boot
  updatedAt: number;
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
  /** Live single-venue triangular arbitrage cycle (omitted when the venue feeds are absent). */
  triangular?: TriangularState;
}

export interface AuditLogEntry {
  id: string;
  created_at: string;
  session_id: string;
  operator_id: string;
  widget_source: string;
  scenario_key: string;
  prompt_version: string;
  prompt_language: string;
  user_query: string;
  model_identifier: string;
  model_latency_ms: number;
  confidence_percentage: number;
  explainability_payload: Record<string, any>;
  applied_parameters: Record<string, any> | null;
  operator_action: 'REVIEWED' | 'APPLIED_SUGGESTION' | 'REJECTED';
  final_system_decision: 'ACCEPTED' | 'REJECTED' | 'BYPASSED';
}
