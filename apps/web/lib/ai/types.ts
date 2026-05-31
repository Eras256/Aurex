export interface AIContractState<I, O> {
  input: I;
  output: O | null;
  loading: boolean;
  error: string | null;
  empty: boolean;
}

// 1. Dashboard Overview AI Advisory
export interface DashboardAIInput {
  rollingVolume24hUSD: number;
  currentSlippageBps: number;
  meanComputeLatencyMs: number;
  recentSpreads: Array<{ venuePair: string; grossSpreadBps: number }>;
}

export interface DashboardAIOutput {
  recommendedProfitFloorUSD: number;
  sizingConfidenceScore: number; // 0.0 to 1.0
  telemetrySummary: { en: string; es: string };
  lastChecked: string;
}

// 2. Risk Parameter Calibration Assistant
export interface RiskParams {
  minNetProfitUSD: number;
  latencyDriftBufferBps: number;
  slippageSafetyBps: number;
}

export interface RiskAIInput {
  currentRiskParams: RiskParams;
  rollingVolatilityZScore: number;
}

export interface RiskAIOutput {
  suggestedParams: RiskParams;
  calibrationRationale: { en: string; es: string };
  zScoreExplanation: { en: string; es: string };
}

// 3. Spread Log Explainability (Opportunities)
export interface OpportunityAIInput {
  opportunityId: string;
  buyVenue: string;
  sellVenue: string;
  grossSpreadUSD: number;
  estimatedCostUSD: number;
}

export interface OpportunityAIOutput {
  executionRating: 'EXCELLENT' | 'HIGH_RISK' | 'SKIPPED_UNPROFITABLE';
  explainabilitySummary: { en: string; es: string };
  costBreakdown: {
    takerFeeUSD: number;
    slippageBufferUSD: number;
    latencyRiskUSD: number;
  };
}

// 4. Telemetry Diagnostics (System Health)
export interface HealthAIInput {
  jitterVarianceMs: number;
  reconnectCounts: Record<string, number>;
}

export interface HealthAIOutput {
  healthRating: 'NOMINAL' | 'DEGRADED' | 'CRITICAL';
  telemetryAnalysis: { en: string; es: string };
}

// 5. Execution Critique (Trades)
export interface TradeCritiqueInput {
  tradeId: string;
  elapsedExecutionMs: number;
  slippageUSD: number;
}

export interface TradeCritiqueOutput {
  vwapEfficiencyScore: number;
  critiqueDetails: { en: string; es: string };
}

// 6. Dedicated Copilot Workspace Auditing
export interface AuditLogEntry {
  id: string;
  created_at: string;
  session_id: string;
  operator_id: string;
  widget_source: string;
  scenario_key: string;
  prompt_version: string;
  prompt_language: string;
  user_query: string;
  model_identifier: string;
  model_latency_ms: number;
  confidence_percentage: number;
  explainability_payload: Record<string, any>;
  applied_parameters: Record<string, any> | null;
  operator_action: 'REVIEWED' | 'APPLIED_SUGGESTION' | 'REJECTED';
  final_system_decision: 'ACCEPTED' | 'REJECTED' | 'BYPASSED';
}

// 7. Chat Message
export interface ToolInvocation {
  name: string;
  status: 'executing' | 'success' | 'failed';
  result?: string;
  durationMs?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: 'thinking' | 'streaming' | 'completed';
  confidence?: number;
  explainability?: {
    rationaleEn: string;
    rationaleEs: string;
    detailsEn: string;
    detailsEs: string;
  };
  toolCalls?: ToolInvocation[];
  timestamp: string;
  suggestedParams?: RiskParams;
}
