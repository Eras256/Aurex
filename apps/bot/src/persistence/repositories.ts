import crypto from 'crypto';
import fs from 'fs/promises';

import { INITIAL_WALLET_BALANCES, DEFAULT_ENGINE_CONFIG } from '@arbitrage/config';
import { ArbitrageOpportunity, SimulatedTrade, EngineEvent, EngineConfig } from '@arbitrage/core';

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
}

let dbState: LocalDBState = {
  opportunities: [],
  trades: [],
  events: [],
  balances: INITIAL_WALLET_BALANCES,
  config: DEFAULT_ENGINE_CONFIG,
  pnlHistory: [{ timestamp: Date.now(), value: 100000 }], // Starting with 100,000 USD portfolio value
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
      balances: parsed.balances || INITIAL_WALLET_BALANCES,
      config: parsed.config || DEFAULT_ENGINE_CONFIG,
      pnlHistory: parsed.pnlHistory || [{ timestamp: Date.now(), value: 100000 }],
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
    } else if (data && data.length > 0) {
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
    } else if (data) {
      dbState.config = typeof data.config === 'string' ? JSON.parse(data.config) : data.config;
      return dbState.config;
    }
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

export async function getTrades(limit = 100): Promise<SimulatedTrade[]> {
  return dbState.trades.slice(0, limit);
}

export async function getEvents(limit = 50): Promise<EngineEvent[]> {
  return dbState.events.slice(0, limit);
}

export async function getPnlSnapshots(): Promise<{ timestamp: number; value: number }[]> {
  return dbState.pnlHistory;
}

export async function resetSimulation(): Promise<void> {
  dbState.opportunities = [];
  dbState.trades = [];
  dbState.events = [];
  dbState.balances = INITIAL_WALLET_BALANCES;
  dbState.pnlHistory = [{ timestamp: Date.now(), value: 100000 }];
  await flushToDisk();

  if (supabase) {
    await supabase.from('arbitrage_opportunities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('simulated_trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('engine_events').delete().neq('id', 'placeholder');
    await supabase.from('pnl_snapshots').delete().neq('id', 'placeholder');
    
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
