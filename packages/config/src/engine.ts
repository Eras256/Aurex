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
  maxTradesPerMinute: z.number().positive().default(30),
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
  maxTradesPerMinute: env.ENGINE_MAX_TRADES_PER_MINUTE !== undefined ? env.ENGINE_MAX_TRADES_PER_MINUTE : 30,
  enabledExchanges: ['binance', 'kraken', 'coinbase', 'okx', 'bybit'],
  enabledPairs: ['BTCUSDT'],
  isPaused: false,
});
