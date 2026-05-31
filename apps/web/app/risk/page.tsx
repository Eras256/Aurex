'use client';

import React, { useState, useEffect } from 'react';


import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { MockRiskAdvisor } from '@/lib/ai/mock/mockRiskAdvisor';
import { RiskAIOutput } from '@/lib/ai/types';

import { useLanguage } from '../LanguageContext';
import { useWebSocket } from '../WebSocketContext';

export default function RiskSettingsPage() {
  const { state, updateConfig, triggerReset } = useWebSocket();
  const { t, language } = useLanguage();

  // Settings form states
  const [minNetProfitUSD, setMinNetProfitUSD] = useState(0.25);
  const [maxPositionBTC, setMaxPositionBTC] = useState(2.0);
  const [latencySafetyBps, setLatencySafetyBps] = useState(1);
  const [slippageSafetyBps, setSlippageSafetyBps] = useState(0);
  const [executionLatencyMs, setExecutionLatencyMs] = useState(75);
  const [isPaused, setIsPaused] = useState(false);

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Dialog state for simulation reset confirmation modal
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  // AI Calibration State (Phase 1)
  const [aiCalibration, setAiCalibration] = useState<RiskAIOutput | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!state?.config) return;
    const fetchCalibration = async () => {
      setAiLoading(true);
      try {
        const res = await MockRiskAdvisor.calibrateRisk({
          currentRiskParams: {
            minNetProfitUSD: state.config.minNetProfitUSD,
            latencyDriftBufferBps: state.config.latencySafetyBps,
            slippageSafetyBps: state.config.slippageSafetyBps,
          },
          rollingVolatilityZScore: 2.14 // Simulated high-frequency telemetry volatility Z-score
        });
        setAiCalibration(res);
      } catch (err) {
        console.error(err);
      } finally {
        setAiLoading(false);
      }
    };
    fetchCalibration();
  }, [state?.config]);

  const handleApplyAIParams = () => {
    if (!aiCalibration) return;
    
    // Controlled human pre-fill autofill
    setMinNetProfitUSD(aiCalibration.suggestedParams.minNetProfitUSD);
    setLatencySafetyBps(aiCalibration.suggestedParams.latencyDriftBufferBps);
    setSlippageSafetyBps(aiCalibration.suggestedParams.slippageSafetyBps);

    setAiStatusMessage(
      language === 'es'
        ? '💡 ¡Calibración cargada en el formulario! Revise los parámetros y haga clic en "Persist Configuration" para guardarlos.'
        : '💡 Calibration pre-filled successfully! Review parameters and click "Persist Configuration" to save.'
    );
    setTimeout(() => setAiStatusMessage(null), 5000);
  };

  // Sync inputs with active backend config on message loads
  useEffect(() => {
    if (state?.config) {
      setMinNetProfitUSD(state.config.minNetProfitUSD);
      setMaxPositionBTC(state.config.maxPositionBTCPerExchange);
      setLatencySafetyBps(state.config.latencySafetyBps);
      setSlippageSafetyBps(state.config.slippageSafetyBps);
      setExecutionLatencyMs(state.config.executionLatencyMs);
      setIsPaused(state.config.isPaused);
    }
  }, [state?.config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state?.config) return;
    setSaving(true);
    setSaveStatus(t('risk.saving_msg'));

    const success = await updateConfig({
      ...state.config,
      minNetProfitUSD,
      maxPositionBTCPerExchange: maxPositionBTC,
      latencySafetyBps,
      slippageSafetyBps,
      executionLatencyMs,
      isPaused,
    });

    setSaving(false);
    if (success) {
      setSaveStatus(t('risk.success_msg'));
      setTimeout(() => setSaveStatus(null), 3000);
    } else {
      setSaveStatus(t('risk.error_msg'));
    }
  };

  const handlePauseToggle = async (checked: boolean) => {
    if (!state?.config) return;
    setIsPaused(checked);
    
    await updateConfig({
      ...state.config,
      isPaused: checked,
    });
  };

  const executeReset = async () => {
    setIsResetDialogOpen(false);
    setResetting(true);
    const success = await triggerReset();
    setResetting(false);

    if (success) {
      alert(t('risk.alert_success'));
    } else {
      alert(t('risk.alert_error'));
    }
  };

  const riskStatus = state?.risk || {
    status: 'SAFE' as const,
    isCoolingDown: false,
    cooldownUntil: 0,
    consecutiveLosses: 0,
    reason: undefined as string | undefined,
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER */}
      <div className="pb-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t('risk.title_header')}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {t('risk.subtitle_header')}
          </p>
        </div>

        {/* Engine emergency freeze control using premium Switch */}
        <Card className="flex items-center gap-4 py-2.5 px-4 bg-slate-950 border border-white/10 shrink-0 self-start shadow-lg">
          <span className="font-mono text-xs font-semibold text-slate-300">{t('risk.system_breaker')}</span>
          <Switch
            checked={isPaused}
            onCheckedChange={handlePauseToggle}
            aria-label={t('risk.pause_aria')}
          />
        </Card>
      </div>

      {/* 2. RISK SYSTEM INDICATOR PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className={`border ${riskStatus.status === 'COOLDOWN' ? 'border-rose-500/30 animate-pulse' : 'border-white/5'} md:col-span-2 flex flex-col justify-between`}>
          <CardHeader className="pb-0 border-b-0">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{t('risk.engine_health')}</span>
            <div className="flex items-center gap-3 mt-2">
              <span className={`w-3 h-3 rounded-full ${
                riskStatus.status === 'SAFE' 
                  ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' 
                  : riskStatus.status === 'WARNING' 
                    ? 'bg-amber-400 shadow-lg shadow-amber-500/20' 
                    : 'bg-rose-500 shadow-lg shadow-rose-500/20'
              }`}></span>
              <h3 className="text-lg font-bold text-white font-mono uppercase tracking-wide">
                {t('risk.circuit_status')}: {
                  riskStatus.status === 'SAFE' 
                    ? t('risk.cooldown_inactive') 
                    : riskStatus.status === 'COOLDOWN' 
                      ? t('risk.cooldown_active') 
                      : riskStatus.status
                }
              </h3>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex-1">
            <p className="text-xs text-slate-400 font-mono leading-relaxed bg-slate-950/40 p-3 rounded border border-white/5">
              {riskStatus.reason || t('risk.default_reason')}
            </p>
          </CardContent>
          <CardContent className="border-t border-white/5 pt-4 mt-6 grid grid-cols-2 gap-4 text-xs font-mono text-slate-400 pb-4">
            <div>
              <span>{t('risk.consecutive_losses')}:</span>
              <p className="text-sm font-bold text-white">{riskStatus.consecutiveLosses} / 3</p>
            </div>
            <div>
              <span>{t('risk.cooldown_timer')}:</span>
              <p className="text-sm font-bold text-white">
                {riskStatus.isCoolingDown 
                  ? `${Math.max(0, Math.ceil((riskStatus.cooldownUntil - Date.now()) / 1000))}${t('risk.seconds_remaining')}` 
                  : t('risk.inactive')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* SIMULATION RESET CARD */}
        <Card className="flex flex-col justify-between border border-rose-500/10 bg-slate-900/50">
          <CardHeader className="pb-0 border-b-0">
            <span className="text-[10px] text-rose-400 font-mono tracking-wider uppercase">{t('risk.emergency_ops')}</span>
            <h3 className="font-semibold text-sm tracking-wide text-white uppercase mt-1">{t('risk.rebalance_title')}</h3>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              {t('risk.rebalance_desc')}
            </p>
          </CardContent>
          <CardContent className="pt-0 pb-4 mt-auto">
            <Button
              variant="destructive"
              className="w-full py-2.5"
              onClick={() => setIsResetDialogOpen(true)}
              disabled={resetting}
            >
              {resetting ? t('risk.resetting_btn') : `🔄 ${t('risk.reset_balances_btn')}`}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 2d. INTEGRATED AI QUANT CALIBRATION ASSISTANT (Phase 1) */}
      <Card glow className="border-amber-500/10 bg-slate-950/20 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
              <CardTitle className="text-xs uppercase font-mono tracking-wider">{t('widget.ai_advisor')}</CardTitle>
            </div>
            <CardDescription className="text-[10px] font-mono mt-0.5">{t('risk.settings_desc')}</CardDescription>
          </div>
          <Badge variant="outline" className="text-[9px] border-amber-500/25 text-amber-500 font-mono tracking-wider font-semibold uppercase animate-pulse">
            🛡️ {t('widget.ai_advisory_only')}
          </Badge>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-4">
          {aiLoading && !aiCalibration ? (
            <div className="space-y-2 animate-pulse py-2">
              <div className="h-4 bg-white/5 rounded w-3/4"></div>
              <div className="h-3 bg-white/5 rounded w-1/2"></div>
            </div>
          ) : aiCalibration ? (
            <div className="space-y-4 font-mono text-[11px]">
              
              {/* Telemetry Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-white/5 pb-4">
                <div className="md:col-span-2 space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                    Volatility Risk Audit (Z-Score: 2.14)
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {language === 'es' ? aiCalibration.calibrationRationale.es : aiCalibration.calibrationRationale.en}
                  </p>
                  <span className="text-[9px] text-slate-500 font-mono block mt-1">
                    {language === 'es' ? aiCalibration.zScoreExplanation.es : aiCalibration.zScoreExplanation.en}
                  </span>
                </div>

                <div className="space-y-2 bg-slate-950/40 p-3 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block text-center md:text-left">
                    Calibration Proposals
                  </span>
                  <div className="space-y-1.5 text-[10px] text-slate-300">
                    <div className="flex justify-between">
                      <span>Profit Floor:</span>
                      <span className="text-amber-500 font-bold">${aiCalibration.suggestedParams.minNetProfitUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Latency Drift:</span>
                      <span className="text-amber-500 font-bold">{aiCalibration.suggestedParams.latencyDriftBufferBps} BPS</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Slippage Safety:</span>
                      <span className="text-amber-500 font-bold">{aiCalibration.suggestedParams.slippageSafetyBps} BPS</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <span className="text-slate-400 text-[10px] max-w-md font-sans leading-normal block">
                  *Clicking Apply pre-fills the form sliders. You must manually click the &quot;Persist Configuration&quot; button below to compile and save.
                </span>
                <div className="flex gap-2 shrink-0 self-end">
                  <Button
                    type="button"
                    onClick={handleApplyAIParams}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border border-amber-600/30 text-[10px] px-4 py-2 rounded-lg"
                  >
                    ⚙️ {t('widget.ai_apply_btn')}
                  </Button>
                </div>
              </div>

              {/* Status Message banner */}
              {aiStatusMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-[10px] leading-normal font-sans">
                  {aiStatusMessage}
                </div>
              )}

            </div>
          ) : (
            <div className="text-[10px] text-slate-500 font-mono text-center py-4">
              Awaiting telemetry sync... calibration suggestions offline.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. SETTINGS FORM WITH PREMIUM SLIDERS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs">{t('risk.settings_title')}</CardTitle>
          <CardDescription>{t('risk.settings_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Slider 1: Min Net Profit */}
              <div className="space-y-4 bg-slate-950/20 p-4 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400 uppercase tracking-wider block">{t('risk.min_profit_title')}</span>
                  <span className="text-amber-500 font-bold text-sm bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    ${minNetProfitUSD.toFixed(1)} USD
                  </span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={0.1}
                  value={[minNetProfitUSD]}
                  onValueChange={(val) => setMinNetProfitUSD(val[0])}
                  className="w-full"
                />
                <span className="text-[10px] text-slate-500 font-mono block">{t('risk.min_profit_desc')}</span>
              </div>

              {/* Slider 2: Max Exposure */}
              <div className="space-y-4 bg-slate-950/20 p-4 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400 uppercase tracking-wider block">{t('risk.max_alloc_title')}</span>
                  <span className="text-amber-500 font-bold text-sm bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {maxPositionBTC.toFixed(1)} BTC
                  </span>
                </div>
                <Slider
                  min={0.1}
                  max={5.0}
                  step={0.1}
                  value={[maxPositionBTC]}
                  onValueChange={(val) => setMaxPositionBTC(val[0])}
                  className="w-full"
                />
                <span className="text-[10px] text-slate-500 font-mono block">{t('risk.max_alloc_desc')}</span>
              </div>

              {/* Slider 3: Latency Buffer */}
              <div className="space-y-4 bg-slate-950/20 p-4 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400 uppercase tracking-wider block">{t('risk.latency_title')}</span>
                  <span className="text-amber-500 font-bold text-sm bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {latencySafetyBps} BPS
                  </span>
                </div>
                <Slider
                  min={0}
                  max={50}
                  step={1}
                  value={[latencySafetyBps]}
                  onValueChange={(val) => setLatencySafetyBps(val[0])}
                  className="w-full"
                />
                <span className="text-[10px] text-slate-500 font-mono block">{t('risk.latency_desc')}</span>
              </div>

              {/* Slider 4: Slippage Buffer */}
              <div className="space-y-4 bg-slate-950/20 p-4 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400 uppercase tracking-wider block">{t('risk.slippage_title')}</span>
                  <span className="text-amber-500 font-bold text-sm bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {slippageSafetyBps} BPS
                  </span>
                </div>
                <Slider
                  min={0}
                  max={20}
                  step={1}
                  value={[slippageSafetyBps]}
                  onValueChange={(val) => setSlippageSafetyBps(val[0])}
                  className="w-full"
                />
                <span className="text-[10px] text-slate-500 font-mono block">{t('risk.slippage_desc')}</span>
              </div>

              {/* Slider 5: Execution-window latency (drives the adverse-move abort model) */}
              <div className="space-y-4 bg-slate-950/20 p-4 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400 uppercase tracking-wider block">{t('risk.exec_latency_title')}</span>
                  <span className="text-amber-500 font-bold text-sm bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {executionLatencyMs} ms
                  </span>
                </div>
                <Slider
                  min={0}
                  max={300}
                  step={5}
                  value={[executionLatencyMs]}
                  onValueChange={(val) => setExecutionLatencyMs(val[0])}
                  className="w-full"
                />
                <span className="text-[10px] text-slate-500 font-mono block">{t('risk.exec_latency_desc')}</span>
              </div>

            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-white/5 pt-6 mt-8">
              <span className="text-xs text-slate-400 font-mono font-medium">{saveStatus || ''}</span>
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? t('risk.persisting_btn') : t('risk.save_config_btn')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* DYNAMIC CONFIRMATION MODAL DIALOG */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="max-w-md border border-rose-500/20 bg-slate-950 text-slate-100 font-sans shadow-2xl shadow-rose-950/10">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider uppercase font-mono text-rose-500 flex items-center gap-2">
              {t('risk.dialog_title')}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 mt-2 font-sans leading-relaxed">
              {t('risk.dialog_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 text-xs font-mono text-slate-500 bg-slate-900/40 p-3.5 border border-white/5 rounded-lg leading-relaxed">
            {t('risk.dialog_body')}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)} disabled={resetting}>
              {t('risk.cancel')}
            </Button>
            <Button variant="destructive" onClick={executeReset} disabled={resetting}>
              {resetting ? t('risk.resetting_btn') : t('risk.confirm_reset')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
