import { env } from '@arbitrage/config';

// Server-side only: the OpenAI key is read from process.env and NEVER reaches the client
// bundle (this route runs on the server; the browser only ever sees the streamed tokens).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// Cache the live grounding for a few seconds so rapid successive Copilot queries don't each
// pay the full /state round-trip (the biggest chunk of time-to-first-token). Engine P&L /
// config / metrics move slowly relative to a chat turn, so a few seconds of staleness is
// invisible in an advisory answer — zero quality loss, ~0.7s saved on a cache hit.
let cachedContext: { value: string | null; at: number } | null = null;
const CONTEXT_TTL_MS = 4000;

function formatStateSummary(s: any): string | null {
  try {
    const cfg = s.config ?? {};
    const pnl = s.pnl ?? {};
    const recentTrades = (s.trades ?? []).slice(0, 5)
      .map((t: any) => `${t.buyExchange}->${t.sellExchange} vol=${t.volume} net=$${(t.netProfit ?? 0).toFixed(2)}`)
      .join('; ');
    const recentSkips = (s.opportunities ?? []).filter((o: any) => o.status === 'SKIPPED').slice(0, 3)
      .map((o: any) => `${o.buyExchange}->${o.sellExchange}: ${o.reason ?? 'sub-threshold'}`)
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

async function fetchLiveContext(clientState?: any): Promise<string | null> {
  if (clientState) {
    const formatted = formatStateSummary(clientState);
    if (formatted) return formatted;
  }
  if (cachedContext && Date.now() - cachedContext.at < CONTEXT_TTL_MS) {
    return cachedContext.value;
  }
  const value = await computeLiveContext();
  cachedContext = { value, at: Date.now() };
  return value;
}

async function computeLiveContext(): Promise<string | null> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL}/state/summary`, { cache: 'no-store' });
    if (!res.ok) return null;
    const s = await res.json();
    return formatStateSummary(s);
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
  let query = '';
  let language: 'en' | 'es' = 'en';
  let clientState: any = null;
  let aiProvider = 'OpenAI';
  let aiModel = 'gpt-4o-mini';
  let customApiKey = '';
  let customBaseUrl = '';

  try {
    const body = (await request.json()) as {
      query?: string;
      language?: 'en' | 'es';
      statePayload?: any;
      aiProvider?: string;
      aiModel?: string;
      customApiKey?: string;
      customBaseUrl?: string;
    };
    query = (body.query ?? '').slice(0, 2000);
    language = body.language === 'es' ? 'es' : 'en';
    clientState = body.statePayload;
    aiProvider = body.aiProvider || 'OpenAI';
    aiModel = body.aiModel || 'gpt-4o-mini';
    customApiKey = body.customApiKey || '';
    customBaseUrl = body.customBaseUrl || '';
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 });
  }
  if (!query.trim()) return new Response(JSON.stringify({ error: 'empty query' }), { status: 400 });

  const liveContext = await fetchLiveContext(clientState);
  const langInstruction = language === 'es' ? 'Responde en español.' : 'Respond in English.';

  let url = 'https://api.openai.com/v1/chat/completions';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let bodyPayload: any = {};

  let activeKey = customApiKey;

  if (aiProvider === 'OpenAI') {
    if (!activeKey) activeKey = process.env.OPENAI_API_KEY || '';
    url = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${activeKey}`;
    bodyPayload = {
      model: aiModel,
      stream: true,
      temperature: 0.4,
      max_tokens: 700,
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n${langInstruction}` },
        { role: 'system', content: liveContext ?? 'Live engine state is unavailable; answer from general Aurex architecture knowledge.' },
        { role: 'user', content: query },
      ],
    };
  } else if (aiProvider === 'Gemini') {
    if (!activeKey) activeKey = process.env.GEMINI_API_KEY || '';
    url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    headers['Authorization'] = `Bearer ${activeKey}`;
    bodyPayload = {
      model: aiModel,
      stream: true,
      temperature: 0.4,
      max_tokens: 700,
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n${langInstruction}` },
        { role: 'system', content: liveContext ?? 'Live engine state is unavailable.' },
        { role: 'user', content: query },
      ],
    };
  } else if (aiProvider === 'Anthropic') {
    if (!activeKey) activeKey = process.env.ANTHROPIC_API_KEY || '';
    url = 'https://api.anthropic.com/v1/messages';
    headers['x-api-key'] = activeKey;
    headers['anthropic-version'] = '2023-06-01';
    bodyPayload = {
      model: aiModel,
      max_tokens: 700,
      temperature: 0.4,
      stream: true,
      system: `${SYSTEM_PROMPT}\n${langInstruction}\n\nLive context:\n${liveContext ?? 'Live engine state is unavailable.'}`,
      messages: [
        { role: 'user', content: query },
      ],
    };
  } else if (aiProvider === 'Custom') {
    let customUrl = customBaseUrl || '';
    if (customUrl.endsWith('/')) customUrl = customUrl.slice(0, -1);
    if (!customUrl.endsWith('/chat/completions') && !customUrl.endsWith('/completions')) {
      url = `${customUrl}/chat/completions`;
    } else {
      url = customUrl;
    }
    if (activeKey) {
      headers['Authorization'] = `Bearer ${activeKey}`;
    }
    bodyPayload = {
      model: aiModel,
      stream: true,
      temperature: 0.4,
      max_tokens: 700,
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n${langInstruction}` },
        { role: 'system', content: liveContext ?? 'Live engine state is unavailable.' },
        { role: 'user', content: query },
      ],
    };
  }

  if (!activeKey && aiProvider !== 'Custom') {
    return new Response(
      JSON.stringify({ error: `API key is not configured for ${aiProvider}.` }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyPayload),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return new Response(JSON.stringify({ error: 'upstream', status: upstream.status, detail: detail.slice(0, 300) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Re-stream upstream's SSE deltas to the client as plain text tokens.
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
          const json = JSON.parse(data);
          // OpenAI / Gemini / Custom standard formats
          const openAiToken = json.choices?.[0]?.delta?.content;
          if (openAiToken) {
            controller.enqueue(encoder.encode(openAiToken));
            continue;
          }
          // Anthropic format
          if (json.type === 'content_block_delta') {
            const anthropicToken = json.delta?.text;
            if (anthropicToken) {
              controller.enqueue(encoder.encode(anthropicToken));
              continue;
            }
          }
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
