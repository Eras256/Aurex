import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { RestClient } from '../src/client/RestClient.js';
import { HttpError, TimeoutError } from '../src/errors.js';

describe('RestClient', () => {
  const baseUrl = 'http://localhost:3001';
  const apiKey = 'test-secret-key-123';
  let client: RestClient;

  beforeEach(() => {
    client = new RestClient({
      baseUrl,
      apiKey,
      timeoutMs: 100, // Small timeout for easier timeout testing
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should construct correctly and strip trailing slash', () => {
    const customClient = new RestClient({ baseUrl: 'http://localhost:3001/' });
    expect((customClient as any).baseUrl).toBe('http://localhost:3001');
  });

  it('should fetch health status successfully', async () => {
    const mockHealth = {
      status: 'healthy',
      timestamp: 123456789,
      uptime: 42,
      connections: { binance: true, kraken: true, coinbase: false },
    };

    const mockHeaders = new Headers({ 'Content-Type': 'application/json' });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      headers: mockHeaders,
      json: async () => mockHealth,
    } as any);

    const health = await client.getHealth();
    expect(health).toEqual(mockHealth);
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/health`, expect.any(Object));
  });

  it('should send x-api-key and Authorization headers for authenticated routes', async () => {
    const mockConfig = { isPaused: false };
    const mockHeaders = new Headers({ 'Content-Type': 'application/json' });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      headers: mockHeaders,
      json: async () => ({ success: true, config: mockConfig }),
    } as any);

    await client.updateConfig({ isPaused: true });

    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/config`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
      })
    );

    const lastCallHeaders: Headers = vi.mocked(fetch).mock.calls[0][1]?.headers as any;
    expect(lastCallHeaders.get('x-api-key')).toBe(apiKey);
    expect(lastCallHeaders.get('Authorization')).toBe(`Bearer ${apiKey}`);
  });

  it('should throw HttpError when response is not ok', async () => {
    const errorDetails = { error: 'Unauthorized key' };
    const mockHeaders = new Headers({ 'Content-Type': 'application/json' });

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: mockHeaders,
      json: async () => errorDetails,
    } as any);

    await expect(client.resetEngine()).rejects.toThrow(HttpError);

    try {
      await client.resetEngine();
    } catch (err: any) {
      expect(err).toBeInstanceOf(HttpError);
      expect(err.statusCode).toBe(401);
      expect(err.message).toContain('HTTP Error 401: Unauthorized');
      expect(err.details).toEqual(errorDetails);
    }
  });

  it('should throw TimeoutError when request times out', async () => {
    // Mock fetch to simulate a delayed response that exceeds timeoutMs
    vi.mocked(fetch).mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          const err = new Error('The user aborted a request.');
          err.name = 'AbortError';
          reject(err);
        }, 150);
      });
    });

    await expect(client.getState()).rejects.toThrow(TimeoutError);
  });

  it('should handle text/csv trade reports exports', async () => {
    const csvContent = 'id,timestamp,buyExchange,sellExchange\n1,12345,binance,kraken';
    const mockHeaders = new Headers({ 'Content-Type': 'text/csv' });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      headers: mockHeaders,
      text: async () => csvContent,
    } as any);

    const result = await client.exportTrades();
    expect(result).toBe(csvContent);
  });

  it('should filter opportunities and trades locally using state payload', async () => {
    const mockState = {
      opportunities: [{ id: 'opp-1' }, { id: 'opp-2' }, { id: 'opp-3' }],
      trades: [{ id: 't-1' }, { id: 't-2' }],
    };
    const mockHeaders = new Headers({ 'Content-Type': 'application/json' });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: mockHeaders,
      json: async () => mockState,
    } as any);

    const slicedOpps = await client.getOpportunities({ limit: 2 });
    expect(slicedOpps).toHaveLength(2);
    expect(slicedOpps[0].id).toBe('opp-1');

    const slicedTrades = await client.getTrades({ limit: 1 });
    expect(slicedTrades).toHaveLength(1);
    expect(slicedTrades[0].id).toBe('t-1');
  });
});
