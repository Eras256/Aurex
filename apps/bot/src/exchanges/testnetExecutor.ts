import crypto from 'node:crypto';

import { env } from '@arbitrage/config';

import { createChildLogger } from '../core/logging/logger.js';

/**
 * Real-execution adapter for exchange TESTNET / DEMO matching engines.
 *
 * This is the bridge from "simulator" to "actually places orders": when the engine runs in
 * `executionMode: 'testnet'`, each arbitrage leg is sent as a real IOC order to a venue's
 * test environment — Binance Spot Testnet (https://testnet.binance.vision), OKX Demo Trading
 * (production API + `x-simulated-trading: 1`), Bybit Testnet, and Coinbase Exchange Sandbox
 * (https://api-public.sandbox.exchange.coinbase.com). These use fake balances, so no real
 * funds are ever at risk, but the orders are matched by the real engines, returning real
 * (and realistically partial / rejected) fills.
 *
 * Kraken is intentionally NOT an execution venue: Kraken offers no spot testnet, so it is
 * handled separately via `validateKrakenSpotOrder` (a `validate=true` dry-run that never
 * executes and never books a fill — see below), and is kept out of the execution path.
 *
 * Credentials are read from env (gitignored) and never logged. If a venue is not configured
 * or a request fails, the caller falls back to the internal simulator for that trade.
 */

const logger = createChildLogger({ component: 'TestnetExecutor' });

export type ExecVenue = 'binance' | 'okx' | 'bybit' | 'coinbase';

export interface PlaceOrderParams {
  venue: ExecVenue;
  side: 'BUY' | 'SELL';
  symbol: string; // canonical engine symbol, e.g. 'BTCUSDT'
  quantity: number; // base-asset quantity
  limitPrice: number; // marketable limit price
}

export interface FillResult {
  ok: boolean; // request succeeded (the order was accepted by the venue)
  filledQty: number; // base-asset quantity actually filled (0 for an IOC that didn't cross)
  avgPrice: number; // volume-weighted fill price (0 when nothing filled)
  status: string; // venue order status (FILLED / PARTIALLY_FILLED / EXPIRED / REJECTED / ...)
  venue: ExecVenue;
  error?: string;
}

/** True when the venue has testnet/demo credentials configured. */
export function isExecutionConfigured(venue: ExecVenue): boolean {
  if (venue === 'binance') return Boolean(env.BINANCE_TESTNET_API_KEY && env.BINANCE_TESTNET_API_SECRET);
  if (venue === 'okx') return Boolean(env.OKX_DEMO_API_KEY && env.OKX_DEMO_API_SECRET && env.OKX_DEMO_PASSPHRASE);
  if (venue === 'bybit') return Boolean(env.BYBIT_TESTNET_API_KEY && env.BYBIT_TESTNET_API_SECRET);
  if (venue === 'coinbase')
    return Boolean(env.COINBASE_SANDBOX_API_KEY && env.COINBASE_SANDBOX_API_SECRET && env.COINBASE_SANDBOX_PASSPHRASE);
  return false;
}

/** Which venues can currently execute live (for health/UI surfaces). */
export function executionVenuesStatus(): Record<ExecVenue, boolean> {
  return {
    binance: isExecutionConfigured('binance'),
    okx: isExecutionConfigured('okx'),
    bybit: isExecutionConfigured('bybit'),
    coinbase: isExecutionConfigured('coinbase'),
  };
}

// NOTE: real exchanges enforce LOT_SIZE / PRICE_FILTER tick rules. These conservative
// per-venue precisions match the live BTC-USDT test instruments (verified against each
// venue's instrument-info endpoint); a production build would fetch them dynamically.
// Binance testnet PRICE_FILTER tick = 0.01 (2dp); Bybit/OKX tick = 0.1 (1dp).
const PRICE_DECIMALS: Record<ExecVenue, number> = { binance: 2, bybit: 1, okx: 1, coinbase: 2 };
const fmtQty = (q: number): string => q.toFixed(5);
const fmtPrice = (p: number, venue: ExecVenue): string => p.toFixed(PRICE_DECIMALS[venue]);

