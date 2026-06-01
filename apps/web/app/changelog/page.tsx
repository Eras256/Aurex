'use client';

import React from 'react';

import { useLanguage } from '../LanguageContext';

/**
 * Build Notes / Changelog page.
 *
 * Transparency surface for the challenge: the GitHub repository submitted for judging is
 * frozen at the code-deadline commit `9eb95a4` (only README/docs were polished afterwards).
 * The live public deployment was then iterated during the additional public-deployment
 * window. This page documents — honestly and in full — every engineering change the live
 * system carries on top of that frozen submission, so reviewers can reconcile the two.
 *
 * It lives entirely in the deployed app; it does not alter the submitted repository.
 */

const FROZEN_COMMIT = '9eb95a4';
const REPO_URL = 'https://github.com/Eras256/Aurex';

type ChangeGroup = {
  tag: string;
  title: { en: string; es: string };
  items: { en: string; es: string }[];
};

const GROUPS: ChangeGroup[] = [
  {
    tag: 'REALISM',
    title: {
      en: 'Execution realism & honest metrics',
      es: 'Realismo de ejecución y métricas honestas',
    },
    items: [
      {
        en: 'Stochastic two-sided fill drift: realised fills are drawn around the modeled adverse cost (Box–Muller), so the win rate is no longer a perfect 100%.',
        es: 'Deriva de llenado estocástica de dos colas: el fill realizado se sortea alrededor del coste adverso modelado (Box–Muller), por lo que el win rate ya no es un 100% perfecto.',
      },
      {
        en: 'Cross-venue leg-execution risk: a fraction of approved trades fill one leg and miss the other, unwinding at a realised loss — the dominant real-world loss source.',
        es: 'Riesgo de ejecución por pata (leg risk): una fracción de operaciones aprobadas llena una pata y falla la otra, deshaciéndose con pérdida real — la principal fuente de pérdida del mundo real.',
      },
      {
        en: 'Per-pair execution cooldown (60s): once a dislocation is captured the pair is not re-fired every tick, so cumulative returns are realistic instead of compounding an artificial spread.',
        es: 'Cooldown de ejecución por par (60s): tras capturar una dislocación el par no se re-dispara en cada tick, así el retorno acumulado es realista y no compone un spread artificial.',
      },
      {
        en: 'SKIPPED window surfacing: sub-threshold venue pairs are recorded as transparently-rejected even on executing cycles, and the feed is status-balanced so SKIPPED is never empty.',
        es: 'Exposición de ventanas SKIPPED: los pares sub-umbral se registran como rechazados transparentes incluso en ciclos que ejecutan, y el feed se balancea por estado para que SKIPPED nunca esté vacío.',
      },
    ],
  },
  {
    tag: 'STRATEGY',
    title: {
      en: 'Strategy intelligence',
      es: 'Inteligencia de estrategia',
    },
    items: [
      {
        en: 'Single-venue triangular arbitrage on Binance (USDT → BTC → ETH cycle), net of three taker fees.',
        es: 'Arbitraje triangular de un solo venue en Binance (ciclo USDT → BTC → ETH), neto de tres comisiones taker.',
      },
      {
        en: 'Statistical-arbitrage ranking: a rolling z-score per venue pair prioritises the most anomalous, mean-reverting dislocations when multiple windows are profitable.',
        es: 'Ranking de arbitraje estadístico: un z-score móvil por par de venues prioriza las dislocaciones más anómalas y reversibles cuando varias ventanas son rentables.',
      },
    ],
  },
  {
    tag: 'EXECUTION',
    title: {
      en: 'Execution & latency modelling',
      es: 'Modelado de ejecución y latencia',
    },
    items: [
      {
        en: 'Adverse price-movement model during the fill window, scaled by volatility × √time.',
        es: 'Modelo de movimiento adverso del precio durante la ventana de llenado, escalado por volatilidad × √tiempo.',
      },
      {
        en: 'Pure compute latency separated from wire latency, with a p99 detection-latency metric in the header ticker.',
        es: 'Latencia de cómputo puro separada de la latencia de red, con métrica p99 de latencia de detección en el ticker de cabecera.',
      },
    ],
  },
  {
    tag: 'AI COPILOT',
    title: {
      en: 'AI Quant Copilot layer',
      es: 'Capa de AI Quant Copilot',
    },
    items: [
      {
        en: 'AI Copilot workspace and an engine settings modal with provider/model selection (advisory only; simulated by default).',
        es: 'Espacio de trabajo del Copiloto IA y un modal de ajustes del motor con selección de proveedor/modelo (solo consultivo; simulado por defecto).',
      },
      {
        en: 'Spread explainability and execution-cost attribution surfaced from live telemetry.',
        es: 'Explicabilidad del spread y atribución de costes de ejecución a partir de telemetría en vivo.',
      },
    ],
  },
  {
    tag: 'RELIABILITY',
    title: {
      en: 'Reliability & operations',
      es: 'Fiabilidad y operación',
    },
    items: [
      {
        en: 'Always-on engine guard and liveness watchdog with self-heal recovery counting.',
        es: 'Guardia de motor siempre activo y watchdog de liveness con conteo de auto-recuperación.',
      },
      {
        en: 'Honest Sharpe ratio: withheld until at least 20 trades exist, rendered as "Calculating n/20" rather than a flattering placeholder.',
        es: 'Sharpe honesto: se retiene hasta tener al menos 20 operaciones, mostrado como "Calculando n/20" en vez de un placeholder favorecedor.',
      },
      {
        en: 'Binance resync-storm fix (reconnect on persistent desync) and persistence honesty (report missing cloud state instead of masquerading defaults).',
        es: 'Corrección de tormenta de resync en Binance (reconexión ante desync persistente) y honestidad de persistencia (reportar estado de nube ausente en vez de enmascarar valores por defecto).',
      },
      {
        en: 'Real Supabase audit trail, dynamic risk-calibration API, and a live WebSocket telemetry stream.',
        es: 'Audit trail real en Supabase, API de calibración dinámica de riesgo y stream de telemetría por WebSocket en vivo.',
      },
    ],
  },
  {
    tag: 'UI / I18N',
    title: {
      en: 'Interface & localisation',
      es: 'Interfaz y localización',
    },
    items: [
      {
        en: 'Full English/Spanish localisation across the terminal, plus responsive fixes (mobile bottom-sheet modal, header ticker, overflow tables).',
        es: 'Localización completa inglés/español en todo el terminal, más correcciones responsivas (modal bottom-sheet móvil, ticker de cabecera, tablas con overflow).',
      },
    ],
  },
];

