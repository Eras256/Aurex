
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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 });
  }

  const { contextType, payload } = body;
  if (!contextType || !payload) {
    return new Response(JSON.stringify({ error: 'missing parameters' }), { status: 400 });
  }

  let schemaPrompt = '';
  if (contextType === 'trade') {
    schemaPrompt = `Analyze this simulated trade execution: ${JSON.stringify(payload)}.
Output JSON schema: { 
  "confidence": number (0-1), 
  "rationaleEn": string (short 1 sentence), 
  "rationaleEs": string, 
  "detailsEn": string (2-3 sentences), 
  "detailsEs": string, 
  "finalDecision": "ACCEPTED" | "REJECTED" | "BYPASSED",
  "suggestedParams": optional object with keys like minNetProfitUSD (number)
}`;
  } else if (contextType === 'opportunity') {
    schemaPrompt = `Analyze this cross-exchange arbitrage opportunity: ${JSON.stringify(payload)}.
Output JSON schema: { 
  "insightEn": string, 
  "insightEs": string, 
  "limitingFactor": "FEES" | "LATENCY" | "LIQUIDITY" | "NONE", 
  "projectedRoi": number 
}`;
  } else if (contextType === 'health') {
    schemaPrompt = `Analyze these HFT system metrics: ${JSON.stringify(payload)}.
Output JSON schema: { 
  "status": "OPTIMAL" | "DEGRADED" | "CRITICAL", 
  "messageEn": string, 
  "messageEs": string, 
  "primaryBottleneck": string, 
  "remediationSteps": string[] 
}`;
  } else if (contextType === 'risk-calibrate') {
    schemaPrompt = `Suggest risk parameter calibration based on this state: ${JSON.stringify(payload)}.
Output JSON schema: { 
  "status": "UPDATED" | "NO_CHANGE", 
  "newParameters": { minNetProfitUSD?: number, latencySafetyBps?: number, slippageSafetyBps?: number, volatilityBreakerPct?: number }, 
  "explanationEn": string, 
  "explanationEs": string 
}`;
  } else if (contextType === 'risk-advisory') {
    schemaPrompt = `Generate a global risk advisory based on this state: ${JSON.stringify(payload)}.
Output JSON schema: { 
  "advisoryEn": string, 
  "advisoryEs": string, 
  "riskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL" 
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

    const data = await upstream.json();
    const content = data.choices?.[0]?.message?.content;
    
    const parsed = JSON.parse(content);
    return new Response(JSON.stringify(parsed), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'parse or fetch error' }), { status: 500 });
  }
}
