'use client';

import { env } from '@arbitrage/config';
import React, { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { RealAiAgent } from '@/lib/ai/realAiAgent';
import { HealthAIOutput } from '@/lib/ai/types';

import { useLanguage } from '../LanguageContext';
import { useWebSocket } from '../WebSocketContext';

export default function SystemHealthPage() {
  const { state, connected, backendUrl } = useWebSocket();
  const { t, language } = useLanguage();

  const conn = state?.connections || {
    binance: { connected: false, reconnects: 0, lastMessageAt: 0 },
    kraken: { connected: false, reconnects: 0, lastMessageAt: 0 },
    coinbase: { connected: false, reconnects: 0, lastMessageAt: 0 },
  };

  const metrics = state?.metrics;

  // Real Telemetry WebSocket state
  const [telemetryData, setTelemetryData] = useState<any>(null);

  // AI Diagnostics State (Phase 1 to live)
  const [aiDiag, setAiDiag] = useState<HealthAIOutput | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!backendUrl) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectTelemetry = () => {
      try {
        const wsUrl = `${backendUrl.replace(/^http/, 'ws')}/api/v1/telemetry/logs?token=${env.NEXT_PUBLIC_API_KEY}`;
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setTelemetryData(data);
          } catch (err) {
            console.error('Failed to parse telemetry WS frame:', err);
          }
        };

        ws.onerror = (err) => {
          console.warn('Telemetry WS connection error, falling back to simulated diagnostics.');
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectTelemetry, 5000);
        };
      } catch (err) {
        console.error('Telemetry WS initialization error:', err);
      }
    };

    connectTelemetry();

    return () => {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [backendUrl]);

  useEffect(() => {
    if (telemetryData) {
      setAiDiag({
        healthRating: telemetryData.warnings.length > 0 ? 'DEGRADED' : 'NOMINAL',
        telemetryAnalysis: {
          en: `Compute Speed: ${telemetryData.computeLatencyMs.toFixed(2)}ms (Detection wire latency: ${telemetryData.engineLatencyMs.toFixed(2)}ms). Exchange connection lag: Binance (${(telemetryData.exchangeLag.binance/1000).toFixed(1)}s), Kraken (${(telemetryData.exchangeLag.kraken/1000).toFixed(1)}s), Coinbase (${(telemetryData.exchangeLag.coinbase/1000).toFixed(1)}s). Active warnings: ${telemetryData.warnings.join(', ') || 'None'}.`,
          es: `Velocidad de Cómputo: ${telemetryData.computeLatencyMs.toFixed(2)}ms (Latencia de detección: ${telemetryData.engineLatencyMs.toFixed(2)}ms). Retraso en conexión: Binance (${(telemetryData.exchangeLag.binance/1000).toFixed(1)}s), Kraken (${(telemetryData.exchangeLag.kraken/1000).toFixed(1)}s), Coinbase (${(telemetryData.exchangeLag.coinbase/1000).toFixed(1)}s). Alertas activas: ${telemetryData.warnings.join(', ') || 'Ninguna'}.`
        }
      });
      return;
    }

    const fetchDiagnostics = async () => {
      setAiLoading(true);
      try {
        const reconnects: Record<string, number> = {};
        Object.entries(conn).forEach(([k, v]) => {
          reconnects[k] = v.reconnects;
        });
        const res = await RealAiAgent.diagnoseHealth({
          jitterVarianceMs: metrics?.detectionLatencyMs ?? 1.2,
          reconnectCounts: reconnects,
        });
        setAiDiag(res);
      } catch (err) {
        console.error(err);
      } finally {
        setAiLoading(false);
      }
    };
    fetchDiagnostics();
  }, [metrics?.detectionLatencyMs, telemetryData]);

  // Uptime formatting helper
  const formatUptime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  const events = state?.events || [];
  const uptime = state?.uptime || 0;

  // Engine liveness: paused (manual), live (evaluating recently), or idle (running but no
  // recent evaluations — the watchdog self-heals this). Mirrors the backend autostart guard.
  const isPaused = state?.config?.isPaused ?? false;
  const lastActivityAt = metrics?.lastActivityAt ?? 0;
  const msSinceActivity = lastActivityAt > 0 ? Date.now() - lastActivityAt : Infinity;
  const watchdogRecoveries = metrics?.watchdogRecoveries ?? 0;
  const executionAborts = metrics?.executionAborts ?? 0;
  const execLatencyMs = state?.config?.executionLatencyMs ?? 0;
  const engineLive = !isPaused && lastActivityAt > 0 && msSinceActivity < 10000;
  const engineStatusLabel = isPaused
    ? t('health.engine_paused')
    : engineLive
      ? t('health.engine_live')
      : t('health.engine_idle');
  const activityStr = lastActivityAt > 0
    ? (t('health.feed_suffix') === 'Canal' ? `hace ${(msSinceActivity / 1000).toFixed(1)}s` : `${(msSinceActivity / 1000).toFixed(1)}s ago`)
    : t('health.no_messages');
  const venueLabels: Record<string, string> = {
    binance: 'Binance Spot WS',
    kraken: 'Kraken Spot WS',
    coinbase: 'Coinbase Adv WS',
    okx: 'OKX Spot WS',
    bybit: 'Bybit Spot WS',
  };

  const renderConnectionCard = (
    exName: string,
    stateObj: { connected: boolean; reconnects: number; lastMessageAt: number }
  ) => {
    const msSinceLastMsg = Date.now() - stateObj.lastMessageAt;
    const heartbeatStr = stateObj.lastMessageAt > 0 
      ? (t('health.feed_suffix') === 'Canal' ? `hace ${(msSinceLastMsg / 1000).toFixed(1)}s` : `${(msSinceLastMsg / 1000).toFixed(1)}s ago`)
      : t('health.no_messages');

    return (
      <Card>
        <CardHeader className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 pb-3">
          <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{exName} {t('health.feed_suffix')}</span>
          <Badge variant={stateObj.connected ? 'success' : 'destructive'} className="self-start xs:self-auto">
            {stateObj.connected ? t('health.connected') : t('health.disconnected')}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-xs font-mono text-slate-400 pt-4">
          <div className="flex justify-between">
            <span>{t('health.reconnect_counter')}</span>
            <span className="text-white font-bold">{stateObj.reconnects}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('health.last_heartbeat')}</span>
            <span className="text-white font-bold">{heartbeatStr}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER */}
      <div className="pb-6 border-b border-white/5">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {t('health.title_header')}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {t('health.subtitle_header')}
        </p>
      </div>

      {/* ENGINE LIVENESS BANNER */}
      <Card className={`border ${isPaused ? 'border-amber-500/30' : engineLive ? 'border-emerald-500/30' : 'border-rose-500/30'}`}>
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              {engineLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPaused ? 'bg-amber-500' : engineLive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </span>
            <div>
              <div className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{t('health.engine_status')}</div>
              <div className={`text-lg font-bold font-mono ${isPaused ? 'text-amber-400' : engineLive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {engineStatusLabel}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-8 text-xs font-mono">
            <div>
              <div className="text-[10px] text-slate-500 tracking-wider uppercase">{t('health.last_activity')}</div>
              <div className="text-white font-bold mt-0.5">{activityStr}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 tracking-wider uppercase">{t('health.self_heals')}</div>
              <div className="text-white font-bold mt-0.5">{watchdogRecoveries}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 tracking-wider uppercase">{t('health.fill_aborts')}</div>
              <div className="text-white font-bold mt-0.5">
                {executionAborts}
                <span className="text-slate-500 font-normal"> · {execLatencyMs}ms {t('health.fill_window')}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CORE STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Term. Uptime */}
        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{t('health.terminal_uptime')}</span>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-lg font-bold font-mono mt-1 text-white glow-text-blue">
              {formatUptime(uptime)}
            </h3>
          </CardContent>
        </Card>

        {/* Core Socket state */}
        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{t('health.client_socket')}</span>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className={`text-lg font-bold font-mono mt-1 ${connected ? 'text-emerald-400' : 'text-rose-400'}`}>
              {connected ? t('health.socket_stable') : t('health.socket_connecting')}
            </h3>
          </CardContent>
        </Card>

        {/* Total Audit Logs */}
        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{t('health.logged_events')}</span>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-lg font-bold font-mono mt-1 text-white">
              {events.length} {t('health.records_label')}
            </h3>
          </CardContent>
        </Card>

        {/* Detection latency (speed criterion) */}
        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{t('health.detection_latency')}</span>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-lg font-bold font-mono mt-1 text-sky-400 glow-text-blue">
              {(metrics?.detectionLatencyMs ?? 0).toFixed(2)} ms
              <span className="text-[10px] text-slate-500"> {t('health.wire_label')}</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              <span className="text-emerald-400/80">~{Math.round((metrics?.computeLatencyMs ?? 0) * 1000)}µs {t('health.compute_label')}</span> · p99 {(metrics?.p99LatencyMs ?? 0).toFixed(2)}ms · {metrics?.evalsPerSecond ?? 0} books/s
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 2e. INTEGRATED AI SYSTEM DIAGNOSTICS MONITOR (Phase 1) */}
      <Card glow className="border-amber-500/10 bg-slate-950/20 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
              <CardTitle className="text-xs uppercase font-mono tracking-wider">{t('widget.ai_diagnostics')}</CardTitle>
            </div>
            <CardDescription className="text-[10px] font-mono mt-0.5">{t('widget.ai_diagnostics_sub')}</CardDescription>
          </div>
          <Badge variant="outline" className="text-[9px] border-amber-500/25 text-amber-500 font-mono tracking-wider font-semibold uppercase animate-pulse">
            🛡️ {t('widget.ai_advisory_only')}
          </Badge>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          {aiLoading && !aiDiag ? (
            <div className="space-y-2 animate-pulse py-2 font-mono text-[10px]">
              <div className="h-4 bg-white/5 rounded w-3/4"></div>
              <div className="h-3 bg-white/5 rounded w-1/2"></div>
            </div>
          ) : aiDiag ? (
            <div className="space-y-4 font-mono text-[11px] leading-relaxed">
              
              {/* Rating and Connection Jitter */}
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold uppercase text-[9px]">Telemetry Assessment</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    aiDiag.healthRating === 'NOMINAL' 
                      ? 'bg-emerald-400 animate-pulse' 
                      : aiDiag.healthRating === 'DEGRADED' 
                        ? 'bg-amber-400' 
                        : 'bg-rose-500'
                  }`}></span>
                  <Badge variant={aiDiag.healthRating === 'NOMINAL' ? 'success' : aiDiag.healthRating === 'DEGRADED' ? 'warning' : 'destructive'} className="text-[9px] font-bold py-0.5 px-2 uppercase rounded">
                    {aiDiag.healthRating}
                  </Badge>
                </div>
              </div>

              {/* Terminal Diagnostics Feed */}
              <div className="border border-white/5 bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 leading-normal border-l-2 border-l-amber-500">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-2 text-[10px] text-slate-500">
                  <span>SYSTEM::DIAGNOSTIC_DAEMON_V1 &gt;_</span>
                  <span className="ml-auto font-normal">LOCK_OK</span>
                </div>
                <p className="text-[11px] text-slate-200">
                  {language === 'es' ? aiDiag.telemetryAnalysis.es : aiDiag.telemetryAnalysis.en}
                </p>
              </div>

              <div className="flex justify-between items-center text-[9px] text-slate-500 pt-2 border-t border-white/5">
                <span>Diagnostics: PASS</span>
                <Badge variant="outline" className="text-[8px] text-slate-400 font-mono py-0 px-1">{t('widget.ai_advisory_only')}</Badge>
              </div>

            </div>
          ) : (
            <div className="text-[10px] text-slate-500 font-mono text-center py-4">
              Awaiting telemetry diagnostics stream...
            </div>
          )}
        </CardContent>
      </Card>

      {/* EXCHANGE FEEDS METRICS — one card per live venue */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(conn).map(([id, stateObj]) => (
          <React.Fragment key={id}>
            {renderConnectionCard(venueLabels[id] ?? `${id.toUpperCase()} WS`, stateObj)}
          </React.Fragment>
        ))}
      </div>

      {/* 4. AUDIT SYSTEM LOGS TABLE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xs">{t('health.audit_trails')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-y-auto max-h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 py-3">{t('health.timestamp_col')}</TableHead>
                  <TableHead className="px-6 py-3">{t('health.type_col')}</TableHead>
                  <TableHead className="px-6 py-3">{t('health.desc_col')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-slate-500">
                      {t('health.no_events')}
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((e) => (
                    <TableRow key={e.id} className="hover:bg-white/5 transition-colors">
                      <TableCell className="px-6 py-2.5 text-slate-500">
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="px-6 py-2.5">
                        <Badge variant={
                          e.type === 'TRADE_EXECUTION' 
                            ? 'success' 
                            : e.type === 'RISK_ALERT' 
                              ? 'destructive' 
                              : 'secondary'
                        }>
                          {e.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-2.5 text-slate-300">
                        {e.message}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
