'use client';

import { env } from '@arbitrage/config';
import { StatePayload } from '@arbitrage/core';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface WebSocketContextType {
  state: StatePayload | null;
  connected: boolean;
  reconnectCount: number;
  triggerReset: () => Promise<boolean>;
  updateConfig: (newConfig: any) => Promise<boolean>;
  backendUrl: string;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<StatePayload | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);

  // Read backend endpoints from environment presets
  const backendHost = env.NEXT_PUBLIC_BACKEND_URL;
  const wsHost = backendHost.replace(/^http/, 'ws');

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;
    let localReconnectAttempts = 0;
    let isComponentMounted = true;

    // ResizeObserver loop limit exceeded silencer bypass
    const handleResizeObserverError = (e: ErrorEvent) => {
      if (
        e.message === 'ResizeObserver loop limit exceeded' ||
        e.message === 'ResizeObserver loop completed with undelivered notifications.'
      ) {
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener('error', handleResizeObserverError);

    const connect = () => {
      if (!isComponentMounted) return;
      console.log(`🔌 Initializing client WebSocket connection to: ${wsHost}`);
      socket = new WebSocket(wsHost);

      socket.onopen = () => {
        console.log('✅ Client WebSocket connected to simulator backend.');
        setConnected(true);
        setReconnectCount(0);
        localReconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as StatePayload;
          setState(payload);
        } catch (error) {
          console.error('Failed to parse inbound StatePayload packet', error);
        }
      };

      socket.onclose = () => {
        if (!isComponentMounted) return;
        console.warn('❌ WebSocket connection closed. Initiating automated retry...');
        setConnected(false);
        
        localReconnectAttempts++;
        setReconnectCount(localReconnectAttempts);
        
        // Dynamic backoff interval capping at 15s
        const delay = Math.min(1000 * Math.pow(2, localReconnectAttempts), 15000);
        reconnectTimeoutId = setTimeout(connect, delay);
      };

      socket.onerror = (err) => {
        console.error('WebSocket connection error', err);
        if (socket) {
          socket.close();
        }
      };
    };

    connect();

    return () => {
      isComponentMounted = false;
      window.removeEventListener('error', handleResizeObserverError);
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      }
      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
    };
  }, []);

  const triggerReset = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${backendHost}/engine/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'dev-api-key-12345',
        },
      });
      const data = await res.json();
      return data.success === true;
    } catch (e) {
      console.error('Failed to reset backend simulator database', e);
      return false;
    }
  };

  const updateConfig = async (newConfig: any): Promise<boolean> => {
    try {
      const res = await fetch(`${backendHost}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'dev-api-key-12345',
        },
        body: JSON.stringify(newConfig),
      });
      const data = await res.json();
      return data.success === true;
    } catch (e) {
      console.error('Failed to update engine configurations', e);
      return false;
    }
  };

  return (
    <WebSocketContext.Provider value={{ state, connected, reconnectCount, triggerReset, updateConfig, backendUrl: backendHost }}>
      {children}
    </WebSocketContext.Provider>
  );
};
