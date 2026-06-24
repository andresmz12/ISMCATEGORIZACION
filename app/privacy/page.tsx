import Link from 'next/link'

export const metadata = {
  title: 'Política de Privacidad — MyP&L',
  description: 'Política de privacidad de MyP&L / ISM Categorización',
}

export default function PrivacyPage() {
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
        <span className="text-gray-600 text-sm">Política de Privacidad</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-10">Última actualización: 1 de enero de 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Quiénes somos</h2>
            <p>
              MyP&L / ISM Categorización ("nosotros", "nuestro") es una plataforma SaaS de gestión financiera y
              categorización contable. Operamos el servicio disponible en este dominio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Qué información recopilamos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Información de cuenta:</strong> nombre, dirección de correo electrónico y contraseña (almacenada como hash bcrypt).</li>
              <li><strong>Datos financieros:</strong> transacciones, categorías, reglas de clasificación y recibos que tú o tu equipo suben a la plataforma.</li>
              <li><strong>Datos de uso:</strong> páginas visitadas, acciones realizadas y registros del sistema para seguridad y mejora del servicio.</li>
              <li><strong>Información técnica:</strong> dirección IP (usada para rate-limiting y seguridad), tipo de navegador y sistema operativo.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Cómo usamos tu información</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Proveer, mantener y mejorar el servicio.</li>
              <li>Autenticar tu identidad y proteger tu cuenta.</li>
              <li>Clasificar transacciones mediante IA (los datos se procesan via Anthropic Claude API; no se usan para entrenar modelos).</li>
              <li>Generar reportes financieros dentro de tu cuenta.</li>
              <li>Comunicarnos contigo sobre cambios importantes en el servicio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Compartir información con terceros</h2>
            <p className="mb-3">No vendemos tu información personal. Solo la compartimos con:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Anthropic:</strong> para el procesamiento de IA en clasificación y escaneo de recibos. Su política de privacidad aplica a ese procesamiento.</li>
              <li><strong>Railway:</strong> proveedor de infraestructura cloud donde se alojan la base de datos y la aplicación.</li>
              <li><strong>Autoridades legales:</strong> cuando sea requerido por ley o proceso legal válido.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Seguridad</h2>
            <p>
              Implementamos medidas de seguridad incluyendo: cifrado HTTPS (HSTS), contraseñas hasheadas con bcrypt,
              rate limiting en endpoints críticos, cabeceras de seguridad HTTP (CSP, X-Frame-Options, etc.) y
              sesiones con expiración de 8 horas. Sin embargo, ningún sistema es 100% seguro.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Retención de datos</h2>
            <p>
              Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, tus datos serán
              eliminados dentro de los 30 días siguientes, salvo que la ley requiera conservarlos por más tiempo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Tus derechos</h2>
            <p className="mb-3">Tienes derecho a:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Acceder a los datos personales que tenemos sobre ti.</li>
              <li>Corregir información inexacta desde la página de Configuración.</li>
              <li>Solicitar la eliminación de tu cuenta y datos.</li>
              <li>Exportar tus datos financieros en formato CSV o Excel desde la sección de Reportes.</li>
            </ul>
            <p className="mt-3">Para ejercer estos derechos, contáctanos en el correo indicado abajo.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Cookies</h2>
            <p>
              Usamos únicamente cookies de sesión necesarias para el funcionamiento del servicio (autenticación via NextAuth).
              No usamos cookies de rastreo ni publicidad.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Cambios a esta política</h2>
            <p>
              Podemos actualizar esta política ocasionalmente. Te notificaremos por correo electrónico si los cambios
              son materiales. La fecha de última actualización aparece al inicio de este documento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contacto</h2>
            <p>
              Para preguntas sobre esta política o tus datos, escríbenos a:{' '}
              <a href="mailto:privacidad@ismcategorizacion.com" className="text-[#1B4965] underline">
                privacidad@ismcategorizacion.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 flex gap-4 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700">← Inicio</Link>
          <Link href="/terms" className="hover:text-gray-700">Términos de uso</Link>
        </div>
      </main>
    </div>
  )
}
