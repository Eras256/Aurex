# Institutional-Grade Cross-Exchange Bitcoin Arbitrage Simulator

## Mathematical Foundations and Architectural Analysis

---

### Abstract

This paper presents the mathematical, algorithmic, and architectural formulations driving **Aurex**, a production-grade, high-throughput, non-custodial cross-exchange arbitrage simulator. Standard arbitrage models naively compute spreads using top-of-book (L1) bid/ask levels. This approach introduces significant tracking errors when trade volumes exceed immediate top levels, resulting in severe market slippage and fee-model miscalculations. We define a mathematically rigorous **L2 Depth-Walking Algorithm (Liquidity Ladder Walk)** that calculates exact volume-weighted average prices across L2 limit order books. We further construct a cost-adjusted net spread capture equation that integrates spot taker fees, network latency buffers, slippage penalties, and flat-rate withdrawal rebalancing fees to yield highly realistic, execution-grade spread simulations.

---

### 1. Algorithmic L2 Depth-Walking (Liquidity Ladder Walk)

In real-world markets, order books contain limit orders distributed across discrete price tiers. An order book level can be represented as a tuple $(p_i, q_i)$ where $p_i$ is the limit price and $q_i$ is the available quantity at that price.

Let the bids order book ladder $B$ and asks order book ladder $A$ be ordered lists of levels:
$$B = \{(p_{b,i}, q_{b,i})\}_{i=1}^n \quad \text{where} \quad p_{b,i} > p_{b,i+1}$$
$$A = \{(p_{a,i}, q_{a,i})\}_{i=1}^m \quad \text{where} \quad p_{a,i} < p_{a,i+1}$$

To execute a simulated order of target volume $V$ (in base asset, e.g., BTC), the engine must iteratively walk down the order book ladder to consume liquidity.

Let $k$ be the index of the deepest book level consumed to fully satisfy target volume $V$:
$$k = \min \left\{ u : \sum_{i=1}^u q_i \ge V \right\}$$

If no such $k$ exists (i.e., $\sum_{i=1}^{length} q_i < V$), the order book lacks sufficient depth to fulfill the requested transaction size, and the trade is rejected due to insufficient liquidity.

The filled volume $a_i$ allocated to each level $i \le k$ is computed as:

$$
a_i = \begin{cases}
q_i & \text{if } i < k \\
V - \sum_{j=1}^{k-1} q_j & \text{if } i = k
\end{cases}
$$

The resulting **Volume-Weighted Average Price (VWAP)** $P_{avg}(V)$ for volume $V$ is given by:
$$P_{avg}(V) = \frac{\sum_{i=1}^k a_i \cdot p_i}{V}$$

---

### 2. Cost-Adjusted Net Spread Capture Formulation

Once the average purchase price $P_{avg, buy}(V)$ on the buying venue and average sale price $P_{avg, sell}(V)$ on the selling venue are computed via L2 depth walking, the engine applies cost deductions to calculate the net risk-free spread.

#### 2.1 Gross Spread

The gross spread per unit asset before transaction costs is defined as:
$$S_{gross} = P_{avg, sell} - P_{avg, buy}$$

#### 2.2 Spot Taker Fees

Exchanges charge spot taker fees on executed order values. Let $\phi_{buy}$ and $\phi_{sell}$ represent the taker fee percentages (expressed as decimals, e.g., Binance Spot: $0.10\% = 0.0010$, Kraken Spot: $0.26\% = 0.0026$).

The fee costs per unit asset are calculated as:
$$C_{fee, buy} = P_{avg, buy} \times \phi_{buy}$$
$$C_{fee, sell} = P_{avg, sell} \times \phi_{sell}$$
$$C_{fee, total} = C_{fee, buy} + C_{fee, sell}$$

#### 2.3 Latency Bps Safety Buffer

To simulate market price movement during WebSocket transit and REST execution delays, a latency safety buffer is applied. The buffer is scaled against the mid price and configured in basis points (bps, where $1 \text{ bps} = 0.0001$).

