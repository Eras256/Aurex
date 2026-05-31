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

  const renderConnectionCard = (exName: string, stateObj: any) => {
    const msSinceLastMsg = Date.now() - stateObj.lastMessageAt;
    const heartbeatStr = stateObj.lastMessageAt > 0 
      ? `${(msSinceLastMsg / 1000).toFixed(1)}s ago` 
      : 'No messages';

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{exName} Feed</span>
          <Badge variant={stateObj.connected ? 'success' : 'destructive'}>
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

        {/* Active strategies */}
        <Card>
          <CardHeader className="p-4 border-b-0 pb-0">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">ACTIVE STRATEGIES</span>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <h3 className="text-lg font-bold font-mono mt-1 text-amber-500 font-bold">
              SPOT-ARB-BTC
            </h3>
          </CardContent>
        </Card>
      </div>

      {/* EXCHANGE FEEDS METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {renderConnectionCard('Binance Spot WS', conn.binance)}
        {renderConnectionCard('Kraken Spot WS', conn.kraken)}
        {renderConnectionCard('Coinbase Adv WS', conn.coinbase)}
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
