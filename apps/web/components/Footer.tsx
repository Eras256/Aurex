'use client';

import React, { useState } from 'react';

import { useLanguage } from '../app/LanguageContext';

export const Footer: React.FC = () => {
  const { language, t } = useLanguage();
  const [activeModal, setActiveModal] = useState<'terms' | 'privacy' | null>(null);

  const handleClose = () => setActiveModal(null);

  // Legal texts localized for May 31, 2026
  const legalData = {
    en: {
      terms_title: 'Terms of Service (May 31, 2026)',
      privacy_title: 'Privacy Policy (May 31, 2026)',
      close: 'Close Window',
      terms: [
        {
          sec: '1. Simulation Scope & Environment',
          text: 'Aurex is an educational and algorithmic cross-exchange arbitrage simulation terminal. It monitors live public order books from global cryptocurrency exchanges and executes synthetic test orders. All balance pooling, ledger records, rebalance operations, and portfolio equity metrics are simulated strictly off-chain within local memory caches.'
        },
        {
          sec: '2. No Custody & Capital Safety',
          text: 'The platform does not manage real custody, route execution transactions to public blockchains, or place production orders. It does not require private CEX API keys for its baseline simulation. Aurex holds absolutely no digital assets or fiat currencies, eliminating all custodial risks.'
        },
        {
          sec: '3. No Financial Advice Disclaimer',
          text: 'None of the mathematical spreads, z-score indicators, historical charts, Sharpe ratios, or simulated executions represent financial advice, investment guidance, or real-world portfolio suggestions. Users must evaluate all data for research and informational purposes only.'
        },
        {
          sec: '4. Public API Feeds & Service Rates',
          text: 'Arbitrage math depends entirely on public REST and WebSocket API connections provided by Binance, Kraken, Coinbase Advanced, OKX, and Bybit. Service response speeds, WebSocket lifespans, and API restrictions are governed by the respective platforms.'
        }
      ],
      privacy: [
        {
          sec: '1. Data Storage & Local Caching',
          text: 'Aurex operates under a localized disk backup model. All wallet balances, opportunities, and trade logs are stored locally on your device in a JSON file ("db.json"). No third-party servers compile or process these files.'
        },
        {
          sec: '2. Optional Supabase Integration',
          text: 'If the cloud persistence driver is active, the backend broadcasts telemetry records to secure PostgreSQL tables. No Personally Identifiable Information (PII), browser identifiers, or telemetry metadata are recorded or transferred.'
        },
        {
          sec: '3. Zero Third-Party Tracker cookies',
          text: 'Our Next.js front-end console contains no behavioral analytics, advertising pixels, or profiling scripts. Your connection and configuration state remain entirely confidential.'
        }
      ]
    },
    es: {
      terms_title: 'Términos de Servicio (31 de mayo de 2026)',
      privacy_title: 'Política de Privacidad (31 de mayo de 2026)',
      close: 'Cerrar Ventana',
      terms: [
        {
          sec: '1. Alcance de la Simulación',
          text: 'Aurex es una terminal de simulación de arbitraje algorítmico con fines educativos y de investigación. Monitorea libros de órdenes públicos en tiempo real de exchanges globales y ejecuta órdenes sintéticas de prueba. Toda la gestión de balances, registros de operaciones y métricas de cartera se simulan off-chain dentro de la memoria local.'
        },
        {
          sec: '2. Ausencia de Custodia y Seguridad',
          text: 'La plataforma no gestiona custodia real, no transmite operaciones a blockchains públicas, ni realiza transacciones reales. No requiere claves API privadas para la simulación base. Aurex no retiene criptomonedas ni dinero fíat, lo que elimina cualquier riesgo custodial.'
        },
        {
          sec: '3. Descargo de Responsabilidad Financiera',
          text: 'Ninguno de los diferenciales calculados, indicadores de z-score, gráficos de P&L, ratios de Sharpe o ejecuciones simuladas constituye asesoría financiera, recomendación de inversión ni consultoría de trading. Toda la información mostrada es estrictamente informativa.'
        },
        {
          sec: '4. Canales de API Públicas',
          text: 'El cálculo matemático depende enteramente de conexiones WebSocket y REST públicas provistas por Binance, Kraken, Coinbase Advanced, OKX y Bybit. Los tiempos de respuesta y la disponibilidad del flujo de datos están sujetos a los respectivos exchanges.'
        }
      ],
      privacy: [
        {
          sec: '1. Almacenamiento Local de Datos',
          text: 'Aurex opera bajo un modelo de respaldo local. Todos los saldos, oportunidades y logs de operaciones se almacenan localmente en su dispositivo en un archivo JSON ("db.json"). Ningún servidor de terceros recopila estos archivos.'
        },
        {
          sec: '2. Integración Opcional de Supabase',
          text: 'Si se activa la persistencia en la nube, el backend transmite registros a tablas PostgreSQL. No se registra, recopila ni transfiere Información de Identificación Personal (PII), identificadores de navegador ni metadatos de conexión.'
        },
        {
          sec: '3. Cero Cookies de Seguimiento',
          text: 'Nuestra consola Next.js no contiene scripts de analítica de comportamiento, píxeles de publicidad ni rastreadores de perfiles. Su configuración y navegación se mantienen completamente confidenciales.'
        }
      ]
    }
  };

  const currentLegal = legalData[language] || legalData['en'];

  return (
    <footer className="border-t border-white/5 bg-darkCard/10 backdrop-blur-md py-6 px-4 sm:px-8 mt-auto shrink-0 relative z-30">
      <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
        
        {/* Left Side: Copy & Legal links */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1.5">
          <span className="text-slate-400 font-semibold tracking-wider">AUREX</span>
          <span>&copy; {new Date().getFullYear()}</span>
          <span className="hidden xs:inline text-white/10">|</span>
          <button
            onClick={() => setActiveModal('terms')}
            className="hover:text-slate-300 transition-colors cursor-pointer underline decoration-white/10 underline-offset-4"
          >
            {language === 'es' ? 'Términos de Servicio' : 'Terms of Service'}
          </button>
          <span className="text-white/10">|</span>
          <button
            onClick={() => setActiveModal('privacy')}
            className="hover:text-slate-300 transition-colors cursor-pointer underline decoration-white/10 underline-offset-4"
          >
            {language === 'es' ? 'Política de Privacidad' : 'Privacy Policy'}
          </button>
        </div>

        {/* Right Side: Telemetry Node Indicator */}
        <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
          <span className="text-amber-500/80 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 text-[10px] tracking-wider uppercase">
            {language === 'es' ? 'Solo Entorno Simulado' : 'Simulated Environment Only'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 text-[10px] font-medium tracking-wide">SECURE NODE</span>
          </div>
        </div>
      </div>

      {/* POPUP MODAL (100% RESPONSIVE FOR MOBILE & DESKTOP) */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-[650px] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh] md:max-h-[75vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-slate-950/40">
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-amber-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                {activeModal === 'terms' ? currentLegal.terms_title : currentLegal.privacy_title}
              </h3>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg border border-white/5 bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Modal Content Scrollable Area */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300 leading-relaxed font-sans custom-scrollbar">
              {(activeModal === 'terms' ? currentLegal.terms : currentLegal.privacy).map((item, idx) => (
                <div key={idx} className="space-y-2">
                  <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wide border-b border-white/5 pb-1">
                    {item.sec}
                  </h4>
                  <p className="text-slate-400 text-xs font-sans">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/5 bg-slate-950/40 flex justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs font-mono transition-colors tracking-wider uppercase shadow-lg shadow-amber-500/10"
              >
                {currentLegal.close}
              </button>
            </div>

          </div>
        </div>
      )}
    </footer>
  );
};
