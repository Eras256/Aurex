'use client';

import React, { useState, useEffect, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { MockAiAgent, PREDEFINED_SCENARIOS, PredefinedScenario } from '@/lib/ai/mock/mockAiAgent';
import { AuditLogEntry, ToolInvocation, RiskParams } from '@/lib/ai/types';

import { useLanguage } from '../LanguageContext';

export default function CopilotWorkspace() {
  const { t, language } = useLanguage();
  const [mounted, setMounted] = useState(false);
  
  // Model Configuration State
  const [selectedModel, setSelectedModel] = useState('AurexQuant-V2.1');
  const models = ['AurexQuant-V2.1', 'Aurex-Diagnostic-L3', 'HFT-Engine-L2'];

  // Composer State
  const [composerInput, setComposerInput] = useState('');
  
  // Active Chat State
  const [chatStatus, setChatStatus] = useState<'thinking' | 'streaming' | 'completed' | null>(null);
  const [streamedResponse, setStreamedResponse] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [explainability, setExplainability] = useState<PredefinedScenario['explainability'] | null>(null);
  const [toolLogs, setToolLogs] = useState<ToolInvocation[]>([]);
  const [activeParams, setActiveParams] = useState<RiskParams | undefined>(undefined);
  const [finalDecision, setFinalDecision] = useState<'ACCEPTED' | 'REJECTED' | 'BYPASSED' | null>(null);
  const [activeScenarioKey, setActiveScenarioKey] = useState<string>('');

  // Human-in-the-Loop Interaction States
  const [prefilledAlert, setPrefilledAlert] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  // Supabase Append-Only Audit Trail State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const logs = await MockAiAgent.getAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Triggers simulated streaming sequence for the chosen prompt
  const handleQuery = async (queryText: string) => {
    if (!queryText.trim() || chatStatus === 'thinking' || chatStatus === 'streaming') return;

    // Reset current active states
    setChatStatus('thinking');
    setStreamedResponse('');
    setConfidence(null);
    setExplainability(null);
    setToolLogs([]);
    setActiveParams(undefined);
    setFinalDecision(null);
    setPrefilledAlert(null);

    // Track sequential tool execution
    const handleToolInvocation = (tool: { name: string; status: 'executing' | 'success'; durationMs: number; result: string }) => {
      setToolLogs(prev => {
        const index = prev.findIndex(t => t.name === tool.name);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = {
            name: tool.name,
            status: tool.status === 'executing' ? 'executing' : 'success',
            result: tool.result,
            durationMs: tool.durationMs,
          };
          return updated;
        } else {
          return [...prev, {
            name: tool.name,
            status: tool.status === 'executing' ? 'executing' : 'success',
            result: tool.result,
            durationMs: tool.durationMs,
          }];
        }
      });
    };

    try {
      const meta = await MockAiAgent.streamScenarioResponse(
        queryText,
        (token) => {
          setStreamedResponse(prev => prev + token);
        },
        (status) => {
          setChatStatus(status);
        },
        handleToolInvocation,
        language
      );

      setConfidence(meta.confidence);
      setExplainability(meta.explainability);
      setActiveParams(meta.suggestedParams);
      setFinalDecision(meta.finalDecision);
      setActiveScenarioKey(meta.scenarioKey);

      // Refresh Supabase Audit table rows
      await fetchAuditLogs();
    } catch (err) {
      console.error(err);
      setChatStatus(null);
    }
  };

  // Simulates loading parameters into local storage to bind with Form fields in RiskConsole
  const handleApplyParams = async () => {
    if (!activeParams) return;
    
    // Simulate database update
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Save temporary calibration settings in localStorage for Risk Calibration View
    localStorage.setItem('aurex_suggested_calibration', JSON.stringify(activeParams));
    
    // Make live calibration fetch to backend bot through secure proxy
    try {
      const calibrateRes = await fetch('/api/bot/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profitFloor: activeParams.minNetProfitUSD,
          minSpread: activeParams.slippageSafetyBps ?? 0,
          maxExposure: 5,
          safetyBuffer: activeParams.latencyDriftBufferBps ?? 1,
          source: 'copilot',
          sessionId: 'a29b20b2-4822-4911-8ce2-47209cb14e21',
          operatorId: '8cb38a10-29c8-4721-98bc-298319a28c31'
        })
      });
      if (calibrateRes.ok) {
        console.log('✅ Dynamic parameter calibration successfully persisted on Fly.io bot in memory.');
      }
    } catch (err) {
      console.warn('Backend calibration failed, falling back to simulated localStorage preload:', err);
    }
    
    setPrefilledAlert(
      language === 'en'
        ? '✅ Suggestions safely loaded! Parameters are pre-filled in the Risk Calibration form. Review and click "Persist Configuration" on the Risk Control panel to save.'
        : '✅ Parámetros cargados con éxito! Los campos se han pre-rellenado en el panel de Control de Riesgo. Revíselos y haga clic en "Persist Configuration" para guardar.'
    );

    // Update log audit action state
    if (auditLogs.length > 0) {
      try {
        const topLog = auditLogs[0];
        // Insert a new confirmation audit transaction in Supabase
        await MockAiAgent.insertAuditLog({
          session_id: topLog.session_id,
          operator_id: topLog.operator_id,
          widget_source: 'COPILOT_WORKSPACE',
          scenario_key: topLog.scenario_key,
          prompt_version: topLog.prompt_version,
          prompt_language: topLog.prompt_language,
          user_query: topLog.user_query,
          model_identifier: topLog.model_identifier,
          model_latency_ms: 150,
          confidence_percentage: topLog.confidence_percentage,
          explainability_payload: topLog.explainability_payload,
          applied_parameters: { ...activeParams },
          operator_action: 'APPLIED_SUGGESTION',
          final_system_decision: topLog.final_system_decision
        });
        await fetchAuditLogs();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleLoadSuggestion = () => {
    setPrefilledAlert(
      language === 'en'
        ? '📥 Stablecoin rebalancing path staged successfully. Operator action logged in the audit ledger.'
        : '📥 Ruta de rebalanceo de stablecoins cargada con éxito. Acción del operador registrada en la bitácora.'
    );
  };

  if (!mounted) {
    return <div className="text-slate-500 font-mono text-xs">Loading copilot console...</div>;
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER SECTION */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl -z-10 pointer-events-none"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              {t('copilot.subtitle')}
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-3 font-sans">
              {t('copilot.title')}
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-3xl mt-1.5 leading-relaxed font-mono">
              {t('copilot.desc')}
            </p>
          </div>
          
          {/* Model Selector Selector */}
          <div className="flex flex-col gap-1 shrink-0 bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 font-bold">
              {t('copilot.model')}
            </span>
            <div className="flex gap-2 mt-1">
              {models.map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedModel(m)}
                  className={`px-3 py-1 text-[10px] font-mono rounded-md border transition-all ${
                    selectedModel === m
                      ? 'bg-gold border-gold text-darkBg font-bold'
                      : 'bg-white/5 text-slate-400 border-white/5 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CORE WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: SCENARIOS & COMPOSER */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* PRESETS LIST */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs">{t('copilot.presets')}</CardTitle>
              <CardDescription className="text-[10px] font-mono">
                {t('copilot.presets_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PREDEFINED_SCENARIOS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => {
                      setComposerInput(s.triggerPrefix);
                      handleQuery(s.triggerPrefix);
                    }}
                    disabled={chatStatus === 'thinking' || chatStatus === 'streaming'}
                    className="text-left px-3 py-2.5 rounded-lg border border-white/5 bg-slate-950/20 text-[11px] font-mono text-slate-300 hover:border-amber-500/30 hover:text-white transition-all disabled:opacity-50 flex items-center justify-between"
                  >
                    <span>{s.triggerPrefix.substring(0, 50)}...</span>
                    <span className="text-[9px] text-amber-500 shrink-0 select-none ml-2">&rarr;</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* COMPOSER BOX */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs">{t('copilot.composer')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={composerInput}
                  onChange={(e) => setComposerInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuery(composerInput)}
                  placeholder={t('copilot.placeholder')}
                  disabled={chatStatus === 'thinking' || chatStatus === 'streaming'}
                  className="flex-1 bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50"
                />
                <Button
                  onClick={() => handleQuery(composerInput)}
                  disabled={chatStatus === 'thinking' || chatStatus === 'streaming' || !composerInput.trim()}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border border-amber-600/30 shrink-0 text-xs px-5 rounded-xl disabled:opacity-50"
                >
                  {t('copilot.execute')}
                </Button>
              </div>

              {/* STREAMING RESPONSE BLOCK */}
              {chatStatus && (
                <div className="border border-white/5 bg-slate-950/30 rounded-xl p-5 space-y-4 font-mono">
                  {/* Status Indicator */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${chatStatus === 'completed' ? 'bg-emerald-400' : 'bg-amber-500 animate-pulse'}`}></span>
                      <span>
                        {chatStatus === 'thinking' && t('copilot.thinking')}
                        {chatStatus === 'streaming' && t('copilot.streaming')}
                        {chatStatus === 'completed' && t('copilot.stream_done')}
                      </span>
                    </div>
                    {confidence !== null && (
                      <div className="flex items-center gap-1.5 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold text-amber-500">
                        🛡️ {t('copilot.confidence')}: {(confidence * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>

                  {/* Dynamic Tool Calls Stream */}
                  {toolLogs.length > 0 && (
                    <div className="bg-slate-950/50 border border-white/5 p-3 rounded-lg space-y-2">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                        🔧 {t('copilot.tools')}
                      </span>
                      {toolLogs.map((tool, idx) => (
                        <div key={idx} className="flex items-start justify-between text-[10px] font-mono leading-relaxed">
                          <span className="text-slate-400">
                            {tool.status === 'executing' ? '⏳' : '✅'} sys::
                            <span className="text-sky-400">{tool.name}</span>()
                          </span>
                          <span className={`${tool.status === 'executing' ? 'text-amber-500 animate-pulse' : 'text-emerald-400'} text-[9px] max-w-[50%] truncate`}>
                            {tool.status === 'executing' ? t('copilot.invoking') : `${tool.result} (${tool.durationMs}ms)`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Core Content Output */}
                  <div className="text-xs text-slate-200 leading-relaxed font-sans prose prose-invert max-w-none pt-2">
                    {chatStatus === 'thinking' && streamedResponse === '' ? (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-4 bg-white/5 rounded w-3/4"></div>
                        <div className="h-4 bg-white/5 rounded w-1/2"></div>
                      </div>
                    ) : (
                      <div className="whitespace-pre-line font-mono text-[11px] leading-relaxed text-slate-300">
                        {streamedResponse}
                      </div>
                    )}
                  </div>

                  {/* HUMAN ACTION TRIGGERS */}
                  {chatStatus === 'completed' && (
                    <div className="border-t border-white/5 pt-4 flex flex-wrap gap-2 justify-end">
                      {activeParams && (
                        <Button
                          onClick={handleApplyParams}
                          variant="default"
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border border-amber-600/30 text-[10px] px-3.5 py-1.5 h-auto rounded-lg"
                        >
                          ⚙️ {t('copilot.apply')}
                        </Button>
                      )}
                      {activeScenarioKey === 'rebalance_strategy' && (
                        <Button
                          onClick={handleLoadSuggestion}
                          className="bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[10px] px-3.5 py-1.5 h-auto rounded-lg"
                        >
                          📥 {t('copilot.load')}
                        </Button>
                      )}
                      <Button
                        onClick={() => setShowDrawer(true)}
                        variant="outline"
                        className="border-white/15 bg-white/5 hover:bg-white/10 text-white text-[10px] px-3.5 py-1.5 h-auto rounded-lg"
                      >
                        👁️ {t('widget.ai_review_btn')}
                      </Button>
                    </div>
                  )}

                  {/* Active Prefilled Alert Notification */}
                  {prefilledAlert && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-[10px] leading-normal font-sans">
                      {prefilledAlert}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: RATIONALE DRAWER & EXPLAINABILITY */}
        <div className="space-y-6">
          {/* EXPLAINABILITY PANEL */}
          <Card>
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-xs">🔬 {t('copilot.rationale')}</CardTitle>
              <CardDescription className="text-[10px] font-mono">{t('copilot.rationale_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
              {explainability ? (
                <div className="space-y-4 font-mono text-[11px]">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                      {t('copilot.zscore_rationale')}
                    </span>
                    <p className="text-slate-300 leading-normal font-sans">
                      {language === 'en' ? explainability.rationaleEn : explainability.rationaleEs}
                    </p>
                  </div>
                  <div className="border-t border-white/5 pt-3">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                      {t('copilot.algorithmic_walk')}
                    </span>
                    <p className="text-slate-300 leading-normal font-sans">
                      {language === 'en' ? explainability.detailsEn : explainability.detailsEs}
                    </p>
                  </div>
                  {finalDecision && (
                    <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                        {t('copilot.audit_col_decision')}
                      </span>
                      <Badge
                        variant={
                          finalDecision === 'ACCEPTED'
                            ? 'success'
                            : finalDecision === 'REJECTED'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-[9px] font-bold uppercase font-mono py-0.5 px-2 rounded"
                      >
                        {finalDecision}
                      </Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-500 font-mono text-[10px] text-center py-8">
                  {t('copilot.awaiting_execution')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* SIMULATED SYSTEM SECURITY GATES */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs">{t('copilot.governance')}</CardTitle>
            </CardHeader>
            <CardContent className="text-[10px] font-mono space-y-3 text-slate-400 leading-normal font-sans">
              <div className="flex gap-2">
                <span className="text-amber-500 shrink-0 font-mono text-xs">⚠️</span>
                <p>
                  {language === 'en' ? (
                    <><strong>Advisory-Only Mode:</strong> The Copilot cannot write trade executions directly to exchanges. All recommendations are advisory-only.</>
                  ) : (
                    <><strong>Modo de Solo Asesoría:</strong> El Copiloto no puede emitir ejecuciones de operaciones directamente en los exchanges. Todas las recomendaciones son únicamente de carácter consultivo.</>
                  )}
                </p>
              </div>
              <div className="flex gap-2 border-t border-white/5 pt-3">
                <span className="text-emerald-400 shrink-0 font-mono text-xs">✓</span>
                <p>
                  {language === 'en' ? (
                    <><strong>Immutable Audit Logging:</strong> Operates under database-enforced immutability. No updates or deletions are permitted on compiled records.</>
                  ) : (
                    <><strong>Registro de Auditoría Inmutable:</strong> Opera bajo inmutabilidad forzada por la base de datos. No se permiten actualizaciones ni eliminaciones en los registros recopilados.</>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DENSE IMMUTABLE AUDIT TRAIL TABLE PANEL */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-white/5">
          <div>
            <CardTitle className="text-xs">{t('copilot.audit')}</CardTitle>
            <CardDescription className="text-[10px] font-mono">
              {t('copilot.audit_desc')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase font-mono tracking-widest text-slate-500 font-bold">
              {t('copilot.secure_ledger')}
            </span>
            <Badge variant="success" className="text-[9px] font-mono py-0.5 px-2 font-bold uppercase rounded">
              {t('copilot.append_only')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6 py-3">{t('copilot.audit_col_time')}</TableHead>
                <TableHead className="px-6 py-3">{t('copilot.audit_col_scenario')}</TableHead>
                <TableHead className="px-6 py-3">{t('copilot.audit_col_source')}</TableHead>
                <TableHead className="px-6 py-3">{t('copilot.audit_col_action')}</TableHead>
                <TableHead className="px-6 py-3">{t('copilot.audit_col_decision')}</TableHead>
                <TableHead className="px-6 py-3 text-right">{t('copilot.audit_col_latency')}</TableHead>
                <TableHead className="px-6 py-3 text-right">{t('copilot.confidence')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-500 font-mono text-xs">
                    {t('copilot.reconciling')}
                  </TableCell>
                </TableRow>
              ) : auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-500 font-mono text-xs">
                    {t('copilot.audit_empty')}
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-white/5 transition-colors font-mono text-[10px] leading-relaxed">
                    <TableCell className="px-6 py-3 text-slate-500">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="px-6 py-3 text-slate-200">
                      <span className="font-semibold block max-w-[200px] truncate">{log.user_query}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{log.model_identifier} ({log.prompt_version})</span>
                    </TableCell>
                    <TableCell className="px-6 py-3 text-sky-400">
                      {log.widget_source}
                    </TableCell>
                    <TableCell className="px-6 py-3">
                      <Badge variant={log.operator_action === 'APPLIED_SUGGESTION' ? 'success' : 'secondary'} className="text-[8px] font-bold py-0.5 px-2 uppercase rounded">
                        {log.operator_action}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-3">
                      <Badge variant={log.final_system_decision === 'ACCEPTED' ? 'success' : log.final_system_decision === 'REJECTED' ? 'destructive' : 'secondary'} className="text-[8px] font-bold py-0.5 px-2 uppercase rounded">
                        {log.final_system_decision}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right text-slate-400">
                      {log.model_latency_ms} ms
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right text-amber-500 font-semibold">
                      {log.confidence_percentage.toFixed(0)}%
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* HUMAN VERIFICATION DRAWER (DIALOG PANEL) */}
      {showDrawer && explainability && (
        <div className="fixed inset-0 bg-darkBg/80 backdrop-blur-sm z-50 flex justify-end animate-fadeIn">
          <div className="w-full max-w-lg bg-darkCard border-l border-white/10 h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">{t('copilot.drawer_title')}</h3>
                  <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">
                    {t('copilot.drawer_subtitle')}
                  </p>
                </div>
                <button
                  onClick={() => setShowDrawer(false)}
                  className="text-slate-400 hover:text-white font-bold font-mono text-sm"
                >
                  [✕]
                </button>
              </div>

              <div className="space-y-4 text-xs font-mono">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-3">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                    {t('copilot.telemetry_overview')}
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
                    <div>{t('copilot.model_label')} <span className="text-white">{selectedModel}</span></div>
                    <div>{t('copilot.source_label')} <span className="text-sky-400">COPILOT_WORKSPACE</span></div>
                    <div>{t('copilot.confidence_label')} <span className="text-amber-500 font-bold">{(confidence ? confidence * 100 : 0).toFixed(0)}%</span></div>
                    <div>{t('copilot.latency_label')} <span className="text-white">{(explainability ? 1450 : 0)} ms</span></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                    {t('copilot.execution_rationale')}
                  </span>
                  <p className="text-slate-300 leading-relaxed font-sans text-[11px]">
                    {language === 'en' ? explainability.rationaleEn : explainability.rationaleEs}
                  </p>
                </div>

                <div className="space-y-2 border-t border-white/5 pt-3">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                    {t('copilot.safety_evaluation')}
                  </span>
                  <p className="text-slate-300 leading-relaxed font-sans text-[11px]">
                    {language === 'en' ? explainability.detailsEn : explainability.detailsEs}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex gap-2 justify-end">
              <Button
                onClick={() => setShowDrawer(false)}
                variant="outline"
                className="border-white/10 bg-white/5 text-white text-[10px] font-bold px-4 py-2"
              >
                {t('copilot.dismiss')}
              </Button>
              {activeParams && (
                <Button
                  onClick={() => {
                    handleApplyParams();
                    setShowDrawer(false);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border border-amber-600/30 text-[10px] px-4 py-2"
                >
                  {t('copilot.apply')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
