# Aurex &mdash; Agent Memory & State Ledger

This file tracks the active development state, memory logs, and strategic roadmap progress of the **Aurex** cross-exchange arbitrage system.

---

## 🚀 Active Project State

- **Current Stage:** Finalist Extension Phase (Deadline: Sun 12 Jul 2026, 23:59).
- **Active Branch:** `final-phase` (All new features are developed here; stable commits merged to `main`).
- **Live Endpoint Dashboard:** [https://aurex-terminal.vercel.app/](https://aurex-terminal.vercel.app/)
- **Live Backend Bot API:** [https://bitcoin-arbitrage-bot.fly.dev/](https://bitcoin-arbitrage-bot.fly.dev/)

---

## 💎 Implemented Milestones (final-phase)

### 1. Real-Model AI Copilot Integration

- **Server Route:** [route.ts](file:///c:/DaAps/IACHallenge/apps/web/app/api/copilot/chat/route.ts) connects securely to OpenAI's completion API on the server side using the gitignored `OPENAI_API_KEY`.
- **Live Engine Grounding:** Injects live stats (`GET /state`) containing P&L, risk params, recent trades, and reasons for spread rejections directly into the prompt context.
- **Graceful Mock Fallback:** [realAiAgent.ts](file:///c:/DaAps/IACHallenge/apps/web/lib/ai/realAiAgent.ts) falls back seamlessly to pre-scripted scenarios if the key is missing or an upstream error occurs, ensuring the client dashboard never breaks.

### 2. Live Testnet/Demo Execution

- **Executor:** [testnetExecutor.ts](file:///c:/DaAps/IACHallenge/apps/bot/src/exchanges/testnetExecutor.ts) routes Binance↔OKX arbitrage legs to real IOC (Immediate-Or-Cancel) orders on Binance Spot Testnet and OKX Demo Trading.
- **Safety Fallback:** Gracefully falls back to simulation mode if API credentials are unconfigured or fail.

### 3. Statistical Z-Score Gate

- **Engine Gate:** [SpreadStatistics.ts](file:///c:/DaAps/IACHallenge/apps/bot/src/engine/SpreadStatistics.ts) ranks and gates executions based on rolling z-score statistics of price spreads, filtering out non-statistical noise.

### 4. Risk Calibration & UI Enhancements

- **Dynamic Configuration:** Supports hot-applying parameters (sizing step, consecutive loss limits, cooldowns, volatility-breakers) from the Risk panel on the fly.
- **Analytics:** Added max-drawdown computation alongside the Sharpe Ratio, win rate, and equity curve logs.
- **Rebalancing Visibility:** Staged rebalancing options are visible in the Wallets tab.

---

## 🛠️ Next Milestones & Planned Roadmap

1. **Multi-Asset Arbitrage:** Extend the engine beyond BTC/USDT to scan other liquid pairs (ETH, SOL, AVAX, LINK) by generalizing the base asset types in `RiskManager` and `InventoryManager`.
2. **Backtesting Harness:** Implement a simulator that replays historical L2 order book data and compares modeled net spreads with real execution costs.

---

## 🔑 Development & Safety Constraints

- **Commit Authorship:** Configured to `Eras256 <neuralsol7@gmail.com>`. No co-authorship tags allowed in commit logs.
- **Secrets Management:** Keep `OPENAI_API_KEY` and exchange credentials strictly inside `.env.local` or environment variables; they must never leak to the client bundle.
- **Audit Immutability:** The Postgres audit log table `copilot_audit_trail` has strict db triggers preventing `UPDATE` or `DELETE` commands.
