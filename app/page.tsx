import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')
  return <LandingPage />
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#1B4965] rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold text-white">MP</span>
            </div>
            <span className="font-bold text-[#1B4965] text-lg">MyP&amp;L</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-[#1B4965] transition-colors">Funciones</a>
            <a href="#how" className="hover:text-[#1B4965] transition-colors">Cómo funciona</a>
            <a href="#pricing" className="hover:text-[#1B4965] transition-colors">Planes</a>
            <a href="#faq" className="hover:text-[#1B4965] transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/signin" className="text-sm font-medium text-gray-600 hover:text-[#1B4965] transition-colors">
              Iniciar sesión
            </Link>
            <Link href="/signup" className="text-sm font-semibold bg-[#1B4965] hover:bg-[#143A52] text-white px-4 py-2 rounded-lg transition-colors">
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1B4965] via-[#1B4965] to-[#0d3349] text-white">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 30% 50%, #2EC4B6 0%, transparent 60%), radial-gradient(circle at 80% 20%, #60a5fa 0%, transparent 50%)'}} />
        <div className="relative max-w-6xl mx-auto px-5 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-[#2EC4B6]/20 border border-[#2EC4B6]/30 text-[#2EC4B6] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Clasificación de gastos con IA
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight max-w-4xl mx-auto">
            Tu contabilidad fiscal,<br />
            <span className="text-[#2EC4B6]">automatizada con IA</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
            Importa tu estado de cuenta bancario, deja que la IA clasifique tus gastos según el IRS Schedule C y genera reportes fiscales en segundos.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#2EC4B6] hover:bg-[#26a89b] text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-[#2EC4B6]/30">
              Empezar gratis
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
            <Link href="/signin" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors">
              Inicia sesión
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/40">Sin tarjeta de crédito · Configura en 5 minutos</p>
        </div>

        {/* Dashboard mock */}
        <div className="relative max-w-5xl mx-auto px-5 pb-0">
          <div className="bg-white/10 backdrop-blur rounded-t-2xl border border-white/20 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-red-400/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <div className="w-3 h-3 rounded-full bg-green-400/70" />
              <span className="ml-3 text-xs text-white/40">ismcategorizacion.railway.app</span>
            </div>
            <div className="p-4 grid grid-cols-4 gap-3">
              {[
                { label: 'Ingresos', value: '$48,200', color: 'text-emerald-400' },
                { label: 'Gastos', value: '$31,540', color: 'text-red-400' },
                { label: 'Ganancia Neta', value: '$16,660', color: 'text-emerald-400' },
                { label: 'Total Deducible', value: '$22,180', color: 'text-[#2EC4B6]' },
              ].map(c => (
                <div key={c.label} className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs text-white/50 mb-1">{c.label}</p>
                  <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 px-4 pb-4">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-xs text-white/50 mb-2">Gastos por Mes</p>
                <div className="flex items-end gap-1.5 h-16">
                  {[35, 55, 40, 70, 60, 90].map((h, i) => (
                    <div key={i} className="flex-1 bg-[#2EC4B6]/60 rounded-sm" style={{height:`${h}%`}} />
                  ))}
                </div>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-xs text-white/50 mb-2">Transacciones recientes</p>
                <div className="space-y-2">
                  {[
                    { desc: 'Office Supplies — Staples', amt: '-$142' },
                    { desc: "Client Dinner", amt: '-$380' },
                    { desc: 'AWS Services', amt: '-$89' },
                  ].map((tx, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-white/60 truncate">{tx.desc}</span>
                      <span className="text-red-400 ml-2 flex-shrink-0">{tx.amt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="border-b border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-5 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '< 5 min', label: 'para clasificar 500 transacciones' },
            { value: '95%', label: 'precisión de clasificación IA' },
            { value: '40+', label: 'categorías IRS Schedule C' },
            { value: '0 setup', label: 'sin configuración técnica' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold text-[#1B4965]">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 max-w-6xl mx-auto px-5">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">Todo lo que necesitas para tus impuestos</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">Desde la importación del banco hasta el reporte final para tu contador, todo en un solo lugar.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: '⚡', title: 'Clasificación con IA', desc: 'Sube tu CSV o Excel del banco y nuestra IA clasifica automáticamente cada transacción con categorías IRS Schedule C.', color: 'bg-[#2EC4B6]/10 text-[#2EC4B6]' },
            { icon: '📊', title: 'Reportes fiscales', desc: 'Genera reportes en PDF y Excel con desglose por categoría, deducibles y ganancia neta. Listos para tu contador.', color: 'bg-blue-50 text-blue-600' },
            { icon: '🏦', title: 'Cualquier banco', desc: 'Compatible con Chase, Bank of America, Wells Fargo y cualquier banco que exporte en CSV o Excel.', color: 'bg-purple-50 text-purple-600' },
            { icon: '👥', title: 'Trabajo en equipo', desc: 'Crea usuarios para tu personal o contador. Cada uno tiene su propio acceso con la misma información.', color: 'bg-amber-50 text-amber-600' },
            { icon: '📷', title: 'Escaneo de recibos', desc: 'Adjunta fotos de tus recibos desde tu celular. Todo queda organizado y vinculado a cada gasto.', color: 'bg-rose-50 text-rose-600' },
            { icon: '🤖', title: 'Reglas automáticas', desc: 'Crea reglas para que "Uber" siempre se clasifique como Transporte. La IA aprende de tus correcciones.', color: 'bg-emerald-50 text-emerald-600' },
          ].map(f => (
            <div key={f.title} className="group p-6 rounded-2xl border border-gray-100 hover:border-[#1B4965]/20 hover:shadow-md transition-all">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-2xl ${f.color}`}>
                {f.icon}
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">De banco a reporte en 3 pasos</h2>
            <p className="mt-4 text-lg text-gray-500">Sin complicaciones. Sin horas de trabajo manual.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Importa tu estado de cuenta', desc: 'Descarga el CSV o Excel de tu banco y arrástralo a la plataforma. Mapeamos las columnas automáticamente.' },
              { step: '02', title: 'La IA clasifica todo', desc: 'Nuestra IA revisa cada transacción y la asigna a la categoría IRS correcta con nivel de confianza. Tú solo revisas las dudosas.' },
              { step: '03', title: 'Descarga tu reporte', desc: 'Genera un PDF o Excel con el desglose fiscal completo. Listo para compartir con tu contador.' },
            ].map(s => (
              <div key={s.step} className="relative bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-[#1B4965] text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {s.step}
                </div>
                <div className="w-14 h-14 bg-[#1B4965]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#1B4965] text-2xl font-bold">
                  {s.step}
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-3">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 max-w-6xl mx-auto px-5">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">Planes simples y transparentes</h2>
          <p className="mt-4 text-lg text-gray-500">Empieza gratis. Escala cuando lo necesites.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {[
            {
              name: 'Básico', price: 'Gratis', sub: 'Para siempre',
              features: ['1 negocio', 'Hasta 200 transacciones/mes', 'Clasificación IA básica', 'Exportar PDF', 'Soporte por email'],
              cta: 'Empezar gratis', href: '/signup', highlight: false,
            },
            {
              name: 'Plus', price: '$29', sub: '/mes',
              features: ['5 negocios', 'Transacciones ilimitadas', 'Clasificación IA avanzada', 'Exportar PDF + Excel', '3 usuarios de equipo', 'Reglas automáticas', 'Soporte prioritario'],
              cta: 'Empezar con Plus', href: '/signup', highlight: true,
            },
            {
              name: 'Enterprise', price: '$79', sub: '/mes',
              features: ['Negocios ilimitados', 'Transacciones ilimitadas', 'Clasificación IA máxima', 'Reportes personalizados', 'Usuarios ilimitados', 'API access', 'Soporte dedicado 24/7'],
              cta: 'Contactar ventas', href: '/signup', highlight: false,
            },
          ].map(p => (
            <div key={p.name} className={`rounded-2xl border p-8 ${p.highlight ? 'bg-[#1B4965] border-[#1B4965] text-white shadow-xl scale-105' : 'bg-white border-gray-200'}`}>
              {p.highlight && <div className="inline-block bg-[#2EC4B6] text-white text-xs font-bold px-3 py-1 rounded-full mb-4">MÁS POPULAR</div>}
              <h3 className={`text-xl font-bold mb-1 ${p.highlight ? 'text-white' : 'text-gray-900'}`}>{p.name}</h3>
              <div className="flex items-end gap-1 mb-6">
                <span className={`text-4xl font-extrabold ${p.highlight ? 'text-white' : 'text-gray-900'}`}>{p.price}</span>
                <span className={`text-sm mb-1 ${p.highlight ? 'text-white/60' : 'text-gray-400'}`}>{p.sub}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <span className={p.highlight ? 'text-[#2EC4B6]' : 'text-emerald-500'}>✓</span>
                    <span className={p.highlight ? 'text-white/80' : 'text-gray-600'}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href={p.href} className={`block w-full text-center font-bold py-3 rounded-xl transition-colors ${p.highlight ? 'bg-[#2EC4B6] hover:bg-[#26a89b] text-white' : 'bg-[#1B4965] hover:bg-[#143A52] text-white'}`}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 bg-gray-50">
        <div className="max-w-3xl mx-auto px-5">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">Preguntas frecuentes</h2>
          </div>
          <div className="space-y-4">
            {[
              { q: '¿Funciona con mi banco?', a: 'Sí. Funciona con cualquier banco que permita exportar transacciones en CSV o Excel: Chase, Bank of America, Wells Fargo, Citi, TD Bank, y más.' },
              { q: '¿Qué tan precisa es la clasificación IA?', a: 'Nuestra IA tiene una precisión del ~95% en gastos de negocios comunes. Para los casos dudosos, te mostramos el nivel de confianza (alta, media, baja) y puedes corregirlos fácilmente.' },
              { q: '¿Mis datos financieros están seguros?', a: 'Absolutamente. Usamos encriptación TLS en tránsito, contraseñas hasheadas con bcrypt, y cada usuario solo puede ver sus propios datos. No vendemos ni compartimos tu información.' },
              { q: '¿Necesito conocimiento contable para usarlo?', a: 'No. La plataforma está diseñada para dueños de negocios que no son contadores. La IA hace el trabajo pesado; tú solo revisas y apruebas.' },
              { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí, sin penalidades. Si cancelas, tu cuenta queda en plan Básico (gratuito) y conservas acceso a tus datos históricos.' },
            ].map((item, i) => (
              <details key={i} className="group bg-white rounded-xl border border-gray-200 overflow-hidden">
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer font-semibold text-gray-800 hover:text-[#1B4965] transition-colors list-none">
                  {item.q}
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-4">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 bg-gradient-to-br from-[#1B4965] to-[#0d3349] text-white text-center">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">¿Listo para ahorrar horas en tus impuestos?</h2>
          <p className="text-lg text-white/60 mb-10">Automatiza tu contabilidad fiscal hoy mismo.</p>
          <Link href="/signup" className="inline-flex items-center gap-2 bg-[#2EC4B6] hover:bg-[#26a89b] text-white font-bold px-10 py-4 rounded-xl text-lg transition-colors shadow-lg shadow-[#2EC4B6]/30">
            Empezar gratis ahora
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
          <p className="mt-4 text-sm text-white/30">Sin tarjeta de crédito · Cancela cuando quieras</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0d2233] text-white/50 py-12">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-[#2EC4B6] rounded-lg flex items-center justify-center">
                  <span className="text-xs font-bold text-white">MP</span>
                </div>
                <span className="font-bold text-white text-sm">MyP&amp;L</span>
              </div>
              <p className="text-xs leading-relaxed">Clasificación fiscal automatizada con IA para negocios en Estados Unidos.</p>
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-3">Producto</p>
              <ul className="space-y-2 text-xs">
                <li><a href="#features" className="hover:text-white transition-colors">Funciones</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Planes</a></li>
                <li><a href="#how" className="hover:text-white transition-colors">Cómo funciona</a></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-3">Cuenta</p>
              <ul className="space-y-2 text-xs">
                <li><Link href="/signin" className="hover:text-white transition-colors">Iniciar sesión</Link></li>
                <li><Link href="/signup" className="hover:text-white transition-colors">Crear cuenta</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-3">Legal</p>
              <ul className="space-y-2 text-xs">
                <li><a href="#" className="hover:text-white transition-colors">Privacidad</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Términos de uso</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <p>© 2026 MyP&amp;L · ISM Categorización. Todos los derechos reservados.</p>
            <p>Hecho para negocios en USA 🇺🇸</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
