import crypto from 'crypto';
import fs from 'fs/promises';

import { INITIAL_WALLET_BALANCES, DEFAULT_ENGINE_CONFIG } from '@arbitrage/config';
import { ArbitrageOpportunity, SimulatedTrade, EngineEvent, EngineConfig, AuditLogEntry } from '@arbitrage/core';

import { logger } from '../logging.js';

import { supabase } from './supabaseClient.js';

export function stringToUUID(str: string): string {
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join('-');
}


const DB_FILE = 'db.json';

interface LocalDBState {
  opportunities: ArbitrageOpportunity[];
  trades: SimulatedTrade[];
  events: EngineEvent[];
  balances: Record<string, Record<string, { free: number; locked: number }>>;
  config: EngineConfig;
  pnlHistory: { timestamp: number; value: number }[];
  copilotAudits: AuditLogEntry[];
  // True cumulative count of executed trades. The `trades` ledger above is capped at the
  // last 500 for display/memory, so its length must NOT be used as the trade count.
  totalTradesExecuted: number;
}

let dbState: LocalDBState = {
  opportunities: [],
  trades: [],
  events: [],
  balances: INITIAL_WALLET_BALANCES,
  config: DEFAULT_ENGINE_CONFIG,
  pnlHistory: [{ timestamp: Date.now(), value: 100000 }], // Starting with 100,000 USD portfolio value
  copilotAudits: [],
  totalTradesExecuted: 0,
};

// Asynchronously flushes local database state to disk (db.json)
async function flushToDisk() {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Failed to flush local database to disk', error);
  }
}

// Load database file from disk at startup
export async function initializeDatabase() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data);

    // Safety check & merge to keep the structure fully valid
    dbState = {
      opportunities: parsed.opportunities || [],
      trades: parsed.trades || [],
      events: parsed.events || [],
      balances: parsed.balances || JSON.parse(JSON.stringify(INITIAL_WALLET_BALANCES)),
      config: parsed.config || DEFAULT_ENGINE_CONFIG,
      pnlHistory: parsed.pnlHistory || [{ timestamp: Date.now(), value: 100000 }],
      copilotAudits: parsed.copilotAudits || [],
      // Restore the cumulative counter; seed it from the retained ledger length for older
      // db.json files that predate this field (a floor, never an over-count).
      totalTradesExecuted: parsed.totalTradesExecuted ?? (parsed.trades?.length || 0),
    };

    logger.info('💾 Loaded local persistent database from disk.');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      logger.info('💾 No database file found on disk. Initializing db.json...');
      await flushToDisk();
    } else {
      logger.error('Failed to read local persistent database file', error);
    }
  }

  // When the Supabase driver is active, rehydrate the in-memory state from Postgres so the
  // trade ledger and P&L survive a container restart/redeploy (the Fly filesystem — and
  // thus db.json — is ephemeral). Read paths serve dbState, so this is what actually makes
  // the cloud persistence visible in the dashboard. Fully guarded: any failure (e.g. a
  // missing table) falls back to whatever local/seed state we already have.
  if (supabase) {
    await hydrateFromSupabase();
  }
}

/**
 * Rehydrates the live in-memory ledger from Supabase at boot. Trades are restored at full
 * fidelity; the P&L equity curve is taken from `pnl_snapshots` when present, otherwise it
 * is reconstructed chronologically from the restored trades so the cumulative P&L is
 * correct even without that table. Opportunities are intentionally not restored — they
 * regenerate live within seconds and the persisted rows omit top-of-book prices.
 */
