export type {
  OrderBookLevel,
  NormalizedOrderBook,
  WalletBalance,
  OpportunityStatus,
  ArbitrageOpportunity,
  SimulatedTrade,
  EngineConfig,
  RiskStatus,
  EngineEvent,
  StatePayload,
} from '@arbitrage/core';

export interface EngineConfigUpdate {
  minNetProfitUSD?: number;
  maxPositionBTCPerExchange?: number;
  maxPositionQuotePerExchange?: number;
  latencySafetyBps?: number;
  slippageSafetyBps?: number;
  maxTradesPerMinute?: number;
  enabledExchanges?: string[];
  enabledPairs?: string[];
  isPaused?: boolean;
}

export interface HealthResponse {
  status: 'healthy' | string;
  timestamp: number;
  uptime: number;
  connections: {
    binance: boolean;
    kraken: boolean;
    coinbase: boolean;
    [exchange: string]: boolean;
  };
}

export interface OpportunitiesQuery {
  limit?: number;
}

export interface TradesQuery {
  limit?: number;
}

export interface BotStatus {
  isPaused: boolean;
  uptime: number;
  connections: Record<
    string,
    {
      connected: boolean;
      reconnects: number;
      lastMessageAt: number;
    }
  >;
}

export interface MetricsSnapshot {
  totalProfitUSD: number;
  dailyProfitUSD: number;
  winRate: number;
  totalTrades: number;
  sharpeRatio: number;
  equityHistory: { timestamp: number; value: number }[];
  risk: any; // Mapped dynamically to RiskStatus
}