export default function ChangelogPage() {
  const { language } = useLanguage();
  const es = language === 'es';

  return (
    <div className="space-y-8 animate-fadeIn max-w-[1000px] mx-auto pb-12">
      {/* HEADER */}
      <div className="pb-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] shrink-0" />
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl font-mono uppercase">
            {es ? 'Notas de Build' : 'Build Notes'}
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-400 font-sans pl-5 leading-relaxed">
          {es
            ? 'Transparencia para la evaluación: lo que el sistema en vivo incorpora por encima del código entregado en GitHub.'
            : 'Transparency for review: what the live system carries on top of the code submitted to GitHub.'}
        </p>
      </div>

      {/* FROZEN-SUBMISSION CALLOUT */}
      <div className="relative p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-950/80 via-slate-900/40 to-slate-950/80 border border-amber-500/15 backdrop-blur-md shadow-2xl overflow-hidden">
        <div className="absolute -left-20 -top-20 w-48 h-48 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3 font-sans text-sm leading-relaxed text-slate-300">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25">
              {es ? 'Entrega congelada' : 'Frozen submission'}
            </span>
            <a
              href={`${REPO_URL}/commit/${FROZEN_COMMIT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-amber-300 hover:text-amber-200 underline underline-offset-2"
            >
              {REPO_URL.replace('https://', '')} @ {FROZEN_COMMIT}
            </a>
          </div>
          <p>
            {es
              ? 'El código del repositorio enviado para evaluación está congelado en el commit de cierre. Los únicos commits posteriores en GitHub son ediciones de README (documentación, no código), firmadas y verificadas.'
              : 'The repository code submitted for judging is frozen at the deadline commit. The only later commits on GitHub are README edits (documentation, not code), signed and verified.'}
          </p>
          <p>
            {es
              ? 'Durante la ventana adicional de publicación del sistema, el despliegue público siguió iterando. Esta página lista, de forma completa y honesta, cada cambio que el sistema en vivo tiene sobre la entrega congelada — para que el jurado pueda reconciliar ambos.'
              : 'During the additional public-deployment window, the public deployment continued to iterate. This page lists — fully and honestly — every change the live system carries over the frozen submission, so reviewers can reconcile the two.'}
          </p>
        </div>
      </div>

      {/* CHANGE GROUPS */}
      <div className="grid grid-cols-1 gap-4">
        {GROUPS.map((group) => (
          <div
            key={group.tag}
            className="p-5 rounded-xl bg-white/[0.01] border border-white/5 hover:border-amber-500/15 hover:bg-white/[0.02] transition-all duration-300"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-[9px] font-mono uppercase tracking-wider font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                {group.tag}
              </span>
              <h3 className="text-sm font-semibold text-slate-100 font-mono uppercase tracking-wide">
                {es ? group.title.es : group.title.en}
              </h3>
            </div>
            <ul className="space-y-2 pl-1">
              {group.items.map((item, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] text-slate-400 font-sans leading-relaxed">
                  <span className="text-amber-500/60 mt-1 shrink-0 text-[10px]">▸</span>
                  <span>{es ? item.es : item.en}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* FOOTER NOTE */}
      <p className="text-[11px] text-slate-600 font-mono text-center pt-2 border-t border-white/5">
        {es
          ? 'Entorno simulado. Sin asesoría financiera. Esta página no modifica el repositorio entregado.'
          : 'Simulated environment. Not financial advice. This page does not modify the submitted repository.'}
      </p>
    </div>
  );
}