async function hydrateFromSupabase(): Promise<void> {
  if (!supabase) return;
  try {
    const { data: trades, error: tradesErr } = await supabase
      .from('simulated_trades')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(500);

    if (tradesErr) {
      logger.warn('Supabase hydration: could not load trades (' + tradesErr.message + '). Using local state.');
      return;
    }

    if (trades && trades.length > 0) {
      dbState.trades = trades.map((r: any) => ({
        id: r.id,
        opportunityId: r.opportunity_id ?? '',
        timestamp: new Date(r.executed_at).getTime(),
        buyExchange: r.buy_exchange,
        sellExchange: r.sell_exchange,
        symbol: r.symbol,
        buyPrice: Number(r.buy_price),
        sellPrice: Number(r.sell_price),
        volume: Number(r.volume),
        grossProfit: Number(r.gross_profit_usd),
        netProfit: Number(r.net_profit_usd),
        feesPaid: Number(r.fees_paid_usd),
        slippagePaid: Number(r.slippage_paid_usd),
      }));

      // Prefer a persisted equity curve; otherwise reconstruct it from the trade series.
      const { data: pnl } = await supabase
        .from('pnl_snapshots')
        .select('*')
        .order('timestamp', { ascending: true })
        .limit(1000);

      if (pnl && pnl.length > 0) {
        dbState.pnlHistory = pnl.map((r: any) => ({
          timestamp: new Date(r.timestamp).getTime(),
          value: Number(r.value),
        }));
      } else {
        const chrono = [...dbState.trades].sort((a, b) => a.timestamp - b.timestamp);
        let equity = 100000;
        const history = [{ timestamp: chrono[0].timestamp, value: equity }];
        for (const t of chrono) {
          equity += t.netProfit;
          history.push({ timestamp: t.timestamp, value: equity });
        }
        dbState.pnlHistory = history;
      }

      // The ledger above is capped at the last 500 rows; the true cumulative count is the
      // exact table count so totalTrades and avg/trade reflect the full executed history.
      const { count } = await supabase
        .from('simulated_trades')
        .select('id', { count: 'exact', head: true });
      dbState.totalTradesExecuted = count ?? dbState.trades.length;

      // Rehydrate historical EXECUTED opportunities from Supabase so the tab has historical data
      const { data: opps } = await supabase
        .from('arbitrage_opportunities')
        .select('*')
        .eq('status', 'EXECUTED')
        .order('detected_at', { ascending: false })
        .limit(200);

      if (opps && opps.length > 0) {
        dbState.opportunities = opps.map((r: any) => {
          const gross = Number(r.gross_spread ?? 0);
          const buyAsk = Number(r.buy_ask ?? 64000);
          const sellBid = Number(r.sell_bid ?? (buyAsk + gross));
          return {
            id: r.id,
            timestamp: new Date(r.detected_at || r.timestamp || Date.now()).getTime(),
            buyExchange: r.buy_exchange,
            sellExchange: r.sell_exchange,
            symbol: r.symbol,
            buyAsk,
            sellBid,
            grossSpread: gross,
            netSpread: Number(r.net_spread ?? 0),
            executableVolume: Number(r.volume ?? 0),
            expectedNetProfitUSD: Number(r.estimated_profit_usd ?? 0),
            status: r.status,
            reason: r.reason || undefined,
            zScore: 0,
          };
        });
        logger.info(`💾 Hydrated ${dbState.opportunities.length} executed opportunities from Supabase.`);
      }

      logger.info(`💾 Hydrated ${dbState.trades.length} trades from Supabase (ledger + P&L restored).`);
    }
  } catch (err) {
    logger.error('Supabase hydration failed; continuing with local state.', err);
  }
}

export async function saveOpportunity(opp: ArbitrageOpportunity): Promise<void> {
  dbState.opportunities.unshift(opp);
  if (dbState.opportunities.length > 500) dbState.opportunities.pop();
  await flushToDisk();

  if (supabase) {
    const { error } = await supabase.from('arbitrage_opportunities').insert({
      id: stringToUUID(opp.id),
      detected_at: new Date(opp.timestamp).toISOString(),
      buy_exchange: opp.buyExchange,
      sell_exchange: opp.sellExchange,
      symbol: opp.symbol,
      gross_spread: opp.grossSpread,
      net_spread: opp.netSpread,
      volume: opp.executableVolume,
      estimated_profit_usd: opp.expectedNetProfitUSD,
      status: opp.status,
      reason: opp.reason || null,
    });
    if (error) logger.error('Supabase saveOpportunity error:', error.message);
  }
}

export async function saveTrade(trade: SimulatedTrade): Promise<void> {
  dbState.trades.unshift(trade);
  if (dbState.trades.length > 500) dbState.trades.pop();
  dbState.totalTradesExecuted += 1;
  await flushToDisk();

  if (supabase) {
    const { error } = await supabase.from('simulated_trades').insert({
      id: stringToUUID(trade.id),
      opportunity_id: stringToUUID(trade.opportunityId),
      executed_at: new Date(trade.timestamp).toISOString(),
      buy_exchange: trade.buyExchange,
      sell_exchange: trade.sellExchange,
      symbol: trade.symbol,
      buy_price: trade.buyPrice,
      sell_price: trade.sellPrice,
      volume: trade.volume,
      gross_profit_usd: trade.grossProfit,
      net_profit_usd: trade.netProfit,
      fees_paid_usd: trade.feesPaid,
      slippage_paid_usd: trade.slippagePaid,
      latency_cost_usd: 0,
      buy_fill_ratio: 1.0,
      sell_fill_ratio: 1.0,
      status: 'SUCCESS',
      error_message: null,
    });
    if (error) logger.error('Supabase saveTrade error:', error.message);
  }
}

