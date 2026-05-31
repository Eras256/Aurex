**Resumen en Español:** _Aurex es un simulador de arbitraje de Bitcoin de alto rendimiento que consume datos públicos en tiempo real (REST + WebSocket L2) de Binance y Kraken. El sistema detecta oportunidades de arbitraje, calcula la rentabilidad neta (restando comisiones, deslizamiento y penalizaciones por latencia) y simula ejecuciones, balances de carteras y P&L off-chain visibles en un dashboard web interactivo._

# ₿ Aurex

### Institutional-Grade Bitcoin Cross-Exchange Arbitrage Simulator

Aurex is an institutional-grade platform for real-time Bitcoin arbitrage detection, execution simulation, and risk-aware market monitoring across multiple exchanges.

By utilizing high-speed WebSocket market feeds, walking real-time L2 order book depth tables, and incorporating transaction costs, slippage penalties, and network latency buffers, the system provides a highly accurate simulation environment of high-frequency trading (HFT) spread capture.

## Cómo cumple los requisitos del Challenge

El proyecto se diseñó para cumplir con el 100% de los lineamientos del reto técnico:

- **Monitoreo en tiempo real de libros de órdenes de BTC en 2+ exchanges:** Conexión concurrente y de alta fidelidad a Binance Spot y Kraken Spot mediante streams WebSocket L2 combinados con snapshots REST para mantener libros de órdenes locales sincronizados con precisión de milisegundos.
- **Detección de oportunidades de arbitraje y cálculo de rentabilidad neta:** Detección instantánea de ventanas de arbitraje cuando Ask < Bid. El motor L2 Depth-Walking evalúa la liquidez de los libros y deduce comisiones spot de taker (Binance: 0.1%, Kraken: 0.26%), costos de transferencia/retiro simulados, amortiguadores de deslizamiento (slippage) y retraso de red (latencia).
- **Simulación de ejecución con respeto de liquidez:** Ejecución simulada 100% off-chain y no-custodial que realiza recorridos L2 (Depth-Walk) para fills parciales y actualiza dinámicamente los balances simulados de las carteras (USDT y BTC).
- **Seguimiento y visualización:** Registro de oportunidades evaluadas, historial detallado de trades ejecutados y curvas de P&L acumulado en tiempo real, expuestos de forma de alta fidelidad en la interfaz web de Next.js.
- **Arquitectura full-stack de alto nivel:** Arquitectura desacoplada de alto rendimiento que incluye el bot backend (Express/WebSockets/Pino), paquetes compartidos en monorepo, persistencia local a prueba de reinicios (`db.json`) y frontend de vanguardia con Tailwind CSS, entregado completamente en 48 horas.

---

## 🌟 Key Architectural Innovations

### 1. L2 Depth Walking (Optimal Size Sizing)

Standard simulators calculate spreads naively using top-of-book levels (L1: best Bid/Ask). If a strategy tries to execute a large order (e.g., 2 BTC) against a level that only has 0.1 BTC liquidity, the transaction suffers massive slippage.
Our engine **Walks the L2 order book depth**: it iteratively tests larger size blocks, aggregates walked average prices, subtracts fees and buffers, and isolates the **mathematically optimal transaction volume** that maximizes net return.

### 2. Micro-Level Cost & Latency Modeling

We apply a strict cost deduction profile to candidate spreads to ensure realistic margins:

- **Spot Taker Fees:** Charged on both sides (Binance Spot: 0.10% Taker fee, Kraken Spot: 0.26% Taker fee).
- **Withdrawal Fees (Network Rebalancing):** Modeled per-opportunity to simulate asset rebalancing costs across venues.
- **Latency Buffer (BPS):** Subtracts expected sell prices and inflates expected buy prices to replicate spread drift during network websocket transit.
- **Slippage Buffer (BPS):** Cushion margin padded to walked averages.

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

Our exchange integration layer follows official CEX developer guidelines to guarantee extreme order book fidelity:

- **Binance Spot:** Upgraded to the official local order book standard, utilizing REST depth snapshots (`/api/v3/depth`) combined with buffered WebSocket L2 diff feeds (`@depth@100ms`) and sequence ID tracking (`U`/`u`) to heal and resync on gaps.
- **Kraken Spot:** Implements real-time L2 books with live CRC32 checksum verifications and REST fallback snapshots (`/0/public/Depth`) to heal book caches instantly during connection resets.

> ⚠️ Safety Note  
> This system never sends real trading orders and never requires private API keys.  
> It consumes only public market data (REST/WebSocket) and runs a full off-chain simulation engine for execution, balances, and P&L.

---

## 🏛️ System Architecture Flowchart

```mermaid
flowchart TD
    subgraph Venues ["Live Exchanges (CEX)"]
        B_WS["Binance WS Depth Stream"]
        K_WS["Kraken WS Depth Stream"]
    end

    subgraph BotApp ["Express Server / Simulator Backend (apps/bot)"]
        AdapterB["Binance WebSocket Adapter"]
        AdapterK["Kraken WebSocket Adapter"]
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
    K_WS -->|L2 Depth Book updates| AdapterK
    AdapterB --> L2Cache
    AdapterK --> L2Cache
    L2Cache -->|Aggregated order book states| Engine
    Engine -->|Calculate volume weighted average price| Math
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
    ├── bot/                # Express REST + WS backend bot (Binance & Kraken WS)
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
