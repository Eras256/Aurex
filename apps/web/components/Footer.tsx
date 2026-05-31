'use client';

import Link from 'next/link';
import React from 'react';

import { useLanguage } from '../app/LanguageContext';

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-white/5 bg-darkCard/10 backdrop-blur-md py-6 px-4 sm:px-8 mt-auto shrink-0 relative z-30">
      <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
        
        {/* Left Side: Copy & Legal links */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1.5">
          <span className="text-slate-400 font-semibold tracking-wider">AUREX</span>
          <span>&copy; {new Date().getFullYear()}</span>
          <span className="hidden xs:inline text-white/10">|</span>
          <Link
            href="/terms"
            className="hover:text-slate-300 transition-colors cursor-pointer underline decoration-white/10 underline-offset-4"
          >
            {t('footer.terms')}
          </Link>
          <span className="text-white/10">|</span>
          <Link
            href="/privacy"
            className="hover:text-slate-300 transition-colors cursor-pointer underline decoration-white/10 underline-offset-4"
          >
            {t('footer.privacy')}
          </Link>
        </div>

        {/* Right Side: Telemetry Node Indicator */}
        <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
          <span className="text-amber-500/80 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 text-[10px] tracking-wider uppercase">
            {t('footer.sim_only')}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 text-[10px] font-medium tracking-wide">{t('footer.secure_node')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

