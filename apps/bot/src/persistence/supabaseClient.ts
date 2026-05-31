import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

import { config } from '../config.js';
import { logger } from '../logging.js';

export const supabase =
  config.PERSISTENCE_DRIVER === 'supabase' && config.SUPABASE_URL && config.SUPABASE_KEY
    ? createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
        realtime: {
          transport: WebSocket as any,
        },
      })
    : null;

if (supabase) {
  logger.info('🔌 Connected to Supabase PostgreSQL database.');
} else {
  logger.info('💾 Supabase not configured or driver set to local. Using local JSON-backed dual persistence engine.');
}

