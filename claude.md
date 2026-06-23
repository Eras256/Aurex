# CLAUDE.md &mdash; Developer Guide & Command Reference

This file documents the command reference and codebase standards for **Aurex**.

## 🌐 Live Deployment
- **Production Dashboard:** [https://aurex-terminal.vercel.app/](https://aurex-terminal.vercel.app/)


## 🛠️ Commands Reference

### 1. Startup & Development

Launch the backend bot server (port `3001`) and Next.js frontend (port `3000`) concurrently:

```bash
# Concurrently launch both services
pnpm dev

# Launch Next.js web application dashboard only
pnpm dev:web

# Launch Express bot server only
pnpm dev:bot
```

### 2. Compilation & Monorepo Build

```bash
# Build all internal packages (@arbitrage/core, @arbitrage/config, @arbitrage/testing) and applications (bot, web)
pnpm build

# Typecheck all source files recursively (strict compiler type checks, noEmit)
pnpm typecheck

# Full monorepo cleanup (removes node_modules, build targets, and .next cache)
pnpm clean
```

### 3. Testing Suites

```bash
# Run all unit, integration, and E2E tests in the workspace
pnpm test

# Run Vitest unit tests in apps/bot (RiskManager, order book walking, net spreads math)
pnpm test:unit

# Run Vitest integration tests in apps/bot (Express HTTP routes and APIs using supertest)
pnpm test:integration

# Run Playwright E2E browser tests in apps/web (isolated Next.js port 3005)
pnpm test:e2e
```

### 4. Running Single Test Files

To run a specific test suite or test file in isolation:

```bash
# Run specific Vitest unit test file
pnpm --filter bot exec vitest run src/tests/unit/engine.test.ts

# Run specific Vitest integration test file
pnpm --filter bot exec vitest run src/tests/integration/api.test.ts

# Run specific Playwright E2E test file
pnpm --filter web exec playwright test e2e/dashboard.spec.ts

# Run Playwright test in UI mode (Interactive visual debugger)
pnpm --filter web exec playwright test --ui
```

### 5. Linting & Code Style Formatter

```bash
# Run ESLint validation and auto-fix rules
pnpm lint

# Run all validations sequentially: Linting + Strict Typechecking + All Tests
pnpm validate
```

### 6. Supabase & Database Operations

- **Database Schema DDL:** Detailed in [docs/db-schema.md](file:///c:/DaAps/IACHallenge/docs/db-schema.md). Contains schemas for `copilot_audit_trail` and standard arbitrage fills.
- **Persistence Toggle:** Set `PERSISTENCE_DRIVER=supabase` in `apps/bot/.env` to switch from zero-config local mode (`db.json`) to Supabase PostgreSQL.
- **Failover Security:** If Supabase is unreachable, the engine seamlessly falls back to local disk storage (`db.json`) to avoid stopping the bot.
- **Immutability Protection:** The PostgreSQL `block_audit_mutations` trigger rejects all `UPDATE` or `DELETE` commands on the `copilot_audit_trail` table, guaranteeing immutable history even for database administrators using `service_role` credentials.

### 7. AI Quant Copilot Real-Time Integrations

- **Dynamic Calibration Endpoint:** `POST /api/v1/bot/calibrate` (Express Bot API, guarded by `secureGuard`). Updates risk parameters (`minNetProfitUSD`, `maxPositionBTCPerExchange`, `latencySafetyBps`) in memory on the fly and logs the event to the Supabase audit trail.
- **WebSocket Telemetry Server:** `wss://bitcoin-arbitrage-bot.fly.dev/api/v1/telemetry/logs?token=<API_KEY>`. Streams real-time performance logs including engine latency, feed lag per exchange, skipped trades stats, and warning flags. Connects securely in browsers via query-string authentication.
- **Secure Server-Side Proxies:** Next.js uses server-side proxies (`/api/bot/calibrate` and `/api/copilot/audits`) to read the private Vercel `API_KEY` entirely server-side, eliminating the exposure of sensitive credentials to the browser console.

---

## 🎨 Code Style & Engineering Standards

### 1. Naming & Case Conventions

- **TypeScript Source Files:** Strictly camelCase (e.g. `binanceClient.ts`, `stateAggregator.ts`).
- **Next.js App Router (pages/layouts):** Strictly lowercase (e.g. `page.tsx`, `layout.tsx`).
- **Test Files Suffixes:** Suffix Vitest tests with `.test.ts` and Playwright E2E tests with `.spec.ts`.

### 2. TypeScript strict mode

- **NO `any` types allowed:** Utilize exact types or `unknown` when handling raw exchange payloads.
- **Single Source of Truth:** All core type declarations must exist inside `packages/core/src/types/index.ts` and are shared using the monorepo package `@arbitrage/core`. Never redeclare redundant types locally.

### 3. Structured Logging & Observability

- **Pino Logger:** All backend diagnostic output must use the custom Pino logger module from `apps/bot/src/logging.ts`.
- **No `console.log`:** Use structured levels `logger.info`, `logger.warn`, and `logger.error` to output machine-readable JSON logs.

### 4. Quality Guardrails

- **Pre-commit Checks:** Husky and lint-staged execute ESLint and Prettier on staged files prior to all commits. Never bypass these checks.
- **Preserve Documentation & Comments:** Maintain all existing comments and docstrings that are unrelated to your current edits.

### 5. Commit Authorship

- **Sole author:** Every commit must be authored **and** committed by `Eras256 <neuralsol7@gmail.com>`. Configure once with `git config user.name "Eras256"` and `git config user.email "neuralsol7@gmail.com"`.
- **No co-authors:** Do **not** add any `Co-Authored-By:` trailer (no AI/assistant attribution) to commit messages.

---

## 🧊 Submission Freeze & Live-Deploy Delta

- **Frozen submission:** the code judged for the Coding Challenge is frozen at the deadline commit (`9eb95a4`). Do not alter that judged baseline.
- **Live deploy:** the public deployment kept iterating after the freeze. Every change the live system carries over the frozen submission is listed, fully and honestly, on the in-app **Build Notes** page ([apps/web/app/changelog/page.tsx](apps/web/app/changelog/page.tsx)). Keep that page authoritative.
- **Working discipline:** until the official extension window is open, the repo and deploy stay frozen. Do all new work on a dedicated branch; never commit or push outside the window.

## 🗺️ Roadmap — planned for the extension window (NOT yet implemented)

> These are planned enhancements, **not** current behavior. Keep docs and code in sync: only describe a feature as live once it actually ships. Private strategy and sequencing live in `PLAN-PODIO.md` (gitignored — do not commit).

- **Multi-asset arbitrage:** extend beyond BTC to liquid altcoins (ETH, SOL, AVAX/LINK) via `supportedSymbols` in [packages/config/src/metadata.ts](packages/config/src/metadata.ts) and per-symbol book scanning.
- **Statistical arbitrage (first-class):** wire the existing `SpreadStatistics` z-score (`apps/bot/src/engine/SpreadStatistics.ts`) into opportunity ranking/gating, surfaced in the UI.
- **Latency benchmarking:** measured end-to-end figures (book update → opportunity detected), mean and p99.
- **Backtesting harness:** replay recorded L2 books and report realized-vs-modeled net to validate the cost model.
- **AI Quant Copilot — real model:** the Copilot is currently mock-driven ([apps/web/lib/ai/mock/mockAiAgent.ts](apps/web/lib/ai/mock/mockAiAgent.ts), scripted scenarios). Planned: a server-side Next.js route (`app/api/copilot/chat/route.ts`) that calls OpenAI with `OPENAI_API_KEY` read from `.env.local` (already gitignored), streaming real tokens with graceful fallback to the mock. The key must **never** reach the client bundle — mirror the existing secure server-side proxy pattern (`/api/bot/calibrate`, `/api/copilot/audits`). Rotate any key that has been exposed.
