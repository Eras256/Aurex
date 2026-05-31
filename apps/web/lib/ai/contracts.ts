import {
  DashboardAIInput,
  DashboardAIOutput,
  RiskAIInput,
  RiskAIOutput,
  OpportunityAIInput,
  OpportunityAIOutput,
  HealthAIInput,
  HealthAIOutput,
  TradeCritiqueInput,
  TradeCritiqueOutput,
  AuditLogEntry,
} from './types';

export interface IAICopilotClient {
  generateAdvisory(input: DashboardAIInput): Promise<DashboardAIOutput>;
  calibrateRisk(input: RiskAIInput): Promise<RiskAIOutput>;
  explainOpportunity(input: OpportunityAIInput): Promise<OpportunityAIOutput>;
  diagnoseHealth(input: HealthAIInput): Promise<HealthAIOutput>;
  critiqueTrade(input: TradeCritiqueInput): Promise<TradeCritiqueOutput>;
  
  // Hardened Immutability Audits
  insertAuditLog(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<{ success: boolean; id: string }>;
  getAuditLogs(): Promise<AuditLogEntry[]>;
}
