/**
 * One-shot smoke test for the real testnet execution path (SWING verification).
 * Places a tiny real IOC BUY on Binance Spot Testnet (fake funds) and prints the fill.
 * Run: pnpm --filter bot exec tsx src/testnetSmoke.ts
 */
import { placeTestnetOrder, isExecutionConfigured } from './exchanges/testnetExecutor.js';

async function main() {
  console.log('binance testnet configured:', isExecutionConfigured('binance'));

  const res = await fetch('https://testnet.binance.vision/api/v3/ticker/price?symbol=BTCUSDT');
  const { price } = (await res.json()) as { price: string };
  const px = Number(price);
  console.log('testnet BTCUSDT price:', px);

  const fill = await placeTestnetOrder({
    venue: 'binance',
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
