import { EXCHANGES_METADATA } from '@arbitrage/config';

import { createChildLogger } from '../core/logging/logger.js';

type Wallets = Record<string, Record<string, { free: number; locked: number }>>;

export interface RebalanceTransfer {
  asset: 'BTC' | 'USDT';
  from: string;
  to: string;
  amount: number; // Gross amount debited from the sending venue.
  fee: number; // Transfer/withdrawal fee in the same asset.
  received: number; // Net amount credited to the receiving venue (amount - fee).
}

/**
 * Keeps simulated cross-venue inventory solvent the way a real arbitrage desk does:
 * by periodically transferring the asset that has piled up on the venues that keep
 * *buying* over to the venues that keep *selling* (and vice-versa for the quote asset).
 *
 * Without this, directed arbitrage drains BTC from the perennially-expensive venue and
 * USDT from the perennially-cheap one until trading stalls on "insufficient reserve".
 * Every transfer pays a realistic on-chain/stablecoin fee, so rebalancing is not free —
 * it slowly bleeds total inventory exactly as real settlement does.
 */
export class InventoryManager {
  // Trigger a rebalance once any venue's free balance for an asset drops below these.
  private static readonly LOW = { BTC: 0.5, USDT: 50000 } as const;
  // Don't move dust — minimum economically-sensible transfer size per asset.
  private static readonly MIN_TRANSFER = { BTC: 0.1, USDT: 5000 } as const;
  // Flat USDT settlement fee per transfer (≈ a TRC-20 stablecoin withdrawal).
  private static readonly USDT_TRANSFER_FEE = 1;

  private logger = createChildLogger({ component: 'InventoryManager' });

  /** True when at least one venue has run low enough on either asset to justify a transfer. */
  needsRebalance(wallets: Wallets, enabledExchanges: string[]): boolean {
    for (const exchangeId of enabledExchanges) {
      const w = wallets[exchangeId];
      if (!w) continue;
      if (w.BTC && w.BTC.free < InventoryManager.LOW.BTC) return true;
      if (w.USDT && w.USDT.free < InventoryManager.LOW.USDT) return true;
    }
    return false;
  }

  /**
   * Computes the set of transfers that flattens each asset back toward its cross-venue
   * mean (surplus venues fund deficit venues). Pure: does not mutate `wallets`.
   */
  computeTransfers(wallets: Wallets, enabledExchanges: string[]): RebalanceTransfer[] {
    const transfers: RebalanceTransfer[] = [];

    for (const asset of ['BTC', 'USDT'] as const) {
      const venues = enabledExchanges.filter((e) => wallets[e]?.[asset]);
      if (venues.length < 2) continue;

      const total = venues.reduce((sum, e) => sum + wallets[e][asset].free, 0);
      const target = total / venues.length;
      const min = InventoryManager.MIN_TRANSFER[asset];

      // Working copy of free balances so we can plan a multi-hop rebalance.
      const frees: Record<string, number> = {};
      for (const e of venues) frees[e] = wallets[e][asset].free;

      const surpluses = venues
        .filter((e) => frees[e] - target > min)
        .sort((a, b) => frees[b] - frees[a]);
      const deficits = venues
        .filter((e) => target - frees[e] > min)
        .sort((a, b) => frees[a] - frees[b]);

      let si = 0;
      let di = 0;
      while (si < surpluses.length && di < deficits.length) {
        const from = surpluses[si];
        const to = deficits[di];
        const canSend = frees[from] - target;
        const need = target - frees[to];
        const amount = Math.min(canSend, need);

        if (amount < min) {
          if (canSend <= need) si++;
          else di++;
          continue;
        }

        const fee =
          asset === 'BTC'
            ? EXCHANGES_METADATA[from]?.withdrawalFeeBTC ?? 0
            : InventoryManager.USDT_TRANSFER_FEE;
        const received = Math.max(0, amount - fee);

        transfers.push({ asset, from, to, amount, fee, received });

        frees[from] -= amount;
        frees[to] += received;
        if (frees[from] - target <= min) si++;
        if (target - frees[to] <= min) di++;
      }
    }

    return transfers;
  }

  /** Applies planned transfers in-place, debiting senders and crediting receivers net of fees. */
  applyTransfers(wallets: Wallets, transfers: RebalanceTransfer[]): void {
    for (const t of transfers) {
      const from = wallets[t.from]?.[t.asset];
      const to = wallets[t.to]?.[t.asset];
      if (!from || !to) continue;
      from.free -= t.amount;
      to.free += t.received;
    }
  }
}