/** Canonical engine symbol (BTCUSDT) → OKX instrument id (BTC-USDT). */
function toOkxInstId(symbol: string): string {
  if (symbol.endsWith('USDT')) return `${symbol.slice(0, -4)}-USDT`;
  if (symbol.endsWith('USD')) return `${symbol.slice(0, -3)}-USD`;
  return symbol;
}

/**
 * Canonical engine symbol (BTCUSDT) → Coinbase product id. Coinbase is modelled as a USD
 * venue in this engine (the USD/USDT basis is priced into the cost model), so the USDT
 * symbol maps to the USD product, e.g. BTCUSDT → BTC-USD.
 */
function toCoinbaseProductId(symbol: string): string {
  if (symbol.endsWith('USDT')) return `${symbol.slice(0, -4)}-USD`;
  if (symbol.endsWith('USD')) return `${symbol.slice(0, -3)}-USD`;
  return symbol;
}

/**
 * Place a real IOC order on the venue's testnet/demo. Never throws — any failure resolves to
 * `{ ok: false, ... }` so the engine can fall back to simulated execution for that trade.
 */
export async function placeTestnetOrder(p: PlaceOrderParams): Promise<FillResult> {
  try {
    if (p.venue === 'binance') return await placeBinanceTestnet(p);
    if (p.venue === 'okx') return await placeOkxDemo(p);
    if (p.venue === 'bybit') return await placeBybitTestnet(p);
    if (p.venue === 'coinbase') return await placeCoinbaseSandbox(p);
    return { ok: false, filledQty: 0, avgPrice: 0, status: 'UNSUPPORTED', venue: p.venue, error: 'Unsupported venue' };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn({ eventType: 'WARNING', venue: p.venue, error }, '⚠️ Testnet order failed; caller will fall back to sim.');
    return { ok: false, filledQty: 0, avgPrice: 0, status: 'ERROR', venue: p.venue, error };
  }
}

