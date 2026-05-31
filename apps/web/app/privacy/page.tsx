'use client';

import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

import { useLanguage } from '../LanguageContext';

export default function PrivacyPage() {
  const { language, t } = useLanguage();

  return (
    <div className="space-y-8 animate-fadeIn max-w-[1000px] mx-auto pb-10">
      {/* HEADER */}
      <div className="pb-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl font-mono uppercase">
            {language === 'es' ? 'POLÍTICA DE PRIVACIDAD' : 'PRIVACY POLICY'}
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
            {language === 'es' ? 'CODING CHALLENGE MEXICO' : 'CODING CHALLENGE MEXICO'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 text-sm text-slate-300 leading-relaxed font-sans p-6 md:p-8">
          <p className="font-semibold text-slate-200">
            {language === 'es' 
              ? 'En CODING CHALLENGE MEXICO, nos comprometemos a proteger tu privacidad. Esta Política de Privacidad explica cómo recopilamos, usamos, compartimos y protegemos tu información personal cuando interactúas con nuestro sitio web (el "Sitio") y participas en nuestro desafío de desarrollo de software (el "Desafío").' 
              : 'At CODING CHALLENGE MEXICO, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, share, and protect your personal information when you interact with our website (the "Site") and participate in our software development challenge (the "Challenge").'}
          </p>
          
          <p className="text-xs text-amber-500/80 bg-amber-500/5 px-3 py-2 rounded border border-amber-500/10 font-mono tracking-wide uppercase inline-block">
            {language === 'es' ? 'Al usar el Sitio o registrarte en el Desafío, aceptas estos términos.' : 'By using the Site or registering for the Challenge, you agree to these terms.'}
          </p>

          <div className="space-y-6 mt-8">
            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                1. {language === 'es' ? 'Información que recopilamos' : 'Information We Collect'}
              </h3>
              <p className="text-slate-400">
                {language === 'es' ? 'Recopilamos los siguientes tipos de datos:' : 'We collect the following types of data:'}
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
                <li><strong className="text-white">{language === 'es' ? 'Datos de identificación:' : 'Identification Data:'}</strong> {language === 'es' ? 'Nombre y dirección de correo electrónico, proporcionados durante el registro para el Desafío.' : 'Name and email address, provided during registration for the Challenge.'}</li>
                <li><strong className="text-white">{language === 'es' ? 'Datos técnicos:' : 'Technical Data:'}</strong> {language === 'es' ? 'Dirección IP, tipo de navegador, sistema operativo, páginas visitadas y datos de cookies para mejorar la experiencia del usuario.' : 'IP address, browser type, operating system, pages visited, and cookies to improve the user experience.'}</li>
                <li><strong className="text-white">{language === 'es' ? 'Datos de participación:' : 'Participation Data:'}</strong> {language === 'es' ? 'Código fuente enviado, puntuaciones, comentarios y progreso en el Desafío.' : 'Source code submitted, scores, feedback, and progress in the Challenge.'}</li>
                <li><strong className="text-white">{language === 'es' ? 'Datos de comunicación:' : 'Communication Data:'}</strong> {language === 'es' ? 'Mensajes enviados a través de formularios de contacto o soporte.' : 'Messages sent through contact or support forms.'}</li>
              </ul>
              <p className="text-xs font-mono text-slate-500 mt-2">
                ⚠️ {language === 'es' ? 'No recopilamos datos sensibles como información racial, religiosa o de salud.' : 'We do not collect sensitive data such as racial, religious, or health information.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                2. {language === 'es' ? 'Cómo usamos tu información' : 'How We Use Your Information'}
              </h3>
              <p className="text-slate-400">
                {language === 'es' ? 'Utilizamos tus datos para:' : 'We use your data to:'}
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
                <li>{language === 'es' ? 'Gestionar tu registro y participación en el Desafío.' : 'Manage your registration and participation in the Challenge.'}</li>
                <li>{language === 'es' ? 'Enviarte actualizaciones, resultados y comunicaciones relacionadas con el evento.' : 'Send you updates, results, and communications related to the event.'}</li>
                <li>{language === 'es' ? 'Analizar el uso del Sitio para mejorar funcionalidades y seguridad.' : 'Analyze Site usage to improve functionality and security.'}</li>
                <li>{language === 'es' ? 'Prevenir fraudes y cumplir con obligaciones legales.' : 'Prevent fraud and comply with legal obligations.'}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                3. {language === 'es' ? 'Cookies y tecnologías similares' : 'Cookies and Similar Technologies'}
              </h3>
              <p className="text-slate-300">
                {language === 'es' 
                  ? 'El Sitio usa cookies para mantener tu sesión activa, analizar tráfico y personalizar contenido.' 
                  : 'The Site uses cookies to keep your session active, analyze traffic, and personalize content.'}
              </p>
              <p className="text-slate-400 text-xs">
                {language === 'es' 
                  ? 'Puedes gestionar cookies en tu navegador. Para rechazarlas, visita la configuración de tu dispositivo. Nuestro aviso de cookies detalla más opciones.' 
                  : 'You can manage cookies in your browser. To reject them, visit your device settings. Our cookie notice details more options.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                4. {language === 'es' ? 'Compartir tu información' : 'Sharing Your Information'}
              </h3>
              <p className="text-slate-300">
                {language === 'es' 
                  ? 'No vendemos tus datos. Los compartimos solo con:' 
                  : 'We do not sell your data. We share it only with:'}
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
                <li>{language === 'es' ? 'Proveedores de servicios (ej. plataformas de hosting como AWS o GitHub para códigos).' : 'Service providers (e.g. hosting platforms like AWS or GitHub for code).'}</li>
                <li>{language === 'es' ? 'Patrocinadores del Desafío, solo con tu consentimiento explícito y datos anonimizados.' : 'Challenge sponsors, only with your explicit consent and anonymized data.'}</li>
                <li>{language === 'es' ? 'Autoridades legales si es requerido por ley.' : 'Legal authorities if required by law.'}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                5. {language === 'es' ? 'Almacenamiento y seguridad' : 'Storage and Security'}
              </h3>
              <p className="text-slate-300">
                {language === 'es' 
                  ? 'Tus datos se almacenan en servidores seguros. Usamos encriptación (SSL/TLS) y medidas como firewalls para protegerlos.' 
                  : 'Your data is stored on secure servers. We use encryption (SSL/TLS) and measures such as firewalls to protect it.'}
              </p>
              <p className="text-slate-400 text-xs">
                {language === 'es' 
                  ? 'Retenemos datos solo mientras sea necesario para el Desafío o según requisitos legales, salvo que solicites su eliminación.' 
                  : 'We retain data only as long as necessary for the Challenge or as required by law, unless you request its deletion.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                6. {language === 'es' ? 'Tus derechos' : 'Your Rights'}
              </h3>
              <p className="text-slate-300">
                {language === 'es' 
                  ? 'De acuerdo con las leyes aplicables, puedes:' 
                  : 'In accordance with applicable laws, you may:'}
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
                <li>{language === 'es' ? 'Acceder, rectificar o eliminar tus datos.' : 'Access, rectify, or delete your data.'}</li>
                <li>{language === 'es' ? 'Oponerte al procesamiento o retirar consentimiento.' : 'Object to processing or withdraw consent.'}</li>
                <li>{language === 'es' ? 'Solicitar portabilidad de datos.' : 'Request data portability.'}</li>
              </ul>
              <p className="text-slate-400 text-xs pt-1">
                {language === 'es' 
                  ? 'Envía tu solicitud a info@coding-challenge-mexico.com. Responderemos en 30 días.' 
                  : 'Send your request to info@coding-challenge-mexico.com. We will respond within 30 days.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                7. {language === 'es' ? 'Enlaces a terceros' : 'Third-Party Links'}
              </h3>
              <p className="text-slate-300">
                {language === 'es' 
                  ? 'El Sitio puede incluir enlaces a sitios externos (ej. redes sociales). No somos responsables de sus políticas de privacidad.' 
                  : 'The Site may include links to external sites (e.g. social networks). We are not responsible for their privacy policies.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                8. {language === 'es' ? 'Cambios a esta política' : 'Changes to This Policy'}
              </h3>
              <p className="text-slate-300">
                {language === 'es' 
                  ? 'Podemos actualizar esta política. Te notificaremos cambios significativos por email o en el Sitio. Revisa periódicamente.' 
                  : 'We may update this policy. We will notify you of significant changes by email or on the Site. Please check periodically.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-1.5">
                9. {language === 'es' ? 'Contacto' : 'Contact'}
              </h3>
              <p className="text-slate-300">
                {language === 'es' 
                  ? 'Para preguntas, contacta a: info@coding-challenge-mexico.com' 
                  : 'For questions, contact: info@coding-challenge-mexico.com'}
              </p>
            </section>
          </div>

          <div className="border-t border-white/5 pt-6 text-center text-xs font-mono text-slate-500">
            {language === 'es' 
              ? '¡Gracias por participar en CODING CHALLENGE MEXICO!' 
              : 'Thank you for participating in CODING CHALLENGE MEXICO!'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
