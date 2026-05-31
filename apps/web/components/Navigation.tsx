'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState } from 'react';

import { AurexLogo } from './branding/AurexLogo';

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { name: 'Dashboard Overview', path: '/' },
    { name: 'Comparative Markets', path: '/markets' },
    { name: 'Live Opportunities', path: '/opportunities' },
    { name: 'Executed Trades', path: '/trades' },
    { name: 'Simulated Wallets', path: '/wallets' },
    { name: 'Risk & Settings', path: '/risk' },
    { name: 'System Health', path: '/health' },
    { name: 'Platform Docs', path: '/docs' },
  ];

  return (
    <>
      {/* 1. MOBILE HEADER BAR */}
      <div className="md:hidden w-full h-16 bg-darkCard border-b border-white/5 px-4 flex items-center justify-between shrink-0 backdrop-blur-xl sticky top-0 z-50">
        <AurexLogo variant="full" size="sm" />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 flex flex-col justify-center items-center gap-1.5 focus:outline-none hover:bg-white/5 rounded-lg transition-all"
          aria-label="Toggle Menu"
        >
          <span className={`w-5 h-0.5 bg-slate-300 transition-all ${isOpen ? 'rotate-45 translate-y-[5px]' : ''}`} />
          <span className={`w-5 h-0.5 bg-slate-300 transition-all ${isOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-0.5 bg-slate-300 transition-all ${isOpen ? '-rotate-45 -translate-y-[5px]' : ''}`} />
        </button>
      </div>

      {/* 2. MOBILE DRAWER OVERLAY */}
      {isOpen && (
        <div className="md:hidden fixed inset-x-0 bottom-0 top-16 bg-darkBg/95 backdrop-blur-lg z-40 flex flex-col justify-between py-6 px-4 animate-fadeIn overflow-y-auto">
          <nav className="space-y-1.5">
            {links.map((link) => {
              const isActive = pathname === link.path;
              return (
                <Link
                  key={link.path}
                  href={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white bg-white/5 border-l-2 border-gold font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>
          
          <div className="pt-4 border-t border-white/5 px-2">
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
        </div>
      )}

      {/* 3. DESKTOP SIDEBAR NAVBAR */}
      <aside className="hidden md:flex w-full md:w-64 bg-darkCard border-b md:border-b-0 md:border-r border-white/5 flex-col justify-between py-6 px-4 shrink-0 backdrop-blur-xl">
        <div>
          {/* Brand / Logo */}
          <div className="px-2 mb-8 flex items-center">
            <AurexLogo variant="full" size="md" />
          </div>

          {/* Primary Nav Links */}
          <nav className="space-y-1">
            {links.map((link) => {
              const isActive = pathname === link.path;
              return (
                <Link
                  key={link.path}
                  href={link.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white bg-white/5 border-l-2 border-gold font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
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
    </>
  );
};
