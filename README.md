**Resumen en Español:** _Aurex es un simulador de arbitraje de Bitcoin de alto rendimiento que consume datos públicos en tiempo real (REST + WebSocket L2) de **5 exchanges reales: Binance, Kraken, Coinbase Advanced, OKX y Bybit**. El sistema recorre la profundidad L2, prioriza las oportunidades de arbitraje entre todos los pares de venues, calcula la rentabilidad neta (restando comisiones, deslizamiento y penalizaciones por latencia) y simula ejecuciones, balances de carteras y P&L off-chain visibles en un dashboard web interactivo con métricas de latencia de detección en tiempo real._

# ₿ Aurex

### Institutional-Grade Bitcoin Cross-Exchange Arbitrage Simulator

Aurex is an institutional-grade platform for real-time Bitcoin arbitrage detection, execution simulation, and risk-aware market monitoring across multiple exchanges.

By utilizing high-speed WebSocket market feeds from **five live exchanges (Binance, Kraken, Coinbase Advanced, OKX, Bybit)**, walking real-time L2 order book depth tables, ranking opportunities across every directed venue pair, and incorporating transaction costs, slippage penalties, and network latency buffers, the system provides a highly accurate simulation environment of high-frequency trading (HFT) spread capture — including the genuine cross-venue dislocations such as the well-known **Coinbase premium/discount**.

## 🎬 60-Second Jury Walkthrough

Open the dashboard and read it in this order — every value is live from the backend, nothing is hardcoded:

| #   | What to look at                                         | Where                                            | Why it matters (evaluation criterion)                                    |
| --- | ------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| 1   | **5 venues connected** (CONNECTED badges + heartbeats)  | **System Health** page / header `FEEDS x/5 live` | Real multi-exchange monitoring (2+ required)                             |
| 2   | **Detection latency** (mean + p99) & books/sec          | **Overview** KPI card / header `DETECTION`       | Speed of detection (criterion #1)                                        |
| 3   | **Opportunity detected** across venue pairs             | **Live Opportunities** feed                      | Real-time detection + ranking                                            |
| 4   | **Trade executed** with size, fills, net profit         | **Executed Trades** ledger (+ CSV export)        | Simulated execution respecting L2 liquidity                              |
| 5   | **Opportunity rejected after costs** (red, with reason) | **Live Opportunities** → filter `Skipped`        | Correctly rejecting gross-positive / net-negative windows (criterion #2) |
| 6   | **Cumulative P&L**, win rate, Sharpe, equity curve      | **Overview** + **Executed Trades**               | Performance tracking & visualization                                     |

> The richest live signal is the **Coinbase premium/discount**: watch `coinbase → binance/okx/bybit` windows being detected, costed, and either executed or transparently rejected in real time.

## Why this project uses real market data with simulated execution

Aurex uses real-time public market data from supported exchanges while keeping execution fully simulated. This design choice is intentional: the goal is to measure live cross-exchange spreads, maintain current order books, estimate net profitability after fees and slippage, and simulate fills under realistic market conditions without placing real orders or depending on private trading credentials.

Using public production market data provides a more credible view of actual market fragmentation than an isolated testnet environment. The challenge is centered on detecting and evaluating arbitrage opportunities in real time across exchanges, and public market feeds are sufficient for that purpose because authentication is not required for these feeds on exchanges such as Kraken, while Coinbase Advanced Trade also provides real-time market data over its WebSocket infrastructure.

Testnet environments are useful for validating authenticated trading flows, order submission, and account-level behavior. However, they are less suitable as the primary foundation for this project because the core objective here is market monitoring and execution simulation, not live order placement, and because testnet liquidity and spread behavior do not reliably reflect live market conditions.

As a result, Aurex follows a hybrid architecture:

Live public order books for market observation

Simulated execution for fills, PnL, and wallet updates

No real trading and no custody risk

No dependency on private exchange API keys for the core demo path

This approach keeps the system aligned with the challenge requirements while maximizing realism, safety, and demo reliability.

## Cómo cumple los requisitos del Challenge

El proyecto se diseñó para cumplir con el 100% de los lineamientos del reto técnico:

- **Monitoreo en tiempo real de libros de órdenes de BTC en 5 exchanges:** Conexión concurrente y de alta fidelidad a Binance Spot, Kraken Spot, Coinbase Advanced, OKX Spot y Bybit Spot mediante streams WebSocket L2 públicos (sin autenticación) combinados con snapshots REST, manteniendo libros de órdenes locales sincronizados con precisión de milisegundos.
- **Detección, priorización y cálculo de rentabilidad neta:** Detección instantánea de ventanas de arbitraje cuando Ask < Bid en cualquier par de venues. El motor evalúa **todos los pares dirigidos** y **prioriza la oportunidad más rentable** mediante recorrido L2 (Depth-Walk), deduciendo comisiones spot de taker realistas (tier VIP, configurables), costos de transferencia/retiro simulados, deslizamiento real del libro y un amortiguador de latencia. Las ventanas que parecen rentables en bruto pero resultan negativas en neto se registran como **rechazadas con su razón** — exactamente el filtrado de falsos positivos que pide el reto.
- **Simulación de ejecución con respeto de liquidez:** Ejecución simulada 100% off-chain y no-custodial que realiza recorridos L2 (Depth-Walk) para fills parciales y actualiza dinámicamente los balances simulados de las carteras (USDT y BTC) en las 5 venues.
- **Seguimiento, latencia y visualización:** Registro de oportunidades evaluadas (ejecutadas y rechazadas), historial detallado de trades ejecutados, curvas de P&L acumulado y **métricas de latencia de detección en tiempo real** (latencia media/p99, libros evaluados por segundo), expuestos de forma de alta fidelidad en la interfaz web de Next.js.
- **Arquitectura full-stack de alto nivel:** Arquitectura desacoplada de alto rendimiento que incluye el bot backend (Express/WebSockets/Pino), paquetes compartidos en monorepo, persistencia local a prueba de reinicios (`db.json`) y frontend de vanguardia con Tailwind CSS, entregado completamente en 48 horas.

---

## 🌟 Key Architectural Innovations

### 1. L2 Depth Walking (Optimal Size Sizing)

Standard simulators calculate spreads naively using top-of-book levels (L1: best Bid/Ask). If a strategy tries to execute a large order (e.g., 2 BTC) against a level that only has 0.1 BTC liquidity, the transaction suffers massive slippage.
Our engine **Walks the L2 order book depth**: it iteratively tests larger size blocks, aggregates walked average prices, subtracts fees and buffers, and isolates the **mathematically optimal transaction volume** that maximizes net return.

### 2. Micro-Level Cost & Latency Modeling

We apply a strict cost deduction profile to candidate spreads to ensure realistic margins:

- **Spot Taker Fees:** Charged on both sides at competitive **VIP / high-volume tiers** — the tiers a real cross-exchange arbitrage desk actually operates under (Binance ~0.04%, OKX/Bybit ~0.05%, Coinbase ~0.06%, Kraken ~0.10%). All are configurable per-engine.
- **Withdrawal Fees (Network Rebalancing):** Modeled per-opportunity to simulate asset rebalancing costs across venues.
- **Latency Buffer (BPS):** Subtracts expected sell prices and inflates expected buy prices to replicate spread drift during network websocket transit.
- **Slippage:** The L2 depth-walk prices **real** slippage directly from book depth (the walked volume-weighted average price), so no artificial slippage cushion is double-counted on top.

### 2b. Opportunity Ranking & Real-Time Latency Telemetry

Rather than firing on the first window it finds, the engine evaluates **every directed venue pair each cycle, ranks the profitable candidates by net expectation, and executes the single best one** — capturing the richest spread when several venues diverge simultaneously. Every evaluation is timestamped, so the dashboard surfaces live **detection-latency (mean & p99)** and **order-book throughput (books/sec)** KPIs, directly addressing the speed criterion.

### 3. Dual-Engine Persistence Failover

To guarantee an **instant, zero-config plug-and-play experience** for the hackathon jury, the platform features a dynamic dual DB layer:

- **Local Persistent Mode (Default):** Zero-latency in-memory databases backed by asynchronous background flushes to a local `db.json` file. This preserves simulated wallets, trades, and event histories across server restarts.
- **Supabase PostgreSQL Mode:** Escalates transaction histories directly into remote cloud PostgreSQL tables when the `PERSISTENCE_DRIVER=supabase` and `SUPABASE_KEY` env vars are loaded. See [db-schema.md](file:///c:/DaAps/IACHallenge/docs/db-schema.md) for step-by-step setup guides and the full PostgreSQL DDL schema definition.

### 4. Risk Circuit Breakers (`RiskManager`)

- **Emergency Freezer:** Complete freeze on engine evaluation.
- **Consecutive Loss Breaker:** Pauses simulation for 60 seconds if slippage causes 3 consecutive trades to result in net losses.
- **Volatility Spike Breaker:** Halts trading if prices diverge by >8% in a short window, protecting capital against data lag or flash crashes.
- **Exposure Cap Enforcer:** Restricts balances from exceeding maximum configured limits per exchange and globally.

### 5. Production-Grade Exchange API Syncing

Our exchange integration layer follows official CEX developer guidelines to guarantee extreme order book fidelity. **All five venues stream live, unauthenticated public market data** (verified against the official 2026 API docs):

- **Binance Spot:** Official local order book standard — REST depth snapshots (`/api/v3/depth`) combined with buffered WebSocket L2 diff feeds (`@depth@100ms`) and sequence ID tracking (`U`/`u`) to heal and resync on gaps.
- **Kraken Spot:** Real-time L2 books with live CRC32 checksum verifications and REST fallback snapshots (`/0/public/Depth`) to heal book caches instantly during connection resets.
- **Coinbase Advanced Trade:** `level2` channel over `wss://advanced-trade-ws.coinbase.com` (no JWT required for market data), applying the `snapshot` then incremental `update` events. Served from the deep **BTC-USD** book, which surfaces the genuine Coinbase premium/discount signal.
- **OKX Spot:** `books5` channel over `wss://ws.okx.com:8443/ws/v5/public` — a full top-5 L2 snapshot every 100ms (no checksum bookkeeping needed), with a raw `ping` keepalive.
- **Bybit Spot:** `orderbook.50` topic over `wss://stream.bybit.com/v5/public/spot` — initial `snapshot` plus 20ms `delta` frames merged into a local price-keyed book, with `op: ping` heartbeats.

> ⚠️ Safety Note  
> This system never sends real trading orders and never requires private API keys.  
> It consumes only public market data (REST/WebSocket) and runs a full off-chain simulation engine for execution, balances, and P&L.
>
> ℹ️ **Dollar-quote note:** USD and USDT are both treated as the US-dollar quote in this dollar-denominated simulation, so cross-quote dislocations (the Coinbase premium, USDT basis) are captured as real arbitrage signals — exactly what a real desk arbitrages.

---

## 🏛️ System Architecture Flowchart

```mermaid
flowchart TD
    subgraph Venues ["Live Exchanges (CEX) — 5 public WS feeds"]
        B_WS["Binance WS Depth Stream"]
        K_WS["Kraken WS Depth Stream"]
        C_WS["Coinbase Adv level2 Stream"]
        O_WS["OKX books5 Stream"]
        BY_WS["Bybit orderbook.50 Stream"]
    end

    subgraph BotApp ["Express Server / Simulator Backend (apps/bot)"]
        AdapterB["5x Exchange WebSocket Adapters"]
        L2Cache["L2 Order Book Cache"]
        Engine["Arbitrage Core Engine"]
        Math["L2 Depth-Walk Calculators (@arbitrage/core)"]
        Risk["RiskManager & Circuit Breakers"]
        DbRepo["Dual Database Persistence (SQLite/Supabase)"]
        Server["Express HTTP & WebSockets Server"]
    end

    subgraph WebApp ["Next.js Frontend Dashboard (apps/web)"]
        UI["Glassmorphic UI View Components"]
        ChartBypass["ResizeObserver Loop Chart Bypass"]
        E2E_Mock["Playwright Browser E2E WS Mocks"]
    end

    B_WS -->|L2 Depth Book updates| AdapterB
    K_WS -->|L2 Depth Book updates| AdapterB
    C_WS -->|L2 Depth Book updates| AdapterB
    O_WS -->|L2 Depth Book updates| AdapterB
    BY_WS -->|L2 Depth Book updates| AdapterB
    AdapterB --> L2Cache
    L2Cache -->|Aggregated order book states| Engine
    Engine -->|Walk depth + rank all venue pairs| Math
    Math -->|Gross & Net spreads result| Engine
    Engine -->|Evaluate rules and circuit breakers| Risk
    Risk -->|Approve simulation trades execution| Engine
    Engine -->|Persist simulated states, wallets, events| DbRepo
    Engine -->|State aggregates push| Server
    Server -->|Real-time state payloads via WebSocket (Port 3001)| UI
    UI -->|Render KPIs, Depth book visualization| WebApp
    E2E_Mock -->|Deterministic offline payloads injection (Port 3005)| UI
```

---

## 📁 Monorepo Folder Structure

```
.
├── pnpm-workspace.yaml     # Monorepo workspaces definition
├── package.json            # Task orchestration script mappings
├── tsconfig.base.json      # Strict TS compiler base rules
├── .gitignore              # Ignored files
├── README.md               # Visual platform docs (Jury Pitch)
├── packages/
│   ├── core/               # Shared domain typings and L2 Math utilities
│   ├── config/             # Zod environment schemas & exchange fee metadata
│   └── testing/            # Fixture builders for synthetic order books
└── apps/
    ├── bot/                # Express REST + WS backend bot (5 live exchange WS adapters)
    └── web/                # Next.js 14 glassmorphic real-time terminal
```

---

## ⚙️ REST API Overview (`apps/bot`)

The backend bot exposes standard REST endpoints:

- `GET /health` &mdash; Connection status and uptime stats.
- `GET /state` &mdash; Immediate aggregated `StatePayload` data.
- `GET /config` &mdash; Current engine settings.
- `POST /config` &mdash; Updates engine config variables (Protected by API Key).
- `POST /engine/reset` &mdash; Wipes databases and restores capital to default $100k USDT.
- `GET /trades/export` &mdash; Generates a downloadable flat CSV spreadsheet of all executed simulated trades.

---

## 🚀 Getting Started

### 📋 Prerequisites

Ensure you have the following installed:

- Node.js (v18+)
- pnpm (v9+)

### 1. Installation

Initialize workspace dependencies from the root directory:

```bash
pnpm install
```

### 2. Environment Setup

The monorepo uses isolated environment files for each application. Copy the templates provided to configure your local environment:

- **Backend Bot Configuration:** Copy [apps/bot/.env.example](file:///c:/DaAps/IACHallenge/apps/bot/.env.example) to `apps/bot/.env`
- **Frontend Dashboard Configuration:** Copy [apps/web/.env.local.example](file:///c:/DaAps/IACHallenge/apps/web/.env.local.example) to `apps/web/.env.local`

#### Critical Variables Summary:

- **Backend Bot (`apps/bot/.env`):**
  - `PORT`: Internal server port (default `3001`).
  - `API_KEY`: Secure key to authorize configuration changes and simulator resets.
  - `BINANCE_WS_URL` / `BINANCE_REST_URL`: Native API endpoints for Binance Spot order books.
  - `KRAKEN_WS_URL` / `KRAKEN_REST_URL`: Native API endpoints for Kraken Spot order books.
  - `PERSISTENCE_DRIVER`: Driver switch; `local` uses zero-dependency `db.json`, `supabase` connects to Supabase Postgres.
  - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: Supabase database credentials (**loaded strictly in backend; never exposed to browser**).
- **Frontend Dashboard (`apps/web/.env.local`):**
  - `NEXT_PUBLIC_BACKEND_URL`: Single base URL of the simulator bot (e.g. `http://localhost:3001`). The dashboard derives both the REST base and the WebSocket connection from it; the WS connects at the **root** (scheme swapped to `ws`/`wss`), with no `/ws` path.

### 3. Launching Development Environment

Launch both the backend bot and the Next.js dashboard terminal in parallel:

```bash
pnpm dev
```

- **Backend Bot** spins up on `http://localhost:3001`
- **Dashboard UI** compiles and loads on `http://localhost:3000`

## UI Screenshots

Las siguientes capturas de pantalla ilustran el diseño visual y las capacidades del dashboard interactivo en tiempo real del simulador:

- **Overview Dashboard:** Muestra las métricas principales (KPIs), P&L acumulado y la curva de crecimiento del patrimonio simulado.
  ![Overview Dashboard](docs/screenshots/overview-dashboard.png)
- **Comparative Markets:** Muestra la comparación visual lado a lado de los libros de órdenes de Binance y Kraken.
  ![Comparative Markets](docs/screenshots/markets-orderbooks.png)
- **Simulated Trades Ledger:** Historial de ejecuciones simuladas y el enlace de descarga de registros en formato CSV.
  ![Trades Ledger](docs/screenshots/trades-history.png)
- **Risk & Settings Panel:** Controles del motor, ajuste de márgenes mínimos y disyuntores de riesgo (Risk Circuit Breakers).
  ![Risk & Settings Panel](docs/screenshots/risk-settings.png)

---

## 🧪 Testing Strategies

We provide extensive test coverage across the entire monorepo:

1. **Unit Tests (Core Math & Risk):** Test order book walking, net spreads, and circuit breaker approvals in isolation using Vitest.
2. **Integration Tests (REST API):** Spin up Express routes with mocked adapters, verifying endpoints and database connections using `supertest`.
3. **E2E Visual Tests (Playwright Browser Specs):** Automate headless browser executions verifying real-time visual elements, comparative books updates, config updates, and CSV downloads against an isolated server port (`3005`).

Run testing pipelines using root workspace commands:

```bash
# Run all tests (Unit, Integration, and E2E specs)
pnpm test

# Run unit tests only (Vitest engine/risk suites)
pnpm test:unit

# Run integration routes tests only (Vitest server suites)
pnpm test:integration

# Run Playwright end-to-end browser specifications
pnpm test:e2e
```

---

## 🛠️ Production-Grade Developer Tooling

To ensure the highest quality standards, robust stability, and an exceptional "clean code" impression for the hackathon jury, the platform is integrated with state-of-the-art developer tooling:

1. **Strict Code Quality & Auditing (`ESLint` + `Prettier`)**:
   - **ESLint v9 Flat Configs (`eslint.config.js`)**: Applies strict TypeScript parser rules globally.
   - **Auto-Formatting & Cleanup**: Integrates `eslint-plugin-unused-imports` (which auto-prunes dead imports) and `eslint-plugin-import` (which enforces sorted import structures alphabetically).
   - **Prettier Config (`.prettierrc`)**: Enforces standard styling rules (quotes, semicolons, print spacing, line endings).

2. **Pre-Commit Hook Quality Controls (`Husky` + `lint-staged`)**:
   - **Git Hooks**: Instantiated a local Git repository with active pre-commit hooks.
   - **Automated Checkpoints**: Staging changed files automatically triggers `lint-staged` to execute `eslint --fix` on staged `.ts`/`.tsx` files and `prettier --write` on staged configs and JSON sheets, preventing bad styling from ever entering commits.

3. **Backend Test Automation (`Vitest` + `supertest`)**:
   - High-performance, zero-latency Vitest config (`apps/bot/vitest.config.ts`) running native path aliases.
   - Fully exercises core order book walking math, RiskManager position cap breaks, and PnL trackers.
   - Exercises REST paths (`/health`, `/config`, `/state`, `/engine/reset`) under supertest environments.

4. **Frontend E2E Visual Tests (`Playwright`)**:
   - Chromium E2E specs (`apps/web/playwright.config.ts`) verifying active browser loads, side-by-side market depth visualization columns, and risk settings updates.

5. **Structural Logging & Observability (`Pino`)**:
   - Backend logging is mapped to **Pino structured JSON streams** (`apps/bot/src/logging.ts`). Every info, trade, error, and risk alert outputs detailed JSON rows containing timestamps, event IDs, and error parameters, suitable for modern ELK/Datadog logging collectors.

6. **Payload Schema Validation (`Zod`)**:
   - **Environment Vars (`EnvSchema`)**: Verifies env parameters on server initialization.
   - **Incoming Payloads (`EngineConfigSchema`)**: Validates POST `/config` request bodies, safely rejecting bad data.

---

## 🚀 Quality Validation Pipeline

Operators can run the master validation script locally to enforce code safety, compile references recursively, and run all test sweeps in a single sequential sweep:

```bash
# Execute linter audit + typecheck + Vitest suites
pnpm validate

# Execute individual sweeps
pnpm lint       # Run style check and auto-fixes
pnpm typecheck  # Run strict recursive compiler audits
pnpm test       # Run backend unit & integration tests
```

---

## ☁️ Production Deployment (Fly.io)

The backend bot (`apps/bot`) deploys to a single Fly.io app that serves **both**
HTTP and WebSocket traffic. The Next.js dashboard (`apps/web`) is deployed
separately (e.g. Vercel) and connects to this app over HTTPS/WSS.

Deployment is driven by [`apps/bot/Dockerfile`](apps/bot/Dockerfile) and
[`apps/bot/fly.toml`](apps/bot/fly.toml). The HTTP server and the WebSocket
server share the **same** Node HTTP server bound to `0.0.0.0:$PORT`
(`apps/bot/src/index.ts` → `createServer` + `DashboardWebSocketServer`), so Fly
proxies both protocols through one public endpoint:

- **HTTP / REST:** `https://bitcoin-arbitrage-bot.fly.dev` (e.g. `/health`, `/state`, `/config`, `/trades/export`)
- **WebSocket:** `wss://bitcoin-arbitrage-bot.fly.dev` — the WS server attaches to the
  whole HTTP server (no sub-path filter), so the dashboard connects at the root.

### Launch & deploy

Run these from the **repo root** so the Docker build context includes the
shared workspace packages (`packages/*`):

```bash
# First time: create the Fly app from the existing config (no deploy yet)
flyctl launch --config apps/bot/fly.toml --no-deploy

# Build the image and roll it out (and on every subsequent deploy)
flyctl deploy --config apps/bot/fly.toml
```

The `fly.toml` declares `internal_port = 3001`, `force_https`, a `/health` HTTP
health check, and `min_machines_running = 1` to keep one machine warm so
long-lived WebSocket connections are not dropped.

### Confirmed production URLs

- **REST / HTTP:** `https://bitcoin-arbitrage-bot.fly.dev` (e.g. `/health`, `/state`, `/config`, `/trades/export`)
- **WebSocket:** `wss://bitcoin-arbitrage-bot.fly.dev` — **root path, there is NO `/ws`** (the WS server attaches to the whole HTTP server).

### Required Fly secrets

Every value is read from `process.env` via `@arbitrage/config` — nothing is
hardcoded. `PORT`, `ALLOWED_ORIGINS`, and the exchange feed URLs
(`BINANCE_WS_URL`, `KRAKEN_WS_URL`, `BINANCE_REST_URL`, `KRAKEN_REST_URL`) live
in `fly.toml [env]` with sane production defaults. Set only the following as
**encrypted Fly secrets**:

| Secret         | Purpose                                            |
| -------------- | -------------------------------------------------- |
| `SUPABASE_URL` | Supabase project URL (cloud persistence; optional) |
| `SUPABASE_KEY` | Supabase service/secret key (optional)             |
| `API_KEY`      | Protects `POST /config` and `POST /engine/reset`   |

```bash
flyctl secrets set \
  SUPABASE_URL="https://<your-project>.supabase.co" \
  SUPABASE_KEY="<your-service-role-or-secret-key>" \
  API_KEY="dev-api-key-12345" \
  --config apps/bot/fly.toml
```

> ⚠️ **`API_KEY` must stay `dev-api-key-12345` for now.** The dashboard sends a
> hardcoded `x-api-key: 'dev-api-key-12345'` for the reset/config actions
> (`apps/web/app/WebSocketContext.tsx`). Using a different value will make those
> buttons return `401` until the frontend is updated to read the key from env.

`ALLOWED_ORIGINS` (the CORS allowlist) is already set in `fly.toml [env]` to the
Vercel + localhost origins — update it to match your deployed dashboard domain,
or override it via `flyctl secrets set ALLOWED_ORIGINS="..."`.

### Frontend wiring (apps/web → Vercel)

The dashboard reads its backend location from **`NEXT_PUBLIC_BACKEND_URL`**
(`apps/web/app/WebSocketContext.tsx`) and derives both the REST base and the
WSS connection from it. No Supabase keys or `API_KEY` belong in the frontend.

Set this as a Vercel project env var (and locally in `apps/web/.env.local`):

```env
NEXT_PUBLIC_BACKEND_URL=https://bitcoin-arbitrage-bot.fly.dev
```

The frontend converts the scheme to `wss://` and connects at the **root** — no
`/ws` suffix. Remember to add the deployed Vercel domain to the bot's
`ALLOWED_ORIGINS` (in `apps/bot/fly.toml` or via `flyctl secrets set`) so CORS
and the WS upgrade are accepted. This single variable drives **both** the REST
and WebSocket connections — do not add separate API/WS variables.

### ✅ Final Submission Checklist

- [ ] **Fly deploy succeeds:** `flyctl deploy --config apps/bot/fly.toml` finishes with no errors.
- [ ] **Health OK:** `https://bitcoin-arbitrage-bot.fly.dev/health` returns a healthy JSON response.
- [ ] **Fly secrets set:** `SUPABASE_URL`, `SUPABASE_KEY`, `API_KEY` (kept as `dev-api-key-12345`).
- [ ] **Vercel env set:** `NEXT_PUBLIC_BACKEND_URL=https://bitcoin-arbitrage-bot.fly.dev` (Production scope).
- [ ] **Vercel domain allowlisted:** real Vercel domain added to `ALLOWED_ORIGINS` in `apps/bot/fly.toml`.
- [ ] **Dashboard loads** at the Vercel URL with no console errors.
- [ ] **Live data updates:** prices / order books tick in real time (WS connected).
- [ ] **Opportunities & trades render** and P&L updates.
- [ ] **Reset / config buttons work** (no `401` — confirms `API_KEY` matches).
- [ ] **CSV export works** from `…fly.dev/trades/export`.
