/**
 * One-shot smoke test for the real testnet execution path (SWING verification).
 * - binance | bybit | okx | coinbase: places a tiny real IOC BUY on the venue's test
 *   environment (fake funds) and prints the actual fill.
 * - kraken: Kraken has NO spot testnet, so instead of a fill this runs a signed
 *   `validate=true` dry-run — Kraken validates the order (balance/lot/price) but never
 *   executes and never returns a txid — and prints the validation result.
 * Run: pnpm --filter bot exec tsx src/testnetSmoke.ts [binance|bybit|okx|coinbase|kraken]
 */
import {
  placeTestnetOrder,
  isExecutionConfigured,
  isKrakenValidationConfigured,
  validateKrakenSpotOrder,
  type ExecVenue,
} from './exchanges/testnetExecutor.js';

async function tickerPrice(venue: string): Promise<number> {
  if (venue === 'binance') {
    const res = await fetch('https://testnet.binance.vision/api/v3/ticker/price?symbol=BTCUSDT');
    const { price } = (await res.json()) as { price: string };
    return Number(price);
  }
  if (venue === 'bybit') {
    const res = await fetch('https://api-testnet.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT');
    const data = (await res.json()) as { result?: { list?: Array<{ lastPrice?: string }> } };
    return Number(data.result?.list?.[0]?.lastPrice ?? 0);
  }
  if (venue === 'coinbase') {
    const res = await fetch('https://api-public.sandbox.exchange.coinbase.com/products/BTC-USD/ticker');
    const data = (await res.json()) as { price?: string };
    return Number(data.price ?? 0);
  }
  if (venue === 'kraken') {
    const res = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSD');
    const data = (await res.json()) as { result?: Record<string, { c?: string[] }> };
    const first = data.result ? Object.values(data.result)[0] : undefined;
    return Number(first?.c?.[0] ?? 0);
  }
  // okx
  const res = await fetch('https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT');
  const data = (await res.json()) as { data?: Array<{ last?: string }> };
  return Number(data.data?.[0]?.last ?? 0);
}

async function main() {
  const venue = process.argv[2] ?? 'binance';

  // Kraken: no spot testnet — run a signed validate=true dry-run instead of a real fill.
  if (venue === 'kraken') {
    console.log('kraken validation configured:', isKrakenValidationConfigured());
    const px = await tickerPrice('kraken');
    console.log('kraken BTCUSD price:', px);
    const result = await validateKrakenSpotOrder({
      side: 'BUY',
      symbol: 'BTCUSD',
      quantity: 0.0001,
      limitPrice: px * 0.5, // far from market; validate=true never executes regardless
    });
    console.log('KRAKEN VALIDATION (dry-run, no fill):', JSON.stringify(result, null, 2));
    process.exit(result.validated ? 0 : 1);
  }

  const execVenue = venue as ExecVenue;
  console.log(`${execVenue} testnet configured:`, isExecutionConfigured(execVenue));

  const px = await tickerPrice(execVenue);
  console.log(`${execVenue} testnet BTC price:`, px);

  const fill = await placeTestnetOrder({
    venue: execVenue,
    side: 'BUY',
    symbol: 'BTCUSDT', // canonical engine symbol; each venue maps it (coinbase → BTC-USD)
    quantity: 0.0001,
    limitPrice: px * 1.001, // marketable: crosses the book so the IOC fills now
  });
  console.log('FILL RESULT:', JSON.stringify(fill, null, 2));
  process.exit(fill.ok ? 0 : 1);
}

main().catch((e) => {
  console.error('SMOKE FAIL:', e);
  process.exit(1);
});
