# Aurex — Technical Decision Log

Short rationale for the decisions that shape Aurex, written so a reviewer can understand
_why_ the system is built the way it is. Each entry: the decision, the alternative, and why.

## Market data & detection

- **L2 depth-walking instead of top-of-book (L1).** A spread that looks profitable on the
  best bid/ask often evaporates once you size into it. Aurex walks the L2 ladder to a
  volume-weighted average price, so the edge it reports is the edge you could actually fill.
  _Alternative:_ L1 spreads — rejected as unrealistic.
- **WebSockets with REST snapshot reconciliation.** Each venue adapter syncs a REST snapshot
  with the incremental diff stream and heals on sequence gaps / checksum mismatch. _Alternative:_
  REST polling — rejected for latency and rate limits.
- **Wire vs compute latency, measured separately.** Wire latency is measured from the venue's
  own event timestamp; compute latency times the pure algorithm. Conflating them would hide
  where time actually goes; a p99 is surfaced because tail latency is what kills arbitrage.

## Cost model & honesty

- **Cost-aware net spread, not gross.** Taker fees, a latency buffer, a slippage buffer, the
  USD↔USDT basis on cross-quote legs, and flat withdrawal cost are all deducted before a
  window is considered profitable. The "Coinbase premium" is charged its real conversion cost
  so it is never booked as free profit.
- **Stochastic two-sided fills (Box–Muller) + cross-venue leg risk.** Realised fills are drawn
  around the modeled adverse cost, and a configurable fraction of trades fill one leg and miss
  the other, unwound at a loss. This is _why the win rate is honestly below 100%_ rather than a
  flattering ideal — leg risk is the dominant real-world loss source.
- **Honest Sharpe.** Withheld until ≥20 trades exist instead of printing a meaningless early
  number.

## Strategy & risk

- **Directed 5×5 scan + ranking, not first-found.** When several venues diverge at once, the
  engine ranks by net profit and breaks near-ties by statistical z-score, executing the single
  highest-conviction window.
- **Statistical-arbitrage z-score gate (optional).** A rolling per-pair z-score prioritises
  anomalous, mean-reverting dislocations over merely-positive spreads. Off by default; the
  operator turns it on and sets the threshold.
- **Per-pair execution cooldown.** After a capture, a pair is not re-fired every tick — capital
  is cycling — so cumulative returns stay realistic instead of compounding one apparent spread.
- **Circuit breakers:** consecutive-loss cooldown, volatility-spike breaker, and exposure caps,
  all runtime-configurable.

## Parametrization (the design centre of the final phase)

- **Single source of truth (`EngineConfig`), schema-validated (Zod), hot-applied.** Every knob
  — thresholds, sizing, fees (with Retail/VIP presets), cooldowns, leg-risk probability,
  rebalancing thresholds, the z-score gate — is editable at runtime from the Risk page and
  persisted, with no restart. Old persisted configs merge over defaults so new knobs are never
  undefined. _Why:_ configurability is what separates a toy from an operable system, and the
  same knobs make the robustness paths deterministically testable.
- **Fee defaults are VIP-tier, but configurable.** Real desks operate at VIP tiers; defaults
  reflect that, and a one-click Retail preset switches to published standard rates so the
  assumption is explicit and adjustable rather than hidden.

## Inventory & settlement

- **Mean-reversion rebalancing with explicit fees.** Directed arbitrage drains the expensive
  venue of base and the cheap venue of quote; the InventoryManager moves the surplus back
  toward the cross-venue mean, paying a real transfer fee (so rebalancing honestly bleeds
  inventory) and never moving dust below the configurable minimum.

## Architecture & persistence

- **pnpm monorepo** with shared `@arbitrage/core` types as the single type source.
- **Dual persistence with failover:** local `db.json` by default, optional Supabase Postgres;
  if the cloud is unreachable the engine falls back to local without stopping. Audit records
  are append-only (a DB trigger blocks updates/deletes).
- **Secrets stay server-side.** The dashboard talks to the bot through Next.js server-side
  proxies so the API key never reaches the client bundle.

## Submission integrity

- The judged submission is frozen at commit `9eb95a4`. Every change the live deployment carries
  on top of it is listed, in full, on the in-app **Build Notes** page so the two can be
  reconciled. Final-phase work happens on the `final-phase` branch.
