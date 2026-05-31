---
name: core-context
description: >
  Loads and registers strategic and technical memory rules from claude.md at the
  root of the repository, preventing AI hallucinations and keeping code aligned
  with audited API endpoints.
---

# Antigravity Skill: Core Context & Memory Loader

## Overview

This local skill instructs **Antigravity** (our agentic system) to automatically load, parse, and synchronize strategic and technical codebase configurations from `claude.md` and `CLAUDE.md` before executing any development workflows.

**Always use this skill when:**

- Initializing a task in the **Aurex** repository.
- Modifying exchange adapters (Binance, Kraken, Coinbase, OKX, Bybit).
- Changing risk configurations, database repositories, or math equations.
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

---

## Verification Checklist for Context Loading

1. **Verify Root Rules presence**: Check that `.cursorrules`, `.windsurfrules`, and `.clinerules` are in place.
2. **Review Environment limits**: Verify env schemas in `packages/config/src/index.ts`.
3. **Execute Monorepo Validation**: Run `pnpm validate` to confirm linter, typecheck, and test suite consistency (including Playwright E2E and Vitest).
