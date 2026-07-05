import { env } from '@arbitrage/config';

// Server-side only: the OpenAI key is read from process.env and NEVER reaches the client
// bundle (this route runs on the server; the browser only ever sees the streamed tokens).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Pulls a compact, live snapshot of the bot's real state so the Copilot answers grounded in
 * the operator's ACTUAL P&L, trades, risk config and market — not generic boilerplate.
 * Fails soft: if the backend is unreachable, returns null and the model answers from the
 * question alone.
 */
async function fetchLiveContext(): Promise<string | null> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL}/state`, { cache: 'no-store' });
    if (!res.ok) return null;
    const s = (await res.json()) as {
      config?: Record<string, unknown>;
      pnl?: { totalProfitUSD?: number; winRate?: number; totalTrades?: number; sharpeRatio?: number };
      risk?: { status?: string; consecutiveLosses?: number };
      metrics?: { detectionLatencyMs?: number; p99LatencyMs?: number; opportunitiesDetected?: number };
      trades?: Array<{ buyExchange: string; sellExchange: string; volume: number; netProfit: number }>;
      opportunities?: Array<{ buyExchange: string; sellExchange: string; status: string; reason?: string }>;
      wallets?: Record<string, Record<string, { free: number }>>;
    };

    const cfg = s.config ?? {};
    const pnl = s.pnl ?? {};
    const recentTrades = (s.trades ?? []).slice(0, 5)
      .map((t) => `${t.buyExchange}->${t.sellExchange} vol=${t.volume} net=$${(t.netProfit ?? 0).toFixed(2)}`)
      .join('; ');
    const recentSkips = (s.opportunities ?? []).filter((o) => o.status === 'SKIPPED').slice(0, 3)
      .map((o) => `${o.buyExchange}->${o.sellExchange}: ${o.reason ?? 'sub-threshold'}`)
      .join(' | ');

    return [
      '=== LIVE AUREX ENGINE STATE (real, use these exact figures) ===',
      `P&L: total $${(pnl.totalProfitUSD ?? 0).toFixed(2)}, win rate ${(pnl.winRate ?? 0).toFixed(1)}%, ${pnl.totalTrades ?? 0} trades, Sharpe ${(pnl.sharpeRatio ?? 0).toFixed(2)}`,
      `Risk: status ${s.risk?.status ?? 'SAFE'}, consecutive losses ${s.risk?.consecutiveLosses ?? 0}`,
      `Latency: detection ${(s.metrics?.detectionLatencyMs ?? 0).toFixed(2)}ms (p99 ${(s.metrics?.p99LatencyMs ?? 0).toFixed(2)}ms), ${s.metrics?.opportunitiesDetected ?? 0} opportunities scanned`,
      `Key config: executionMode=${cfg.executionMode}, minNetProfitUSD=${cfg.minNetProfitUSD}, latencySafetyBps=${cfg.latencySafetyBps}, slippageSafetyBps=${cfg.slippageSafetyBps}, volatilityBreakerPct=${cfg.volatilityBreakerPct}, consecutiveLossLimit=${cfg.consecutiveLossLimit}, zScoreGateEnabled=${cfg.zScoreGateEnabled}, enabledExchanges=${(cfg.enabledExchanges as string[] | undefined)?.join(',')}`,
      recentTrades ? `Recent trades: ${recentTrades}` : '',
      recentSkips ? `Recent rejected windows: ${recentSkips}` : '',
    ].filter(Boolean).join('\n');
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are the Aurex Quant Copilot — an advisory AI embedded in a live institutional-grade Bitcoin cross-exchange arbitrage terminal. Aurex scans L2 order books across Binance, Kraken, Coinbase, OKX and Bybit, depth-walks them to volume-weighted prices, deducts taker fees, latency and slippage buffers and the USD/USDT basis, ranks windows by net profit and z-score, and can execute real IOC orders on exchange test environments. You help the operator understand risk parameters, spread rejections, execution outcomes and rebalancing.

Rules:
- Ground every answer in the LIVE ENGINE STATE provided; cite the operator's real numbers.
- Be concise, technical and honest. If the edge is thin or a window was correctly rejected, say so and explain which cost killed it (fees, slippage, latency drift, USD/USDT basis).
- You are ADVISORY ONLY: never claim to have changed settings; suggest values and let the operator apply them in the Risk page.
- Use compact Markdown (short headers, bullet points). Do not invent numbers that aren't in the state.`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'unconfigured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let query = '';
  let language: 'en' | 'es' = 'en';
  try {
    const body = (await request.json()) as { query?: string; language?: 'en' | 'es' };
    query = (body.query ?? '').slice(0, 2000);
    language = body.language === 'es' ? 'es' : 'en';
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 });
  }
  if (!query.trim()) return new Response(JSON.stringify({ error: 'empty query' }), { status: 400 });

  const liveContext = await fetchLiveContext();
  const langInstruction = language === 'es' ? 'Responde en español.' : 'Respond in English.';

  const upstream = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      stream: true,
      temperature: 0.4,
      max_tokens: 700,
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n${langInstruction}` },
        { role: 'system', content: liveContext ?? 'Live engine state is unavailable; answer from general Aurex architecture knowledge and say the live snapshot could not be loaded.' },
        { role: 'user', content: query },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return new Response(JSON.stringify({ error: 'upstream', status: upstream.status, detail: detail.slice(0, 300) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Re-stream OpenAI's SSE deltas to the client as plain text tokens.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const token = json.choices?.[0]?.delta?.content;
          if (token) controller.enqueue(encoder.encode(token));
        } catch {
          // ignore keep-alive / partial frames
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
