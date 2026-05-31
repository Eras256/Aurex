import type { Metadata } from 'next';
import Link from 'next/link';

import { AurexLogo } from '@/components/branding/AurexLogo';
import { HeaderTicker } from '@/components/HeaderTicker';

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
            {/* 1. SIDEBAR NAVBAR */}
            <aside className="w-full md:w-64 bg-darkCard border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-between py-6 px-4 shrink-0 backdrop-blur-xl">
              <div>
                {/* Brand / Logo */}
                <div className="px-2 mb-8 flex items-center">
                  <AurexLogo variant="full" size="md" />
                </div>

                {/* Primary Nav Links */}
                <nav className="space-y-1">
                  {[
                    { name: 'Dashboard Overview', path: '/' },
                    { name: 'Comparative Markets', path: '/markets' },
                    { name: 'Live Opportunities', path: '/opportunities' },
                    { name: 'Executed Trades', path: '/trades' },
                    { name: 'Simulated Wallets', path: '/wallets' },
                    { name: 'Risk & Settings', path: '/risk' },
                    { name: 'System Health', path: '/health' },
                    { name: 'Platform Docs', path: '/docs' },
                  ].map((link) => (
                    <Link
                      key={link.path}
                      href={link.path}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all"
                    >
                      {link.name}
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Sidebar Footer System status */}
              <div className="mt-8 pt-4 border-t border-white/5 px-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-mono">NODE STATUS:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-mono text-emerald-400 font-medium">LIVE</span>
                  </div>
                </div>
              </div>
            </aside>

            {/* 2. MAIN LAYOUT WINDOW */}
            <main className="flex-1 flex flex-col overflow-x-hidden min-h-screen">
              {/* Header Ticker Banner */}
              <header className="h-16 border-b border-white/5 bg-darkCard/25 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
                <HeaderTicker />

                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-mono text-xs hidden sm:inline">API VER: 1.0.0</span>
                  <div className="px-2.5 py-1 rounded bg-white/5 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    SIM-MODE
                  </div>
                </div>
              </header>

              {/* Sub-page content */}
              <div className="flex-1 p-6 md:p-8 max-w-[1600px] w-full mx-auto">
                {children}
              </div>
            </main>
          </div>
        </WebSocketProvider>
      </body>
    </html>
  );
}
