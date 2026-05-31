# Aurex AI Quant Copilot - Phase Separation & Handoff Roadmap

This document serves as the technical handoff and roadmap for the **Aurex AI Quant Copilot** integration. It details what has been fully implemented in **Phase 1** as simulation-ready frontend layers, what database schemas are defined for **Supabase**, and what capabilities need to be activated on the **Fly.io Bot/Backend** in the next phase.

---

## 🗺️ Architectural Paradigm

To preserve absolute uptime on the live production bot, we separated the quant UI from the real backend. All quantitative AI widgets are designed to be **advisory-only** (human-in-the-loop validation) and rely on decoupled, contract-based interfaces (`IAICopilotClient`).

This architecture allows the frontend to operate in `Simulated Mode` by default, but seamlessly switches to `Connected Mode` when an operator loads custom credentials in the **Quant Copilot Engine** settings.

---

## 🟢 Block 1: Fully Functional Frontend (Phase 1 Delivered)

The following components are fully functional and run entirely on client-side state, local memory, and simulation adapters:

### 1. Global Navigation & Active Badge Telemetry

- **Quant Copilot badge:** Injected in the global navbar with premium amber pulsing animations.
- **Quant Copilot Engine Settings (Modal/Drawer):** Accessible via a settings gear icon native to the mobile header and desktop sidebar.
  - Supports full **bilingual localization (EN/ES)** via the global `LanguageContext`.
  - Implements a responsive **bottom drawer** on mobile and centered glassmorphic dialog on desktop.
  - Stores all credentials (API Key with toggleable mask, optional Base URL/Endpoint), connection status, and runtime controls (Streaming toggle, reasoning level) securely in memory and `localStorage`.
  - Broadcasts reactive storage updates to dynamically change active badges (`AI: Simulated`, `AI: GPT-5`, `AI: Claude`, `AI: Gemini`) next to the navigation gear icon.

### 2. Quant Copilot Workspace (`/copilot`)

- Bloomberg-style dashboard featuring **10 preloaded quantitative scenario triggers** (depth audits, slippage audits, WebSocket congestions).
- Dynamic token-by-token text streaming simulations and progressive execution tool call logs (`[QUERY_TELEMETRY]`, `[CALCULATE_VOLATILITY]`).
- Collapsible z-score mathematical explainability accordions and an interactive "Review Proposal" drawer.
- Dense quantitative **Audit Trail Ledger** table showing all simulated coprocessor evaluations, latencies, and operator statuses.
- Scrollable responsive layout wrapping all tables to prevent horizontal body scrolling on mobile.

### 3. Modular Integrated Advisory Widgets

- **Dashboard Overview (`/`)**: Slippage and routing cost explainability cards with direct deep-links to review proposals.
- **Risk Console Settings (`/risk`)**: Calibration Assistant that calculates sizing suggestions and incorporates an **"Apply Suggested Parameters"** button that pre-fills risk inputs for operator review before saving.
- **Spread Opportunities (`/opportunities`)**: Selectable split-pane explaining skipped spread attributions (taker fee drags, latency buffers).
- **Diagnostics Console (`/health`)**: Styled terminal log evaluating network latency alerts and packet delays.
- **Trades Performance Ledger (`/trades`)**: Slip-pane assessing slippage VWAP efficiency.

---

## 🟡 Block 2: Supabase Real Integration (Next Phase)

To transition from simulated states to full database persistence for governance audits, the following schemas and policies must be created on your **Supabase** instance:

### 1. Database Schema

Create the `copilot_audit_trail` table designed for immutable quant audits:

