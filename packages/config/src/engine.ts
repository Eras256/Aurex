import { z } from 'zod';

import { env } from './env.js';

export const EngineConfigSchema = z.object({
  minNetProfitUSD: z.number().nonnegative().default(0.25),
  maxPositionBTCPerExchange: z.number().positive().default(5),
  maxPositionQuotePerExchange: z.number().positive().default(100000),
  // The L2 depth-walk already prices real slippage from book depth, so the extra
  // slippage cushion defaults to 0 (avoids double-counting); a 1bp latency buffer
  // models websocket transit drift for a low-latency execution path.
  latencySafetyBps: z.number().nonnegative().default(1),
  slippageSafetyBps: z.number().nonnegative().default(0),
  // Cost (bps of notional) charged when an arbitrage leg crosses quote currencies
  // (USD↔USDT). Realising a Coinbase/Kraken (USD) vs Binance/OKX/Bybit (USDT) spread
  // requires a stablecoin conversion. Coinbase lets you settle USDC↔USD 1:1 and USDC↔USDT
  // trades within ~1-3 bps of peg, so 3 bps is a realistic blended conversion cost — wide
  // enough to reject marginal cross-quote windows, tight enough that a genuine Coinbase
  // premium still clears. Set 0 to treat USD≈USDT 1:1.
  usdtUsdBasisBps: z.number().nonnegative().default(3),
  maxTradesPerMinute: z.number().positive().default(30),
  // Modeled order-routing-to-fill latency (ms). During this window the engine prices the
  // adverse price drift the taker is exposed to (volatility * sqrt(time)) and aborts a
  // window whose edge the move would wipe out. 75ms ≈ a realistic cross-venue REST fill path.
  executionLatencyMs: z.number().nonnegative().default(75),

  // --- Execution & sizing (parametrizable) ---
  // Depth-walk volume step (BTC) used when searching for the net-profit-maximizing size.
  sizingStepBTC: z.number().positive().default(0.05),
  // Per-pair post-capture cooldown (ms): once a dislocation is captured the pair is not
  // re-fired every tick, so cumulative returns stay realistic.
  executionCooldownMs: z.number().nonnegative().default(60000),
  // Multiple of the modeled adverse move beyond which a catastrophic spike pulls the order
  // before the second leg fills (slippage circuit breaker).
  circuitBreakerMult: z.number().positive().default(2.5),
  // Probability that an approved trade fills one leg and misses the other (leg-execution
  // risk), unwound at a realised loss. 0 disables modeled leg risk.
  legFillFailureProb: z.number().min(0).max(1).default(0.07),

  // --- Risk circuit breakers (parametrizable) ---
  // Gross spread as % of mid above which a window is treated as data lag / flash crash and
  // the engine halts (volatility spike breaker).
  volatilityBreakerPct: z.number().positive().default(8),
  // Consecutive realised losses that trip the cooldown breaker.
  consecutiveLossLimit: z.number().int().positive().default(3),
  // Cooldown (seconds) after the consecutive-loss breaker trips.
  lossCooldownSeconds: z.number().nonnegative().default(60),
  // Cooldown (seconds) after the volatility-spike breaker trips.
  volatilityCooldownSeconds: z.number().nonnegative().default(120),

  // --- Inventory rebalancing thresholds (parametrizable) ---
  // Trigger a rebalance once any venue's free balance drops below these.
  rebalanceLowBTC: z.number().nonnegative().default(0.5),
  rebalanceLowQuote: z.number().nonnegative().default(50000),
  // Don't move dust — minimum economically-sensible transfer size per asset.
  rebalanceMinTransferBTC: z.number().nonnegative().default(0.1),
  rebalanceMinTransferQuote: z.number().nonnegative().default(5000),

  // --- Statistical-arbitrage gating (parametrizable) ---
  // When enabled, only windows whose rolling z-score exceeds the threshold are executed,
  // prioritising anomalous, mean-reverting dislocations over merely-positive spreads.
  zScoreGateEnabled: z.boolean().default(false),
  zScoreGateThreshold: z.number().default(1.0),

  // Per-exchange taker fee overrides (bps). Empty = use venue defaults (VIP-tier). Lets the
  // operator switch to retail tiers or custom fees at runtime without a redeploy.
  takerFeeBpsOverrides: z.record(z.string(), z.number().nonnegative()).default({}),

  enabledExchanges: z.array(z.string()).default(['binance', 'kraken', 'coinbase', 'okx', 'bybit']),
  enabledPairs: z.array(z.string()).default(['BTCUSDT']),
  isPaused: z.boolean().default(false),
});

export type EngineConfig = z.infer<typeof EngineConfigSchema>;

export const DEFAULT_ENGINE_CONFIG: EngineConfig = EngineConfigSchema.parse({
  minNetProfitUSD: env.ENGINE_MIN_NET_PROFIT_USD !== undefined ? env.ENGINE_MIN_NET_PROFIT_USD : 0.25,
  maxPositionBTCPerExchange: env.ENGINE_MAX_POSITION_BTC_PER_EXCHANGE !== undefined ? env.ENGINE_MAX_POSITION_BTC_PER_EXCHANGE : 5,
  maxPositionQuotePerExchange: env.ENGINE_MAX_POSITION_QUOTE_PER_EXCHANGE !== undefined ? env.ENGINE_MAX_POSITION_QUOTE_PER_EXCHANGE : 100000,
  latencySafetyBps: env.ENGINE_LATENCY_SAFETY_BPS !== undefined ? env.ENGINE_LATENCY_SAFETY_BPS : 1,
  slippageSafetyBps: env.ENGINE_SLIPPAGE_SAFETY_BPS !== undefined ? env.ENGINE_SLIPPAGE_SAFETY_BPS : 0,
  usdtUsdBasisBps: env.ENGINE_USDT_USD_BASIS_BPS !== undefined ? env.ENGINE_USDT_USD_BASIS_BPS : 3,
  maxTradesPerMinute: env.ENGINE_MAX_TRADES_PER_MINUTE !== undefined ? env.ENGINE_MAX_TRADES_PER_MINUTE : 30,
  executionLatencyMs: env.ENGINE_EXECUTION_LATENCY_MS !== undefined ? env.ENGINE_EXECUTION_LATENCY_MS : 75,
  enabledExchanges: ['binance', 'kraken', 'coinbase', 'okx', 'bybit'],
  enabledPairs: ['BTCUSDT'],
  isPaused: false,
});
