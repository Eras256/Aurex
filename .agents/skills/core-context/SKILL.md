---
name: core-context
description: >
  Loads and registers strategic and technical memory rules from claude.md at the
  root of the repository, preventing AI hallucinations and keeping code aligned
  with audited API endpoints.
---

# Antigravity Skill: Core Context & Memory Loader

## Overview

This local skill instructs **Antigravity** (our agentic system) to automatically load, parse, and synchronize strategic and technical codebase configurations from `claude.md` and `CLAUDE.md` before executing any development workflows. The platform utilizes full ES/EN localization across the Next.js UI, dynamic portfolio metrics scaling, and secure API Key injection for backend configurations.

- **Live Production Dashboard:** [https://aurex-terminal.vercel.app/](https://aurex-terminal.vercel.app/)
- **Live Backend Bot API:** [https://bitcoin-arbitrage-bot.fly.dev/](https://bitcoin-arbitrage-bot.fly.dev/)

**Always use this skill when:**

- Initializing a task in the **Aurex** repository.
- Modifying exchange adapters (Binance, Kraken, Coinbase, OKX, Bybit).
- Changing risk configurations, Supabase repositories, or math equations.
- Reviewing dynamic calibration endpoints, telemetry WebSockets, or secure Next.js proxies.
- Performing builds, lint runs, or test validations.

---

## Core Rules for Antigravity

### 1. Load Memory First

Before proposing any code edits or running any terminal commands, you **MUST** read and assimilate the contents of the unified master memory:

- `claude.md` (located at the workspace root)
- `CLAUDE.md` (located at the workspace root)

Do not assume current configuration variables, API payloads, or workspace structures without verifying them against these master files.

### 2. Zero-Hallucination CEX API Protocol

When working on WebSocket feeds or REST adapters:

- Do NOT use internal base knowledge regarding exchange endpoints.
- Scrape or read the official documentation links under **Section 1.3** of `claude.md` to fetch the real, live API specifications.

### 3. Continuous Documentation Update Hook

Upon completing any development task:

- Verify if any directory paths, terminal commands, or exchange adapters have changed.
- Update `claude.md` and `CLAUDE.md` immediately to reflect these changes _before_ finishing your turn.
- Ensure that codebase realities never drift from the documented memory.

### 4. Submission Freeze Discipline

- The original judged submission is frozen at the deadline commit (`9eb95a4`). The finalist extension window is now **OPEN** (deadline Sun 12 Jul 2026, 23:59): active development happens on the `final-phase` branch; merge to `main` and redeploy only when stable, then update the submission on the portal. Keep `main`/deploy green.
- The live-deploy delta over the frozen submission is documented on the Build Notes page (`apps/web/app/changelog/page.tsx`). Keep that page authoritative and honest; never let it claim "docs-only" changes when engine code also moved.

### 5. AI Copilot Reality

- The AI Quant Copilot is backed by a real model (OpenAI Integration via a secure server-side route at `apps/web/app/api/copilot/chat/route.ts`) with a seamless fallback to mock data (`apps/web/lib/ai/mock/mockAiAgent.ts`) if the API key is not configured. The API key must stay strictly server-side (`.env.local`, gitignored) and never reach the client bundle. Keep this proxy pattern intact for any model updates.
- Private roadmap and sequencing live in `PLAN-PODIO.md` (gitignored — do not commit).

---

## Verification Checklist for Context Loading

1. **Verify Root Rules presence**: Check that `.cursorrules`, `.windsurfrules`, and `.clinerules` are in place.
2. **Review Environment limits**: Verify env schemas in `packages/config/src/index.ts`.
3. **Execute Monorepo Validation**: Run `pnpm validate` to confirm linter, typecheck, and test suite consistency (including Playwright E2E and Vitest).
