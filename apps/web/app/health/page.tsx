'use client';

import React from 'react';


import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

import { useWebSocket } from '../WebSocketContext';

export default function SystemHealthPage() {
  const { state, connected } = useWebSocket();

  // Uptime formatting helper
  const formatUptime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  const conn = state?.connections || {
    binance: { connected: false, reconnects: 0, lastMessageAt: 0 },
    kraken: { connected: false, reconnects: 0, lastMessageAt: 0 },
    coinbase: { connected: false, reconnects: 0, lastMessageAt: 0 },
  };

  const events = state?.events || [];
  const uptime = state?.uptime || 0;
  const metrics = state?.metrics;
  const venueLabels: Record<string, string> = {
    binance: 'Binance Spot WS',
    kraken: 'Kraken Spot WS',
    coinbase: 'Coinbase Adv WS',
    okx: 'OKX Spot WS',
    bybit: 'Bybit Spot WS',
  };

  const renderConnectionCard = (exName: string, stateObj: any) => {
    const msSinceLastMsg = Date.now() - stateObj.lastMessageAt;
    const heartbeatStr = stateObj.lastMessageAt > 0 
      ? `${(msSinceLastMsg / 1000).toFixed(1)}s ago` 
      : 'No messages';

    return (
      <Card>
        <CardHeader className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 pb-3">
          <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{exName} Feed</span>
          <Badge variant={stateObj.connected ? 'success' : 'destructive'} className="self-start xs:self-auto">
            {stateObj.connected ? 'CONNECTED' : 'DISCONNECTED'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-xs font-mono text-slate-400 pt-4">
          <div className="flex justify-between">
            <span>RECONNECT COUNTER:</span>
            <span className="text-white font-bold">{stateObj.reconnects}</span>
          </div>
          <div className="flex justify-between">
            <span>LAST HEARTBEAT:</span>
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
          System Health Telemetry
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Track WebSocket streams, connection heartbeats, uptime status, and examine standard audit trails.
        </p>
      </div>

      {/* CORE STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Term. Uptime */}
        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">TERMINAL UPTIME</span>
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
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">CLIENT SOCKET CONNECT</span>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className={`text-lg font-bold font-mono mt-1 ${connected ? 'text-emerald-400' : 'text-rose-400'}`}>
              {connected ? 'STABLE' : 'CONNECTING...'}
            </h3>
          </CardContent>
        </Card>

        {/* Total Audit Logs */}
        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">LOGGED EVENTS</span>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-lg font-bold font-mono mt-1 text-white">
              {events.length} records
            </h3>
          </CardContent>
        </Card>

        {/* Detection latency (speed criterion) */}
        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">DETECTION LATENCY</span>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-lg font-bold font-mono mt-1 text-sky-400 glow-text-blue">
              {(metrics?.detectionLatencyMs ?? 0).toFixed(2)} ms
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              p99 {(metrics?.p99LatencyMs ?? 0).toFixed(2)} ms · {metrics?.evalsPerSecond ?? 0} books/s
            </span>
          </CardContent>
        </Card>
      </div>

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
          <CardTitle className="text-xs">Platform Audit Trails</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-y-auto max-h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 py-3">TIMESTAMP</TableHead>
                  <TableHead className="px-6 py-3">TYPE</TableHead>
                  <TableHead className="px-6 py-3">EVENT LOG DESCRIPTION MESSAGE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-slate-500">
                      No system log events recorded yet.
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
