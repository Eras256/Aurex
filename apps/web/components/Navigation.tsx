'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState } from 'react';

import { useLanguage } from '../app/LanguageContext';

import { AurexLogo } from './branding/AurexLogo';

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const links = [
    { key: 'nav.overview', path: '/' },
    { key: 'nav.markets', path: '/markets' },
    { key: 'nav.opportunities', path: '/opportunities' },
    { key: 'nav.trades', path: '/trades' },
    { key: 'nav.wallets', path: '/wallets' },
    { key: 'nav.risk', path: '/risk' },
    { key: 'nav.health', path: '/health' },
    { key: 'nav.docs', path: '/docs' },
  ];

  return (
    <>
      {/* 1. MOBILE HEADER BAR */}
      <div className="md:hidden w-full h-16 bg-darkCard border-b border-white/5 px-4 flex items-center justify-between shrink-0 backdrop-blur-xl sticky top-0 z-50">
        <Link href="/" className="cursor-pointer hover:opacity-90 transition-opacity flex items-center">
          <AurexLogo variant="full" size="sm" />
        </Link>
        
        <div className="flex items-center gap-3">
          {/* Mobile Language Toggle */}
          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5 text-[10px]">
            <button
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded font-mono transition-all ${
                language === 'en'
                  ? 'bg-gold text-darkBg font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('es')}
              className={`px-2.5 py-1 rounded font-mono transition-all ${
                language === 'es'
                  ? 'bg-gold text-darkBg font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ES
            </button>
          </div>

          {/* Hamburger Menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-10 h-10 flex flex-col justify-center items-center gap-1.5 focus:outline-none hover:bg-white/5 rounded-lg transition-all"
            aria-label={t('nav.toggle_menu')}
          >
            <span className={`w-5 h-0.5 bg-slate-300 transition-all ${isOpen ? 'rotate-45 translate-y-[5px]' : ''}`} />
            <span className={`w-5 h-0.5 bg-slate-300 transition-all ${isOpen ? 'opacity-0' : ''}`} />
            <span className={`w-5 h-0.5 bg-slate-300 transition-all ${isOpen ? '-rotate-45 -translate-y-[5px]' : ''}`} />
          </button>
        </div>
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
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>

          {/* Language Toggle directly below Documentation link */}
          <div className="mt-4 px-2 mb-6">
            <div className="flex items-center gap-1.5 bg-white/5 rounded-lg p-1 border border-white/5">
              <button
                onClick={() => setLanguage('en')}
                className={`flex-1 text-center py-1 rounded text-xs font-mono transition-all ${
                  language === 'en'
                    ? 'bg-gold text-darkBg font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`flex-1 text-center py-1 rounded text-xs font-mono transition-all ${
                  language === 'es'
                    ? 'bg-gold text-darkBg font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ES
              </button>
            </div>
          </div>
          
          <div className="pt-4 border-t border-white/5 px-2 mt-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-mono">{t('nav.status')}</span>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-mono text-emerald-400 font-medium">{t('nav.live')}</span>
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
            <Link href="/" className="cursor-pointer hover:opacity-90 transition-opacity flex items-center">
              <AurexLogo variant="full" size="md" />
            </Link>
          </div>

          {/* Primary Nav Links */}
          <nav className="space-y-1 mb-4">
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
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>

          {/* Language Toggle directly below Documentation link */}
          <div className="px-2 mb-6">
            <div className="flex items-center gap-1.5 bg-white/5 rounded-lg p-1 border border-white/5">
              <button
                onClick={() => setLanguage('en')}
                className={`flex-1 text-center py-1 rounded text-xs font-mono transition-all ${
                  language === 'en'
                    ? 'bg-gold text-darkBg font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`flex-1 text-center py-1 rounded text-xs font-mono transition-all ${
                  language === 'es'
                    ? 'bg-gold text-darkBg font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ES
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer System status */}
        <div className="pt-4 border-t border-white/5 px-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-mono">{t('nav.status')}</span>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-emerald-400 font-medium">{t('nav.live')}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
