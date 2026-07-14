'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
} from 'framer-motion'

// ── Constants ─────────────────────────────────────────────────────────────────

const NAVY = '#1B4965'
const TEAL = '#2EC4B6'
const ease = [0.22, 1, 0.36, 1] as [number, number, number, number]

// ── Small helpers ─────────────────────────────────────────────────────────────

function Reveal({
  children,
  delay = 0,
  className = '',
  y = 28,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  y?: number
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.2 })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function Counter({ to, prefix = '', suffix = '', decimals = 0 }: { to: number; prefix?: string; suffix?: string; decimals?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const mv = useMotionValue(0)
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    const unsub = mv.on('change', v => setDisplay(v.toFixed(decimals)))
    return unsub
  }, [mv, decimals])

  useEffect(() => {
    if (inView) {
      const ctrl = animate(mv, to, { duration: 1.8, ease: 'easeOut' })
      return ctrl.stop
    }
  }, [inView, mv, to])

  return <span ref={ref}>{prefix}{display}{suffix}</span>
}

// ── Live ledger (hero) ────────────────────────────────────────────────────────

type LedgerRow = { desc: string; amount: string; cat: { es: string; en: string }; income?: boolean }

const LEDGER_POOL: LedgerRow[] = [
  { desc: 'HOME DEPOT #4521 ATLANTA GA', amount: '-218.40', cat: { es: 'Suministros', en: 'Supplies' } },
  { desc: 'ZELLE FROM RODRIGUEZ CONSTR', amount: '+3,500.00', cat: { es: 'Ingreso', en: 'Income' }, income: true },
  { desc: 'SHELL OIL 57442 MIAMI FL', amount: '-64.12', cat: { es: 'Vehículo', en: 'Car & Truck' } },
  { desc: 'GOOGLE ADS 88231', amount: '-380.00', cat: { es: 'Publicidad', en: 'Advertising' } },
  { desc: 'USPS PO 4402 HOUSTON TX', amount: '-27.90', cat: { es: 'Oficina', en: 'Office' } },
  { desc: 'STRIPE PAYOUT 2201', amount: '+1,842.75', cat: { es: 'Ingreso', en: 'Income' }, income: true },
  { desc: 'CHIPOTLE 1187 DALLAS TX', amount: '-31.55', cat: { es: 'Comidas 50%', en: 'Meals 50%' } },
  { desc: 'STATE FARM INSURANCE', amount: '-146.00', cat: { es: 'Seguro', en: 'Insurance' } },
]

function LiveLedger({ lang }: { lang: 'es' | 'en' }) {
  const [rows, setRows] = useState<{ row: LedgerRow; id: number; tagged: boolean }[]>([])
  const idRef = useRef(0)
  const poolRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []

    const pushRow = () => {
      if (cancelled) return
      const row = LEDGER_POOL[poolRef.current % LEDGER_POOL.length]
      poolRef.current++
      const id = idRef.current++
      setRows(prev => [...prev.slice(-4), { row, id, tagged: false }])
      timers.push(setTimeout(() => {
        if (cancelled) return
        setRows(prev => prev.map(r => (r.id === id ? { ...r, tagged: true } : r)))
      }, 900))
      timers.push(setTimeout(pushRow, 2200))
    }

    timers.push(setTimeout(pushRow, 600))
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="border border-black/10 bg-white">
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-widest text-black/40">
          {lang === 'es' ? 'clasificando en vivo' : 'classifying live'}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-black/40">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TEAL }} />
          chase_export_jan.csv
        </span>
      </div>
      <div className="h-[300px] overflow-hidden px-4 py-3">
        <AnimatePresence initial={false}>
          {rows.map(({ row, id, tagged }) => (
            <motion.div
              key={id}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease }}
              className="flex items-center gap-3 border-b border-black/5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[11px] text-black/70">{row.desc}</p>
              </div>
              <div className="w-20 shrink-0 text-right">
                <span className={`font-mono text-xs ${row.income ? 'text-emerald-600' : 'text-black/60'}`}>{row.amount}</span>
              </div>
              <div className="w-24 shrink-0 text-right">
                <AnimatePresence mode="wait">
                  {tagged ? (
                    <motion.span
                      key="tag"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.25 }}
                      className="inline-block px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide"
                      style={{ backgroundColor: `${TEAL}1a`, color: '#0f766e' }}
                    >
                      {row.cat[lang]}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="dots"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.35 }}
                      exit={{ opacity: 0 }}
                      className="font-mono text-[10px] text-black"
                    >
                      · · ·
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-between border-t border-black/10 px-4 py-2.5">
        <span className="font-mono text-[11px] text-black/40">
          {lang === 'es' ? 'IRS Schedule C · automático' : 'IRS Schedule C · automatic'}
        </span>
        <span className="font-mono text-[11px] font-semibold" style={{ color: NAVY }}>
          ~95% acc.
        </span>
      </div>
    </div>
  )
}

