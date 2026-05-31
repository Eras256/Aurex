import pino from 'pino';

export interface LogContext {
  component?: string;
  exchangeId?: string;
  symbol?: string;
  eventType?: 'INFO' | 'WARNING' | 'ERROR' | 'RISK_ALERT' | 'TRADE_EXECUTION';
  [key: string]: any;
}

// Configured base pino logger
export const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
});

/**
 * Creates a child logger pre-configured with core structured logging context.
 */
export function createChildLogger(context: LogContext) {
  return baseLogger.child(context);
}

// Standard exports
export const logger = baseLogger;
