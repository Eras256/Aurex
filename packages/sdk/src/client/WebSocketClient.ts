import { WebSocketError } from '../errors.js';
import {
  StatePayload,
  ArbitrageOpportunity,
  SimulatedTrade,
  WalletBalance,
  BotStatus,
  MetricsSnapshot,
} from '../types.js';

export type StateUpdateHandler = (state: StatePayload) => void;
export type OpportunityHandler = (opp: ArbitrageOpportunity) => void;
export type TradeHandler = (trade: SimulatedTrade) => void;
export type WalletsHandler = (wallets: WalletBalance[]) => void;
export type BotStatusHandler = (status: BotStatus) => void;
export type MetricsHandler = (metrics: MetricsSnapshot) => void;
export type ErrorHandler = (error: Error) => void;
export type CloseHandler = (code: number, reason: string) => void;

export interface WebSocketClientOptions {
  wsUrl: string;
  apiKey?: string;
  WebSocket?: any; // Custom WebSocket constructor (useful in Node.js)
  maxReconnectAttempts?: number;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export class WebSocketClient {
  private wsUrl: string;
  private apiKey?: string;
  private socket: any | null = null;
  private customWSConstructor?: any;

  // Reconnection state
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private initialReconnectDelayMs: number;
  private maxReconnectDelayMs: number;
  private isExplicitlyClosed = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Seen entities tracking to emit only *new* items
  private seenOpportunities = new Set<string>();
  private seenTrades = new Set<string>();
  private isFirstStatePayload = true;

  // Event handlers collections
  private stateHandlers = new Set<StateUpdateHandler>();
  private opportunityHandlers = new Set<OpportunityHandler>();
  private tradeHandlers = new Set<TradeHandler>();
  private walletsHandlers = new Set<WalletsHandler>();
  private botStatusHandlers = new Set<BotStatusHandler>();
  private metricsHandlers = new Set<MetricsHandler>();
  private errorHandlers = new Set<ErrorHandler>();
  private closeHandlers = new Set<CloseHandler>();

  constructor(options: WebSocketClientOptions) {
    this.wsUrl = options.wsUrl;
    this.apiKey = options.apiKey;
    this.customWSConstructor = options.WebSocket;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.initialReconnectDelayMs = options.initialReconnectDelayMs ?? 1000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 10000;
  }

  /**
   * Establishes the WebSocket connection.
   * Universal design dynamically loads the Node.js 'ws' package if running in a terminal.
   */
  async connect(): Promise<void> {
    if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) {
      return; // Already connecting or connected
    }

    this.isExplicitlyClosed = false;
    this.cleanupTimer();

    // Resolve WebSocket constructor isomorphic engine
    let WS = this.customWSConstructor || (typeof globalThis !== 'undefined' ? (globalThis as any).WebSocket : null);
    if (!WS) {
      try {
        const wsModule = await import('ws');
        WS = wsModule.WebSocket || wsModule.default;
      } catch (err) {
        throw new WebSocketError(
          'No global WebSocket constructor available. Please pass a custom WebSocket constructor or install the "ws" package.'
        );
      }
    }

    try {
      // Pass the API key as standard WebSocket query protocol
      const connectionUrl = this.apiKey
        ? `${this.wsUrl}${this.wsUrl.includes('?') ? '&' : '?'}apiKey=${encodeURIComponent(this.apiKey)}`
        : this.wsUrl;

      this.socket = new WS(connectionUrl);
      this.bindSocketEvents();
    } catch (error: any) {
      const wrappedError = new WebSocketError(error.message || 'Failed to instantiate WebSocket', error);
      this.emitError(wrappedError);
      this.scheduleReconnect();
      throw wrappedError;
    }
  }

  /**
   * Closes the active WebSocket connection cleanly.
   */
  disconnect(code = 1000, reason = 'Clean close requested'): void {
    this.isExplicitlyClosed = true;
    this.cleanupTimer();
    if (this.socket) {
      try {
        this.socket.close(code, reason);
      } catch (err) {
        // Ignore close errors
      }
      this.socket = null;
    }
  }

