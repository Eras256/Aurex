# ₿ Aurex

### Institutional-Grade Bitcoin Cross-Exchange Arbitrage Simulator

Aurex is an institutional-grade platform designed to detect live cross-exchange Bitcoin spreads, model realistic execution costs, and simulate risk-hedged arbitrage trades in real-time across five major centralized venues (Binance, Kraken, Coinbase Advanced, OKX, and Bybit).

---

## 1. What it does

Aurex aggregates public real-time Level 2 (L2) order books directly from live exchange WebSockets, processes them through a mathematical volume-sizing core, simulates trades against off-chain mock capital reserves, and visualizes live arbitrage flow, trades, risk breaker alerts, and telemetry on a glassmorphic fintech web console.

## 2. Why it matters

Unlike naive simulators that calculate arbitrary spreads using top-of-book levels (L1: best bid/ask) only to suffer massive slippage when deploying size, Aurex mirrors true HFT execution mechanics:

- **Real Depth Walks:** Walks L2 books to calculate dynamic volume-weighted execution prices.
- **Realistic Cost Deduction:** Deducts VIP-tier spot taker fees, withdrawal transfer estimates, and slippage.
- **Expected Margin Checks:** Rejects gross-positive spreads that degrade into net-negative returns, logging skips transparently.
- **Latency Drift Hedges:** Penalizes prices with configurable latency basis point buffers to replicate WebSocket transit drift.

## 3. Key features

- **5 Concurrent WS Adapters:** Unified streams for Binance, Kraken, Coinbase, OKX, and Bybit.
- **L2 Sizing Math Core:** Iterative optimization finding the exact size (e.g., 0.05 BTC and up) that maximizes net yield.
- **Risk Control Panel:** Calibrate thresholds and trigger circuit breakers (Consecutive Loss, Volatility, Exposure caps).
- **Dual Persistence Layer:** Seamless failover between zero-config local engine (`db.json`) and cloud Supabase Postgres tables.
- **Telemetry Dashboards:** Real-time mean and p99 detection latency stats and order book throughput logs.

## 4. Architecture

The platform runs a high-performance backend bot that handles WebSocket streams and execution math, communicating with a Next.js terminal client via low-latency server-sent WebSocket payloads.

```
[5x Live CEX WebSockets] ➔ [L2 Order Cache] ➔ [Depth-Walk Engine] ➔ [Risk Breaker Check] ➔ [Simulated Wallet Execution] ➔ [WS Push] ➔ [Glassmorphic Client Web Console]
```

## 5. How it works

1. **Stream:** WebSocket adapters maintain active L2 book caches by merging initial snapshots with real-time delta frames.
2. **Scan:** The core evaluates all directed venue pairs (e.g., Coinbase ➔ Binance) concurrently.
3. **Walk:** For each pair, the calculator walks asks on the cheaper venue and bids on the more expensive venue.
4. **Hedge:** Applies taker fees, slippage, and latency penalties to find the volume-weighted average price.
5. **Size:** Expands position size incrementally until marginal net profit deteriorates.
6. **Commit:** Checks circuit breakers, updates simulated wallet allocations, and logs the execution ledger.

## 6. Tech stack

- **Monorepo:** `pnpm` workspaces with isolated project scopes.
- **Backend Core:** Node.js, Express, Pino (Structured Logging), Zod, Vitest.
- **Frontend Web:** Next.js 14, Tailwind CSS, Lucide, HTML5 canvas.
- **Data & Storage:** SQLite/Supabase Postgres + fast Local JSON fallback driver.

## 7. Project structure

```
.
├── packages/
│   ├── core/         # Shared domain typings & L2 depth-walk math calculators
│   ├── config/       # Strict environment schemas and static CEX fee parameters
│   └── testing/      # Synthetic book fixtures and mock market data templates
└── apps/
    ├── bot/          # Express REST API, 5 CEX WS streams, and execution simulator
    └── web/          # Next.js 14 real-time interactive terminal console dashboard
```

## 8. Run locally

### Prerequisites

- Node.js (v18+)
- pnpm (v9+)

### Installation & Launch

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment files
cp apps/bot/.env.example apps/bot/.env
cp apps/web/.env.local.example apps/web/.env.local

# 3. Launch both bot backend and web console in parallel
pnpm dev
```

- **Dashboard UI:** Accessible at `http://localhost:3000`
- **Bot API Backend:** Accessible at `http://localhost:3001`

## 9. Environment variables

### Bot Backend (`apps/bot/.env`)

- `PORT`: Server port (default `3001`).
- `PERSISTENCE_DRIVER`: Storage switch (`local` for `db.json` file storage / `supabase`).
- `API_KEY`: Authorization secret for setting updates and database resets.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: Supabase Postgres cloud integrations.

### Web Console (`apps/web/.env.local`)

- `NEXT_PUBLIC_BACKEND_URL`: Absolute URL of the bot backend (e.g., `http://localhost:3001`).

## 10. Deployment

- **Backend API:** Pre-configured for Fly.io/Docker hosting, serving REST and WebSocket connections via a unified port.
- **Frontend UI:** Designed for optimized static page generation on Vercel.

## 11. Demo notes

- **Coinbase Premium:** Select Coinbase Advanced (BTC-USD) ➔ Binance routes to observe real-time US dollar base spreads.
- **Circuit Breakers:** Tighten risk parameters (e.g., set latency buffer high) in the settings panel to test dynamic cooldown breakers, engine freezes, and synthetic consecutive loss limits.
- **CSV Exports:** Instantly export executed simulated trade sheets from the ledger controls.

## 12. License

MIT License. For evaluation and educational simulation purposes only.
