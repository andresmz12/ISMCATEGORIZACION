import Link from 'next/link'

export const metadata = {
  title: 'Términos de Uso — MyP&L',
  description: 'Términos y condiciones de uso de MyP&L / ISM Categorización',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-[#1B4965] font-bold text-sm hover:opacity-80">
          <div className="w-7 h-7 bg-[#1B4965] rounded-lg flex items-center justify-center">
            <span className="text-xs font-bold text-white">MP</span>
          </div>
          MyP&L
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600 text-sm">Términos de Uso</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Términos de Uso</h1>
        <p className="text-sm text-gray-500 mb-10">Última actualización: 1 de enero de 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Aceptación de los términos</h2>
            <p>
              Al crear una cuenta o usar MyP&L / ISM Categorización ("el Servicio"), aceptas estos Términos de Uso.
              Si no estás de acuerdo, no uses el Servicio. Estos términos constituyen un acuerdo legal entre tú y
              ISM Categorización.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Descripción del servicio</h2>
            <p>
              MyP&L es una plataforma de gestión financiera que permite importar transacciones bancarias, clasificarlas
              con inteligencia artificial, generar reportes de pérdidas y ganancias, y administrar múltiples negocios
              desde una sola cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Registro y seguridad de cuenta</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Debes proporcionar información verdadera y actualizada al registrarte.</li>
              <li>Eres responsable de mantener la confidencialidad de tu contraseña.</li>
              <li>Debes notificarnos inmediatamente de cualquier acceso no autorizado a tu cuenta.</li>
              <li>No puedes compartir tu cuenta con personas no autorizadas (usa la función de equipo para esto).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Uso aceptable</h2>
            <p className="mb-3">Al usar el Servicio, te comprometes a:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Usar el Servicio solo para fines legales y de acuerdo con estos términos.</li>
              <li>No intentar acceder a cuentas, datos o sistemas de otros usuarios.</li>
              <li>No realizar ingeniería inversa, descompilar o intentar obtener el código fuente del Servicio.</li>
              <li>No usar el Servicio para procesar información financiera de terceros sin su consentimiento.</li>
              <li>No sobrecargar los sistemas (scraping, bots, solicitudes masivas automatizadas).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Planes y pagos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>El Servicio ofrece planes gratuitos y de pago. Las funciones disponibles dependen del plan contratado.</li>
              <li>Los precios están sujetos a cambios con previo aviso de 30 días.</li>
              <li>Los pagos no son reembolsables salvo que la ley aplicable lo requiera.</li>
              <li>El incumplimiento de pago puede resultar en la suspensión del acceso.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Propiedad intelectual</h2>
            <p>
              El Servicio, incluyendo su código, diseño, logos y contenido, es propiedad de ISM Categorización y está
              protegido por leyes de propiedad intelectual. Se te otorga una licencia limitada, no exclusiva y
              revocable para usar el Servicio según estos términos.
            </p>
            <p className="mt-3">
              Tus datos financieros (transacciones, categorías, reportes) son de tu propiedad. No reclamamos
              derechos sobre ellos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Clasificación por IA — limitaciones</h2>
            <p>
              El Servicio usa inteligencia artificial para clasificar transacciones y extraer datos de recibos.
              <strong> Las clasificaciones de IA son sugerencias y pueden contener errores.</strong> Eres responsable
              de revisar y validar los resultados antes de usarlos para declaraciones fiscales u otros fines legales.
              No nos hacemos responsables por errores en clasificaciones automatizadas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limitación de responsabilidad</h2>
            <p>
              En la máxima medida permitida por la ley aplicable, ISM Categorización no será responsable por daños
              indirectos, incidentales, especiales o consecuentes, incluyendo pérdidas de ingresos, datos o
              ganancias esperadas, derivados del uso o la incapacidad de usar el Servicio.
            </p>
            <p className="mt-3">
              Nuestra responsabilidad total ante ti no excederá el monto pagado por el Servicio en los últimos
              12 meses.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Terminación</h2>
            <p>
              Puedes cancelar tu cuenta en cualquier momento desde Configuración. Podemos suspender o terminar
              tu acceso si violas estos términos, con o sin previo aviso según la gravedad de la infracción.
              Al terminar, tus datos serán eliminados en un plazo de 30 días.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Cambios a los términos</h2>
            <p>
              Podemos modificar estos términos en cualquier momento. Te notificaremos por correo con al menos
              15 días de anticipación para cambios materiales. El uso continuado del Servicio después de esa fecha
              implica la aceptación de los nuevos términos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contacto</h2>
            <p>
              Para consultas sobre estos términos, contáctanos en:{' '}
              <a href="mailto:legal@ismcategorizacion.com" className="text-[#1B4965] underline">
                legal@ismcategorizacion.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 flex gap-4 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700">← Inicio</Link>
          <Link href="/privacy" className="hover:text-gray-700">Política de Privacidad</Link>
        </div>
      </main>
    </div>
  )
}
