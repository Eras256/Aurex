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
  updatedAt: number; // Timestamp in milliseconds
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
  type: 'INFO' | 'WARNING' | 'ERROR' | 'RISK_ALERT' | 'TRADE_EXECUTION';
  message: string;
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
  events: EngineEvent[];
  uptime: number;
}
