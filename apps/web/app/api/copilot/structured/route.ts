
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `You are the Aurex Quant Copilot. You are an expert high-frequency trading analyst. 
You must respond ONLY with valid JSON using the exact schema requested by the user, without markdown formatting.
Always provide explanations in both English (En) and Spanish (Es). Be concise, highly technical, and institutional.`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'unconfigured' }), { status: 503 });
  }

  let body: { contextType?: string; payload?: unknown };
  try {
    body = (await request.json()) as { contextType?: string; payload?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 });
  }

  const { contextType, payload } = body;
  if (!contextType || !payload) {
    return new Response(JSON.stringify({ error: 'missing parameters' }), { status: 400 });
  }

  let schemaPrompt = '';
  if (contextType === 'trade') {
    schemaPrompt = `Analyze this trade execution: ${JSON.stringify(payload)}.
Output JSON schema: { 
  "vwapEfficiencyScore": number (0-100), 
  "critiqueDetails": { "en": string, "es": string } 
}`;
  } else if (contextType === 'opportunity') {
    schemaPrompt = `Analyze this cross-exchange arbitrage opportunity: ${JSON.stringify(payload)}.
Output JSON schema: { 
  "executionRating": "EXCELLENT" | "HIGH_RISK" | "SKIPPED_UNPROFITABLE", 
  "explainabilitySummary": { "en": string, "es": string }, 
  "costBreakdown": { "takerFeeUSD": number, "slippageBufferUSD": number, "latencyRiskUSD": number } 
}`;
  } else if (contextType === 'health') {
    schemaPrompt = `Analyze these HFT system metrics: ${JSON.stringify(payload)}.
Output JSON schema: { 
  "healthRating": "NOMINAL" | "DEGRADED" | "CRITICAL", 
  "telemetryAnalysis": { "en": string, "es": string } 
}`;
  } else if (contextType === 'risk-calibrate') {
    schemaPrompt = `Suggest risk parameter calibration based on this state: ${JSON.stringify(payload)}.
Output JSON schema: { 
  "suggestedParams": { "minNetProfitUSD": number, "latencyDriftBufferBps": number, "slippageSafetyBps": number }, 
  "calibrationRationale": { "en": string, "es": string }, 
  "zScoreExplanation": { "en": string, "es": string } 
}`;
  } else if (contextType === 'risk-advisory') {
    schemaPrompt = `Generate a global risk advisory based on this state: ${JSON.stringify(payload)}.
Output JSON schema: { 
  "recommendedProfitFloorUSD": number, 
  "sizingConfidenceScore": number (0.0 to 1.0), 
  "telemetrySummary": { "en": string, "es": string }, 
  "lastChecked": "ISO date string" 
}`;
  } else {
    return new Response(JSON.stringify({ error: 'invalid contextType' }), { status: 400 });
  }

  try {
    const upstream = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 600,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: schemaPrompt }
        ],
      }),
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: 'upstream failure' }), { status: 502 });
    }

    const data = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ error: 'empty completion' }), { status: 502 });
    }

    const parsed = JSON.parse(content) as unknown;
    return new Response(JSON.stringify(parsed), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'parse or fetch error' }), { status: 500 });
  }
}
