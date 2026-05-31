'use client';

import React, { useState, useEffect } from 'react';


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

import { useWebSocket } from '../WebSocketContext';

export default function RiskSettingsPage() {
  const { state, updateConfig, triggerReset } = useWebSocket();

  // Settings form states (initial values mirror the engine defaults; synced from the
  // live backend config as soon as the first StatePayload arrives).
  const [minNetProfitUSD, setMinNetProfitUSD] = useState(0.25);
  const [maxPositionBTC, setMaxPositionBTC] = useState(2.0);
  const [latencySafetyBps, setLatencySafetyBps] = useState(1);
  const [slippageSafetyBps, setSlippageSafetyBps] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Dialog state for simulation reset confirmation modal
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  // Sync inputs with active backend config on message loads
  useEffect(() => {
    if (state?.config) {
      setMinNetProfitUSD(state.config.minNetProfitUSD);
      setMaxPositionBTC(state.config.maxPositionBTCPerExchange);
      setLatencySafetyBps(state.config.latencySafetyBps);
      setSlippageSafetyBps(state.config.slippageSafetyBps);
      setIsPaused(state.config.isPaused);
    }
  }, [state?.config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus('Saving changes...');

    const success = await updateConfig({
      ...state?.config,
      minNetProfitUSD,
      maxPositionBTCPerExchange: maxPositionBTC,
      latencySafetyBps,
      slippageSafetyBps,
      isPaused,
    });

    setSaving(false);
    if (success) {
      setSaveStatus('✅ Configuration updated and persisted.');
      setTimeout(() => setSaveStatus(null), 3000);
    } else {
      setSaveStatus('❌ Failed to update backend configuration.');
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
      alert('🔄 Simulation database successfully reset to defaults.');
    } else {
      alert('❌ Failed to complete database reset. Check logs.');
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
            Risk Oversight Console
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Calibrate arbitrage validation parameters, activate system breakers, and manage transaction limits.
          </p>
        </div>

        {/* Engine emergency freeze control using premium Switch */}
        <Card className="flex items-center gap-4 py-2.5 px-4 bg-slate-950 border border-white/10 shrink-0 self-start shadow-lg">
          <span className="font-mono text-xs font-semibold text-slate-300">SYSTEM CIRCUIT BREAKER</span>
          <Switch
            checked={isPaused}
            onCheckedChange={handlePauseToggle}
            aria-label="Toggle emergency pause"
          />
        </Card>
      </div>

      {/* 2. RISK SYSTEM INDICATOR PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className={`border ${riskStatus.status === 'COOLDOWN' ? 'border-rose-500/30 animate-pulse' : 'border-white/5'} md:col-span-2 flex flex-col justify-between`}>
          <CardHeader className="pb-0 border-b-0">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">RISK ENGINE SYSTEM HEALTH</span>
            <div className="flex items-center gap-3 mt-2">
              <span className={`w-3 h-3 rounded-full ${
                riskStatus.status === 'SAFE' 
                  ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' 
                  : riskStatus.status === 'WARNING' 
                    ? 'bg-amber-400 shadow-lg shadow-amber-500/20' 
                    : 'bg-rose-500 shadow-lg shadow-rose-500/20'
              }`}></span>
              <h3 className="text-lg font-bold text-white font-mono uppercase tracking-wide">
                CIRCUIT STATUS: {riskStatus.status}
              </h3>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex-1">
            <p className="text-xs text-slate-400 font-mono leading-relaxed bg-slate-950/40 p-3 rounded border border-white/5">
              {riskStatus.reason || 'All circuit parameters running within safe boundaries. Slippage breakers fully armed.'}
            </p>
          </CardContent>
          <CardContent className="border-t border-white/5 pt-4 mt-6 grid grid-cols-2 gap-4 text-xs font-mono text-slate-400 pb-4">
            <div>
              <span>CONSECUTIVE LOSSES:</span>
              <p className="text-sm font-bold text-white">{riskStatus.consecutiveLosses} / 3</p>
            </div>
            <div>
              <span>COOLDOWN TIMER:</span>
              <p className="text-sm font-bold text-white">
                {riskStatus.isCoolingDown 
                  ? `${Math.max(0, Math.ceil((riskStatus.cooldownUntil - Date.now()) / 1000))}s remaining` 
                  : 'INACTIVE'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* SIMULATION RESET CARD */}
        <Card className="flex flex-col justify-between border border-rose-500/10 bg-slate-900/50">
          <CardHeader className="pb-0 border-b-0">
            <span className="text-[10px] text-rose-400 font-mono tracking-wider uppercase">Emergency Operations</span>
            <h3 className="font-semibold text-sm tracking-wide text-white uppercase mt-1">Rebalance Reserve Pool</h3>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Flushes trades, opportunities, and logs databases, restoring exchange funds back to default symmetric pools.
            </p>
          </CardContent>
          <CardContent className="pt-0 pb-4 mt-auto">
            <Button
              variant="destructive"
              className="w-full py-2.5"
              onClick={() => setIsResetDialogOpen(true)}
              disabled={resetting}
            >
              {resetting ? 'Resetting Balances...' : '🔄 RESET SIMULATED BALANCES'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 3. SETTINGS FORM WITH PREMIUM SLIDERS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs">Risk Oversight Settings</CardTitle>
          <CardDescription>Calibrate mathematical depth-walk parameters and fee/latency hedges.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Slider 1: Min Net Profit */}
              <div className="space-y-4 bg-slate-950/20 p-4 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400 uppercase tracking-wider block">Minimum Net Profit</span>
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
                <span className="text-[10px] text-slate-500 font-mono block">Spread threshold required to trigger simulated orders</span>
              </div>

              {/* Slider 2: Max Exposure */}
              <div className="space-y-4 bg-slate-950/20 p-4 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400 uppercase tracking-wider block">Max Allocation Ceiling</span>
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
                <span className="text-[10px] text-slate-500 font-mono block">Exposure roof capping single transaction sizes</span>
              </div>

              {/* Slider 3: Latency Buffer */}
              <div className="space-y-4 bg-slate-950/20 p-4 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400 uppercase tracking-wider block">Latency Safety Buffer</span>
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
                <span className="text-[10px] text-slate-500 font-mono block">1 BPS = 0.01%. Expected profit buffer for WebSocket lag rejections</span>
              </div>

              {/* Slider 4: Slippage Buffer */}
              <div className="space-y-4 bg-slate-950/20 p-4 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400 uppercase tracking-wider block">Slippage Safety Buffer</span>
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
                <span className="text-[10px] text-slate-500 font-mono block">Extra safety buffer used to deduct simulated fill prices</span>
              </div>

            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-white/5 pt-6 mt-8">
              <span className="text-xs text-slate-400 font-mono font-medium">{saveStatus || ''}</span>
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? 'Persisting changes...' : 'Save Configuration Changes'}
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
              🚨 Reset Simulation State
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 mt-2 font-sans leading-relaxed">
              WARNING: This action will flush all transaction history, opportunities, and log databases, resetting exchange wallet assets back to initial allocations.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 text-xs font-mono text-slate-500 bg-slate-900/40 p-3.5 border border-white/5 rounded-lg leading-relaxed">
            This execution clears simulated ledger data and restores baseline allocations. This action is irreversible.
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeReset} disabled={resetting}>
              {resetting ? 'Resetting Balances...' : 'Confirm Reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
