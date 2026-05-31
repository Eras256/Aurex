# CLAUDE.md &mdash; Developer Guide & Command Reference

This file documents the command reference and codebase standards for **Aurex**.

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

- **Database Schema DDL:** Detailed in [docs/db-schema.md](file:///c:/DaAps/IACHallenge/docs/db-schema.md). Paste and execute this in the Supabase SQL Editor.
- **Persistence Toggle:** Set `PERSISTENCE_DRIVER=supabase` in `apps/bot/.env` to switch from zero-config local mode (`db.json`) to Supabase PostgreSQL.

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
