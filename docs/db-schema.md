# 🗄️ Supabase Postgres Schema & Deployment Guide

This document describes the database schema and deployment instructions for configuring **Aurex** to use a production-grade remote **Supabase PostgreSQL** instance.

By default, the application runs in zero-dependency **Local Mode** backing up states to `db.json`. Activating the Supabase Postgres database driver enables cloud logging of all simulation balances, events, opportunities, and executed trades.

---

## 🛠️ Step-by-Step Supabase Setup

### 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com) and sign in.
2. Click **New Project** and select your organization.
3. Configure your project name (e.g. `Arbitrage Core Simulator`), choose a strong database password, and select your preferred geographical region.
4. Wait a few minutes for the database provisioning to complete.

### 2. Configure Environment Variables

Copy your API credentials from your Supabase Dashboard (**Settings -> API**):

1. Locate your **Project URL** (`https://your-project.supabase.co`).
2. Locate your **anon public** API key or **service_role** secret API key.
3. Add these parameters to your backend [apps/bot/.env](file:///c:/DaAps/IACHallenge/apps/bot/.env) configuration file:

   ```env
   # Enable Supabase PostgreSQL Persistence
   PERSISTENCE_DRIVER=supabase

   # Credentials
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

> [!IMPORTANT]
> The database driver will only initialize if `PERSISTENCE_DRIVER` is explicitly set to `supabase`. If set to `local` (or if variables are omitted), it falls back seamlessly to the offline `db.json` database.

---

## 💻 SQL DDL Schema Definition

Execute the following SQL DDL script inside the **SQL Editor** of your Supabase Dashboard to instantiate the required schema, tables, foreign keys, and performant indexes:

```sql
-- ==============================================================================
-- AUREX SIMULATOR - MASTER SCHEMA
-- ==============================================================================

-- 1. Arbitrage Opportunities Table
-- Persists candidate arbitrage windows evaluated by the core engine
CREATE TABLE IF NOT EXISTS public.arbitrage_opportunities (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    buy_exchange TEXT NOT NULL,
    sell_exchange TEXT NOT NULL,
    symbol TEXT NOT NULL,
    buy_ask NUMERIC(20, 8) NOT NULL,
    sell_bid NUMERIC(20, 8) NOT NULL,
    gross_spread NUMERIC(20, 8) NOT NULL,
    net_spread NUMERIC(20, 8) NOT NULL,
    executable_volume NUMERIC(20, 8) NOT NULL,
    expected_net_profit_usd NUMERIC(20, 8) NOT NULL,
    status TEXT NOT NULL,
    reason TEXT
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_opp_timestamp ON public.arbitrage_opportunities (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_opp_direction ON public.arbitrage_opportunities (buy_exchange, sell_exchange);

-- 2. Simulated Trades Table
-- Persists simulated captures and slippage details for executed opportunities
CREATE TABLE IF NOT EXISTS public.simulated_trades (
    id TEXT PRIMARY KEY,
    opportunity_id TEXT REFERENCES public.arbitrage_opportunities(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    buy_exchange TEXT NOT NULL,
    sell_exchange TEXT NOT NULL,
    symbol TEXT NOT NULL,
    buy_price NUMERIC(20, 8) NOT NULL,
    sell_price NUMERIC(20, 8) NOT NULL,
    volume NUMERIC(20, 8) NOT NULL,
    gross_profit NUMERIC(20, 8) NOT NULL,
    net_profit NUMERIC(20, 8) NOT NULL,
    fees_paid NUMERIC(20, 8) NOT NULL,
    slippage_paid NUMERIC(20, 8) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON public.simulated_trades (timestamp DESC);

-- 3. Engine Events Table
-- Persists system logs, warnings, and circuit breaker activations
CREATE TABLE IF NOT EXISTS public.engine_events (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON public.engine_events (timestamp DESC);

-- 4. Wallet Balances Table
-- Tracks simulated funds across exchanges in real-time
CREATE TABLE IF NOT EXISTS public.wallet_balances (
    exchange_id TEXT NOT NULL,
    asset TEXT NOT NULL,
    free NUMERIC(20, 8) NOT NULL,
    locked NUMERIC(20, 8) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (exchange_id, asset)
);

-- 5. Engine Configurations Table
-- Persists real-time circuit breaker configurations and spread margins
CREATE TABLE IF NOT EXISTS public.engine_config (
    id TEXT PRIMARY KEY,
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- 6. P&L Snapshots Table
-- Tracks historical growth data points to render portfolio graphs
CREATE TABLE IF NOT EXISTS public.pnl_snapshots (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    value NUMERIC(20, 8) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pnl_timestamp ON public.pnl_snapshots (timestamp DESC);
```

---

## 🛡️ Safety & Privacy Disclaimers

1.  **Simulation Only:** All tables are structured strictly for **simulated, off-chain ledger accounts** and mock balances. No real trading balances are deposited or updated.
2.  **No Private Keys:** The database does **NOT** capture, require, or store private wallet keys, mnemonic phrases, or exchange API secret credentials. It communicates exclusively using public endpoints.
3.  **No PII (Personally Identifiable Information):** The schema records only numeric mathematical spread models, timestamps, exchange IDs, and system events. No user profiles or personal information are tracked.