  /**
   * Evaluates if the WebSocket client is currently connected.
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === 1; // 1 === OPEN
  }

  // ==========================================
  // Subscription handlers registration methods
  // ==========================================

  onState(handler: StateUpdateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  onOpportunity(handler: OpportunityHandler): () => void {
    this.opportunityHandlers.add(handler);
    return () => this.opportunityHandlers.delete(handler);
  }

  onTrade(handler: TradeHandler): () => void {
    this.tradeHandlers.add(handler);
    return () => this.tradeHandlers.delete(handler);
  }

  onWallets(handler: WalletsHandler): () => void {
    this.walletsHandlers.add(handler);
    return () => this.walletsHandlers.delete(handler);
  }

  onBotStatus(handler: BotStatusHandler): () => void {
    this.botStatusHandlers.add(handler);
    return () => this.botStatusHandlers.delete(handler);
  }

  onMetrics(handler: MetricsHandler): () => void {
    this.metricsHandlers.add(handler);
    return () => this.metricsHandlers.delete(handler);
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  // ==========================================
  // Internal event bindings and routing
  // ==========================================

  private bindSocketEvents() {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.reconnectAttempts = 0; // Reset backoff counter on successful link
    };

    this.socket.onmessage = (event: any) => {
      try {
        const rawData = typeof event.data === 'string' ? event.data : event.data.toString();
        const state: StatePayload = JSON.parse(rawData);
        this.processIncomingState(state);
      } catch (err: any) {
        this.emitError(new WebSocketError('Failed to parse incoming WS state JSON', err));
      }
    };

    this.socket.onerror = (errorEvent: any) => {
      this.emitError(new WebSocketError(errorEvent.message || 'WebSocket Client Error', errorEvent));
    };

    this.socket.onclose = (closeEvent: any) => {
      const code = closeEvent.code ?? 1006;
      const reason = closeEvent.reason ?? 'Abnormal Closure';
      
      this.closeHandlers.forEach((handler) => {
        try {
          handler(code, reason);
        } catch {
          // Prevent handler failures from breaking flow
        }
      });

      this.socket = null;

      // Automatically reconnect on abnormal close codes
      if (!this.isExplicitlyClosed) {
        this.scheduleReconnect();
      }
    };
  }

  private processIncomingState(state: StatePayload) {
    // 1. Emit absolute full state snapshot
    this.stateHandlers.forEach((handler) => handler(state));

    // 2. Emit flat wallet balances list mapping
    const walletList: WalletBalance[] = [];
    if (state.wallets) {
      for (const [exchangeId, assets] of Object.entries(state.wallets)) {
        for (const [asset, bal] of Object.entries(assets)) {
          walletList.push({
            exchangeId,
            asset,
            free: bal.free,
            locked: bal.locked,
          });
        }
      }
    }
    this.walletsHandlers.forEach((handler) => handler(walletList));

    // 3. Emit custom bot status
    const botStatus: BotStatus = {
      isPaused: state.config?.isPaused ?? false,
      uptime: state.uptime ?? 0,
      connections: state.connections || {},
    };
    this.botStatusHandlers.forEach((handler) => handler(botStatus));

    // 4. Emit analytics and risk metrics snapshots
    const metrics: MetricsSnapshot = {
      totalProfitUSD: state.pnl?.totalProfitUSD ?? 0,
      dailyProfitUSD: state.pnl?.dailyProfitUSD ?? 0,
      winRate: state.pnl?.winRate ?? 0,
      totalTrades: state.pnl?.totalTrades ?? 0,
      sharpeRatio: state.pnl?.sharpeRatio ?? 0,
      equityHistory: state.pnl?.equityHistory || [],
      risk: state.risk || null,
    };
    this.metricsHandlers.forEach((handler) => handler(metrics));

    // 5. Emit individual new trades & opportunities (excluding history on first message)
    if (this.isFirstStatePayload) {
      if (state.opportunities) {
        state.opportunities.forEach((opp) => this.seenOpportunities.add(opp.id));
      }
      if (state.trades) {
        state.trades.forEach((trade) => this.seenTrades.add(trade.id));
      }
      this.isFirstStatePayload = false;
    } else {
      // Opportunities (evaluate in chronological ascending order)
      if (state.opportunities) {
        const newOpps = [...state.opportunities]
          .reverse()
          .filter((opp) => !this.seenOpportunities.has(opp.id));
        newOpps.forEach((opp) => {
          this.seenOpportunities.add(opp.id);
          this.opportunityHandlers.forEach((handler) => handler(opp));
        });
      }

      // Trades
      if (state.trades) {
        const newTrades = [...state.trades]
          .reverse()
          .filter((trade) => !this.seenTrades.has(trade.id));
        newTrades.forEach((trade) => {
          this.seenTrades.add(trade.id);
          this.tradeHandlers.forEach((handler) => handler(trade));
        });
      }
    }
  }

  private scheduleReconnect() {
    if (this.isExplicitlyClosed || this.reconnectTimer) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emitError(
        new WebSocketError(
          `WebSocket connection failed permanently after ${this.reconnectAttempts} attempts.`
        )
      );
      return;
    }

    // Calculate delay with exponential backoff capped at maxReconnectDelayMs
    const delay = Math.min(
      this.initialReconnectDelayMs * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelayMs
    );

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        // Failures during connection trigger errors which invoke scheduleReconnect again
      });
    }, delay);
  }

  private emitError(error: Error) {
    this.errorHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch {
        // Prevent handlers crashes from bubble up
      }
    });
  }

  private cleanupTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