/** Binance Spot Testnet: signed POST /api/v3/order (HMAC-SHA256). Returns fills inline. */
async function placeBinanceTestnet(p: PlaceOrderParams): Promise<FillResult> {
  const key = env.BINANCE_TESTNET_API_KEY;
  const secret = env.BINANCE_TESTNET_API_SECRET;
  if (!key || !secret) {
    return { ok: false, filledQty: 0, avgPrice: 0, status: 'UNCONFIGURED', venue: 'binance', error: 'No testnet credentials' };
  }

  const params = new URLSearchParams({
    symbol: p.symbol,
    side: p.side,
    type: 'LIMIT',
    timeInForce: 'IOC',
    quantity: fmtQty(p.quantity),
    price: fmtPrice(p.limitPrice, 'binance'),
    recvWindow: '5000',
    timestamp: Date.now().toString(),
  });
  const signature = crypto.createHmac('sha256', secret).update(params.toString()).digest('hex');
  params.append('signature', signature);

  const res = await fetch(`${env.BINANCE_TESTNET_REST_URL}/api/v3/order`, {
    method: 'POST',
    headers: { 'X-MBX-APIKEY': key, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = (await res.json()) as {
    status?: string;
    executedQty?: string;
    cummulativeQuoteQty?: string;
    msg?: string;
  };

  if (!res.ok) {
    return { ok: false, filledQty: 0, avgPrice: 0, status: 'REJECTED', venue: 'binance', error: data?.msg ?? `HTTP ${res.status}` };
  }

  const filledQty = Number(data.executedQty ?? 0);
  const quote = Number(data.cummulativeQuoteQty ?? 0);
  const avgPrice = filledQty > 0 ? quote / filledQty : 0;
  return { ok: true, filledQty, avgPrice, status: data.status ?? 'UNKNOWN', venue: 'binance' };
}

/** OKX Demo: signed POST /api/v5/trade/order, then a signed read for the realised fill. */
async function placeOkxDemo(p: PlaceOrderParams): Promise<FillResult> {
  const key = env.OKX_DEMO_API_KEY;
  const secret = env.OKX_DEMO_API_SECRET;
  const passphrase = env.OKX_DEMO_PASSPHRASE;
  if (!key || !secret || !passphrase) {
    return { ok: false, filledQty: 0, avgPrice: 0, status: 'UNCONFIGURED', venue: 'okx', error: 'No demo credentials' };
  }

  const instId = toOkxInstId(p.symbol);
  const path = '/api/v5/trade/order';
  const body = JSON.stringify({
    instId,
    tdMode: 'cash',
    side: p.side.toLowerCase(),
    ordType: 'ioc',
    sz: fmtQty(p.quantity),
    px: fmtPrice(p.limitPrice, 'okx'),
  });

  const ack = (await okxRequest('POST', path, body)) as {
    code?: string;
    msg?: string;
    data?: Array<{ ordId?: string; sCode?: string; sMsg?: string }>;
  };
  const order = ack?.data?.[0];
  if (ack?.code !== '0' || !order || order.sCode !== '0' || !order.ordId) {
    return { ok: false, filledQty: 0, avgPrice: 0, status: 'REJECTED', venue: 'okx', error: order?.sMsg ?? ack?.msg ?? 'OKX order rejected' };
  }

  // The order ack carries no fill detail; read the order back for the realised fill.
  const readPath = `/api/v5/trade/order?instId=${instId}&ordId=${order.ordId}`;
  const read = (await okxRequest('GET', readPath, '')) as {
    code?: string;
    data?: Array<{ accFillSz?: string; avgPx?: string; state?: string }>;
  };
  const fill = read?.data?.[0];
  const filledQty = Number(fill?.accFillSz ?? 0);
  const avgPrice = Number(fill?.avgPx ?? 0);
  return { ok: true, filledQty, avgPrice, status: fill?.state ?? 'unknown', venue: 'okx' };
}

/**
 * Bybit Testnet: signed POST /v5/order/create (spot IOC limit), then a signed read of
 * order history for the realised fill. V5 signing: HMAC-SHA256 hex of
 * `timestamp + apiKey + recvWindow + (rawBody | queryString)` via X-BAPI-* headers.
 */
async function placeBybitTestnet(p: PlaceOrderParams): Promise<FillResult> {
  const key = env.BYBIT_TESTNET_API_KEY;
  const secret = env.BYBIT_TESTNET_API_SECRET;
  if (!key || !secret) {
    return { ok: false, filledQty: 0, avgPrice: 0, status: 'UNCONFIGURED', venue: 'bybit', error: 'No testnet credentials' };
  }

  const body = JSON.stringify({
    category: 'spot',
    symbol: p.symbol,
    side: p.side === 'BUY' ? 'Buy' : 'Sell',
    orderType: 'Limit',
    timeInForce: 'IOC',
    qty: fmtQty(p.quantity),
    price: fmtPrice(p.limitPrice, 'bybit'),
  });

  const ack = (await bybitRequest('POST', '/v5/order/create', body)) as {
    retCode?: number;
    retMsg?: string;
    result?: { orderId?: string };
  };
  if (ack?.retCode !== 0 || !ack.result?.orderId) {
    return { ok: false, filledQty: 0, avgPrice: 0, status: 'REJECTED', venue: 'bybit', error: ack?.retMsg ?? 'Bybit order rejected' };
  }

  // The create ack carries no fill detail, and the just-closed IOC takes a moment to appear
  // in the order queries — poll briefly (realtime first, history as fallback).
  const query = `category=spot&orderId=${ack.result.orderId}`;
  type BybitOrder = { cumExecQty?: string; avgPrice?: string; orderStatus?: string };
  let order: BybitOrder | undefined;
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    for (const path of ['/v5/order/realtime', '/v5/order/history']) {
      const read = (await bybitRequest('GET', `${path}?${query}`, query)) as {
        result?: { list?: BybitOrder[] };
      };
      order = read?.result?.list?.[0];
      if (order) break;
    }
  }
  const filledQty = Number(order?.cumExecQty ?? 0);
  const avgPrice = Number(order?.avgPrice ?? 0);
  return { ok: true, filledQty, avgPrice, status: order?.orderStatus ?? 'UNKNOWN', venue: 'bybit' };
}

/** Signed Bybit v5 request. `payload` is the raw JSON body (POST) or query string (GET). */
async function bybitRequest(method: 'GET' | 'POST', pathWithQuery: string, payload: string): Promise<unknown> {
  const key = env.BYBIT_TESTNET_API_KEY as string;
  const secret = env.BYBIT_TESTNET_API_SECRET as string;
  const ts = Date.now().toString();
  const recvWindow = '5000';
  const sign = crypto.createHmac('sha256', secret).update(ts + key + recvWindow + payload).digest('hex');
  const res = await fetch(`${env.BYBIT_TESTNET_REST_URL}${pathWithQuery}`, {
    method,
    headers: {
      'X-BAPI-API-KEY': key,
      'X-BAPI-TIMESTAMP': ts,
      'X-BAPI-RECV-WINDOW': recvWindow,
      'X-BAPI-SIGN': sign,
      'Content-Type': 'application/json',
    },
    ...(method === 'POST' ? { body: payload } : {}),
  });
  return res.json();
}

/** Signed OKX request (demo). Sign = base64(HMAC-SHA256(ts + method + path + body)). */
async function okxRequest(method: 'GET' | 'POST', path: string, body: string): Promise<unknown> {
  const secret = env.OKX_DEMO_API_SECRET as string;
  const ts = new Date().toISOString();
  const sign = crypto.createHmac('sha256', secret).update(ts + method + path + body).digest('base64');
  const res = await fetch(`${env.OKX_REST_URL}${path}`, {
    method,
    headers: {
      'OK-ACCESS-KEY': env.OKX_DEMO_API_KEY as string,
      'OK-ACCESS-SIGN': sign,
      'OK-ACCESS-TIMESTAMP': ts,
      'OK-ACCESS-PASSPHRASE': env.OKX_DEMO_PASSPHRASE as string,
      'x-simulated-trading': '1',
      'Content-Type': 'application/json',
    },
    ...(method === 'POST' ? { body } : {}),
  });
  return res.json();
}

/**
 * Coinbase Exchange Sandbox: signed POST /orders (limit IOC), then a signed read of the
 * order for the realised fill. The sandbox matches on a real engine with test funds.
 */
async function placeCoinbaseSandbox(p: PlaceOrderParams): Promise<FillResult> {
  const key = env.COINBASE_SANDBOX_API_KEY;
  const secret = env.COINBASE_SANDBOX_API_SECRET;
  const passphrase = env.COINBASE_SANDBOX_PASSPHRASE;
  if (!key || !secret || !passphrase) {
    return { ok: false, filledQty: 0, avgPrice: 0, status: 'UNCONFIGURED', venue: 'coinbase', error: 'No sandbox credentials' };
  }

  const productId = toCoinbaseProductId(p.symbol);
  const body = JSON.stringify({
    product_id: productId,
    side: p.side.toLowerCase(),
    type: 'limit',
    time_in_force: 'IOC',
    price: fmtPrice(p.limitPrice, 'coinbase'),
    size: fmtQty(p.quantity),
  });

  const ack = (await coinbaseRequest('POST', '/orders', body)) as { id?: string; message?: string };
  if (!ack?.id) {
    return { ok: false, filledQty: 0, avgPrice: 0, status: 'REJECTED', venue: 'coinbase', error: ack?.message ?? 'Coinbase order rejected' };
  }

  // The create ack carries no fill detail; read the order back for the realised fill.
  const read = (await coinbaseRequest('GET', `/orders/${ack.id}`, '')) as {
    filled_size?: string;
    executed_value?: string;
    status?: string;
  };
  const filledQty = Number(read?.filled_size ?? 0);
  const quote = Number(read?.executed_value ?? 0);
  const avgPrice = filledQty > 0 ? quote / filledQty : 0;
  return { ok: true, filledQty, avgPrice, status: read?.status ?? 'unknown', venue: 'coinbase' };
}

/**
 * Signed Coinbase Exchange request. Sign = base64(HMAC-SHA256(timestamp + method + path +
 * body)) keyed by the base64-DECODED secret; timestamp is Unix seconds. (Both differ from
 * OKX, which uses the raw secret and an ISO timestamp — do not conflate them.)
 */
async function coinbaseRequest(method: 'GET' | 'POST', path: string, body: string): Promise<unknown> {
  const key = env.COINBASE_SANDBOX_API_KEY as string;
  const secret = env.COINBASE_SANDBOX_API_SECRET as string;
  const passphrase = env.COINBASE_SANDBOX_PASSPHRASE as string;
  const timestamp = (Date.now() / 1000).toString();
  const prehash = timestamp + method + path + body;
  const hmacKey = Buffer.from(secret, 'base64');
  const sign = crypto.createHmac('sha256', hmacKey).update(prehash).digest('base64');
  const res = await fetch(`${env.COINBASE_SANDBOX_REST_URL}${path}`, {
    method,
    headers: {
      'CB-ACCESS-KEY': key,
      'CB-ACCESS-SIGN': sign,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'CB-ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json',
    },
    ...(method === 'POST' ? { body } : {}),
  });
  return res.json();
}

// ---------------------------------------------------------------------------------------
// Kraken — validate-only (NO real fills). Kraken has no spot testnet, so this is a genuine
// pre-flight check, never an execution. Deliberately kept out of ExecVenue / FillResult so
// it can never be mistaken for, or booked as, a real trade.
// ---------------------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean; // the request reached Kraken and returned a structured response
  validated: boolean; // Kraken accepted the order parameters (it would be placeable)
  venue: 'kraken';
  descr?: string; // the order description Kraken echoes back on a successful validation
  error?: string;
}

/** True when Kraken API credentials for dry-run validation are configured. */
export function isKrakenValidationConfigured(): boolean {
  return Boolean(env.KRAKEN_API_KEY && env.KRAKEN_API_SECRET);
}

/** Canonical engine symbol (BTCUSDT) → Kraken pair (Kraken uses XBT for BTC). */
function toKrakenPair(symbol: string): string {
  const withXbt = symbol.startsWith('BTC') ? `XBT${symbol.slice(3)}` : symbol;
  return withXbt; // e.g. BTCUSDT → XBTUSDT, BTCUSD → XBTUSD
}

/**
 * Kraken has NO spot testnet. This performs a REAL, signed AddOrder with `validate=true`,
 * which runs Kraken's full order validation (balance / lot size / price / pair) WITHOUT
 * executing and WITHOUT returning a txid — a genuine pre-flight check, never a fill. It is
 * intentionally NOT part of the arbitrage execution path (it can never book a trade), and
 * never throws — any failure resolves to `{ ok: false, ... }`.
 */
export async function validateKrakenSpotOrder(p: Omit<PlaceOrderParams, 'venue'>): Promise<ValidationResult> {
  try {
    const key = env.KRAKEN_API_KEY;
    const secret = env.KRAKEN_API_SECRET;
    if (!key || !secret) {
      return { ok: false, validated: false, venue: 'kraken', error: 'No Kraken API credentials' };
    }

    const path = '/0/private/AddOrder';
    const nonce = Date.now().toString();
    const postData = new URLSearchParams({
      nonce,
      pair: toKrakenPair(p.symbol),
      type: p.side.toLowerCase(),
      ordertype: 'limit',
      price: p.limitPrice.toFixed(1),
      volume: fmtQty(p.quantity),
      validate: 'true', // dry-run: validate only, never execute
    }).toString();

    // Kraken signing: API-Sign = base64(HMAC-SHA512(path + SHA256(nonce + postData), key)),
    // where key is the base64-decoded secret.
    const sha256 = crypto.createHash('sha256').update(nonce + postData).digest();
    const hmacKey = Buffer.from(secret, 'base64');
    const sign = crypto
      .createHmac('sha512', hmacKey)
      .update(Buffer.concat([Buffer.from(path, 'utf8'), sha256]))
      .digest('base64');

    const res = await fetch(`${env.KRAKEN_REST_URL}${path}`, {
      method: 'POST',
      headers: { 'API-Key': key, 'API-Sign': sign, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postData,
    });
    const data = (await res.json()) as { error?: string[]; result?: { descr?: { order?: string } } };
    const errs = data.error ?? [];
    if (errs.length > 0) {
      return { ok: true, validated: false, venue: 'kraken', error: errs.join('; ') };
    }
    return { ok: true, validated: true, venue: 'kraken', descr: data.result?.descr?.order };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn({ eventType: 'WARNING', venue: 'kraken', error }, '⚠️ Kraken validation request failed.');
    return { ok: false, validated: false, venue: 'kraken', error };
  }
}