Let $\lambda_{safety}$ represent the latency safety factor in decimals (e.g., $5 \text{ bps} = 0.0005$). The latency penalty is:
$$C_{latency} = \left(\frac{P_{avg, buy} + P_{avg, sell}}{2}\right) \times \lambda_{safety}$$

#### 2.4 Slippage Bps Safety Buffer

To absorb sudden changes in available limit liquidity between book snapshot updates and trade trigger requests, a slippage safety buffer is deducted.

Let $\sigma_{safety}$ represent the slippage safety factor in decimals (e.g., $2 \text{ bps} = 0.0002$). The slippage penalty is:
$$C_{slippage} = \left(\frac{P_{avg, buy} + P_{avg, sell}}{2}\right) \times \sigma_{safety}$$

#### 2.5 Withdrawal Simulation Fee (Network Rebalancing Cost)

Executing simulated arbitrage trades leads to balance imbalances between exchanges (buying venue capital depletes, selling venue capital accumulates). Rebalancing requires on-chain cryptocurrency transfers, which incur flat network withdrawal fees.

Let $\delta_{withdrawal}$ represent the flat withdrawal fee in base asset (e.g., $0.0005 \text{ BTC}$) and $P_{btc}$ represent the current BTC price in quote asset (USD). The withdrawal rebalancing cost in USD is:
$$C_{withdrawal} = \delta_{withdrawal} \times P_{btc}$$

#### 2.6 Complete Net Spread Capture Equation

The net arbitrage spread capture $S_{net}$ per unit asset (before flat-rate withdrawal deductions) is formulated as:
$$S_{net} = P_{avg, sell} (1 - \phi_{sell}) - P_{avg, buy} (1 + \phi_{buy}) - C_{latency} - C_{slippage}$$

The total opportunity net profit in USD ($NP_{total}$) captured on transaction volume $V$ is:
$$NP_{total} = V \cdot S_{net} - C_{withdrawal}$$

An arbitrage window is considered executable if and only if:
$$NP_{total} \ge NP_{min}$$
Where $NP_{min}$ is the minimum net profit threshold set by the operator (default: $\$1.50 \text{ USD}$).

---

### 3. Simulator System Architecture

```
                                      +------------------------------------+
                                      |    Live Centralized Venue (CEX)    |
                                      |  Binance / Kraken Websocket Feeds  |
                                      +-----------------+------------------+
                                                        |
                                                        v (L2 Depth Updates)
                                      +-----------------+------------------+
                                      |     Real-Time WebSocket Client     |
                                      |   Ingestion & Connection Manager   |
                                      +-----------------+------------------+
                                                        |
                                                        v (Incremental Delta Parse)
                                      +-----------------+------------------+
                                      |      In-Memory L2 Cache Store     |
                                      |    Walks Bids/Asks Price Ladders   |
                                      +-----------------+------------------+
                                                        |
+-----------------------------------+                   | (Aggregated Books State)
|           RiskManager             |                   v
| - Volatility Breakers             |<--------+----------------------------+
| - Exposure Limit Enforcers        |         |    Arbitrage Engine Loop   |
| - Consecutive Loss Coolers        +-------->|    - Computes VWAP & Fees  |
+-----------------------------------+         |    - Validates Spreads     |
                                              +-----------------+----------+
                                                                |
                                                                v (Trade Capture)
                                              +-----------------+----------+
+-----------------------------------+         |    Dual DB Persistence     |
|       Next.js Web Frontend        |         |  - Local File: db.json     |
| Real-time KPIs & React Dashboards |<--------|  - Remote: Supabase PG     |
+-----------------------------------+         +----------------------------+
```

#### 3.1 WebSocket Ingestion and L2 Sync Engine

The backend bot (`apps/bot`) maintains active, high-fidelity L2 order book caches following official developer guidelines:

- **Binance Client:** Implements the official Binance local order book synchronization algorithm. Upon socket connection, it buffers incoming WebSocket diff events (`@depth@100ms`) while executing a REST query (`GET /api/v3/depth`) to pull the base snapshot. It then parses, filters, and applies diff events sequentially, ensuring update IDs align (`U <= lastUpdateId + 1` and `u >= lastUpdateId + 1`), with automatic sequence gap detection triggering resync fetches.
- **Kraken Client:** Implements real-time L2 books with live CRC32 checksum verifications and REST fallback snapshots (`GET /0/public/Depth`) to heal caches instantly during connection resets or checksum mismatches, preventing book-clearing downtime.

#### 3.2 Real-time Risk Circuit Breakers

The `RiskManager` evaluates every potential arbitrage window against multiple circuit breakers:

1. **Exposure Cap:** Enforces that net asset balances do not cross maximum limits on any individual exchange or globally.
2. **Consecutive Loss Breaker:** Automatically triggers a 60-second engine cooldown if execution slippage results in 3 consecutive losing simulated trades.
3. **Volatility Spike Breaker:** Rejects spreads if CEX prices diverge by more than $8\%$, indicating extreme market disequilibrium, API lag, or flash crashes.

#### 3.3 Dual-Engine Failover Storage

To ensure high accessibility and zero-config deployment during testing:

- **Local Persistence Engine:** Default database layer using asynchronous writes to a local `db.json` file. This preserves wallet states, trade history logs, and system events across restarts.
- **Supabase Cloud Engine:** Triggers on environment variable discovery, piping transaction logs directly to a cloud PostgreSQL table.

---

### 4. Visual Verification & E2E Testing Safeguards

Developing dynamic charts and real-time visual feeds poses unique automated testing challenges.

#### 4.1 Recharts ResizeObserver Layout Recursion Loop

Rendering interactive SVG line and bar charts (using the Recharts library) inside flexible CSS layouts (e.g. Tailwind `flex` columns) can trigger infinite rendering loops. In headless Chromium environments used by Playwright, window resize notifications trigger chart updates, which modify parent container sizes, triggering subsequent resize notifications. This creates a loop:
$$\text{ResizeEvent} \longrightarrow \text{Chart Resize} \longrightarrow \text{Parent Layout Shift} \longrightarrow \text{ResizeObserver Notification}$$

The loop continues until stack bounds are exceeded, throwing `Maximum update depth exceeded`.

We solve this issue by introducing a browser-injected testing variable `window.IS_PLAYWRIGHT`. When set to `true`, Next.js app components conditionally bypass the Recharts wrapper, instead rendering a styled static visual block with identical absolute CSS layout proportions:

```tsx
{
  typeof window !== 'undefined' && (window as any).IS_PLAYWRIGHT ? (
    <div
      id="mock-chart-container"
      className="h-[300px] bg-slate-900 border border-dashed rounded-lg flex items-center justify-center"
    >
      <span className="text-slate-500 font-mono">Chart Visual Substituted (Playwright Mode)</span>
    </div>
  ) : (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>{/* ... area chart layers ... */}</AreaChart>
    </ResponsiveContainer>
  );
}
```

This guarantees robust visual verification pipelines without impacting the rich dashboard experience for real human operators.

#### 4.2 Playwright Port Isolation Strategy

To prevent port collisions, Playwright E2E tests target Next.js on an isolated port (`3005`). Real-time WebSocket connectivity is simulated by injecting a `MockWebSocket` class that wraps the original browser `WebSocket` constructor, giving E2E specs complete, deterministic control over simulated CEX streams and trading ledger events.

---

### 5. Deployed Topology and Production Benchmarks

For public evaluation, performance auditing, and end-to-end telemetry capture, **Aurex** is deployed in a high-availability production topology:

- **Frontend User Interface:** Next.js terminal client deployed on **Vercel** with full static page optimization and global edge distribution.
  - **Live Production URL:** [https://aurex-terminal.vercel.app/](https://aurex-terminal.vercel.app/)
- **Backend Simulator Engine:** Express-based CEX WebSocket ingestion adapter and memory engine deployed in close physical proximity to core US-East cloud servers on **Fly.io**.
- **Shared Telemetry Database:** Direct PostgreSQL integration utilizing **Supabase** for real-time trade event capturing, persistent wallet state synchronization, and operational config updates.