```sql
CREATE TABLE public.copilot_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    widget_source TEXT NOT NULL,          -- e.g., 'COPILOT_WORKSPACE', 'RISK_CONSOLE'
    scenario_key TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    prompt_language VARCHAR(5) NOT NULL,
    user_query TEXT NOT NULL,
    model_identifier TEXT NOT NULL,
    model_latency_ms INTEGER NOT NULL,
    confidence_percentage NUMERIC(5,2) NOT NULL,
    explainability_payload JSONB NOT NULL,
    applied_parameters JSONB DEFAULT NULL, -- Null if suggestion was ignored or rejected
    operator_action TEXT NOT NULL,         -- 'APPLIED_SUGGESTION', 'REJECTED_SUGGESTION', 'DISMISSED'
    final_system_decision TEXT NOT NULL,   -- 'ACCEPTED', 'REJECTED', 'BYPASSED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### 2. Immutability trigger Policy

Because RLS can be bypassed by standard `service_role` keys, absolute append-only immutability must be enforced using database triggers:

```sql
-- Block all updates and deletes at the database trigger level
CREATE OR REPLACE FUNCTION block_audit_mutations()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Table "copilot_audit_trail" is strictly append-only. UPDATE and DELETE actions are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_immutable_audits
BEFORE UPDATE OR DELETE ON public.copilot_audit_trail
FOR EACH ROW
EXECUTE FUNCTION block_audit_mutations();
```

### 3. Read/Write RLS Rules

Ensure reading and writing are restricted to authenticated trading operators:

```sql
ALTER TABLE public.copilot_audit_trail ENABLE ROW LEVEL SECURITY;

-- Allow authenticated operators to insert audit logs
CREATE POLICY insert_audit_policy ON public.copilot_audit_trail
    FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated operators to read their audit trail
CREATE POLICY select_audit_policy ON public.copilot_audit_trail
    FOR SELECT TO authenticated USING (true);
```

---

## 🔴 Block 3: Quantitative Bot Integration on Fly.io (Next Phase)

To leverage real execution, the bot container running on **Fly.io** must be upgraded to support dynamic, client-guided parameter updates.

### 1. Parameters Sync (Dynamic Risk Adjustment)

When an operator approves a recommendation via `"Apply Suggested Parameters"` on the risk panel:

- The frontend will trigger an authenticated REST request to the Fly.io bot endpoint: `POST /api/v1/bot/calibrate`.
- The bot must parse the updated parameters:
  - `profitFloor`
  - `minSpread`
  - `maxExposure`
  - `safetyBuffer`
- The bot must apply these values **live in-memory** to its next arbitrage loop without requiring a container restart, logging the change in the audit trail.

### 2. Real Telemetry Streaming

- The bot must expose a secure WebSocket route `ws://<bot-url>/api/v1/telemetry/logs`.
- It must stream real-time JSON packets representing L2 depth checks, skipped opportunities due to taker fee margins, routing latency delays, and CEX WebSocket lag logs.
- The React frontend will subscribe to this route to feed the `/health` terminal and `/opportunities` split-pane dynamically.

### 3. Real VWAP Fill Critique

- The bot must populate trade logs with detailed transaction times, CEX order fills, and target VWAPs.
- The frontend will call a microservice or run calculations based on these raw fills to dynamically evaluate transaction slippages and fill efficiency indexes displayed in `/trades`.

---

## 🔗 Drop-In REST Client Contract (`IAICopilotClient`)

To connect the frontend to the backend later, you only need to swap the simulated adapter class inside `/lib/ai/contracts.ts` with a real implementation of the declared contract:

```typescript
export interface IAICopilotClient {
  /**
   * Streams token-by-token quant reasoning from the configured model
   */
  streamScenarioResponse(
    queryText: string,
    onToken: (token: string) => void,
    onStatusChange: (status: 'thinking' | 'streaming' | 'completed') => void,
    onToolCall: (tool: ToolInvocation) => void,
    language: 'en' | 'es'
  ): Promise<ScenarioResult>;

  /**
   * Persists an execution or advisory action into the Supabase Audit Trail
   */
  insertAuditLog(log: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<boolean>;

  /**
   * Pulls the audit ledger history for dashboard display
   */
  getAuditLogs(): Promise<AuditLogEntry[]>;
}
```

This guarantees **zero changes to component presentation markup** during backend plug-in!
