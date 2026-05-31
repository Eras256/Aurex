'use client';

import React, { useState } from 'react';

import { useLanguage } from '../LanguageContext';

export default function DocsPage() {
  const { t } = useLanguage();

  // State to track expanded cards (First card is open by default)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({
    1: true,
    2: false,
    3: false,
    4: false,
    5: false
  });

  const toggleCard = (id: number) => {
    setExpanded(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-[1000px] mx-auto pb-10">
      
      {/* HEADER SECTION */}
      <div className="pb-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] shrink-0" />
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl font-mono uppercase">
            {t('docs.title_header')}
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-400 font-sans pl-5">
          {t('docs.subtitle_header')}
        </p>
      </div>

      {/* SYSTEM OVERVIEW FLOWCHART */}
      <div className="relative p-6 rounded-2xl bg-gradient-to-r from-slate-950/80 via-slate-900/40 to-slate-950/80 border border-white/5 backdrop-blur-md shadow-2xl overflow-hidden">
        {/* Glow ambient design elements */}
        <div className="absolute -left-20 -top-20 w-48 h-48 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />
        <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2 relative z-10">
          
          {/* Node 1: Market Data */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/[0.01] border border-white/5 w-full md:w-[22%] group hover:border-amber-500/20 hover:bg-white/[0.03] transition-all duration-300">
            <div className="text-[10px] font-mono text-slate-600 font-bold self-start mb-1 group-hover:text-amber-500/50 transition-colors">01</div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400 mb-2 group-hover:scale-105 transition-transform duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase group-hover:text-white transition-colors text-center">
              {t('docs.flow_market_data')}
            </span>
          </div>

          {/* Connection Arrow 1 */}
          <div className="hidden md:flex items-center text-slate-600">
            <svg className="w-5 h-5 animate-pulse text-amber-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="flex md:hidden items-center text-slate-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Node 2: Opportunity Engine */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/[0.01] border border-white/5 w-full md:w-[22%] group hover:border-sky-500/20 hover:bg-white/[0.03] transition-all duration-300">
            <div className="text-[10px] font-mono text-slate-600 font-bold self-start mb-1 group-hover:text-sky-500/50 transition-colors">02</div>
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center border border-sky-500/20 text-sky-400 mb-2 group-hover:scale-105 transition-transform duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase group-hover:text-white transition-colors text-center">
              {t('docs.flow_opportunity')}
            </span>
          </div>

          {/* Connection Arrow 2 */}
          <div className="hidden md:flex items-center text-slate-600">
            <svg className="w-5 h-5 animate-pulse text-sky-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="flex md:hidden items-center text-slate-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Node 3: Execution Simulator */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/[0.01] border border-white/5 w-full md:w-[22%] group hover:border-purple-500/20 hover:bg-white/[0.03] transition-all duration-300">
            <div className="text-[10px] font-mono text-slate-600 font-bold self-start mb-1 group-hover:text-purple-500/50 transition-colors">03</div>
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400 mb-2 group-hover:scale-105 transition-transform duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <span className="text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase group-hover:text-white transition-colors text-center">
              {t('docs.flow_execution')}
            </span>
          </div>

          {/* Connection Arrow 3 */}
          <div className="hidden md:flex items-center text-slate-600">
            <svg className="w-5 h-5 animate-pulse text-purple-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="flex md:hidden items-center text-slate-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Node 4: PnL Tracking */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/[0.01] border border-white/5 w-full md:w-[22%] group hover:border-emerald-500/20 hover:bg-white/[0.03] transition-all duration-300">
            <div className="text-[10px] font-mono text-slate-600 font-bold self-start mb-1 group-hover:text-emerald-500/50 transition-colors">04</div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400 mb-2 group-hover:scale-105 transition-transform duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase group-hover:text-white transition-colors text-center">
              {t('docs.flow_pnl')}
            </span>
          </div>

        </div>
      </div>

      {/* DOCUMENTATION COLLAPSIBLE CARDS STACK */}
      <div className="space-y-4">
        
        {/* CARD 1: Cross-Exchange Arbitrage */}
        <div 
          className={`border rounded-xl transition-all duration-300 backdrop-blur-md overflow-hidden ${
            expanded[1] 
              ? 'bg-slate-900/50 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.05)]' 
              : 'bg-slate-900/20 border-white/5 hover:border-white/10 hover:bg-slate-900/30'
          }`}
        >
          <button 
            onClick={() => toggleCard(1)}
            className="w-full flex items-center justify-between p-5 text-left transition-colors duration-200"
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                expanded[1] 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                  : 'bg-white/5 border-white/5 text-slate-400'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
                  {t('docs.sec1_title')}
                </h3>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">Section 01 / Arbitrage Core</p>
              </div>
            </div>

            <div className={`text-slate-400 transition-transform duration-300 ${expanded[1] ? 'rotate-180 text-amber-400' : ''}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          <div className={`transition-all duration-300 ease-in-out ${expanded[1] ? 'max-h-[800px] opacity-100 border-t border-white/5' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div className="p-6 text-sm text-slate-300 leading-relaxed font-sans">
              <p>
                {t('docs.sec1_p1')}
              </p>
            </div>
          </div>
        </div>

        {/* CARD 2: Execution Logic */}
        <div 
          className={`border rounded-xl transition-all duration-300 backdrop-blur-md overflow-hidden ${
            expanded[2] 
              ? 'bg-slate-900/50 border-sky-500/30 shadow-[0_0_20px_rgba(14,165,233,0.05)]' 
              : 'bg-slate-900/20 border-white/5 hover:border-white/10 hover:bg-slate-900/30'
          }`}
        >
          <button 
            onClick={() => toggleCard(2)}
            className="w-full flex items-center justify-between p-5 text-left transition-colors duration-200"
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                expanded[2] 
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' 
                  : 'bg-white/5 border-white/5 text-slate-400'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
                  {t('docs.sec2_title')}
                </h3>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">Section 02 / L2 Depth Sizing</p>
              </div>
            </div>

            <div className={`text-slate-400 transition-transform duration-300 ${expanded[2] ? 'rotate-180 text-sky-400' : ''}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          <div className={`transition-all duration-300 ease-in-out ${expanded[2] ? 'max-h-[800px] opacity-100 border-t border-white/5' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div className="p-6 text-sm text-slate-300 space-y-4 leading-relaxed font-sans">
              <p>
                {t('docs.sec2_p1')}
              </p>
              
              <div className="border border-sky-500/20 bg-slate-950/60 rounded-xl p-5">
                <span className="text-[10px] text-sky-400 font-mono tracking-wider uppercase block mb-3 font-semibold">
                  {t('docs.sec2_seq_title')}
                </span>
                
                <div className="font-mono text-xs text-slate-300 space-y-3 pl-1">
                  <div className="flex items-start gap-3">
                    <span className="text-sky-500 font-bold">1.</span>
                    <span>{t('docs.sec2_card_step1')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sky-500 font-bold">2.</span>
                    <span>{t('docs.sec2_card_step2')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sky-500 font-bold">3.</span>
                    <span>{t('docs.sec2_card_step3')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sky-500 font-bold">4.</span>
                    <span>{t('docs.sec2_card_step4')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sky-500 font-bold">5.</span>
                    <span>{t('docs.sec2_card_step5')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: Cost Framework */}
        <div 
          className={`border rounded-xl transition-all duration-300 backdrop-blur-md overflow-hidden ${
            expanded[3] 
              ? 'bg-slate-900/50 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.05)]' 
              : 'bg-slate-900/20 border-white/5 hover:border-white/10 hover:bg-slate-900/30'
          }`}
        >
          <button 
            onClick={() => toggleCard(3)}
            className="w-full flex items-center justify-between p-5 text-left transition-colors duration-200"
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                expanded[3] 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-white/5 border-white/5 text-slate-400'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
                  {t('docs.sec3_title')}
                </h3>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">Section 03 / Cost Model</p>
              </div>
            </div>

            <div className={`text-slate-400 transition-transform duration-300 ${expanded[3] ? 'rotate-180 text-emerald-400' : ''}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          <div className={`transition-all duration-300 ease-in-out ${expanded[3] ? 'max-h-[800px] opacity-100 border-t border-white/5' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div className="p-6 text-sm text-slate-300 space-y-4 leading-relaxed font-sans">
              <p>
                {t('docs.sec3_p1')}
              </p>
              
              <div className="border border-emerald-500/20 bg-slate-950/60 rounded-xl p-5">
                <span className="text-[10px] text-emerald-400 font-mono tracking-wider uppercase block mb-3 font-semibold">
                  {t('docs.sec3_costs_title')}
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 bg-white/[0.01] border border-white/5 rounded-lg hover:border-emerald-500/20 transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs font-mono text-slate-200">{t('docs.sec3_li1')}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white/[0.01] border border-white/5 rounded-lg hover:border-emerald-500/20 transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs font-mono text-slate-200">{t('docs.sec3_li2')}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white/[0.01] border border-white/5 rounded-lg hover:border-emerald-500/20 transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs font-mono text-slate-200">{t('docs.sec3_li3')}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white/[0.01] border border-white/5 rounded-lg hover:border-emerald-500/20 transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs font-mono text-slate-200">{t('docs.sec3_li4')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 4: Architecture */}
        <div 
          className={`border rounded-xl transition-all duration-300 backdrop-blur-md overflow-hidden ${
            expanded[4] 
              ? 'bg-slate-900/50 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.05)]' 
              : 'bg-slate-900/20 border-white/5 hover:border-white/10 hover:bg-slate-900/30'
          }`}
        >
          <button 
            onClick={() => toggleCard(4)}
            className="w-full flex items-center justify-between p-5 text-left transition-colors duration-200"
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                expanded[4] 
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' 
                  : 'bg-white/5 border-white/5 text-slate-400'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
                  {t('docs.sec4_title')}
                </h3>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">Section 04 / Workspace Layout</p>
              </div>
            </div>

            <div className={`text-slate-400 transition-transform duration-300 ${expanded[4] ? 'rotate-180 text-purple-400' : ''}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          <div className={`transition-all duration-300 ease-in-out ${expanded[4] ? 'max-h-[1000px] opacity-100 border-t border-white/5' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div className="p-6 text-sm text-slate-300 space-y-4 leading-relaxed font-sans">
              <p>
                {t('docs.sec4_p1')}
              </p>
              
              <div className="border border-purple-500/20 bg-slate-950/60 rounded-xl p-5">
                <span className="text-[10px] text-purple-400 font-mono tracking-wider uppercase block mb-3 font-semibold">
                  {t('docs.sec4_workspace_title')}
                </span>
                
                <div className="space-y-2.5 font-mono text-xs text-slate-300">
                  <div className="p-3 rounded-lg border border-white/5 bg-white/[0.01] hover:border-purple-500/20 transition-all">
                    <span className="text-purple-400 font-bold block mb-1 font-sans text-xs">packages/core</span>
                    <span className="text-slate-400 text-[11px] font-sans block leading-normal">{t('docs.sec4_li1_desc')}</span>
                  </div>
                  <div className="p-3 rounded-lg border border-white/5 bg-white/[0.01] hover:border-purple-500/20 transition-all">
                    <span className="text-purple-400 font-bold block mb-1 font-sans text-xs">packages/config</span>
                    <span className="text-slate-400 text-[11px] font-sans block leading-normal">{t('docs.sec4_li2_desc')}</span>
                  </div>
                  <div className="p-3 rounded-lg border border-white/5 bg-white/[0.01] hover:border-purple-500/20 transition-all">
                    <span className="text-purple-400 font-bold block mb-1 font-sans text-xs">packages/testing</span>
                    <span className="text-slate-400 text-[11px] font-sans block leading-normal">{t('docs.sec4_li3_desc')}</span>
                  </div>
                  <div className="p-3 rounded-lg border border-white/5 bg-white/[0.01] hover:border-purple-500/20 transition-all">
                    <span className="text-purple-400 font-bold block mb-1 font-sans text-xs">apps/bot</span>
                    <span className="text-slate-400 text-[11px] font-sans block leading-normal">{t('docs.sec4_li4_desc')}</span>
                  </div>
                  <div className="p-3 rounded-lg border border-white/5 bg-white/[0.01] hover:border-purple-500/20 transition-all">
                    <span className="text-purple-400 font-bold block mb-1 font-sans text-xs">apps/web</span>
                    <span className="text-slate-400 text-[11px] font-sans block leading-normal">{t('docs.sec4_li5_desc')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 5: Persistence Layer */}
        <div 
          className={`border rounded-xl transition-all duration-300 backdrop-blur-md overflow-hidden ${
            expanded[5] 
              ? 'bg-slate-900/50 border-pink-500/30 shadow-[0_0_20px_rgba(236,72,153,0.05)]' 
              : 'bg-slate-900/20 border-white/5 hover:border-white/10 hover:bg-slate-900/30'
          }`}
        >
          <button 
            onClick={() => toggleCard(5)}
            className="w-full flex items-center justify-between p-5 text-left transition-colors duration-200"
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                expanded[5] 
                  ? 'bg-pink-500/10 border-pink-500/30 text-pink-400' 
                  : 'bg-white/5 border-white/5 text-slate-400'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
                  {t('docs.sec5_title')}
                </h3>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">Section 05 / Persistence Layer</p>
              </div>
            </div>

            <div className={`text-slate-400 transition-transform duration-300 ${expanded[5] ? 'rotate-180 text-pink-400' : ''}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          <div className={`transition-all duration-300 ease-in-out ${expanded[5] ? 'max-h-[800px] opacity-100 border-t border-white/5' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div className="p-6 text-sm text-slate-300 space-y-4 leading-relaxed font-sans">
              <p>
                {t('docs.sec5_p1')}
              </p>
              
              <div className="border border-pink-500/20 bg-slate-950/60 rounded-xl p-5">
                <span className="text-[10px] text-pink-400 font-mono tracking-wider uppercase block mb-3 font-semibold">
                  {t('docs.sec5_modes_title')}
                </span>
                
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex items-start gap-3.5 p-3 rounded-lg border border-white/5 bg-white/[0.01] hover:border-pink-500/20 transition-all">
                    <div className="w-2 h-2 rounded-full bg-slate-500 mt-1.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-200 block text-xs font-sans">Local Mode</span>
                      <span className="text-slate-400 text-[11px] font-sans block leading-normal mt-0.5">{t('docs.sec5_p2_1')}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3.5 p-3 rounded-lg border border-white/5 bg-white/[0.01] hover:border-pink-500/20 transition-all">
                    <div className="w-2 h-2 rounded-full bg-pink-500 mt-1.5 shrink-0 animate-pulse" />
                    <div>
                      <span className="font-semibold text-pink-400 block text-xs font-sans">Supabase Mode</span>
                      <span className="text-slate-400 text-[11px] font-sans block leading-normal mt-0.5">{t('docs.sec5_p3')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

