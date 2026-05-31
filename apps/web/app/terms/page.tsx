'use client';

import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

import { useLanguage } from '../LanguageContext';

export default function TermsPage() {
  const { language } = useLanguage();

  return (
    <div className="space-y-8 animate-fadeIn max-w-[1000px] mx-auto pb-10">
      {/* HEADER */}
      <div className="pb-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl font-mono uppercase">
            {language === 'es' ? 'TÉRMINOS Y CONDICIONES' : 'TERMS & CONDITIONS'}
          </h2>
          <p className="mt-2 text-sm text-slate-400 font-sans">
            {language === 'es' ? 'Última actualización: 31 de mayo de 2026' : 'Last updated: May 31, 2026'}
          </p>
        </div>
        <Link href="/" passHref legacyBehavior>
          <Button variant="outline" size="sm" className="border-white/10 bg-white/5 hover:bg-white/10 text-white font-mono text-xs self-start md:self-center">
            &larr; {language === 'es' ? 'Volver al Panel' : 'Back to Dashboard'}
          </Button>
        </Link>
      </div>

      {/* CONTENT CARD */}
      <Card className="border border-white/5 bg-slate-950/20 backdrop-blur-md">
        <CardHeader className="border-b border-white/5 bg-slate-950/10 p-6">
          <CardTitle className="text-sm font-mono font-bold text-white uppercase tracking-wider">
            {language === 'es' ? 'TÉRMINOS DE USO DE AUREX' : 'AUREX TERMS OF USE'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 text-sm text-slate-300 leading-relaxed font-sans p-6 md:p-8">
          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                1. {language === 'es' ? 'Introducción' : 'Introduction'}
              </h3>
              <p className="text-slate-300">
                {language === 'es'
                  ? 'Estos Términos y Condiciones ("Términos") rigen el uso de Aurex (la "Plataforma"), un simulador en tiempo real de arbitraje de Bitcoin entre exchanges con fines exclusivamente educativos y demostrativos.'
                  : 'These Terms and Conditions ("Terms") govern the use of Aurex (the "Platform"), a real-time Bitcoin cross-exchange arbitrage simulator provided strictly for educational and demonstration purposes.'}
              </p>
              <p className="text-xs font-mono text-amber-500/90 bg-amber-500/5 px-2.5 py-1.5 rounded border border-amber-500/10 uppercase inline-block">
                {language === 'es'
                  ? 'Al acceder o usar la Plataforma, aceptas estos Términos en su totalidad. Si no estás de acuerdo, no la uses.'
                  : 'By accessing or using the Platform, you accept these Terms in full. If you do not agree, do not use it.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                2. {language === 'es' ? 'Naturaleza del Servicio' : 'Nature of the Service'}
              </h3>
              <ul className="list-disc list-inside space-y-2 pl-2 text-slate-300">
                <li>
                  <strong className="text-white">{language === 'es' ? 'Solo simulación:' : 'Simulation only:'}</strong>{' '}
                  {language === 'es'
                    ? 'Aurex no ejecuta operaciones reales. Todas las órdenes, balances, comisiones y resultados de P&L son sintéticos y se calculan sobre datos de mercado públicos.'
                    : 'Aurex executes no real trades. All orders, balances, fees, and P&L results are synthetic and computed against public market data.'}
                </li>
                <li>
                  <strong className="text-white">{language === 'es' ? 'No custodial:' : 'Non-custodial:'}</strong>{' '}
                  {language === 'es'
                    ? 'La Plataforma no recibe depósitos, no procesa retiros y no mantiene fondos, claves privadas ni credenciales de exchange.'
                    : 'The Platform takes no deposits, processes no withdrawals, and holds no funds, private keys, or exchange credentials.'}
                </li>
                <li>
                  {language === 'es'
                    ? 'Los balances iniciales (p. ej. 100 000 USD) son una reserva ficticia que se reinicia según las reglas internas del simulador.'
                    : 'Initial balances (e.g. 100,000 USD) are a fictitious reserve that resets according to the simulator’s internal rules.'}
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                3. {language === 'es' ? 'No es Asesoría Financiera' : 'Not Financial Advice'}
              </h3>
              <p className="text-slate-300">
                {language === 'es'
                  ? 'El contenido de la Plataforma es informativo y educativo. No constituye asesoría financiera, de inversión, legal ni fiscal, ni una oferta o recomendación para comprar o vender activos.'
                  : 'The content of the Platform is informational and educational. It does not constitute financial, investment, legal, or tax advice, nor an offer or recommendation to buy or sell any asset.'}
              </p>
              <p className="text-amber-500 text-xs font-mono tracking-wide pt-1">
                ⚠️ {language === 'es'
                  ? 'El rendimiento simulado no es indicativo de resultados reales. El trading de criptoactivos conlleva un riesgo elevado.'
                  : 'Simulated performance is not indicative of real results. Trading crypto assets carries a high degree of risk.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                4. {language === 'es' ? 'Datos de Mercado y Terceros' : 'Market Data & Third Parties'}
              </h3>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
                <li>
                  {language === 'es'
                    ? 'La Plataforma consume datos de mercado públicos de exchanges de terceros (Binance, Kraken, Coinbase, OKX y Bybit) a través de sus feeds abiertos.'
                    : 'The Platform consumes public market data from third-party exchanges (Binance, Kraken, Coinbase, OKX, and Bybit) via their open feeds.'}
                </li>
                <li>
                  {language === 'es'
                    ? 'Aurex no está afiliado, patrocinado ni respaldado por dichos exchanges. Sus nombres y marcas pertenecen a sus respectivos titulares.'
                    : 'Aurex is not affiliated with, sponsored by, or endorsed by those exchanges. Their names and trademarks belong to their respective owners.'}
                </li>
                <li>
                  {language === 'es'
                    ? 'No garantizamos la exactitud, disponibilidad ni continuidad de los datos de terceros.'
                    : 'We do not guarantee the accuracy, availability, or continuity of third-party data.'}
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                5. {language === 'es' ? 'Uso Aceptable' : 'Acceptable Use'}
              </h3>
              <p className="text-slate-300">
                <strong className="text-rose-500">{language === 'es' ? 'Prohibido:' : 'Prohibited:'}</strong>{' '}
                {language === 'es'
                  ? 'intentar sobrecargar o interrumpir el servicio, abusar de la API, introducir malware, o cualquier conducta que comprometa la integridad o seguridad de la Plataforma.'
                  : 'attempting to overload or disrupt the service, abusing the API, introducing malware, or any conduct that compromises the integrity or security of the Platform.'}
              </p>
              <p className="text-slate-400 text-xs">
                {language === 'es'
                  ? 'Podemos restringir o suspender el acceso ante un uso indebido.'
                  : 'We may restrict or suspend access in response to misuse.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                6. {language === 'es' ? 'Propiedad Intelectual' : 'Intellectual Property'}
              </h3>
              <p className="text-slate-300">
                {language === 'es'
                  ? 'El código, diseño, textos y elementos visuales de Aurex pertenecen a su autor. Cualquier uso permitido del código fuente se rige por la licencia incluida en el repositorio del proyecto.'
                  : 'The code, design, copy, and visual elements of Aurex belong to its author. Any permitted use of the source code is governed by the license included in the project repository.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                7. {language === 'es' ? 'Descargo de Garantías' : 'Disclaimer of Warranties'}
              </h3>
              <p className="text-slate-300">
                {language === 'es'
                  ? 'La Plataforma se proporciona "tal cual" y "según disponibilidad". No garantizamos un funcionamiento ininterrumpido, libre de errores o de virus, ni la exactitud de los cálculos simulados.'
                  : 'The Platform is provided "as is" and "as available". We do not guarantee uninterrupted, error-free, or virus-free operation, nor the accuracy of the simulated calculations.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                8. {language === 'es' ? 'Limitación de Responsabilidad' : 'Limitation of Liability'}
              </h3>
              <p className="text-slate-300">
                {language === 'es'
                  ? 'En la máxima medida permitida por la ley, no seremos responsables de daños indirectos, incidentales o consecuentes, ni de decisiones tomadas con base en la información o los resultados simulados de la Plataforma.'
                  : 'To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages, nor for decisions made based on the information or simulated results of the Platform.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                9. {language === 'es' ? 'Modificaciones' : 'Modifications'}
              </h3>
              <p className="text-slate-300">
                {language === 'es'
                  ? 'Podemos actualizar estos Términos en cualquier momento. El uso continuado de la Plataforma tras una actualización implica la aceptación de los Términos revisados.'
                  : 'We may update these Terms at any time. Continued use of the Platform after an update constitutes acceptance of the revised Terms.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                10. {language === 'es' ? 'Privacidad y Contacto' : 'Privacy & Contact'}
              </h3>
              <p className="text-slate-300">
                {language === 'es' ? 'El tratamiento de datos se describe en nuestra ' : 'Data handling is described in our '}
                <Link href="/privacy" className="text-amber-500 hover:text-amber-400 hover:underline">
                  {language === 'es' ? 'Política de Privacidad' : 'Privacy Policy'}
                </Link>.{' '}
                {language === 'es'
                  ? 'Para consultas sobre la Plataforma, abre un issue en el repositorio del proyecto.'
                  : 'For questions about the Platform, open an issue in the project repository.'}
              </p>
            </section>
          </div>

          <div className="border-t border-white/5 pt-6 text-center text-xs font-mono text-slate-500">
            {language === 'es'
              ? 'Última actualización: 31 de mayo de 2026.'
              : 'Last updated: May 31, 2026.'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
