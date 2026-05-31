import type { Metadata } from 'next';

import { HeaderTicker } from '@/components/HeaderTicker';
import { Navigation } from '@/components/Navigation';

import { WebSocketProvider } from './WebSocketContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aurex - Institutional Bitcoin Arbitrage Terminal',
  description: 'Aurex is an institutional-grade real-time Bitcoin arbitrage detection and simulation platform for monitoring cross-exchange spreads, simulating execution, and visualizing risk, PnL, and market depth.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/aurex-mark.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-darkBg text-slate-100 min-h-screen flex flex-col">
        <WebSocketProvider>
          <div className="flex-1 flex flex-col md:flex-row min-h-screen">
            {/* 1. RESPONSIVE SIDEBAR & MOBILE NAVIGATION */}
            <Navigation />

            {/* 2. MAIN LAYOUT WINDOW */}
            <main className="flex-1 flex flex-col overflow-x-hidden min-h-screen">
              {/* Header Ticker Banner */}
              <header className="h-16 border-b border-white/5 bg-darkCard/25 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0">
                <HeaderTicker />

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-slate-500 font-mono text-xs hidden sm:inline">API VER: 1.0.0</span>
                  <div className="px-2.5 py-1 rounded bg-white/5 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    SIM-MODE
                  </div>
                </div>
              </header>

              {/* Sub-page content */}
              <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1600px] w-full mx-auto">
                {children}
              </div>
            </main>
          </div>
        </WebSocketProvider>
      </body>
    </html>
  );
}
