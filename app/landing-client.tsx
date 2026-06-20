'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
  useScroll,
} from 'framer-motion'

// ── Animation helpers ──────────────────────────────────────────────────────────

const ease = [0.25, 0.4, 0.25, 1] as [number, number, number, number]

function Reveal({
  children,
  delay = 0,
  className = '',
  y = 40,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  y?: number
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.15 })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function Counter({ to, prefix = '', suffix = '', className = '' }: { to: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const count = useMotionValue(0)
  const rounded = useTransform(count, v => Math.round(v))
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const unsub = rounded.on('change', v => setDisplay(v))
    return unsub
  }, [rounded])

  useEffect(() => {
    if (inView) {
      const ctrl = animate(count, to, { duration: 1.6, ease: 'easeOut' })
      return ctrl.stop
    }
  }, [inView, count, to])

  return (
    <span ref={ref} className={className}>
      {prefix}{display}{suffix}
    </span>
  )
}

function AnimatedBars({ data, inView }: { data: { h: number; m: string }[]; inView: boolean }) {
  return (
    <div className="flex items-end gap-2 h-20">
      {data.map(({ h, m }, i) => (
        <div key={m} className="flex-1 flex flex-col items-center gap-1">
          <motion.div
            className="w-full bg-[#2EC4B6]/70 rounded-t-sm"
            initial={{ height: 0 }}
            animate={inView ? { height: `${h}%` } : { height: 0 }}
            transition={{ duration: 0.6, delay: 0.1 + i * 0.07, ease }}
          />
          <span className="text-xs text-white/25">{m}</span>
        </div>
      ))}
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-5 font-bold text-gray-800 hover:text-[#1B4965] transition-colors text-sm text-left"
      >
        {q}
        <motion.svg
          className="w-5 h-5 text-gray-300 flex-shrink-0 ml-4"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-50 pt-4">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Copy ──────────────────────────────────────────────────────────────────────

const copy = {
  en: {
    nav: { features: 'Features', how: 'How it works', pricing: 'Pricing', faq: 'FAQ', login: 'Log in', cta: 'Get started' },
    hero: {
      badge: 'P&L Software for US Businesses',
      h1a: 'Your finances,',
      h1b: 'always under control.',
      sub: 'Track income and expenses, categorize by IRS Schedule C, and generate your P&L report in seconds. Built for small business owners and accountants.',
      cta1: 'Get started',
      cta2: 'Log in',
      sub2: 'From $9/mo · Cancel anytime',
    },
    banks: 'Works with exports from any bank',
    pain: {
      title: 'Stop doing your finances in spreadsheets',
      sub: 'Most small business owners spend 10+ hours a month on bookkeeping. MyP&L cuts that down to minutes.',
      items: [
        { icon: '😓', problem: 'Hours organizing bank statements manually', solution: 'Import any CSV or Excel in one click' },
        { icon: '😰', problem: 'Tax season chaos with receipts everywhere', solution: 'Everything categorized, organized, and ready' },
        { icon: '😤', problem: 'Paying your accountant to do basic sorting', solution: 'Deliver a clean P&L — they just review' },
      ],
    },
    features: {
      title: 'Everything you need to stay on top of your books',
      sub: 'From bank import to tax-ready report — all in one place.',
      items: [
        {
          tag: 'Dashboard',
          title: 'Your P&L at a glance',
          desc: 'See your total income, expenses, net profit and deductible total for the year — updated in real time as you categorize.',
          bullets: ['YTD income vs expenses', 'Monthly expense chart', 'Category breakdown donut chart', 'Recent transactions feed'],
        },
        {
          tag: 'Import',
          title: 'Any bank. Any format.',
          desc: 'Download the CSV or Excel from your bank and drag it in. We auto-detect columns for date, description, and amount — no manual setup.',
          bullets: ['Chase, BofA, Wells Fargo, Citi & more', 'CSV and Excel (.xlsx, .xls)', 'Auto column mapping', 'Duplicate detection'],
        },
        {
          tag: 'Reports',
          title: 'Tax-ready reports in one click',
          desc: 'Generate a detailed PDF or Excel report with your full P&L, expense breakdown by IRS category, and deductible totals. Hand it straight to your accountant.',
          bullets: ['PDF and Excel export', 'IRS Schedule C categories', 'Deductibility breakdown', 'Multi-year comparison'],
        },
      ],
    },
    aiFeature: {
      tag: 'Plus feature',
      title: 'AI classification — a powerful extra',
      desc: 'Upload your bank statement and our AI automatically assigns each transaction to the correct IRS category. Review, adjust, and confirm in minutes instead of hours.',
      bullets: ['~95% classification accuracy', 'HIGH / MEDIUM / LOW confidence badges', 'One-click bulk confirm', 'Learns from your corrections via rules'],
      note: 'AI classification is available on the Plus and Enterprise plans.',
    },
    testimonials: {
      title: 'Trusted by business owners and accountants',
      items: [
        { name: 'Carlos M.', role: 'LLC Owner · Miami, FL', text: 'Before MyP&L I was spending entire weekends sorting receipts before tax season. Now it takes me 20 minutes a month.', stars: 5 },
        { name: 'Sandra R.', role: 'CPA · Dallas, TX', text: 'I manage 12 clients on the platform. The P&L reports come out clean and my clients understand their finances better than ever.', stars: 5 },
        { name: 'James T.', role: 'Freelance Contractor · New York', text: "The IRS Schedule C categories are exactly what I needed. My accountant was impressed — said it was the cleanest file she'd seen.", stars: 5 },
      ],
    },
    pricing: {
      title: 'Simple, transparent pricing',
      sub: 'No hidden fees. Cancel anytime.',
      plans: [
        { name: 'Basic', price: '$9', per: '/mo', desc: 'For solo owners with one business', features: ['1 business', 'Up to 200 transactions/mo', 'IRS Schedule C categories', 'PDF export', 'Email support'], cta: 'Get started', highlight: false },
        { name: 'Plus', price: '$29', per: '/mo', desc: 'For growing businesses', features: ['Up to 5 businesses', 'Unlimited transactions', 'AI auto-classification', 'PDF + Excel export', '3 team members', 'Automatic rules', 'Priority support'], cta: 'Get Plus', highlight: true },
        { name: 'Enterprise', price: '$79', per: '/mo', desc: 'For accountants and firms', features: ['Unlimited businesses', 'Unlimited transactions', 'Advanced AI classification', 'Custom reports', 'Unlimited team members', 'Dedicated support 24/7'], cta: 'Contact sales', highlight: false },
      ],
    },
    faq: {
      title: 'Frequently asked questions',
      items: [
        { q: 'Does it work with my bank?', a: 'Yes. It works with any bank that lets you export transactions as CSV or Excel — Chase, Bank of America, Wells Fargo, Citi, TD Bank, and more.' },
        { q: 'Do I need accounting knowledge to use it?', a: 'No. MyP&L is built for business owners, not accountants. The platform guides you step by step and the AI handles the heavy lifting.' },
        { q: 'Is my financial data secure?', a: 'Absolutely. We use TLS encryption in transit, bcrypt-hashed passwords, and strict per-user data isolation. We never sell or share your information.' },
        { q: 'What is AI classification and which plan includes it?', a: "AI classification automatically assigns each imported transaction to the correct IRS category. It's available on Plus and Enterprise plans." },
        { q: 'Can I cancel anytime?', a: 'Yes, with no penalties. If you cancel, your account downgrades to Basic and you keep access to all your historical data.' },
      ],
    },
    finalCta: { title: 'Take control of your business finances today', sub: 'Join hundreds of business owners who know exactly where their money goes — every month.', btn: 'Get started now' },
    footer: { product: 'Product', account: 'Account', legal: 'Legal', features: 'Features', pricing: 'Pricing', how: 'How it works', login: 'Log in', signup: 'Create account', privacy: 'Privacy policy', terms: 'Terms of use', copy: '© 2026 MyP&L · ISM Categorización. All rights reserved.' },
  },
  es: {
    nav: { features: 'Funciones', how: 'Cómo funciona', pricing: 'Planes', faq: 'FAQ', login: 'Iniciar sesión', cta: 'Comenzar' },
    hero: {
      badge: 'Software de P&L para negocios en USA',
      h1a: 'Tus finanzas,',
      h1b: 'siempre bajo control.',
      sub: 'Registra ingresos y gastos, categoriza según el IRS Schedule C y genera tu reporte P&L en segundos. Diseñado para dueños de negocios y contadores.',
      cta1: 'Comenzar ahora',
      cta2: 'Iniciar sesión',
      sub2: 'Desde $9/mes · Cancela cuando quieras',
    },
    banks: 'Compatible con exportaciones de cualquier banco',
    pain: {
      title: 'Deja de llevar tus finanzas en hojas de cálculo',
      sub: 'La mayoría de los dueños de negocios gastan más de 10 horas al mes en contabilidad. MyP&L lo reduce a minutos.',
      items: [
        { icon: '😓', problem: 'Horas organizando estados de cuenta manualmente', solution: 'Importa cualquier CSV o Excel con un clic' },
        { icon: '😰', problem: 'Caos en temporada de impuestos con recibos por todos lados', solution: 'Todo categorizado, organizado y listo' },
        { icon: '😤', problem: 'Pagarle al contador por clasificar lo que tú podías hacer', solution: 'Entrégale un P&L limpio — él solo revisa' },
      ],
    },
    features: {
      title: 'Todo lo que necesitas para mantener tus libros al día',
      sub: 'Desde importar tu banco hasta el reporte listo para impuestos — todo en un solo lugar.',
      items: [
        {
          tag: 'Panel',
          title: 'Tu P&L de un vistazo',
          desc: 'Ve tus ingresos, gastos, ganancia neta y total deducible del año en curso — actualizado en tiempo real mientras categorizas.',
          bullets: ['Ingresos vs gastos anuales', 'Gráfica de gastos por mes', 'Donut de gastos por categoría', 'Transacciones recientes'],
        },
        {
          tag: 'Importar',
          title: 'Cualquier banco. Cualquier formato.',
          desc: 'Descarga el CSV o Excel de tu banco y arrástralo. Detectamos automáticamente las columnas de fecha, descripción y monto.',
          bullets: ['Chase, BofA, Wells Fargo, Citi y más', 'CSV y Excel (.xlsx, .xls)', 'Mapeo automático de columnas', 'Detección de duplicados'],
        },
        {
          tag: 'Reportes',
          title: 'Reportes listos para impuestos con un clic',
          desc: 'Genera un PDF o Excel con tu P&L completo, desglose por categoría IRS y totales deducibles. Entrégaselo directo a tu contador.',
          bullets: ['Exportar en PDF y Excel', 'Categorías IRS Schedule C', 'Desglose de deducibles', 'Comparación multi-año'],
        },
      ],
    },
    aiFeature: {
      tag: 'Función Plus',
      title: 'Clasificación con IA — un extra poderoso',
      desc: 'Sube tu estado de cuenta y nuestra IA asigna automáticamente cada transacción a la categoría IRS correcta. Revisa, ajusta y confirma en minutos.',
      bullets: ['~95% de precisión en la clasificación', 'Badges de confianza ALTA / MEDIA / BAJA', 'Confirmar todo con un clic', 'Aprende de tus correcciones mediante reglas'],
      note: 'La clasificación con IA está disponible en los planes Plus y Enterprise.',
    },
    testimonials: {
      title: 'Cientos de negocios y contadores confían en MyP&L',
      items: [
        { name: 'Carlos M.', role: 'Dueño de LLC · Miami, FL', text: 'Antes de MyP&L pasaba fines de semana enteros ordenando recibos antes de los impuestos. Ahora me toma 20 minutos al mes.', stars: 5 },
        { name: 'Sandra R.', role: 'Contadora CPA · Dallas, TX', text: 'Manejo 12 clientes en la plataforma. Los reportes P&L salen limpios y mis clientes entienden sus finanzas mejor que nunca.', stars: 5 },
        { name: 'James T.', role: 'Contratista Freelance · New York', text: 'Las categorías IRS Schedule C son exactamente lo que necesitaba. Mi contadora dijo que era el archivo más ordenado que había visto.', stars: 5 },
      ],
    },
    pricing: {
      title: 'Precios simples y transparentes',
      sub: 'Sin costos ocultos. Cancela cuando quieras.',
      plans: [
        { name: 'Básico', price: '$9', per: '/mes', desc: 'Para dueños independientes', features: ['1 negocio', 'Hasta 200 transacciones/mes', 'Categorías IRS Schedule C', 'Exportar PDF', 'Soporte por email'], cta: 'Comenzar', highlight: false },
        { name: 'Plus', price: '$29', per: '/mes', desc: 'Para negocios en crecimiento', features: ['Hasta 5 negocios', 'Transacciones ilimitadas', 'Clasificación automática con IA', 'Exportar PDF + Excel', '3 usuarios de equipo', 'Reglas automáticas', 'Soporte prioritario'], cta: 'Obtener Plus', highlight: true },
        { name: 'Enterprise', price: '$79', per: '/mes', desc: 'Para contadores y firmas', features: ['Negocios ilimitados', 'Transacciones ilimitadas', 'Clasificación IA avanzada', 'Reportes personalizados', 'Usuarios ilimitados', 'Soporte dedicado 24/7'], cta: 'Contactar ventas', highlight: false },
      ],
    },
    faq: {
      title: 'Preguntas frecuentes',
      items: [
        { q: '¿Funciona con mi banco?', a: 'Sí. Funciona con cualquier banco que permita exportar transacciones en CSV o Excel: Chase, Bank of America, Wells Fargo, Citi, TD Bank, y más.' },
        { q: '¿Necesito conocimiento contable para usarlo?', a: 'No. MyP&L está diseñado para dueños de negocios, no contadores. La plataforma te guía paso a paso y la IA hace el trabajo pesado.' },
        { q: '¿Mis datos financieros están seguros?', a: 'Absolutamente. Usamos encriptación TLS en tránsito, contraseñas hasheadas con bcrypt y aislamiento estricto de datos por usuario. No vendemos ni compartimos tu información.' },
        { q: '¿Qué es la clasificación con IA y qué plan la incluye?', a: 'La clasificación con IA asigna automáticamente cada transacción importada a la categoría IRS correcta. Está disponible en los planes Plus y Enterprise.' },
        { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí, sin penalidades. Si cancelas, tu cuenta baja a Básico y conservas acceso a todos tus datos históricos.' },
      ],
    },
    finalCta: { title: 'Toma el control de tus finanzas hoy', sub: 'Únete a cientos de dueños de negocios que saben exactamente a dónde va su dinero — cada mes.', btn: 'Comenzar ahora' },
    footer: { product: 'Producto', account: 'Cuenta', legal: 'Legal', features: 'Funciones', pricing: 'Planes', how: 'Cómo funciona', login: 'Iniciar sesión', signup: 'Crear cuenta', privacy: 'Privacidad', terms: 'Términos de uso', copy: '© 2026 MyP&L · ISM Categorización. Todos los derechos reservados.' },
  },
}

const BANK_LOGOS = ['Chase', 'Bank of America', 'Wells Fargo', 'Citi', 'TD Bank', 'Capital One']

const BARS = [
  { h: 35, m: 'Jan' }, { h: 55, m: 'Feb' }, { h: 42, m: 'Mar' },
  { h: 68, m: 'Apr' }, { h: 58, m: 'May' }, { h: 90, m: 'Jun' },
]

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.1 } } },
  item: { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingClient() {
  const [lang, setLang] = useState<'en' | 'es'>('es')
  const t = copy[lang]

  // scroll-based nav shadow
  const { scrollY } = useScroll()
  const navShadow = useTransform(scrollY, [0, 60], ['0 0 0 0 transparent', '0 4px 24px rgba(0,0,0,0.08)'])

  // chart in-view ref
  const chartRef = useRef(null)
  const chartInView = useInView(chartRef, { once: true, amount: 0.5 })

  // AI rows in-view
  const aiRef = useRef(null)
  const aiInView = useInView(aiRef, { once: true, amount: 0.3 })

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* ── NAV ── */}
      <motion.nav
        className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100"
        style={{ boxShadow: navShadow }}
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#1B4965] rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-sm font-black text-white tracking-tight">MP</span>
            </div>
            <span className="font-black text-[#1B4965] text-xl tracking-tight">MyP&amp;L</span>
          </div>

          <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-500">
            {(['features', 'how', 'pricing', 'faq'] as const).map((k, i) => (
              <motion.a
                key={k}
                href={`#${k}`}
                className="hover:text-[#1B4965] transition-colors"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05, duration: 0.4, ease }}
              >
                {t.nav[k]}
              </motion.a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => setLang(l => l === 'es' ? 'en' : 'es')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <span>{lang === 'es' ? '🇺🇸' : '🇲🇽'}</span>
              <span>{lang === 'es' ? 'EN' : 'ES'}</span>
            </motion.button>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="hidden sm:block">
              <Link href="/signin" className="text-sm font-medium text-gray-600 hover:text-[#1B4965] transition-colors px-3 py-2">
                {t.nav.login}
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, ease }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link href="/signup" className="text-sm font-bold bg-[#1B4965] hover:bg-[#143A52] text-white px-5 py-2.5 rounded-xl transition-colors shadow-sm">
                {t.nav.cta} →
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="relative bg-gradient-to-br from-[#0d2233] via-[#1B4965] to-[#1a5276] overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#2EC4B6]/10 blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-1/2 -left-20 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-0 lg:pt-28">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">

            {/* Left: text */}
            <div>
              <motion.div
                className="inline-flex items-center gap-2 bg-[#2EC4B6]/15 border border-[#2EC4B6]/25 text-[#2EC4B6] text-xs font-bold px-4 py-2 rounded-full mb-6 uppercase tracking-wider"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1, ease }}
              >
                <span className="w-1.5 h-1.5 bg-[#2EC4B6] rounded-full animate-pulse" />
                {t.hero.badge}
              </motion.div>

              <div className="overflow-hidden mb-2">
                <motion.h1
                  className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[1.05] tracking-tight"
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.65, delay: 0.2, ease }}
                >
                  {t.hero.h1a}
                </motion.h1>
              </div>
              <div className="overflow-hidden mb-6">
                <motion.h1
                  className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#2EC4B6] to-[#5dddd5]"
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.65, delay: 0.32, ease }}
                >
                  {t.hero.h1b}
                </motion.h1>
              </div>

              <motion.p
                className="text-lg text-white/65 leading-relaxed mb-8 max-w-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.45, ease }}
              >
                {t.hero.sub}
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-3 mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.55, ease }}
              >
                <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link href="/signup" className="inline-flex items-center justify-center gap-2 bg-[#2EC4B6] hover:bg-[#26a89b] text-white font-bold px-7 py-4 rounded-xl text-base transition-all shadow-lg shadow-[#2EC4B6]/25">
                    {t.hero.cta1}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <Link href="/signin" className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 border border-white/15 text-white font-semibold px-7 py-4 rounded-xl text-base transition-colors">
                    {t.hero.cta2}
                  </Link>
                </motion.div>
              </motion.div>

              <motion.p
                className="text-sm text-white/35"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
              >
                {t.hero.sub2}
              </motion.p>

              {/* Mini stats */}
              <motion.div
                className="flex flex-wrap gap-x-8 gap-y-4 mt-10 pt-8 border-t border-white/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75 }}
              >
                {[
                  { val: 500, suffix: '+', label: lang === 'es' ? 'negocios activos' : 'active businesses' },
                  { val: 95, suffix: '%', label: lang === 'es' ? 'precisión IA' : 'AI accuracy' },
                  { val: 5, prefix: '<', suffix: 'min', label: lang === 'es' ? 'para 500 txns' : 'for 500 txns' },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                  >
                    <p className="text-2xl font-black text-white">
                      <Counter to={s.val} prefix={s.prefix} suffix={s.suffix} />
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Right: dashboard mockup */}
            <div className="relative lg:mt-0 mt-8 pb-0">
              {/* Floating cards — desktop only */}
              <motion.div
                className="hidden md:flex absolute -left-6 top-12 z-10 bg-white rounded-2xl shadow-xl px-4 py-3 items-center gap-3 border border-gray-100"
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.6, type: 'spring', stiffness: 120 }}
              >
                <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <span className="text-lg">📈</span>
                </div>
                <div>
                  <p className="text-xs text-gray-400">{lang === 'es' ? 'Ingresos YTD' : 'YTD Income'}</p>
                  <p className="text-base font-black text-emerald-600">+$48,200</p>
                </div>
              </motion.div>

              <motion.div
                className="hidden md:flex absolute -right-4 top-1/3 z-10 bg-white rounded-2xl shadow-xl px-4 py-3 items-center gap-3 border border-gray-100"
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 1.05, duration: 0.6, type: 'spring', stiffness: 120 }}
              >
                <div className="w-9 h-9 bg-[#2EC4B6]/10 rounded-xl flex items-center justify-center">
                  <span className="text-lg">✅</span>
                </div>
                <div>
                  <p className="text-xs text-gray-400">{lang === 'es' ? 'Clasificadas' : 'Classified'}</p>
                  <p className="text-base font-black text-[#1B4965]">347 txns</p>
                </div>
              </motion.div>

              {/* Browser mockup */}
              <motion.div
                className="bg-[#1a2f3f] rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                initial={{ opacity: 0, x: 60, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 0.35, duration: 0.7, ease }}
              >
                <div className="flex items-center gap-1.5 px-4 py-3 bg-[#152534] border-b border-white/5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                  <div className="flex-1 mx-4 bg-white/8 rounded-md px-3 py-1 text-center">
                    <span className="text-xs text-white/30">mypnl.app/dashboard</span>
                  </div>
                </div>
                <div className="p-5 space-y-4" ref={chartRef}>
                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { l: lang === 'es' ? 'Ingresos' : 'Income', v: '$48,200', c: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                      { l: lang === 'es' ? 'Gastos' : 'Expenses', v: '$31,540', c: 'text-red-400', bg: 'bg-red-500/10' },
                      { l: lang === 'es' ? 'Ganancia Neta' : 'Net Profit', v: '$16,660', c: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                      { l: lang === 'es' ? 'Deducible' : 'Deductible', v: '$22,180', c: 'text-[#2EC4B6]', bg: 'bg-[#2EC4B6]/10' },
                    ].map((s, i) => (
                      <motion.div
                        key={s.l}
                        className={`${s.bg} rounded-xl p-3`}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={chartInView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ delay: 0.5 + i * 0.08, duration: 0.4, ease }}
                      >
                        <p className="text-xs text-white/40 mb-0.5">{s.l}</p>
                        <p className={`text-lg font-black ${s.c}`}>{s.v}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Bar chart */}
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-white/40 mb-3">{lang === 'es' ? 'Gastos por Mes' : 'Monthly Expenses'}</p>
                    <AnimatedBars data={BARS} inView={chartInView} />
                  </div>

                  {/* Recent transactions */}
                  <div className="space-y-2">
                    {[
                      { d: 'Office Supplies · Staples', a: '-$142', cat: 'Office' },
                      { d: 'Google Ads', a: '-$380', cat: 'Advertising' },
                      { d: 'Client Payment', a: '+$3,500', cat: 'Income' },
                    ].map((tx, i) => (
                      <motion.div
                        key={i}
                        className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5"
                        initial={{ opacity: 0, x: -12 }}
                        animate={chartInView ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.9 + i * 0.1, duration: 0.4, ease }}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${tx.a.startsWith('+') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {tx.a.startsWith('+') ? '+' : '−'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/70 truncate">{tx.d}</p>
                          <p className="text-xs text-white/30">{tx.cat}</p>
                        </div>
                        <p className={`text-sm font-bold flex-shrink-0 ${tx.a.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>{tx.a}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BANK LOGOS ── */}
      <section className="bg-gray-50 border-y border-gray-100 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">{t.banks}</p>
          </Reveal>
          <motion.div
            className="flex flex-wrap justify-center items-center gap-x-10 gap-y-3"
            variants={stagger.container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.5 }}
          >
            {BANK_LOGOS.map(b => (
              <motion.span key={b} variants={stagger.item} className="text-sm font-bold text-gray-300 tracking-tight">
                {b}
              </motion.span>
            ))}
            <motion.span variants={stagger.item} className="text-sm text-gray-300">
              & {lang === 'es' ? 'más' : 'more'}
            </motion.span>
          </motion.div>
        </div>
      </section>

      {/* ── PAIN POINTS ── */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-4xl font-black text-gray-900 mb-4">{t.pain.title}</h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">{t.pain.sub}</p>
        </Reveal>
        <motion.div
          className="grid md:grid-cols-3 gap-6"
          variants={stagger.container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {t.pain.items.map((item, i) => (
            <motion.div
              key={i}
              variants={stagger.item}
              whileHover={{ y: -6, boxShadow: '0 12px 32px rgba(0,0,0,0.08)' }}
              className="relative bg-white rounded-2xl border border-gray-100 p-7 shadow-sm transition-shadow"
            >
              <motion.div
                className="text-4xl mb-5"
                initial={{ rotate: -10, scale: 0.8 }}
                whileInView={{ rotate: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}
              >
                {item.icon}
              </motion.div>
              <div className="mb-4 pb-4 border-b border-gray-100">
                <p className="text-sm text-gray-400 line-through">{item.problem}</p>
              </div>
              <p className="text-base font-bold text-[#1B4965] flex items-start gap-2">
                <span className="text-[#2EC4B6] mt-0.5 flex-shrink-0">✓</span>
                {item.solution}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-10 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-20">
          <Reveal className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">{t.features.title}</h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">{t.features.sub}</p>
          </Reveal>

          <div className="space-y-20">
            {t.features.items.map((f, i) => (
              <div key={i} className={`grid lg:grid-cols-2 gap-12 items-center ${i % 2 === 1 ? 'lg:grid-flow-col-dense' : ''}`}>
                {/* Text */}
                <Reveal delay={0.1} className={i % 2 === 1 ? 'lg:col-start-2' : ''}>
                  <span className="inline-block text-xs font-black uppercase tracking-widest text-[#2EC4B6] bg-[#2EC4B6]/10 px-3 py-1.5 rounded-full mb-4">{f.tag}</span>
                  <h3 className="text-3xl font-black text-gray-900 mb-4 leading-tight">{f.title}</h3>
                  <p className="text-gray-500 leading-relaxed mb-6">{f.desc}</p>
                  <motion.ul
                    className="space-y-2.5"
                    variants={stagger.container}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true }}
                  >
                    {f.bullets.map((b, j) => (
                      <motion.li key={j} variants={stagger.item} className="flex items-center gap-2.5 text-sm text-gray-600">
                        <span className="w-5 h-5 bg-[#1B4965] rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </span>
                        {b}
                      </motion.li>
                    ))}
                  </motion.ul>
                </Reveal>

                {/* Visual mockup */}
                <Reveal delay={0.2} className={i % 2 === 1 ? 'lg:col-start-1' : ''} y={i % 2 === 0 ? 30 : -30}>
                  <div className="bg-[#1B4965] rounded-2xl p-5 shadow-xl">
                    {i === 0 && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { l: lang === 'es' ? 'Ingresos' : 'Income', v: '$48,200', c: 'text-emerald-400' },
                            { l: lang === 'es' ? 'Gastos' : 'Expenses', v: '$31,540', c: 'text-red-400' },
                            { l: lang === 'es' ? 'Ganancia' : 'Net Profit', v: '$16,660', c: 'text-emerald-400' },
                            { l: lang === 'es' ? 'Deducible' : 'Deductible', v: '$22,180', c: 'text-[#2EC4B6]' },
                          ].map(s => (
                            <div key={s.l} className="bg-white/10 rounded-xl p-3">
                              <p className="text-xs text-white/40">{s.l}</p>
                              <p className={`text-xl font-black mt-0.5 ${s.c}`}>{s.v}</p>
                            </div>
                          ))}
                        </div>
                        <div className="bg-white/10 rounded-xl p-4">
                          <p className="text-xs text-white/40 mb-3">{lang === 'es' ? 'Gastos por Mes' : 'Monthly Expenses'}</p>
                          <div className="flex items-end gap-1.5 h-24">
                            {[30, 50, 38, 70, 55, 90, 65, 80, 45, 72, 60, 88].map((h, j) => (
                              <motion.div
                                key={j}
                                className="flex-1 bg-[#2EC4B6]/60 rounded-t-sm"
                                initial={{ height: 0 }}
                                whileInView={{ height: `${h}%` }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: 0.3 + j * 0.04, ease }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {i === 1 && (
                      <div className="space-y-3">
                        <div className="bg-white/10 rounded-xl p-4">
                          <p className="text-xs text-white/40 mb-3">{lang === 'es' ? 'Mapeo de columnas' : 'Column mapping'}</p>
                          <div className="space-y-2">
                            {[
                              { from: 'Transaction Date', to: lang === 'es' ? 'Fecha' : 'Date' },
                              { from: 'Merchant Name', to: lang === 'es' ? 'Descripción' : 'Description' },
                              { from: 'Debit Amount', to: lang === 'es' ? 'Monto' : 'Amount' },
                            ].map((m, j) => (
                              <motion.div
                                key={j}
                                className="flex items-center gap-2 text-xs"
                                initial={{ opacity: 0, x: -10 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.3 + j * 0.1 }}
                              >
                                <span className="bg-white/10 text-white/60 px-2 py-1 rounded flex-1">{m.from}</span>
                                <span className="text-[#2EC4B6]">→</span>
                                <span className="bg-[#2EC4B6]/20 text-[#2EC4B6] px-2 py-1 rounded flex-1 font-semibold">{m.to}</span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {[
                            { val: 1247, label: lang === 'es' ? 'Filas' : 'Rows', suffix: '' },
                            { val: 0, label: lang === 'es' ? 'Duplicados' : 'Dupes', suffix: '' },
                            { val: 100, label: lang === 'es' ? 'Mapeadas' : 'Mapped', suffix: '%' },
                          ].map(s => (
                            <div key={s.label} className="bg-white/10 rounded-xl p-3">
                              <p className="text-lg font-black text-white">
                                <Counter to={s.val} suffix={s.suffix} />
                              </p>
                              <p className="text-xs text-white/40">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {i === 2 && (
                      <div className="space-y-3">
                        <div className="bg-white/10 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-white">P&amp;L {lang === 'es' ? 'Resumen' : 'Summary'} 2025</p>
                            <div className="flex gap-1.5">
                              <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-medium">PDF</span>
                              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-medium">Excel</span>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {[
                              { cat: lang === 'es' ? 'Publicidad' : 'Advertising', val: '$4,200', irs: 'Line 8' },
                              { cat: 'Meals (50%)', val: '$1,890', irs: 'Line 24b' },
                              { cat: lang === 'es' ? 'Legal y Profesional' : 'Legal & Professional', val: '$3,600', irs: 'Line 17' },
                              { cat: lang === 'es' ? 'Oficina' : 'Office Expenses', val: '$2,100', irs: 'Line 18' },
                            ].map((r, j) => (
                              <motion.div
                                key={j}
                                className="flex items-center justify-between text-xs py-1 border-b border-white/5"
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.3 + j * 0.08 }}
                              >
                                <span className="text-white/60">{r.cat}</span>
                                <span className="text-white/30 mx-2">{r.irs}</span>
                                <span className="text-red-400 font-semibold">{r.val}</span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI FEATURE ── */}
      <section id="how" className="py-24 max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          {/* Visual */}
          <Reveal y={20}>
            <div className="bg-gradient-to-br from-[#1B4965] to-[#0d2233] rounded-2xl p-6 shadow-xl" ref={aiRef}>
              <div className="space-y-3">
                <motion.div
                  className="flex items-center gap-3 mb-4"
                  initial={{ opacity: 0 }}
                  animate={aiInView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.2 }}
                >
                  <div className="w-8 h-8 bg-[#2EC4B6]/20 rounded-lg flex items-center justify-center">
                    <span className="text-sm">⚡</span>
                  </div>
                  <p className="text-sm font-bold text-white">{lang === 'es' ? 'Clasificación IA en progreso...' : 'AI classification in progress...'}</p>
                </motion.div>
                {[
                  { desc: 'Amazon Business Prime', cat: 'Office Expenses', conf: 'HIGH', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { desc: 'Delta Airlines #DL4821', cat: 'Travel', conf: 'HIGH', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { desc: 'Restaurant XYZ', cat: 'Meals (50%)', conf: 'MEDIUM', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                  { desc: 'MISC TRANSFER 9821', cat: lang === 'es' ? 'Revisar' : 'Needs Review', conf: 'LOW', color: 'text-red-400', bg: 'bg-red-500/10' },
                ].map((row, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3"
                    initial={{ opacity: 0, x: -20 }}
                    animate={aiInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.35 + i * 0.12, duration: 0.45, ease }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/70 truncate">{row.desc}</p>
                      <p className="text-xs text-white/40 mt-0.5">{row.cat}</p>
                    </div>
                    <motion.span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${row.bg} ${row.color} flex-shrink-0`}
                      initial={{ scale: 0 }}
                      animate={aiInView ? { scale: 1 } : {}}
                      transition={{ delay: 0.5 + i * 0.12, type: 'spring', stiffness: 250 }}
                    >
                      {row.conf}
                    </motion.span>
                  </motion.div>
                ))}
                <motion.div
                  className="bg-[#2EC4B6]/10 border border-[#2EC4B6]/20 rounded-xl p-3 flex items-center justify-between mt-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={aiInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.9 }}
                >
                  <span className="text-xs text-[#2EC4B6] font-semibold">342 {lang === 'es' ? 'transacciones clasificadas' : 'transactions classified'}</span>
                  <motion.button
                    className="text-xs bg-[#2EC4B6] text-white font-bold px-3 py-1.5 rounded-lg"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {lang === 'es' ? 'Confirmar todo' : 'Confirm all'}
                  </motion.button>
                </motion.div>
              </div>
            </div>
          </Reveal>

          {/* Text */}
          <Reveal delay={0.15}>
            <span className="inline-block text-xs font-black uppercase tracking-widest text-[#2EC4B6] bg-[#2EC4B6]/10 px-3 py-1.5 rounded-full mb-4">{t.aiFeature.tag}</span>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 leading-tight">{t.aiFeature.title}</h2>
            <p className="text-gray-500 leading-relaxed mb-6">{t.aiFeature.desc}</p>
            <motion.ul
              className="space-y-2.5 mb-6"
              variants={stagger.container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              {t.aiFeature.bullets.map((b, j) => (
                <motion.li key={j} variants={stagger.item} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="w-5 h-5 bg-[#2EC4B6] rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </span>
                  {b}
                </motion.li>
              ))}
            </motion.ul>
            <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
              ⓘ {t.aiFeature.note}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">{t.testimonials.title}</h2>
          </Reveal>
          <motion.div
            className="grid md:grid-cols-3 gap-6"
            variants={stagger.container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            {t.testimonials.items.map((item, i) => (
              <motion.div
                key={i}
                variants={stagger.item}
                whileHover={{ y: -6, boxShadow: '0 16px 40px rgba(0,0,0,0.09)' }}
                className="bg-white rounded-2xl border border-gray-100 p-7 shadow-sm flex flex-col transition-shadow"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array(item.stars).fill(0).map((_, j) => (
                    <motion.svg
                      key={j}
                      className="w-4 h-4 text-amber-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 + i * 0.1 + j * 0.05, type: 'spring', stiffness: 300 }}
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </motion.svg>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-6">"{item.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1B4965] to-[#2EC4B6] flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                    {item.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 max-w-7xl mx-auto px-6">
        <Reveal className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">{t.pricing.title}</h2>
          <p className="text-lg text-gray-500">{t.pricing.sub}</p>
        </Reveal>
        <motion.div
          className="grid md:grid-cols-3 gap-6 items-start max-w-5xl mx-auto"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {t.pricing.plans.map((p, i) => (
            <motion.div
              key={i}
              variants={{ hidden: { opacity: 0, y: 50 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } } }}
              whileHover={{ y: -8, boxShadow: p.highlight ? '0 24px 60px rgba(27,73,101,0.3)' : '0 12px 40px rgba(0,0,0,0.1)' }}
              className={`rounded-2xl p-8 border relative transition-shadow ${p.highlight ? 'bg-[#1B4965] border-[#1B4965] shadow-2xl shadow-[#1B4965]/20 scale-[1.03]' : 'bg-white border-gray-200 shadow-sm'}`}
            >
              {p.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#2EC4B6] text-white text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wide shadow-lg">
                  {lang === 'es' ? '⭐ Más popular' : '⭐ Most popular'}
                </div>
              )}
              <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${p.highlight ? 'text-[#2EC4B6]' : 'text-gray-400'}`}>{p.name}</p>
              <div className="flex items-end gap-1 mb-1">
                <span className={`text-5xl font-black ${p.highlight ? 'text-white' : 'text-gray-900'}`}>{p.price}</span>
                <span className={`text-sm mb-2 ${p.highlight ? 'text-white/50' : 'text-gray-400'}`}>{p.per}</span>
              </div>
              <p className={`text-sm mb-6 ${p.highlight ? 'text-white/50' : 'text-gray-400'}`}>{p.desc}</p>
              <div className={`h-px mb-6 ${p.highlight ? 'bg-white/10' : 'bg-gray-100'}`} />
              <ul className="space-y-3 mb-8">
                {p.features.map((f, j) => (
                  <motion.li
                    key={j}
                    className={`flex items-center gap-2.5 text-sm ${p.highlight ? 'text-white/80' : 'text-gray-600'}`}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + j * 0.05 }}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${p.highlight ? 'bg-[#2EC4B6]/20 text-[#2EC4B6]' : 'bg-[#1B4965]/10 text-[#1B4965]'}`}>
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </span>
                    {f}
                  </motion.li>
                ))}
              </ul>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link href="/signup" className={`block w-full text-center font-bold py-3.5 rounded-xl transition-all ${p.highlight ? 'bg-[#2EC4B6] hover:bg-[#26a89b] text-white shadow-lg shadow-[#2EC4B6]/30' : 'bg-[#1B4965] hover:bg-[#143A52] text-white'}`}>
                  {p.cta}
                </Link>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900">{t.faq.title}</h2>
          </Reveal>
          <motion.div
            className="space-y-3"
            variants={stagger.container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
          >
            {t.faq.items.map((item, i) => (
              <motion.div key={i} variants={stagger.item}>
                <FaqItem q={item.q} a={item.a} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative py-28 overflow-hidden bg-gradient-to-br from-[#0d2233] via-[#1B4965] to-[#1a5276] text-white text-center">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-[#2EC4B6]/10 blur-3xl rounded-full"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <Reveal className="relative max-w-3xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-black mb-5 leading-tight">{t.finalCta.title}</h2>
          <p className="text-lg text-white/55 mb-10 max-w-xl mx-auto">{t.finalCta.sub}</p>
          <motion.div
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="inline-block"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 bg-[#2EC4B6] hover:bg-[#26a89b] text-white font-black px-10 py-4 rounded-2xl text-lg transition-all shadow-xl shadow-[#2EC4B6]/30">
              {t.finalCta.btn}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </motion.div>
          <p className="mt-5 text-sm text-white/25">{t.hero.sub2}</p>
        </Reveal>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#08161f] text-white/40 py-14">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-[#2EC4B6] rounded-xl flex items-center justify-center">
                  <span className="text-xs font-black text-white">MP</span>
                </div>
                <span className="font-black text-white text-lg tracking-tight">MyP&amp;L</span>
              </div>
              <p className="text-sm leading-relaxed max-w-xs">
                {lang === 'es' ? 'Software de P&L y contabilidad fiscal para negocios en Estados Unidos.' : 'P&L and tax accounting software for US small businesses.'}
              </p>
            </div>
            <div>
              <p className="text-white font-bold text-sm mb-4">{t.footer.product}</p>
              <ul className="space-y-2.5 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">{t.footer.features}</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">{t.footer.pricing}</a></li>
                <li><a href="#how" className="hover:text-white transition-colors">{t.footer.how}</a></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-bold text-sm mb-4">{t.footer.account}</p>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/signin" className="hover:text-white transition-colors">{t.footer.login}</Link></li>
                <li><Link href="/signup" className="hover:text-white transition-colors">{t.footer.signup}</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-bold text-sm mb-4">{t.footer.legal}</p>
              <ul className="space-y-2.5 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">{t.footer.privacy}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t.footer.terms}</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/8 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <p>{t.footer.copy}</p>
            <p>{lang === 'es' ? 'Hecho para negocios en USA 🇺🇸' : 'Made for US businesses 🇺🇸'}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
