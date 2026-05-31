import { describe, it, expect, beforeEach } from 'vitest';

import { WebSocketClient } from '../src/client/WebSocketClient.js';
import { StatePayload } from '../src/types.js';

// Clean Mock WebSocket Implementation
class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = 0; // CONNECTING
  closeCode: number | null = null;
  closeReason: string | null = null;

  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((err: { message: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.();
    }, 10);
  }

  send(data: string) {
    // Mock send handler
  }

  close(code = 1000, reason = 'Normal close') {
    this.readyState = 3; // CLOSED
    this.closeCode = code;
    this.closeReason = reason;
    setTimeout(() => {
      this.onclose?.({ code, reason });
    }, 10);
  }

  triggerMessage(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  triggerError(message: string) {
    this.onerror?.({ message });
  }
}

describe('WebSocketClient', () => {
  const wsUrl = 'ws://localhost:3001';
  const apiKey = 'test-secret';
  let client: WebSocketClient;

  beforeEach(() => {
    MockWebSocket.instances = [];
    client = new WebSocketClient({
      wsUrl,
      apiKey,
      WebSocket: MockWebSocket,
      initialReconnectDelayMs: 2, // Minimal delay for fast test executions
      maxReconnectAttempts: 3,
    });
  });

  it('should format URL with apiKey as parameter', async () => {
    await client.connect();
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain(`apiKey=${apiKey}`);
  });

  it('should establish connection and state status correctly', async () => {
    expect(client.isConnected()).toBe(false);
    await client.connect();
    // Wait for async open timeout
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(client.isConnected()).toBe(true);
  });

  it('should parse state payloads and route metrics, status, and flattened wallets', async () => {
    await client.connect();
    await new Promise((resolve) => setTimeout(resolve, 15));

    const mockState: Partial<StatePayload> = {
      uptime: 100,
      config: { isPaused: false } as any,
      connections: { binance: { connected: true, reconnects: 0, lastMessageAt: 123 } },
      wallets: {
        binance: {
          BTC: { free: 1.5, locked: 0.1 },
        },
      },
      pnl: {
        totalProfitUSD: 500,
        dailyProfitUSD: 100,
        winRate: 0.85,
        totalTrades: 20,
        sharpeRatio: 2.1,
        equityHistory: [],
      },
      risk: { status: 'SAFE', isCoolingDown: false } as any,
      opportunities: [],
      trades: [],
    };

    let receivedState: any = null;
    let receivedWallets: any = null;
    let receivedStatus: any = null;
    let receivedMetrics: any = null;

    client.onState((s) => (receivedState = s));
    client.onWallets((w) => (receivedWallets = w));
    client.onBotStatus((s) => (receivedStatus = s));
    client.onMetrics((m) => (receivedMetrics = m));

    MockWebSocket.instances[0].triggerMessage(mockState);

    expect(receivedState).toEqual(mockState);
    expect(receivedWallets).toEqual([
      { exchangeId: 'binance', asset: 'BTC', free: 1.5, locked: 0.1 },
    ]);
    expect(receivedStatus).toEqual({
      isPaused: false,
      uptime: 100,
      connections: mockState.connections,
    });
    expect(receivedMetrics).toEqual({
      totalProfitUSD: 500,
      dailyProfitUSD: 100,
      winRate: 0.85,
      totalTrades: 20,
      sharpeRatio: 2.1,
      equityHistory: [],
      risk: mockState.risk,
    });
  });

  it('should emit only new trades and opportunities in chronological order, skipping initial history', async () => {
    await client.connect();
    await new Promise((resolve) => setTimeout(resolve, 15));

    const statePayload1: Partial<StatePayload> = {
      opportunities: [{ id: 'opp-old' } as any],
      trades: [{ id: 'trade-old' } as any],
    };

    const emittedOpps: any[] = [];
    const emittedTrades: any[] = [];

    client.onOpportunity((opp) => emittedOpps.push(opp));
    client.onTrade((t) => emittedTrades.push(t));

    // First broadcast contains historical state and should be buffered (ignored to avoid initial spam)
    MockWebSocket.instances[0].triggerMessage(statePayload1);
    expect(emittedOpps).toHaveLength(0);
    expect(emittedTrades).toHaveLength(0);

    // Second broadcast pushes new items
    const statePayload2: Partial<StatePayload> = {
      opportunities: [{ id: 'opp-new' } as any, { id: 'opp-old' } as any],
      trades: [{ id: 'trade-new-2' } as any, { id: 'trade-new-1' } as any, { id: 'trade-old' } as any],
    };

    MockWebSocket.instances[0].triggerMessage(statePayload2);

    // Emits new items chronologically (oldest of the new ones first)
    expect(emittedOpps).toEqual([{ id: 'opp-new' }]);
    expect(emittedTrades).toEqual([{ id: 'trade-new-1' }, { id: 'trade-new-2' }]);
  });

  it('should allow unsubscribing from event channels using the return callback function', async () => {
    await client.connect();
    await new Promise((resolve) => setTimeout(resolve, 15));

    let statesCount = 0;
    const unsubscribe = client.onState(() => {
      statesCount++;
    });

    MockWebSocket.instances[0].triggerMessage({});
    expect(statesCount).toBe(1);

    unsubscribe();
    MockWebSocket.instances[0].triggerMessage({});
    expect(statesCount).toBe(1); // Call counter does not increment since callback was unsubscribed
  });

  it('should attempt automatic reconnects with backoff when socket fails abnormally', async () => {
    await client.connect();
    await new Promise((resolve) => setTimeout(resolve, 15));

    expect(client.isConnected()).toBe(true);

    let closeCode = 0;
    client.onClose((code) => {
      closeCode = code;
    });

    // Close socket abnormally (e.g. standard remote socket crash code 1006)
    MockWebSocket.instances[0].close(1006, 'Abnormal server drop');

    // Wait for the closing timeouts
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(closeCode).toBe(1006);
    expect(client.isConnected()).toBe(false);

    // Reconnection triggers and instantiates a new MockWebSocket instance automatically
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(MockWebSocket.instances).toHaveLength(2);
  });
});
