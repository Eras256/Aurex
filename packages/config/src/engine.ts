import { z } from 'zod';

import { env } from './env.js';

export const EngineConfigSchema = z.object({
  minNetProfitUSD: z.number().nonnegative().default(1.5),
  maxPositionBTCPerExchange: z.number().positive().default(2.0),
  maxPositionQuotePerExchange: z.number().positive().default(100000),
  latencySafetyBps: z.number().nonnegative().default(5),
  slippageSafetyBps: z.number().nonnegative().default(2),
  maxTradesPerMinute: z.number().positive().default(15),
  enabledExchanges: z.array(z.string()).default(['binance', 'kraken']),
  enabledPairs: z.array(z.string()).default(['BTCUSDT']),
  isPaused: z.boolean().default(false),
});

export type EngineConfig = z.infer<typeof EngineConfigSchema>;

export const DEFAULT_ENGINE_CONFIG: EngineConfig = EngineConfigSchema.parse({
  minNetProfitUSD: env.ENGINE_MIN_NET_PROFIT_USD !== undefined ? env.ENGINE_MIN_NET_PROFIT_USD : 1.5,
  maxPositionBTCPerExchange: env.ENGINE_MAX_POSITION_BTC_PER_EXCHANGE !== undefined ? env.ENGINE_MAX_POSITION_BTC_PER_EXCHANGE : 2.0,
  maxPositionQuotePerExchange: env.ENGINE_MAX_POSITION_QUOTE_PER_EXCHANGE !== undefined ? env.ENGINE_MAX_POSITION_QUOTE_PER_EXCHANGE : 100000,
  latencySafetyBps: env.ENGINE_LATENCY_SAFETY_BPS !== undefined ? env.ENGINE_LATENCY_SAFETY_BPS : 5,
  slippageSafetyBps: env.ENGINE_SLIPPAGE_SAFETY_BPS !== undefined ? env.ENGINE_SLIPPAGE_SAFETY_BPS : 2,
  maxTradesPerMinute: env.ENGINE_MAX_TRADES_PER_MINUTE !== undefined ? env.ENGINE_MAX_TRADES_PER_MINUTE : 15,
  enabledExchanges: ['binance', 'kraken'],
  enabledPairs: ['BTCUSDT'],
  isPaused: false,
});
