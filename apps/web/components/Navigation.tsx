'use client';

import { Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react';

import { useLanguage } from '../app/LanguageContext';

import { AiEngineSettingsModal } from './AiEngineSettingsModal';
import { AurexLogo } from './branding/AurexLogo';

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const [aiStatus, setAiStatus] = useState({
    status: 'Live',
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
  });

  useEffect(() => {
    const updateAiStatus = () => {
      if (typeof window !== 'undefined') {
        const savedStatus = localStorage.getItem('aurex_live_ai_status') || 'Live';
        const savedProvider = localStorage.getItem('aurex_live_ai_provider') || 'OpenAI';
        const savedModel = localStorage.getItem('aurex_live_ai_model') || 'gpt-4o-mini';
        setAiStatus({
          status: savedStatus,
          provider: savedProvider,
          model: savedModel,
        });
      }
    };

    updateAiStatus();
    window.addEventListener('storage', updateAiStatus);
    return () => window.removeEventListener('storage', updateAiStatus);
  }, []);

  const getAiBadgeText = () => {
    if (aiStatus.status === 'Simulated') return 'AI: Simulated';
    return `AI: ${aiStatus.model}`;
  };

  const getAiBadgeClass = () => {
    if (aiStatus.status === 'Simulated') {
      return 'bg-slate-800/85 text-slate-400 border-slate-700/50';
    }
    if (aiStatus.provider === 'OpenAI') {
      return 'bg-gold/10 text-gold border-gold/25';
    }
    if (aiStatus.provider === 'Anthropic') {
      return 'bg-orange-500/10 text-orange-400 border-orange-500/25';
    }
    if (aiStatus.provider === 'Gemini') {
      return 'bg-sky-500/10 text-sky-400 border-sky-500/25';
    }
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
  };

  const links = [
    { key: 'nav.overview', path: '/' },
    { key: 'nav.copilot', path: '/copilot', isAI: true },
    { key: 'nav.markets', path: '/markets' },
    { key: 'nav.opportunities', path: '/opportunities' },
    { key: 'nav.trades', path: '/trades' },
    { key: 'nav.wallets', path: '/wallets' },
    { key: 'nav.risk', path: '/risk' },
    { key: 'nav.health', path: '/health' },
    { key: 'nav.docs', path: '/docs' },
    { key: 'nav.changelog', path: '/changelog' },
  ];

  return (
    <>
      {/* 1. MOBILE HEADER BAR */}
      <div className="md:hidden w-full h-16 bg-darkCard border-b border-white/5 px-4 flex items-center justify-between shrink-0 backdrop-blur-xl sticky top-0 z-50">
        <Link href="/" className="cursor-pointer hover:opacity-90 transition-opacity flex items-center">
          <AurexLogo variant="full" size="sm" />
        </Link>
        
        <div className="flex items-center gap-2">
          {/* Active AI Status Badge */}
          <span className={`text-[9px] font-mono tracking-wider font-extrabold px-1.5 py-0.5 rounded border shrink-0 ${getAiBadgeClass()}`}>
            {getAiBadgeText()}
          </span>

          {/* AI Settings Gear */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all flex items-center justify-center shrink-0"
            title={t('nav.copilot_settings')}
            aria-label={t('nav.copilot_settings')}
          >
            <Settings className="w-5 h-5 text-slate-400 hover:text-white hover:rotate-45 transition-transform duration-300" />
          </button>

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
                  className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white bg-white/5 border-l-2 border-gold font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  }`}
                >
                  <span>{t(link.key)}</span>
                  {link.isAI && (
                    <span className="text-[9px] uppercase font-mono tracking-wider font-extrabold text-gold bg-gold/15 px-1.5 py-0.5 rounded border border-gold/25 animate-pulse shrink-0">
                      AI COPILOT
                    </span>
                  )}
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
              {/* AI Settings Gear */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                title={t('nav.copilot_settings')}
                aria-label={t('nav.copilot_settings')}
              >
                <Settings className="w-4 h-4 text-slate-400 hover:text-white" />
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
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white bg-white/5 border-l-2 border-gold font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  }`}
                >
                  <span>{t(link.key)}</span>
                  {link.isAI && (
                    <span className="text-[9px] uppercase font-mono tracking-wider font-extrabold text-gold bg-gold/15 px-1.5 py-0.5 rounded border border-gold/25 animate-pulse shrink-0">
                      AI
                    </span>
                  )}
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
              {/* AI Settings Gear */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                title={t('nav.copilot_settings')}
                aria-label={t('nav.copilot_settings')}
              >
                <Settings className="w-4 h-4 text-slate-400 hover:text-white" />
              </button>
            </div>
            
            {/* Active AI Status Badge (Desktop Sidebar) */}
            <div className="mt-2.5 flex items-center justify-between px-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">AI COPROCESSOR:</span>
              <span className={`text-[9px] font-mono tracking-wider font-extrabold px-1.5 py-0.5 rounded border shrink-0 ${getAiBadgeClass()}`}>
                {getAiBadgeText()}
              </span>
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

      {/* 4. AI ENGINE SETTINGS MODAL */}
      <AiEngineSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};
