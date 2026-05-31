-- Supabase / PostgreSQL Schema Migration Script
-- Creates core tables for persisting opportunities, trades, wallets, configs, and P&L snapshots.

-- 1. WALLET BALANCES
CREATE TABLE IF NOT EXISTS wallet_balances (
  exchange_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  free NUMERIC NOT NULL DEFAULT 0,
  locked NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (exchange_id, asset)
);

-- 2. ARBITRAGE OPPORTUNITIES
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  buy_exchange TEXT NOT NULL,
  sell_exchange TEXT NOT NULL,
  symbol TEXT NOT NULL,
  buy_ask NUMERIC NOT NULL,
  sell_bid NUMERIC NOT NULL,
  gross_spread NUMERIC NOT NULL,
  net_spread NUMERIC NOT NULL,
  executable_volume NUMERIC NOT NULL,
  expected_net_profit_usd NUMERIC NOT NULL,
  status TEXT NOT NULL, -- 'EXECUTED', 'SKIPPED'
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opp_timestamp ON arbitrage_opportunities(timestamp DESC);

-- 3. SIMULATED TRADES
CREATE TABLE IF NOT EXISTS simulated_trades (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES arbitrage_opportunities(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  buy_exchange TEXT NOT NULL,
  sell_exchange TEXT NOT NULL,
  symbol TEXT NOT NULL,
  buy_price NUMERIC NOT NULL,
  sell_price NUMERIC NOT NULL,
  volume NUMERIC NOT NULL,
  gross_profit NUMERIC NOT NULL,
  net_profit NUMERIC NOT NULL,
  fees_paid NUMERIC NOT NULL,
  slippage_paid NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON simulated_trades(timestamp DESC);

-- 4. ENGINE CONFIG
CREATE TABLE IF NOT EXISTS engine_config (
  id TEXT PRIMARY KEY DEFAULT 'current',
  config JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ENGINE EVENTS (AUDIT LOGS)
CREATE TABLE IF NOT EXISTS engine_events (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL, -- 'INFO', 'WARNING', 'ERROR', 'RISK_ALERT', 'TRADE_EXECUTION'
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON engine_events(timestamp DESC);

-- 6. P&L SNAPSHOTS
CREATE TABLE IF NOT EXISTS pnl_snapshots (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pnl_timestamp ON pnl_snapshots(timestamp DESC);
