'use client';

import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

import { useLanguage } from '../LanguageContext';

export default function TermsPage() {
  const { language, t } = useLanguage();

  return (
    <div className="space-y-8 animate-fadeIn max-w-[1000px] mx-auto pb-10">
      {/* HEADER */}
      <div className="pb-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl font-mono uppercase">
            {language === 'es' ? 'TÉRMINOS Y CONDICIONES' : 'TERMS & CONDITIONS'}
          </h2>
          <p className="mt-2 text-sm text-slate-400 font-sans">
            {language === 'es' ? 'Última actualización: 23 de marzo de 2026' : 'Last updated: March 23, 2026'}
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
            {language === 'es' ? 'TÉRMINOS Y CONDICIONES DE CODING CHALLENGE MEXICO' : 'CODING CHALLENGE MEXICO TERMS & CONDITIONS'}
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
                  ? 'Estos Términos y Condiciones ("Términos") rigen el uso de coding-challenge-mexico.com (el "Sitio"), una plataforma en línea dedicada a desafíos de desarrollo de software ("Desafíos").' 
                  : 'These Terms and Conditions ("Terms") govern the use of coding-challenge-mexico.com (the "Site"), an online platform dedicated to software development challenges ("Challenges").'}
              </p>
              <p className="text-xs font-mono text-amber-500/90 bg-amber-500/5 px-2.5 py-1.5 rounded border border-amber-500/10 uppercase inline-block">
                {language === 'es' 
                  ? 'Al acceder, registrarte o participar en el Sitio, aceptas estos Términos en su totalidad. Si no estás de acuerdo, no uses el Sitio.' 
                  : 'By accessing, registering, or participating in the Site, you accept these Terms in full. If you do not agree, do not use the Site.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                2. {language === 'es' ? 'Elegibilidad' : 'Eligibility'}
              </h3>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
                <li>{language === 'es' ? 'Debes tener al menos 18 años o la mayoría de edad en tu jurisdicción para participar.' : 'You must be at least 18 years old or the age of majority in your jurisdiction to participate.'}</li>
                <li>{language === 'es' ? 'No puedes participar si resides en países con restricciones legales aplicables.' : 'You cannot participate if you reside in countries with applicable legal restrictions.'}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                3. {language === 'es' ? 'Registro y Cuenta' : 'Registration and Account'}
              </h3>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
                <li>{language === 'es' ? 'Debes crear una cuenta con información precisa (nombre, email, etc.). Eres responsable de mantener la confidencialidad de tu contraseña.' : 'You must create an account with accurate information (name, email, etc.). You are responsible for maintaining the confidentiality of your password.'}</li>
                <li>{language === 'es' ? 'Nos reservamos el derecho de suspender o eliminar cuentas por uso indebido, fraude o violación de estos Términos.' : 'We reserve the right to suspend or delete accounts for misuse, fraud, or violation of these Terms.'}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                4. {language === 'es' ? 'Participación en Desafíos' : 'Participation in Challenges'}
              </h3>
              <ul className="list-disc list-inside space-y-2 pl-2 text-slate-300">
                <li>{language === 'es' ? 'Los Desafíos consisten en resolver problemas de programación mediante código fuente.' : 'Challenges consist of solving programming problems using source code.'}</li>
                <li>{language === 'es' ? 'Tus envíos ("Soluciones") deben ser originales y no violar derechos de terceros.' : 'Your submissions ("Solutions") must be original and not violate third-party rights.'}</li>
                <li>
                  {language === 'es' 
                    ? 'Otorgas a coding-challenge-mexico.com una licencia mundial, gratuita y perpetua para usar, modificar, distribuir y mostrar tus Soluciones públicamente (por ejemplo, en tablas de clasificación o ejemplos educativos). Retienes la propiedad de tu código, pero permites su uso en el Sitio.' 
                    : 'You grant coding-challenge-mexico.com a worldwide, royalty-free, perpetual license to use, modify, distribute, and display your Solutions publicly (for example, in leaderboards or educational examples). You retain ownership of your code, but allow its use on the Site.'}
                </li>
                <li>{language === 'es' ? 'Las Soluciones ganadoras pueden publicarse bajo licencia open-source si se indica en el Desafío.' : 'Winning Solutions may be published under an open-source license if indicated in the Challenge.'}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                5. {language === 'es' ? 'Premios y Ganadores' : 'Prizes and Winners'}
              </h3>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
                <li>
                  <strong className="text-white">{language === 'es' ? 'Facturación obligatoria:' : 'Required Billing:'}</strong>{' '}
                  {language === 'es' 
                    ? 'Los premios en dinero (se requiere emisión de factura o documento similar) se publicarán en el Sitio y se otorgan a los mejores envíos según criterios objetivos (por ejemplo, eficiencia, corrección).' 
                    : 'Cash prizes (invoice or similar document is required) will be published on the Site and are awarded to the best submissions based on objective criteria (e.g., efficiency, correctness).'}
                </li>
                <li>{language === 'es' ? 'Los ganadores serán notificados por email. No hay obligación de aceptar premios.' : 'Winners will be notified by email. There is no obligation to accept prizes.'}</li>
                <li>{language === 'es' ? 'Impuestos y gastos de envío corren por cuenta del ganador. No garantizamos premios en caso de fuerza mayor.' : 'Taxes and shipping expenses are the responsibility of the winner. We do not guarantee prizes in the event of force majeure.'}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                6. {language === 'es' ? 'Propiedad Intelectual' : 'Intellectual Property'}
              </h3>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
                <li>{language === 'es' ? 'Todo el contenido del Sitio (descripciones de Desafíos, diseños, código de muestra) es sujeto a derechos de autor. No puedes copiarlo sin permiso.' : 'All Site content (Challenge descriptions, designs, sample code) is subject to copyright. You may not copy it without permission.'}</li>
                <li>{language === 'es' ? 'Al enviar Soluciones, garantizas que no infringen derechos de autor, patentes o marcas.' : 'By submitting Solutions, you warrant that they do not infringe copyright, patents, or trademarks.'}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                7. {language === 'es' ? 'Comportamiento del Usuario' : 'User Behavior'}
              </h3>
              <p className="text-slate-300">
                <strong className="text-rose-500">{language === 'es' ? 'Prohibido:' : 'Prohibited:'}</strong>{' '}
                {language === 'es' 
                  ? 'trampas, spam, acoso, malware o cualquier conducta que interfiera con el Sitio.' 
                  : 'cheating, spam, harassment, malware, or any conduct that interferes with the Site.'}
              </p>
              <p className="text-slate-400 text-xs">
                {language === 'es' 
                  ? 'Podemos descalificar participantes y reportar actividades ilegales a autoridades.' 
                  : 'We may disqualify participants and report illegal activities to authorities.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                8. {language === 'es' ? 'Privacidad y Datos' : 'Privacy and Data'}
              </h3>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
                <li>
                  {language === 'es' ? 'Procesamos tus datos conforme a nuestra Política de Privacidad: ' : 'We process your data in accordance with our Privacy Policy: '}
                  <Link href="/privacy" className="text-amber-500 hover:text-amber-400 hover:underline">
                    www.coding-challenge-mexico.com/privacy
                  </Link>.
                </li>
                <li>{language === 'es' ? 'Usamos cookies para mejorar la experiencia; puedes gestionarlas en tu navegador.' : 'We use cookies to improve the experience; you can manage them in your browser.'}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                9. {language === 'es' ? 'Limitación de Responsabilidad y Jurisdicción' : 'Limitation of Liability & Jurisdiction'}
              </h3>
              <p className="text-slate-300">
                {language === 'es' 
                  ? 'El Sitio se proporciona "tal cual". No garantizamos ininterrupción, precisión o ausencia de virus. No somos responsables de daños indirectos, pérdidas de datos o ganancias perdidas, hasta el límite máximo.' 
                  : 'The Site is provided "as is". We do not guarantee uninterrupted access, accuracy, or the absence of viruses. We are not liable for indirect damages, loss of data, or lost profits, to the maximum extent permitted by law.'}
              </p>
              <p className="text-amber-500 text-xs font-mono tracking-wide pt-1">
                📍 {language === 'es' 
                  ? 'En caso de disputa, se aplicará la ley mexicana, con jurisdicción en los tribunales de Mérida, Yucatán.' 
                  : 'In case of dispute, Mexican law will apply, with jurisdiction in the courts of Mérida, Yucatán.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                10. {language === 'es' ? 'Modificaciones y Terminación' : 'Modifications and Termination'}
              </h3>
              <p className="text-slate-300">
                {language === 'es' 
                  ? 'Podemos actualizar estos Términos notificándote por email o en el Sitio. El uso continuado implica aceptación. Podemos terminar tu acceso en cualquier momento por violaciones.' 
                  : 'We may update these Terms by notifying you by email or on the Site. Continued use implies acceptance. We may terminate your access at any time for violations.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                11. {language === 'es' ? 'Contacto' : 'Contact'}
              </h3>
              <p className="text-slate-300">
                {language === 'es' 
                  ? 'Para preguntas, escribe a: info@coding-challenge-mexico.com' 
                  : 'For questions, write to: info@coding-challenge-mexico.com'}
              </p>
            </section>
          </div>

          <div className="border-t border-white/5 pt-6 text-center text-xs font-mono text-slate-500">
            {language === 'es' 
              ? 'Última actualización: 23 de marzo de 2026.' 
              : 'Last updated: March 23, 2026.'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
