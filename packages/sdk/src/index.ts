import { RestClient } from './client/RestClient.js';
import { WebSocketClient } from './client/WebSocketClient.js';

export interface ArbitrageSDKOptions {
  baseUrl: string;
  wsUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  WebSocket?: any; // Custom Node.js WebSocket engine
}

export interface ArbitrageSDK {
  rest: RestClient;
  ws: WebSocketClient;
}

export function createArbitrageSDK(options: ArbitrageSDKOptions): ArbitrageSDK {
  return {
    rest: new RestClient({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      timeoutMs: options.timeoutMs,
    }),
    ws: new WebSocketClient({
      wsUrl: options.wsUrl,
      apiKey: options.apiKey,
      WebSocket: options.WebSocket,
    }),
  };
}

export * from './types.js';
export * from './errors.js';
export { RestClient } from './client/RestClient.js';
export type { RestClientOptions } from './client/RestClient.js';
export { WebSocketClient } from './client/WebSocketClient.js';
export type { WebSocketClientOptions } from './client/WebSocketClient.js';
export type {
  StateUpdateHandler,
  OpportunityHandler,
  TradeHandler,
  WalletsHandler,
  BotStatusHandler,
  MetricsHandler,
  ErrorHandler,
  CloseHandler,
} from './client/WebSocketClient.js';
