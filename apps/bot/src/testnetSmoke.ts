/**
 * One-shot smoke test for the real testnet execution path (SWING verification).
 * Places a tiny real IOC BUY on the chosen venue's test environment (fake funds)
 * and prints the actual fill.
 * Run: pnpm --filter bot exec tsx src/testnetSmoke.ts [binance|bybit|okx]
 */
import { placeTestnetOrder, isExecutionConfigured, type ExecVenue } from './exchanges/testnetExecutor.js';

async function tickerPrice(venue: ExecVenue): Promise<number> {
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
  const res = await fetch('https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT');
  const data = (await res.json()) as { data?: Array<{ last?: string }> };
  return Number(data.data?.[0]?.last ?? 0);
}

async function main() {
  const venue = (process.argv[2] ?? 'binance') as ExecVenue;
  console.log(`${venue} testnet configured:`, isExecutionConfigured(venue));

  const px = await tickerPrice(venue);
  console.log(`${venue} testnet BTCUSDT price:`, px);

  const fill = await placeTestnetOrder({
    venue,
    side: 'BUY',
    symbol: 'BTCUSDT',
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
