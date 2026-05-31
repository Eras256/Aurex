# 📦 Aurex SDK (`@arbitrage/sdk`)

The `@arbitrage/sdk` is a universal, production-grade isomorphic TypeScript SDK designed to wrap the **Aurex** HTTP (REST) and WebSocket (WS) servers.

It provides a strongly-typed, fully documented programmatic interface suitable for Next.js react pages (both SSR and Client rendering), Node.js server scripts, and external programmatic clients.

---

## 🚀 Installation & Local Workspace Usage

Since the SDK is managed inside the project monorepo workspace under `packages/sdk/`, it is immediately available for internal applications.

### 1. Link to your package dependencies

Add the SDK dependency to your target package's `package.json`:

```json
"dependencies": {
  "@arbitrage/sdk": "workspace:*"
}
```

Then run `pnpm install` from the workspace root to wire the local symlink:

```bash
pnpm install
```

### 2. Fast Import and Factory Setup

Initialize the clients in a single factory call:

```typescript
import { createArbitrageSDK } from '@arbitrage/sdk';

const sdk = createArbitrageSDK({
  baseUrl: 'http://localhost:3001', // Express REST Endpoint
  wsUrl: 'ws://localhost:3001', // WebSockets Broadcaster
  apiKey: 'dev-api-key-12345', // Auth token for config modification & resets
  timeoutMs: 5000, // Request timeout (defaults to 10000)
});
```

---

## 🗃️ `RestClient` API Methods

The `RestClient` provides promise-based API methods targeting all active HTTP routes.

### Active Endpoints Map

#### 1. Uptime and Health Checking

```typescript
const health = await sdk.rest.getHealth();
console.log(`Status: ${health.status}, Binance linked: ${health.connections.binance}`);
```

#### 2. Full State Synchronization

Retrieves the complete aggregated engine data payload (includes order books, P&L curves, events logs, active wallet exposure, etc.).

```typescript
const state = await sdk.rest.getState();
```

#### 3. List Retrieval & Local Slicing

Because opportunities and trades are stored and served under `/state`, the SDK exposes filtered helper methods that retrieve state details and cleanly slice results for quick list pagination without adding endpoint load:

```typescript
// Fetch the top 10 most recent opportunities
const opportunities = await sdk.rest.getOpportunities({ limit: 10 });

// Fetch the top 20 trades
const trades = await sdk.rest.getTrades({ limit: 20 });
```

#### 4. Safe Configuration Updating (Authenticated)

Validates config parameters client-side, sending required headers (`x-api-key` and `Authorization` Bearer) to authorize updates:

```typescript
const updatedConfig = await sdk.rest.updateConfig({
  minNetProfitUSD: 2.5,
  isPaused: false,
});
```

#### 5. Database & simulation resets (Authenticated)

Restores wallets mock balance funding and clears system event histories:

```typescript
await sdk.rest.resetEngine();
```

#### 6. Export Trades Report (CSV)

Downloads simulated trade records as a formatted CSV spreadsheet string:

```typescript
const csvString = await sdk.rest.exportTrades();
```

---

## ⚡ `WebSocketClient` Real-time Event Streams

The backend WebSocket acts as a high-fidelity state broadcast pipe, pushing updates every 300ms. The `WebSocketClient` acts as a local event router, parsing the payload, mapping balances, analyzing changes, and broadcasting events.

### Reconnection Policy & Universal Setup

- **Isomorphic WebSocket Support:** Automatically leverages native `WebSocket` in browser/Next.js client runtimes, and dynamically imports `'ws'` package in Node.js processes. You can also supply a custom engine:
  ```typescript
  import WS from 'ws';
  const sdk = createArbitrageSDK({
    baseUrl: '...',
    wsUrl: '...',
    WebSocket: WS, // Explicit engine injection
  });
  ```
- **Exponential Backoff Reconnects:** Reconnects automatically on abnormal close codes (e.g. `1006`), utilizing an exponential sequence ($1\text{s}$, $2\text{s}$, $5\text{s}$, $10\text{s}$) up to 10 attempts.

### Event Handler Registrations

Subscribe to specific streams using strongly-typed methods. Each helper returns an **unsubscribe function** for immediate cleanup (highly convenient inside React `useEffect` hooks):

```typescript
// 1. Full State updates
const unsubState = sdk.ws.onState((state) => {
  console.log('Aggregated payload tick', state);
});

// 2. New Arbitrage Opportunity (Fires ONLY for new arrivals, in chronological order)
const unsubOpp = sdk.ws.onOpportunity((opp) => {
  console.log('🚨 Arbitrage window detected:', opp.netSpread);
});

// 3. New Simulated Trade Fills (Fires ONLY for new fills)
const unsubTrade = sdk.ws.onTrade((trade) => {
  console.log('💵 Trade executed!', trade.netProfit);
});

// 4. Flattened Wallet Balances (Flattens nested JSON maps automatically)
const unsubWallets = sdk.ws.onWallets((balances) => {
  console.log('Balances updated:', balances); // Array of WalletBalance[]
});

// 5. Bot configurations and exchange connections health status
const unsubStatus = sdk.ws.onBotStatus((status) => {
  console.log('Bot paused state:', status.isPaused);
});

// 6. Metrics Snapshot (P&L calculations, win rates, Sharpe ratio, risk statuses)
const unsubMetrics = sdk.ws.onMetrics((metrics) => {
  console.log('Win rate:', metrics.winRate, 'Sharpe Ratio:', metrics.sharpeRatio);
});

// Teardown example in React hooks
function cleanup() {
  unsubState();
  unsubOpp();
  unsubTrade();
  unsubWallets();
  unsubStatus();
  unsubMetrics();
}
```

---

## 🚨 Error Types

The SDK surfaces normalized errors to simplify integration audits:

1. **`HttpError`**
   - Raised when REST calls return a non-200 status code.
   - Properties: `statusCode` (number), `message` (string), `details` (any JSON body returned from server).
2. **`TimeoutError`**
   - Raised when REST responses exceed configured `timeoutMs` settings.
3. **`WebSocketError`**
   - Propagated via `sdk.ws.onError((err) => ...)` callbacks during connection failures or message parsing exceptions.
