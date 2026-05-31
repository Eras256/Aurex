import { HttpError, TimeoutError } from '../errors.js';
import {
  HealthResponse,
  StatePayload,
  EngineConfig,
  EngineConfigUpdate,
  ArbitrageOpportunity,
  SimulatedTrade,
  OpportunitiesQuery,
  TradesQuery,
} from '../types.js';

export interface RestClientOptions {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class RestClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeoutMs: number;

  constructor(options: RestClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers = new Headers(options.headers || {});
    if (this.apiKey) {
      // Send both headers for seamless server authentication compatibility
      headers.set('x-api-key', this.apiKey);
      headers.set('Authorization', `Bearer ${this.apiKey}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        let errorDetails: any;
        try {
          errorDetails = await response.json();
        } catch {
          try {
            errorDetails = await response.text();
          } catch {
            errorDetails = null;
          }
        }
        throw new HttpError(
          response.status,
          `HTTP Error ${response.status}: ${response.statusText}`,
          errorDetails
        );
      }

      // Check if the response matches a text/csv file payload
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('text/csv')) {
        return (await response.text()) as unknown as T;
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timer);
      if (error.name === 'AbortError') {
        throw new TimeoutError(`Request to ${url} timed out after ${this.timeoutMs}ms`);
      }
      if (error instanceof HttpError || error.name === 'HttpError') {
        throw error;
      }
      throw new HttpError(500, error.message || 'Network Request Failed', error);
    }
  }

  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  async getState(): Promise<StatePayload> {
    return this.request<StatePayload>('/state');
  }

  async getConfig(): Promise<EngineConfig> {
    return this.request<EngineConfig>('/config');
  }

  async updateConfig(input: EngineConfigUpdate): Promise<EngineConfig> {
    const response = await this.request<{ success: boolean; config: EngineConfig }>('/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    return response.config;
  }

  async resetEngine(): Promise<void> {
    await this.request<{ success: boolean; message: string }>('/engine/reset', {
      method: 'POST',
    });
  }

  async getOpportunities(params?: OpportunitiesQuery): Promise<ArbitrageOpportunity[]> {
    const state = await this.getState();
    const limit = params?.limit ?? 50;
    return state.opportunities.slice(0, limit);
  }

  async getTrades(params?: TradesQuery): Promise<SimulatedTrade[]> {
    const state = await this.getState();
    const limit = params?.limit ?? 50;
    return state.trades.slice(0, limit);
  }

  async exportTrades(): Promise<string> {
    return this.request<string>('/trades/export');
  }
}