export async function saveEvent(event: EngineEvent): Promise<void> {
  dbState.events.unshift(event);
  if (dbState.events.length > 100) dbState.events.pop();
  await flushToDisk();

  if (supabase) {
    const { error } = await supabase.from('engine_events').insert({
      id: event.id,
      timestamp: new Date(event.timestamp).toISOString(),
      type: event.type,
      message: event.message,
    });
    if (error) logger.info('Supabase saveEvent info (table may be missing): ' + error.message);
  }
}

export async function saveBalances(balances: Record<string, Record<string, { free: number; locked: number }>>): Promise<void> {
  dbState.balances = balances;
  await flushToDisk();

  if (supabase) {
    for (const [exchangeId, assets] of Object.entries(balances)) {
      for (const [asset, bal] of Object.entries(assets)) {
        const { error } = await supabase.from('wallet_balances').upsert({
          id: stringToUUID(`${exchangeId}-${asset}`),
          exchange_id: exchangeId,
          asset: asset,
          free_amount: bal.free,
          locked_amount: bal.locked,
          updated_at: new Date().toISOString(),
        });
        if (error) logger.error('Supabase saveBalances error:', error.message);
      }
    }
  }
}

export async function loadBalances(): Promise<Record<string, Record<string, { free: number; locked: number }>> | null> {
  if (supabase) {
    const { data, error } = await supabase.from('wallet_balances').select('*');
    if (error) {
      logger.error('Supabase loadBalances error:', error.message);
      // Don't fall back to the in-memory seed here: returning it would make the caller
      // believe balances were restored from the cloud when they weren't. Signal "no
      // persisted state" so the engine keeps its own initial funding instead.
      return null;
    }
    if (data && data.length > 0) {
      const balances: any = {};
      for (const row of data) {
        if (!balances[row.exchange_id]) balances[row.exchange_id] = {};
        balances[row.exchange_id][row.asset] = {
          free: row.free_amount !== undefined ? row.free_amount : row.free,
          locked: row.locked_amount !== undefined ? row.locked_amount : row.locked
        };
      }
      dbState.balances = balances;
      return balances;
    }
    // Supabase reachable but no persisted balances yet (fresh project).
    return null;
  }
  return dbState.balances;
}

export async function saveConfig(cfg: EngineConfig): Promise<void> {
  dbState.config = cfg;
  await flushToDisk();

  if (supabase) {
    const { error } = await supabase.from('engine_config').upsert({
      id: 'current',
      config: JSON.stringify(cfg),
      updated_at: new Date().toISOString(),
    });
    if (error) logger.error('Supabase saveConfig error:', error.message);
  }
}

export async function loadConfig(): Promise<EngineConfig | null> {
  if (supabase) {
    const { data, error } = await supabase.from('engine_config').select('*').eq('id', 'current').maybeSingle();
    if (error) {
      logger.error('Supabase loadConfig error:', error.message);
      // Report "no persisted config" rather than silently masquerading the default as a
      // DB load — the caller seeds + persists defaults when it gets null.
      return null;
    }
    if (data) {
      dbState.config = typeof data.config === 'string' ? JSON.parse(data.config) : data.config;
      return dbState.config;
    }
    // Supabase reachable but no config row persisted yet.
    return null;
  }
  return dbState.config;
}

export async function savePnlSnapshot(value: number): Promise<void> {
  dbState.pnlHistory.push({ timestamp: Date.now(), value });
  if (dbState.pnlHistory.length > 500) dbState.pnlHistory.shift();
  await flushToDisk();

  if (supabase) {
    const { error } = await supabase.from('pnl_snapshots').insert({
      timestamp: new Date().toISOString(),
      value: value,
    });
    if (error) logger.info('Supabase savePnlSnapshot info (table may be missing): ' + error.message);
  }
}

export async function getOpportunities(limit = 100): Promise<ArbitrageOpportunity[]> {
  return dbState.opportunities.slice(0, limit);
}

/**
 * Returns up to `limit` recent opportunities with a status-balanced blend. Executions
 * persist on every tick while cost-rejected (SKIPPED) windows are throttled, so a plain
 * recency slice is almost entirely EXECUTED and the SKIPPED feed looks empty. This reserves
 * up to half the feed for the most recent SKIPPED windows and backfills the remainder with
 * executions, then restores chronological order. Falls back to plain recency when either
 * status is scarce. The frontend status filter operates on this blended set.
 */
