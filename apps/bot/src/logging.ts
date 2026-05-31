import { createChildLogger, baseLogger, LogContext } from './core/logging/logger.js';

type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'RISK_ALERT' | 'TRADE_EXECUTION';

class Logger {
  info(msg: string) {
    baseLogger.info({ eventType: 'INFO' }, msg);
  }

  warn(msg: string) {
    baseLogger.warn({ eventType: 'WARNING' }, msg);
  }

  error(msg: string, err?: any) {
    baseLogger.error({ 
      eventType: 'ERROR', 
      error: err ? (err.message || err.toString() || err) : undefined 
    }, msg);
  }

  risk(msg: string) {
    baseLogger.warn({ eventType: 'RISK_ALERT' }, msg);
  }

  trade(msg: string) {
    baseLogger.info({ eventType: 'TRADE_EXECUTION' }, msg);
  }
}

export const logger = new Logger();
export type { LogLevel };
export { createChildLogger, baseLogger };
export type { LogContext };
