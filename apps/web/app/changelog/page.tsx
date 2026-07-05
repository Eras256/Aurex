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

// Final-phase work (finalist extension window, Option B — deadline Sun 12 Jul 2026) shown
// first, since it is the most recent and most heavily-weighted delta by the committee's own
// stated criteria (parametrization depth is called out as the #1 differentiator).
const FINAL_PHASE_GROUPS: ChangeGroup[] = [
  {
    tag: 'PARAMETRIZATION',
    title: {
      en: 'Deep runtime parametrization',
      es: 'Parametrización profunda en tiempo real',
    },
    items: [
      {
        en: 'Every previously-hardcoded engine constant is now a live, schema-validated (Zod), hot-applied knob in EngineConfig: sizing step, per-pair execution cooldown, circuit-breaker multiple, leg-fill failure probability, volatility-breaker %, consecutive-loss limit, loss/volatility cooldown durations, inventory rebalancing thresholds, and the statistical-arbitrage z-score gate — all editable from the Risk page with no restart.',
        es: 'Cada constante del motor que antes estaba fija en el código es ahora un parámetro en vivo, validado por esquema (Zod) y aplicado en caliente en EngineConfig: paso de sizing, cooldown de ejecución por par, multiplicador del circuit breaker, probabilidad de leg-fail, % del breaker de volatilidad, límite de pérdidas consecutivas, duración de cooldowns, umbrales de rebalanceo de inventario y el gate estadístico por z-score — todo editable desde la página de Riesgo sin reiniciar.',
      },
      {
        en: 'Per-exchange taker-fee overrides with one-click Retail/VIP presets, so the operator can make the fee assumption explicit and adjustable instead of hidden.',
        es: 'Overrides de comisión taker por exchange con presets de un clic Retail/VIP, para que la comisión asumida sea explícita y ajustable en vez de estar oculta.',
      },
    ],
  },
  {
    tag: 'AI · LIVE MODEL',
    title: {
      en: 'Copilot upgraded to a real, live LLM — grounded on engine state',
      es: 'Copiloto actualizado a un LLM real y en vivo — anclado al estado del motor',
    },
    items: [
      {
        en: 'The AI Copilot — and every in-app AI widget (trade critiques, opportunity explanations, system-health diagnostics and risk calibration) — is now backed by a real model (OpenAI gpt-4o-mini) instead of the deterministic mock. It is reached through two secure server-side Next.js routes; the API key is read server-side only and never reaches the client bundle.',
        es: 'El Copiloto IA — y cada widget de IA de la app (críticas de ejecución, explicación de oportunidades, diagnóstico de salud del sistema y calibración de riesgo) — ahora usa un modelo real (OpenAI gpt-4o-mini) en lugar del mock determinístico. Se accede vía dos rutas server-side seguras de Next.js; la API key se lee solo en el servidor y jamás llega al bundle del cliente.',
      },
      {
        en: 'Answers are grounded on the live engine state (GET /state): the model reasons over the operator’s real P&L, risk config, recent fills and rejected windows, so it cites actual numbers rather than templated boilerplate.',
        es: 'Las respuestas se anclan al estado en vivo del motor (GET /state): el modelo razona sobre el P&L real del operador, la configuración de riesgo, los fills recientes y las ventanas rechazadas, de modo que cita cifras reales en vez de plantillas.',
      },
      {
        en: 'Resilience is preserved and made honest: if the key is unconfigured or a request fails, each call falls back transparently to the deterministic mock so the demo never breaks — and the UI labels which mode produced the answer (live model vs. offline fallback) so the distinction is never overstated.',
        es: 'La resiliencia se conserva y se hace honesta: si la key no está configurada o una petición falla, cada llamada cae de forma transparente al mock determinístico para que la demo nunca se rompa — y la interfaz etiqueta qué modo produjo la respuesta (modelo en vivo vs. fallback offline), para no exagerar nunca la distinción.',
      },
    ],
  },
  {
    tag: 'STRATEGY+',
    title: {
      en: 'Statistical-arbitrage gate wired to execution',
      es: 'Gate de arbitraje estadístico conectado a la ejecución',
    },
    items: [
      {
        en: 'The rolling per-pair z-score (already computed for ranking) now optionally gates execution: when enabled, only windows more anomalous than a configurable threshold are executed, prioritising mean-reverting dislocations over merely-positive spreads.',
        es: 'El z-score móvil por par (ya calculado para el ranking) ahora puede además condicionar la ejecución: si se activa, solo se ejecutan ventanas más anómalas que un umbral configurable, priorizando dislocaciones reversibles sobre spreads apenas positivos.',
      },
    ],
  },
  {
    tag: 'ROBUSTNESS+',
    title: {
      en: 'Deterministic robustness coverage',
      es: 'Cobertura determinística de robustez',
    },
    items: [
      {
        en: 'New unit tests exercise the configurable circuit breakers deterministically (volatility breaker trips at the configured %, consecutive-loss breaker trips at the configured limit and not before, and the loss streak resets after a win) — proving robustness rather than only asserting it.',
        es: 'Nuevas pruebas unitarias ejercitan los circuit breakers configurables de forma determinística (el breaker de volatilidad dispara al % configurado, el de pérdidas consecutivas dispara en el límite configurado y no antes, y la racha se reinicia tras una ganancia) — demostrando la robustez en vez de solo afirmarla.',
      },
    ],
  },
  {
    tag: 'REBALANCE+',
    title: {
      en: 'Rebalancing visibility',
      es: 'Visibilidad del rebalanceo',
    },
    items: [
      {
        en: 'The Wallets page now surfaces the active (operator-configurable) rebalancing thresholds per asset plus recent REBALANCE settlement activity pulled straight from the engine event stream.',
        es: 'La página de Wallets ahora muestra los umbrales de rebalanceo activos (configurables por el operador) por activo, más la actividad reciente de REBALANCE tomada directamente del stream de eventos del motor.',
      },
    ],
  },
  {
    tag: 'ANALYTICS+',
    title: {
      en: 'Max-drawdown metric',
      es: 'Métrica de drawdown máximo',
    },
    items: [
      {
        en: 'A max-drawdown figure (largest peak-to-trough equity decline) is computed client-side from the same equity history driving the P&L chart, alongside the existing win rate and honest Sharpe.',
        es: 'Se calcula del lado del cliente un drawdown máximo (la mayor caída de pico a valle del equity) a partir del mismo historial que alimenta la gráfica de P&L, junto al win rate y el Sharpe honesto ya existentes.',
      },
    ],
  },
  {
    tag: 'REAL EXECUTION',
    title: {
      en: 'Real order execution on exchange test/demo environments',
      es: 'Ejecución real de órdenes en entornos de prueba/demo de exchanges',
    },
    items: [
      {
        en: 'An optional executionMode: "testnet" routes arbitrage legs to real signed IOC orders on venue test environments — Binance Spot Testnet, OKX Demo and Bybit Testnet, all three verified live with real filled orders (six real-executable directed routes) — fake balances, no real funds, real matching engines. Falls back to the internal simulator per-trade if a leg is unconfigured or fails, so the default demo experience never depends on it.',
        es: 'Un modo opcional executionMode: "testnet" enruta las patas de arbitraje a órdenes IOC reales y firmadas en los entornos de prueba de los exchanges — Binance Spot Testnet, OKX Demo y Bybit Testnet, los tres verificados en vivo con órdenes reales llenadas (seis rutas dirigidas ejecutables en real) — balances falsos, sin fondos reales, motores de matching reales. Si una pata no está configurada o falla, cae a la simulación interna para ese trade, así el modo demo por defecto nunca depende de esto.',
      },
    ],
  },
  {
    tag: 'INFRASTRUCTURE',
    title: {
      en: 'Redeployed backend with durable cloud persistence',
      es: 'Backend redesplegado con persistencia en la nube duradera',
    },
    items: [
      {
        en: 'The bot now runs on a new Fly.io app with Supabase Postgres persistence (trades, opportunities, balances, config and P&L survive machine restarts/redeploys — the previous state was ephemeral local storage), still in the Frankfurt region required to reach all 5 exchange feeds, on a single machine (the engine is a stateful singleton; a second machine would split state).',
        es: 'El bot corre ahora en una nueva app de Fly.io con persistencia en Supabase Postgres (trades, oportunidades, balances, config y P&L sobreviven reinicios/redeploys de la máquina — antes el estado era almacenamiento local efímero), sigue en la región de Frankfurt necesaria para alcanzar los 5 feeds de exchanges, con una sola máquina (el motor es un singleton con estado; una segunda máquina dividiría el estado).',
      },
    ],
  },
];

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
      {
        en: 'Markets grid and spread matrix across the 5 venues, wallet/CEX coverage view, logo-to-home links and repositioned language selectors.',
        es: 'Grid de mercados y matriz de spreads en los 5 venues, vista de cobertura wallets/CEX, logos enlazados al inicio y selectores de idioma reposicionados.',
      },
    ],
  },
  {
    tag: 'TESTS & QA',
    title: {
      en: 'Tests & quality',
      es: 'Pruebas y calidad',
    },
    items: [
      {
        en: 'Integration test suite for the Express bot API (HTTP routes, secure-guard auth, calibration and audit endpoints) on top of the existing unit tests — 41 tests passing.',
        es: 'Suite de pruebas de integración para la API del bot en Express (rutas HTTP, auth con secure-guard, endpoints de calibración y auditoría) sobre las pruebas unitarias existentes — 41 pruebas en verde.',
      },
    ],
  },
  {
    tag: 'DOCS & LEGAL',
    title: {
      en: 'Documentation & legal',
      es: 'Documentación y legal',
    },
    items: [
      {
        en: 'Bilingual README rewrite, technical paper, operational runbook and AI Copilot phase roadmaps; absolute claims softened for technical honesty.',
        es: 'Reescritura bilingüe del README, paper técnico, runbook operativo y roadmaps de fase del Copiloto IA; afirmaciones absolutas suavizadas por honestidad técnica.',
      },
      {
        en: 'Aurex-specific Terms & Privacy plus the official Coding Challenge Mexico policy pages, routed from the footer.',
        es: 'Términos y Privacidad propios de Aurex más las páginas oficiales de política de Coding Challenge Mexico, enrutadas desde el pie de página.',
      },
    ],
  },
  {
    tag: 'TOOLING / CI',
    title: {
      en: 'Tooling, CI & refactors',
      es: 'Tooling, CI y refactors',
    },
    items: [
      {
        en: 'CI workflow YAML fix, removal of dead i18n scaffolding, elimination of `any` types for stricter typing, and assorted build/config cleanups.',
        es: 'Corrección de YAML del workflow de CI, eliminación de andamiaje i18n muerto, supresión de tipos `any` para tipado más estricto y limpiezas varias de build/config.',
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
              ? 'El código del repositorio enviado para evaluación está congelado en el commit de cierre. El despliegue público siguió iterando después de esa fecha; cada cambio sobre la entrega congelada está listado, de forma completa y honesta, más abajo.'
              : 'The repository code submitted for judging is frozen at the deadline commit. The public deployment kept iterating after that date; every change over the frozen submission is listed, fully and honestly, below.'}
          </p>
          <p>
            {es
              ? 'El objetivo es que el jurado pueda reconciliar ambos: lo que se evaluó es exactamente el commit congelado, y lo que está en vivo es ese commit más las extensiones detalladas en esta página.'
              : 'The goal is that reviewers can reconcile the two: what was judged is exactly the frozen commit, and what is live is that commit plus the extensions detailed on this page.'}
          </p>
          <p>
            {es
              ? 'Los 17 finalistas votaron por la Opción B: una ventana de extensión oficial hasta el domingo 12 de julio de 2026 para ampliar el proyecto (branch final-phase). Lo listado en "Fase Final" abajo corresponde a ese trabajo oficial, ya fusionado a main y desplegado.'
              : 'The 17 finalists voted for Option B: an official extension window through Sunday 12 Jul 2026 to expand the project (final-phase branch). Everything listed under "Final Phase" below is that official work, already merged to main and deployed.'}
          </p>
        </div>
      </div>

      {/* FINAL-PHASE GROUPS (shown first — most recent, highest-weighted delta) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 pl-1">
          <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
            {es ? 'Fase Final · Ventana de Extensión' : 'Final Phase · Extension Window'}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {FINAL_PHASE_GROUPS.map((group) => (
            <div
              key={group.tag}
              className="p-5 rounded-xl bg-emerald-500/[0.02] border border-emerald-500/10 hover:border-emerald-500/20 hover:bg-emerald-500/[0.04] transition-all duration-300"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <span className="text-[9px] font-mono uppercase tracking-wider font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                  {group.tag}
                </span>
                <h3 className="text-sm font-semibold text-slate-100 font-mono uppercase tracking-wide">
                  {es ? group.title.es : group.title.en}
                </h3>
              </div>
              <ul className="space-y-2 pl-1">
                {group.items.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] text-slate-400 font-sans leading-relaxed">
                    <span className="text-emerald-500/60 mt-1 shrink-0 text-[10px]">▸</span>
                    <span>{es ? item.es : item.en}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* PRE-FINAL-PHASE CHANGE GROUPS (original post-48h public-deploy delta) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 pl-1">
          <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25">
            {es ? 'Pre-Fase Final · Delta del Despliegue Público' : 'Pre-Final-Phase · Public Deploy Delta'}
          </span>
        </div>
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