// ── Product demo tabs ─────────────────────────────────────────────────────────

function DemoPanel({ tab, lang }: { tab: number; lang: 'es' | 'en' }) {
  const es = lang === 'es'
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease }}
        className="p-5 sm:p-8"
      >
        {tab === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { l: es ? 'Ingresos YTD' : 'YTD Income', v: '$48,200', d: '+12.4%' },
              { l: es ? 'Gastos YTD' : 'YTD Expenses', v: '$31,540', d: '−3.1%' },
              { l: es ? 'Ganancia neta' : 'Net profit', v: '$16,660', d: '+8.9%' },
              { l: es ? 'Total deducible' : 'Deductible total', v: '$22,180', d: 'Sched. C' },
            ].map((s, i) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4, ease }}
                className="border border-black/10 bg-white p-5"
              >
                <p className="font-mono text-[11px] uppercase tracking-widest text-black/40">{s.l}</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <p className="text-2xl font-semibold tracking-tight" style={{ color: NAVY }}>{s.v}</p>
                  <span className="font-mono text-[11px] text-black/40">{s.d}</span>
                </div>
              </motion.div>
            ))}
            <div className="border border-black/10 bg-white p-5 sm:col-span-2">
              <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-black/40">
                {es ? 'Gastos por mes' : 'Expenses by month'}
              </p>
              <div className="flex h-24 items-end gap-1.5">
                {[38, 52, 41, 66, 58, 84, 61, 74, 47, 69, 55, 90].map((h, i) => (
                  <motion.div
                    key={i}
                    className="flex-1"
                    style={{ backgroundColor: i === 11 ? TEAL : `${NAVY}26` }}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: 0.15 + i * 0.04, duration: 0.5, ease }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 1 && (
          <div className="space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-black/40">
              {es ? 'Mapeo automático de columnas' : 'Automatic column mapping'}
            </p>
            {[
              { from: 'Transaction Date', to: es ? 'Fecha' : 'Date' },
              { from: 'Merchant Name', to: es ? 'Descripción' : 'Description' },
              { from: 'Debit Amount', to: es ? 'Monto' : 'Amount' },
            ].map((m, i) => (
              <motion.div
                key={m.from}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4, ease }}
                className="flex items-center gap-3"
              >
                <span className="flex-1 border border-black/10 bg-white px-3 py-2 font-mono text-xs text-black/60">{m.from}</span>
                <span className="font-mono text-sm" style={{ color: TEAL }}>→</span>
                <span className="flex-1 border px-3 py-2 font-mono text-xs font-semibold" style={{ borderColor: `${TEAL}66`, backgroundColor: `${TEAL}0d`, color: '#0f766e' }}>{m.to}</span>
              </motion.div>
            ))}
            <div className="grid grid-cols-3 gap-3 pt-3">
              {[
                { v: 1247, l: es ? 'filas leídas' : 'rows read', s: '' },
                { v: 3, l: es ? 'duplicados fuera' : 'dupes removed', s: '' },
                { v: 100, l: es ? 'mapeadas' : 'mapped', s: '%' },
              ].map(s => (
                <div key={s.l} className="border border-black/10 bg-white p-4 text-center">
                  <p className="text-xl font-semibold tracking-tight" style={{ color: NAVY }}>
                    <Counter to={s.v} suffix={s.s} />
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-black/40">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 2 && (
          <div className="space-y-2.5">
            <p className="font-mono text-[11px] uppercase tracking-widest text-black/40">
              {es ? 'Revisión de confianza' : 'Confidence review'}
            </p>
            {[
              { d: 'AMAZON BUSINESS PRIME', c: es ? 'Oficina · Línea 18' : 'Office · Line 18', conf: 'HIGH', clr: '#059669' },
              { d: 'DELTA AIR 0062341', c: es ? 'Viajes · Línea 24a' : 'Travel · Line 24a', conf: 'HIGH', clr: '#059669' },
              { d: 'RESTAURANT LUNA 44', c: es ? 'Comidas 50% · 24b' : 'Meals 50% · 24b', conf: 'MED', clr: '#d97706' },
              { d: 'MISC TRANSFER 9821', c: es ? 'Revisar manualmente' : 'Needs review', conf: 'LOW', clr: '#dc2626' },
            ].map((r, i) => (
              <motion.div
                key={r.d}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.09, duration: 0.4, ease }}
                className="flex items-center gap-3 border border-black/10 bg-white px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-black/70">{r.d}</p>
                  <p className="mt-0.5 text-xs text-black/40">{r.c}</p>
                </div>
                <span className="shrink-0 font-mono text-[10px] font-bold tracking-wider" style={{ color: r.clr }}>{r.conf}</span>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="flex items-center justify-between border px-4 py-3"
              style={{ borderColor: `${TEAL}66`, backgroundColor: `${TEAL}0d` }}
            >
              <span className="font-mono text-xs" style={{ color: '#0f766e' }}>
                342 {es ? 'listas para confirmar' : 'ready to confirm'}
              </span>
              <span className="px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: NAVY }}>
                {es ? 'Confirmar todo' : 'Confirm all'}
              </span>
            </motion.div>
          </div>
        )}

        {tab === 3 && (
          <div className="border border-black/10 bg-white">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-3">
              <p className="font-mono text-xs font-semibold" style={{ color: NAVY }}>P&L 2025 — {es ? 'Resumen anual' : 'Annual summary'}</p>
              <div className="flex gap-2 font-mono text-[10px]">
                <span className="border border-black/15 px-2 py-0.5 text-black/50">PDF</span>
                <span className="border border-black/15 px-2 py-0.5 text-black/50">XLSX</span>
              </div>
            </div>
            <div className="px-5 py-3">
              {[
                { cat: es ? 'Publicidad' : 'Advertising', line: 'Line 8', val: '$4,200' },
                { cat: es ? 'Vehículo' : 'Car & truck', line: 'Line 9', val: '$3,120' },
                { cat: es ? 'Legal y profesional' : 'Legal & professional', line: 'Line 17', val: '$3,600' },
                { cat: es ? 'Oficina' : 'Office expense', line: 'Line 18', val: '$2,100' },
                { cat: es ? 'Comidas (50%)' : 'Meals (50%)', line: 'Line 24b', val: '$1,890' },
              ].map((r, i) => (
                <motion.div
                  key={r.cat}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center justify-between border-b border-black/5 py-2 text-xs last:border-0"
                >
                  <span className="text-black/70">{r.cat}</span>
                  <span className="mx-3 font-mono text-[10px] text-black/30">{r.line}</span>
                  <span className="font-mono text-black/70">{r.val}</span>
                </motion.div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-black/10 pt-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: NAVY }}>
                  {es ? 'Total deducible' : 'Total deductible'}
                </span>
                <span className="font-mono text-sm font-bold" style={{ color: NAVY }}>$14,910</span>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

function FaqItem({ n, q, a }: { n: string; q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-black/10">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-baseline gap-4 py-5 text-left transition-colors hover:bg-black/[0.02] sm:gap-6"
      >
        <span className="font-mono text-xs text-black/30">{n}</span>
        <span className="flex-1 text-base font-medium text-black/85 sm:text-lg">{q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.25 }}
          className="font-mono text-lg text-black/40"
        >
          +
        </motion.span>
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
            <p className="pb-6 pl-10 pr-6 text-sm leading-relaxed text-black/50 sm:pl-14">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Copy ──────────────────────────────────────────────────────────────────────

const copy = {
  es: {
    nav: { product: 'Producto', pricing: 'Planes', faq: 'Preguntas', login: 'Entrar', cta: 'Crear cuenta' },
    hero: {
      kicker: 'P&L y Schedule C para negocios en USA',
      h1: ['Tu contabilidad,', 'sin contabilidad.'],
      sub: 'Importa el estado de cuenta de tu banco, deja que la IA clasifique cada transacción según el IRS Schedule C, y entrega a tu contador un P&L limpio. Eso es todo.',
      cta1: 'Crear cuenta',
      cta2: 'Ver planes',
      note: 'Desde $20/mes · Sin permanencia',
    },
    ticker: ['CHASE', 'BANK OF AMERICA', 'WELLS FARGO', 'CITI', 'TD BANK', 'CAPITAL ONE', 'CSV', 'XLSX', 'IRS SCHEDULE C', 'PDF', 'EXCEL', 'PLAID'],
    steps: {
      kicker: 'Cómo funciona',
      title: 'Tres pasos. Minutos, no fines de semana.',
      items: [
        { n: '01', title: 'Importa tu banco', desc: 'Descarga el CSV o Excel de cualquier banco y arrástralo. Detectamos fecha, descripción y monto automáticamente, y filtramos duplicados.' },
        { n: '02', title: 'Clasifica con IA', desc: 'Cada transacción recibe su categoría IRS Schedule C con un nivel de confianza. Tú revisas las dudosas y confirmas el resto con un clic.' },
        { n: '03', title: 'Entrega el reporte', desc: 'Genera el P&L en PDF o Excel con desglose por línea del Schedule C y totales deducibles. Tu contador solo revisa y presenta.' },
      ],
    },
    demo: {
      kicker: 'El producto',
      title: 'Así se ve por dentro',
      tabs: ['Panel', 'Importar', 'IA', 'Reportes'],
    },
    stats: [
      { v: 500, s: '+', l: 'negocios activos' },
      { v: 95, s: '%', l: 'precisión de la IA' },
      { v: 5, s: ' min', l: 'para 500 transacciones', p: '<' },
      { v: 27, s: '', l: 'categorías Schedule C' },
    ],
    pricing: {
      kicker: 'Planes',
      title: 'Precios claros. Sin sorpresas.',
      sub: 'Cancela cuando quieras. Si bajas de plan conservas todos tus datos.',
      monthly: '/mes',
      custom: 'A convenir',
      popular: 'Recomendado',
      plans: [
        {
          name: 'Basic', price: '$20', desc: 'Para empezar con un negocio',
          features: ['1 negocio', 'Importación CSV y XLSX', 'Categorización manual', 'Reglas de palabras clave'],
          missing: ['Clasificación con IA', 'Escaneo de recibos (OCR)', 'Exportación PDF / Excel', 'Conexión bancaria Plaid', 'Multi-usuario'],
          cta: 'Empezar con Basic', highlight: false,
        },
        {
          name: 'Plus', price: '$45', desc: 'El plan completo para la mayoría',
          features: ['Hasta 5 negocios', 'Importación CSV y XLSX', 'Clasificación automática con IA', 'Escaneo de recibos (OCR)', 'Reportes y exportación PDF / Excel', 'Conexión bancaria Plaid', 'Multi-usuario'],
          missing: [],
          cta: 'Empezar con Plus', highlight: true,
        },
        {
          name: 'Enterprise', price: '$70', desc: 'Para contadores y firmas',
          features: ['Hasta 20 negocios', 'Todo lo de Plus', 'Clasificación automática con IA', 'Escaneo de recibos (OCR)', 'Reportes PDF / Excel', 'Conexión bancaria Plaid', 'Multi-usuario', 'Soporte prioritario'],
          missing: [],
          cta: 'Empezar con Enterprise', highlight: false,
        },
        {
          name: 'Custom', price: null, desc: 'Volumen alto o necesidades especiales',
          features: ['Negocios ilimitados', 'Todo lo de Enterprise', 'Configuración personalizada', 'Soporte prioritario'],
          missing: [],
          cta: 'Hablemos', highlight: false,
        },
      ],
    },
    faq: {
      kicker: 'Preguntas frecuentes',
      items: [
        { q: '¿Funciona con mi banco?', a: 'Sí. Funciona con cualquier banco que permita exportar transacciones en CSV o Excel: Chase, Bank of America, Wells Fargo, Citi, TD Bank y más. En los planes Plus en adelante también puedes conectar tu banco directamente vía Plaid.' },
        { q: '¿Necesito saber de contabilidad?', a: 'No. La plataforma está diseñada para dueños de negocio. Las categorías siguen el IRS Schedule C y la IA hace el trabajo pesado; tú solo revisas y confirmas.' },
        { q: '¿Qué plan incluye la clasificación con IA?', a: 'Plus, Enterprise y Custom. El plan Basic incluye categorización manual y reglas por palabras clave, que ya ahorran bastante tiempo.' },
        { q: '¿Mis datos están seguros?', a: 'Sí. Encriptación TLS en tránsito, contraseñas con bcrypt y aislamiento estricto de datos por usuario. Nunca vendemos ni compartimos tu información.' },
        { q: '¿Puedo cancelar cuando quiera?', a: 'Sí, sin penalidades. Si cancelas conservas acceso a tus datos históricos.' },
      ],
    },
    finalCta: {
      title: 'Deja de perder fines de semana en la contabilidad.',
      sub: 'Importa tu primer estado de cuenta hoy y mira tu P&L en minutos.',
      btn: 'Crear cuenta',
    },
    footer: {
      blurb: 'Software de P&L y contabilidad fiscal para negocios en Estados Unidos.',
      product: 'Producto', account: 'Cuenta', legal: 'Legal',
      links: { product: 'Producto', pricing: 'Planes', faq: 'Preguntas' },
      login: 'Iniciar sesión', signup: 'Crear cuenta', privacy: 'Privacidad', terms: 'Términos de uso',
      copy: '© 2026 My Profit and Loss. Todos los derechos reservados.',
      made: 'Hecho para negocios en USA',
    },
  },
  en: {
    nav: { product: 'Product', pricing: 'Pricing', faq: 'FAQ', login: 'Log in', cta: 'Create account' },
    hero: {
      kicker: 'P&L and Schedule C for US businesses',
      h1: ['Your bookkeeping,', 'without the bookkeeping.'],
      sub: "Import your bank statement, let AI classify every transaction to the IRS Schedule C, and hand your accountant a clean P&L. That's it.",
      cta1: 'Create account',
      cta2: 'See pricing',
      note: 'From $20/mo · Cancel anytime',
    },
    ticker: ['CHASE', 'BANK OF AMERICA', 'WELLS FARGO', 'CITI', 'TD BANK', 'CAPITAL ONE', 'CSV', 'XLSX', 'IRS SCHEDULE C', 'PDF', 'EXCEL', 'PLAID'],
    steps: {
      kicker: 'How it works',
      title: 'Three steps. Minutes, not weekends.',
      items: [
        { n: '01', title: 'Import your bank', desc: 'Download the CSV or Excel from any bank and drop it in. We auto-detect date, description and amount, and filter duplicates.' },
        { n: '02', title: 'Classify with AI', desc: 'Every transaction gets its IRS Schedule C category with a confidence level. You review the doubtful ones and confirm the rest in one click.' },
        { n: '03', title: 'Deliver the report', desc: 'Generate the P&L as PDF or Excel with a per-line Schedule C breakdown and deductible totals. Your accountant just reviews and files.' },
      ],
    },
    demo: {
      kicker: 'The product',
      title: 'What it looks like inside',
      tabs: ['Dashboard', 'Import', 'AI', 'Reports'],
    },
    stats: [
      { v: 500, s: '+', l: 'active businesses' },
      { v: 95, s: '%', l: 'AI accuracy' },
      { v: 5, s: ' min', l: 'for 500 transactions', p: '<' },
      { v: 27, s: '', l: 'Schedule C categories' },
    ],
    pricing: {
      kicker: 'Pricing',
      title: 'Clear prices. No surprises.',
      sub: 'Cancel anytime. If you downgrade you keep all your data.',
      monthly: '/mo',
      custom: "Let's talk",
      popular: 'Recommended',
      plans: [
        {
          name: 'Basic', price: '$20', desc: 'To get started with one business',
          features: ['1 business', 'CSV & XLSX import', 'Manual categorization', 'Keyword rules'],
          missing: ['AI classification', 'Receipt scanning (OCR)', 'PDF / Excel export', 'Plaid bank connection', 'Multi-user'],
          cta: 'Start with Basic', highlight: false,
        },
        {
          name: 'Plus', price: '$45', desc: 'The complete plan for most',
          features: ['Up to 5 businesses', 'CSV & XLSX import', 'Automatic AI classification', 'Receipt scanning (OCR)', 'Reports & PDF / Excel export', 'Plaid bank connection', 'Multi-user'],
          missing: [],
          cta: 'Start with Plus', highlight: true,
        },
        {
          name: 'Enterprise', price: '$70', desc: 'For accountants and firms',
          features: ['Up to 20 businesses', 'Everything in Plus', 'Automatic AI classification', 'Receipt scanning (OCR)', 'PDF / Excel reports', 'Plaid bank connection', 'Multi-user', 'Priority support'],
          missing: [],
          cta: 'Start with Enterprise', highlight: false,
        },
        {
          name: 'Custom', price: null, desc: 'High volume or special needs',
          features: ['Unlimited businesses', 'Everything in Enterprise', 'Custom configuration', 'Priority support'],
          missing: [],
          cta: "Let's talk", highlight: false,
        },
      ],
    },
    faq: {
      kicker: 'Frequently asked questions',
      items: [
        { q: 'Does it work with my bank?', a: 'Yes. It works with any bank that exports transactions as CSV or Excel — Chase, Bank of America, Wells Fargo, Citi, TD Bank and more. On Plus and above you can also connect your bank directly via Plaid.' },
        { q: 'Do I need accounting knowledge?', a: 'No. The platform is built for business owners. Categories follow the IRS Schedule C and the AI does the heavy lifting; you just review and confirm.' },
        { q: 'Which plan includes AI classification?', a: 'Plus, Enterprise and Custom. The Basic plan includes manual categorization and keyword rules, which already save plenty of time.' },
        { q: 'Is my data secure?', a: 'Yes. TLS encryption in transit, bcrypt-hashed passwords and strict per-user data isolation. We never sell or share your information.' },
        { q: 'Can I cancel anytime?', a: 'Yes, no penalties. If you cancel you keep access to your historical data.' },
      ],
    },
    finalCta: {
      title: 'Stop losing weekends to bookkeeping.',
      sub: 'Import your first bank statement today and see your P&L in minutes.',
      btn: 'Create account',
    },
    footer: {
      blurb: 'P&L and tax accounting software for US small businesses.',
      product: 'Product', account: 'Account', legal: 'Legal',
      links: { product: 'Product', pricing: 'Pricing', faq: 'FAQ' },
      login: 'Log in', signup: 'Create account', privacy: 'Privacy policy', terms: 'Terms of use',
      copy: '© 2026 My Profit and Loss. All rights reserved.',
      made: 'Made for US businesses',
    },
  },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingClient() {
  const [lang, setLang] = useState<'es' | 'en'>('es')
  const [tab, setTab] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const t = copy[lang]

  const onScroll = useCallback(() => setScrolled(window.scrollY > 24), [])
  useEffect(() => {
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [onScroll])

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAFAF7] text-black antialiased">
      <style>{`
        @keyframes lp-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .lp-marquee { animation: lp-marquee 36s linear infinite; }
        .lp-marquee:hover { animation-play-state: paused; }
      `}</style>

      {/* ── NAV ── */}
      <header
        className={`sticky top-0 z-50 border-b bg-[#FAFAF7]/90 backdrop-blur transition-shadow ${scrolled ? 'border-black/10 shadow-[0_1px_0_rgba(0,0,0,0.04)]' : 'border-transparent'}`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="My Profit and Loss" className="h-8 w-8" />
            <span className="text-[15px] font-bold tracking-tight" style={{ color: NAVY }}>
              My Profit &amp; Loss
            </span>
          </Link>

          <nav className="hidden items-center gap-7 font-mono text-[12px] uppercase tracking-widest text-black/50 md:flex">
            <a href="#product" className="transition-colors hover:text-black">{t.nav.product}</a>
            <a href="#pricing" className="transition-colors hover:text-black">{t.nav.pricing}</a>
            <a href="#faq" className="transition-colors hover:text-black">{t.nav.faq}</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(l => (l === 'es' ? 'en' : 'es'))}
              className="border border-black/15 px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-black/60 transition-colors hover:border-black/40"
            >
              {lang === 'es' ? 'EN' : 'ES'}
            </button>
            <Link
              href="/signin"
              className="block px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-black/60 transition-colors hover:text-black"
            >
              {t.nav.login}
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: NAVY }}
            >
              {t.nav.cta}
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="border-b border-black/10">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:pb-24 lg:pt-24">
          <div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-black/40"
            >
              — {t.hero.kicker}
            </motion.p>

            <h1 className="text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[4.2rem]">
              {t.hero.h1.map((line, i) => (
                <span key={line} className="block overflow-hidden">
                  <motion.span
                    className="block"
                    style={i === 1 ? { color: NAVY } : undefined}
                    initial={{ y: '110%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.12, ease }}
                  >
                    {i === 1 ? <em className="not-italic" style={{ fontStyle: 'italic' }}>{line}</em> : line}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45, ease }}
              className="mt-7 max-w-md text-[15px] leading-relaxed text-black/55"
            >
              {t.hero.sub}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.58, ease }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: NAVY }}
              >
                {t.hero.cta1}
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center border border-black/20 px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-black/70 transition-colors hover:border-black/50"
              >
                {t.hero.cta2}
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75 }}
              className="mt-5 font-mono text-[11px] text-black/35"
            >
              {t.hero.note}
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease }}
            className="self-center"
          >
            <LiveLedger lang={lang} />
          </motion.div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div className="overflow-hidden border-b border-black/10 bg-white py-3">
        <div className="lp-marquee flex w-max items-center">
          {[0, 1].map(dup => (
            <div key={dup} className="flex items-center" aria-hidden={dup === 1}>
              {t.ticker.map(item => (
                <span key={`${dup}-${item}`} className="flex items-center">
                  <span className="px-6 font-mono text-[11px] tracking-[0.25em] text-black/35">{item}</span>
                  <span className="text-black/20">·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── STEPS ── */}
      <section id="product" className="border-b border-black/10">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
          <Reveal>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-black/40">— {t.steps.kicker}</p>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{t.steps.title}</h2>
          </Reveal>

          <div className="mt-14 grid gap-px overflow-hidden border border-black/10 bg-black/10 md:grid-cols-3">
            {t.steps.items.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.12} className="bg-[#FAFAF7]">
                <div className="group flex h-full flex-col p-8 transition-colors hover:bg-white">
                  <span className="font-mono text-4xl font-light text-black/15 transition-colors group-hover:text-[#2EC4B6]">{s.n}</span>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight" style={{ color: NAVY }}>{s.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-black/50">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO ── */}
      <section className="border-b border-black/10 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
          <Reveal>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-black/40">— {t.demo.kicker}</p>
            <h2 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{t.demo.title}</h2>
          </Reveal>

          <Reveal delay={0.15} className="mt-10">
            <div className="border border-black/10 bg-[#FAFAF7]">
              <div className="flex flex-wrap border-b border-black/10">
                {t.demo.tabs.map((label, i) => (
                  <button
                    key={label}
                    onClick={() => setTab(i)}
                    className={`relative px-5 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors sm:px-7 ${tab === i ? 'text-white' : 'text-black/45 hover:text-black'}`}
                    style={tab === i ? { backgroundColor: NAVY } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <DemoPanel tab={tab} lang={lang} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="border-b border-black/10">
        <div className="mx-auto grid max-w-6xl grid-cols-2 md:grid-cols-4">
          {t.stats.map((s, i) => (
            <div
              key={s.l}
              className={`px-5 py-10 text-center ${i > 0 ? 'border-l border-black/10' : ''} ${i >= 2 ? 'max-md:border-t max-md:border-black/10' : ''} ${i === 2 ? 'max-md:border-l-0' : ''}`}
            >
              <p className="text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: NAVY }}>
                <Counter to={s.v} prefix={(s as any).p ?? ''} suffix={s.s} />
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-black/40">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="border-b border-black/10 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
          <Reveal>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-black/40">— {t.pricing.kicker}</p>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{t.pricing.title}</h2>
              <p className="max-w-xs text-sm text-black/45">{t.pricing.sub}</p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-px overflow-hidden border border-black/10 bg-black/10 md:grid-cols-2 xl:grid-cols-4">
            {t.pricing.plans.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08} className={p.highlight ? '' : 'bg-white'}>
                <div
                  className="relative flex h-full flex-col p-7"
                  style={p.highlight ? { backgroundColor: NAVY } : undefined}
                >
                  <div className="flex items-baseline justify-between">
                    <h3
                      className={`font-mono text-xs font-bold uppercase tracking-[0.2em] ${p.highlight ? 'text-white' : 'text-black/60'}`}
                    >
                      {p.name}
                    </h3>
                    {p.highlight && (
                      <span className="px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-black" style={{ backgroundColor: TEAL }}>
                        {t.pricing.popular}
                      </span>
                    )}
                  </div>

                  <div className="mt-6 flex items-baseline gap-1">
                    {p.price ? (
                      <>
                        <span className={`text-4xl font-semibold tracking-tight ${p.highlight ? 'text-white' : ''}`} style={!p.highlight ? { color: NAVY } : undefined}>
                          {p.price}
                        </span>
                        <span className={`font-mono text-xs ${p.highlight ? 'text-white/50' : 'text-black/35'}`}>{t.pricing.monthly}</span>
                      </>
                    ) : (
                      <span className={`text-2xl font-semibold tracking-tight ${p.highlight ? 'text-white' : ''}`} style={!p.highlight ? { color: NAVY } : undefined}>
                        {t.pricing.custom}
                      </span>
                    )}
                  </div>
                  <p className={`mt-2 text-xs ${p.highlight ? 'text-white/50' : 'text-black/40'}`}>{p.desc}</p>

                  <ul className="mt-7 flex-1 space-y-2.5 border-t pt-6" style={{ borderColor: p.highlight ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}>
                    {p.features.map(f => (
                      <li key={f} className={`flex items-start gap-2.5 text-[13px] ${p.highlight ? 'text-white/85' : 'text-black/65'}`}>
                        <span className="mt-px font-mono text-xs" style={{ color: TEAL }}>✓</span>
                        {f}
                      </li>
                    ))}
                    {p.missing.map(f => (
                      <li key={f} className={`flex items-start gap-2.5 text-[13px] line-through ${p.highlight ? 'text-white/30' : 'text-black/25'}`}>
                        <span className="mt-px font-mono text-xs no-underline">—</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/register"
                    className={`mt-8 block py-3 text-center font-mono text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-85 ${p.highlight ? 'text-black' : 'text-white'}`}
                    style={{ backgroundColor: p.highlight ? TEAL : NAVY }}
                  >
                    {p.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="border-b border-black/10">
        <div className="mx-auto max-w-3xl px-5 py-20 lg:py-28">
          <Reveal>
            <p className="mb-10 font-mono text-[11px] uppercase tracking-[0.2em] text-black/40">— {t.faq.kicker}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="border-t border-black/10">
              {t.faq.items.map((item, i) => (
                <FaqItem key={i} n={String(i + 1).padStart(2, '0')} q={item.q} a={item.a} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ backgroundColor: NAVY }}>
        <div className="mx-auto max-w-6xl px-5 py-24 lg:py-32">
          <Reveal>
            <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.02em] text-white sm:text-5xl">
              {t.finalCta.title}
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/50">{t.finalCta.sub}</p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 px-7 py-4 font-mono text-xs font-bold uppercase tracking-wider text-black transition-opacity hover:opacity-90"
                style={{ backgroundColor: TEAL }}
              >
                {t.finalCta.btn}
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <span className="font-mono text-[11px] text-white/35">{t.hero.note}</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0d2233] py-14 text-white/40">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
            <div>
              <div className="mb-4 flex items-center gap-2.5">
                <img src="/logo.svg" alt="My Profit and Loss" className="h-7 w-7" />
                <span className="text-sm font-bold tracking-tight text-white">My Profit &amp; Loss</span>
              </div>
              <p className="max-w-xs text-xs leading-relaxed">{t.footer.blurb}</p>
            </div>
            <div>
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">{t.footer.product}</p>
              <ul className="space-y-2.5 text-xs">
                <li><a href="#product" className="transition-colors hover:text-white">{t.footer.links.product}</a></li>
                <li><a href="#pricing" className="transition-colors hover:text-white">{t.footer.links.pricing}</a></li>
                <li><a href="#faq" className="transition-colors hover:text-white">{t.footer.links.faq}</a></li>
              </ul>
            </div>
            <div>
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">{t.footer.account}</p>
              <ul className="space-y-2.5 text-xs">
                <li><Link href="/signin" className="transition-colors hover:text-white">{t.footer.login}</Link></li>
                <li><Link href="/register" className="transition-colors hover:text-white">{t.footer.signup}</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">{t.footer.legal}</p>
              <ul className="space-y-2.5 text-xs">
                <li><Link href="/privacy" className="transition-colors hover:text-white">{t.footer.privacy}</Link></li>
                <li><Link href="/terms" className="transition-colors hover:text-white">{t.footer.terms}</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-2 border-t border-white/10 pt-6 font-mono text-[10px] tracking-wider md:flex-row md:items-center">
            <p>{t.footer.copy}</p>
            <p>{t.footer.made}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