export async function getBlendedOpportunities(limit = 50): Promise<ArbitrageOpportunity[]> {
  const all = dbState.opportunities; // already newest-first (unshift on save)
  const skipped = all.filter((o) => o.status === 'SKIPPED');
  const executed = all.filter((o) => o.status === 'EXECUTED');

  const skippedSlice = skipped.slice(0, Math.min(Math.floor(limit / 2), skipped.length));
  const execSlice = executed.slice(0, limit - skippedSlice.length);

  return [...skippedSlice, ...execSlice].sort((a, b) => b.timestamp - a.timestamp);
}

export async function getTrades(limit = 100): Promise<SimulatedTrade[]> {
  return dbState.trades.slice(0, limit);
}

export async function getEvents(limit = 50): Promise<EngineEvent[]> {
  return dbState.events.slice(0, limit);
}

export async function getPnlSnapshots(): Promise<{ timestamp: number; value: number }[]> {
  return dbState.pnlHistory;
}

// True cumulative number of executed trades (survives the 500-row ledger/snapshot caps).
export function getTotalTradesExecuted(): number {
  return dbState.totalTradesExecuted;
}

export async function resetSimulation(): Promise<void> {
  dbState.opportunities = [];
  dbState.trades = [];
  dbState.events = [];
  // Deep-clone so subsequent in-memory mutations (trades, rebalancing) never alias the
  // shared seed constant.
  dbState.balances = JSON.parse(JSON.stringify(INITIAL_WALLET_BALANCES));
  dbState.pnlHistory = [{ timestamp: Date.now(), value: 100000 }];
  dbState.totalTradesExecuted = 0;
  await flushToDisk();

  if (supabase) {
    await supabase.from('arbitrage_opportunities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('simulated_trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('engine_events').delete().neq('id', 'placeholder');
    // pnl_snapshots.id is a BIGINT identity — comparing it to a text placeholder throws a
    // Postgres type error (silently swallowed), which left the equity history unpurged and
    // let stale curves resurrect on every reboot. Filter on the numeric domain instead.
    await supabase.from('pnl_snapshots').delete().gte('id', 0);
    
    // Re-upsert default funding balances
    for (const [exchangeId, assets] of Object.entries(INITIAL_WALLET_BALANCES)) {
      for (const [asset, bal] of Object.entries(assets)) {
        await supabase.from('wallet_balances').upsert({
          id: stringToUUID(`${exchangeId}-${asset}`),
          exchange_id: exchangeId,
          asset: asset,
          free_amount: bal.free,
          locked_amount: bal.locked,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  logger.info('🔄 Database reset completed: all histories purged, wallet funding restored to defaults.');
}

export async function saveCopilotAuditLog(log: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<AuditLogEntry> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('copilot_audit_trail').insert({
        session_id: log.session_id,
        operator_id: log.operator_id,
        widget_source: log.widget_source,
        scenario_key: log.scenario_key,
        prompt_version: log.prompt_version,
        prompt_language: log.prompt_language,
        user_query: log.user_query,
        model_identifier: log.model_identifier,
        model_latency_ms: log.model_latency_ms,
        confidence_percentage: log.confidence_percentage,
        explainability_payload: log.explainability_payload,
        applied_parameters: log.applied_parameters,
        operator_action: log.operator_action,
        final_system_decision: log.final_system_decision,
      }).select().single();

      if (error) {
        logger.error('Supabase saveCopilotAuditLog error:', error.message);
        throw error;
      }
      dbState.copilotAudits.unshift(data);
      if (dbState.copilotAudits.length > 500) dbState.copilotAudits.pop();
      await flushToDisk();
      return data;
    } catch (err) {
      logger.error('Failed to write to Supabase copilot_audit_trail, falling back to disk', err);
    }
  }

  // Local JSON fallback
  const localLog: AuditLogEntry = {
    ...log,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  dbState.copilotAudits.unshift(localLog);
  if (dbState.copilotAudits.length > 500) dbState.copilotAudits.pop();
  await flushToDisk();
  return localLog;
}

export async function getCopilotAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('copilot_audit_trail')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Supabase getCopilotAuditLogs error:', error.message);
      } else if (data) {
        dbState.copilotAudits = data;
        return data;
      }
    } catch (err) {
      logger.error('Failed to read from Supabase copilot_audit_trail, falling back to disk', err);
    }
  }
  return dbState.copilotAudits.slice(0, limit);
}

