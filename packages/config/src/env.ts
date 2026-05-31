import { z } from 'zod';

declare const process: {
  env: Record<string, string | undefined>;
};

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.preprocess((val) => {
    if (val === undefined || val === '') return 3001;
    const num = Number(val);
    return isNaN(num) ? 3001 : num;
  }, z.number().default(3001)),
  SUPABASE_URL: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
  SUPABASE_KEY: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  PERSISTENCE_DRIVER: z.enum(['local', 'supabase']).default('local'),
  BINANCE_WS_URL: z.string().url().default('wss://stream.binance.com:9443/ws'),
  BINANCE_REST_URL: z.string().url().default('https://api.binance.com'),
  KRAKEN_WS_URL: z.string().url().default('wss://ws.kraken.com'),
  KRAKEN_REST_URL: z.string().url().default('https://api.kraken.com'),
  COINBASE_WS_URL: z.string().url().default('wss://advanced-trade-ws.coinbase.com'),
  OKX_WS_URL: z.string().url().default('wss://ws.okx.com:8443/ws/v5/public'),
  BYBIT_WS_URL: z.string().url().default('wss://stream.bybit.com/v5/public/spot'),
  SQLITE_DB_PATH: z.string().default('db.sqlite'),
  API_KEY: z.string().default('dev-api-key-12345'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  NEXT_PUBLIC_BACKEND_URL: z.string().url().default('http://localhost:3001'),
  // Optional Engine Overrides
  ENGINE_MIN_NET_PROFIT_USD: z.preprocess((val) => (val === undefined || val === '' ? undefined : Number(val)), z.number().optional()),
  ENGINE_MAX_POSITION_BTC_PER_EXCHANGE: z.preprocess((val) => (val === undefined || val === '' ? undefined : Number(val)), z.number().optional()),
  ENGINE_MAX_POSITION_QUOTE_PER_EXCHANGE: z.preprocess((val) => (val === undefined || val === '' ? undefined : Number(val)), z.number().optional()),
  ENGINE_LATENCY_SAFETY_BPS: z.preprocess((val) => (val === undefined || val === '' ? undefined : Number(val)), z.number().optional()),
  ENGINE_SLIPPAGE_SAFETY_BPS: z.preprocess((val) => (val === undefined || val === '' ? undefined : Number(val)), z.number().optional()),
  ENGINE_MAX_TRADES_PER_MINUTE: z.preprocess((val) => (val === undefined || val === '' ? undefined : Number(val)), z.number().optional()),
  ENGINE_USDT_USD_BASIS_BPS: z.preprocess((val) => (val === undefined || val === '' ? undefined : Number(val)), z.number().optional()),
});

export type Env = z.infer<typeof EnvSchema>;

const getEnv = (): Env => {
  const envSource = {
    NODE_ENV: typeof process !== 'undefined' ? process.env.NODE_ENV : undefined,
    PORT: typeof process !== 'undefined' ? process.env.PORT : undefined,
    SUPABASE_URL: typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined,
    // Accept either SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY as fallback
    SUPABASE_KEY: typeof process !== 'undefined' ? (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) : undefined,
    PERSISTENCE_DRIVER: typeof process !== 'undefined' ? process.env.PERSISTENCE_DRIVER : undefined,
    BINANCE_WS_URL: typeof process !== 'undefined' ? process.env.BINANCE_WS_URL : undefined,
    BINANCE_REST_URL: typeof process !== 'undefined' ? process.env.BINANCE_REST_URL : undefined,
    KRAKEN_WS_URL: typeof process !== 'undefined' ? process.env.KRAKEN_WS_URL : undefined,
    KRAKEN_REST_URL: typeof process !== 'undefined' ? process.env.KRAKEN_REST_URL : undefined,
    COINBASE_WS_URL: typeof process !== 'undefined' ? process.env.COINBASE_WS_URL : undefined,
    OKX_WS_URL: typeof process !== 'undefined' ? process.env.OKX_WS_URL : undefined,
    BYBIT_WS_URL: typeof process !== 'undefined' ? process.env.BYBIT_WS_URL : undefined,
    SQLITE_DB_PATH: typeof process !== 'undefined' ? process.env.SQLITE_DB_PATH : undefined,
    API_KEY: typeof process !== 'undefined' ? process.env.API_KEY : undefined,
    ALLOWED_ORIGINS: typeof process !== 'undefined' ? process.env.ALLOWED_ORIGINS : undefined,
    NEXT_PUBLIC_BACKEND_URL: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_BACKEND_URL : undefined,
    ENGINE_MIN_NET_PROFIT_USD: typeof process !== 'undefined' ? process.env.ENGINE_MIN_NET_PROFIT_USD : undefined,
    ENGINE_MAX_POSITION_BTC_PER_EXCHANGE: typeof process !== 'undefined' ? process.env.ENGINE_MAX_POSITION_BTC_PER_EXCHANGE : undefined,
    ENGINE_MAX_POSITION_QUOTE_PER_EXCHANGE: typeof process !== 'undefined' ? process.env.ENGINE_MAX_POSITION_QUOTE_PER_EXCHANGE : undefined,
    ENGINE_LATENCY_SAFETY_BPS: typeof process !== 'undefined' ? process.env.ENGINE_LATENCY_SAFETY_BPS : undefined,
    ENGINE_SLIPPAGE_SAFETY_BPS: typeof process !== 'undefined' ? process.env.ENGINE_SLIPPAGE_SAFETY_BPS : undefined,
    ENGINE_MAX_TRADES_PER_MINUTE: typeof process !== 'undefined' ? process.env.ENGINE_MAX_TRADES_PER_MINUTE : undefined,
    ENGINE_USDT_USD_BASIS_BPS: typeof process !== 'undefined' ? process.env.ENGINE_USDT_USD_BASIS_BPS : undefined,
  };

  try {
    return EnvSchema.parse(envSource);
  } catch (error: any) {
    console.error('❌ Environment validation failed:', error.format ? error.format() : error);
    throw error;
  }
};

export const env = getEnv();
