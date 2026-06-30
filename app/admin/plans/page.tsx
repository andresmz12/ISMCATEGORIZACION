'use client'
import { useEffect, useState } from 'react'

interface PlanStats {
  BASIC: number
  PLUS: number
  ENTERPRISE: number
}

const PLAN_FEATURES = {
  BASIC: {
    name: 'Basic',
    price: 'Gratis',
    color: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-700',
    features: [
      '✓ Hasta 100 transacciones / mes',
      '✓ 1 negocio',
      '✓ Importación CSV y XLSX',
      '✓ Categorización manual',
      '✓ Reglas de palabras clave',
      '✓ Reportes básicos P&L',
      '✗ Clasificación con IA',
      '✗ Escaneo de recibos',
      '✗ Reglas aprendidas por IA',
      '✗ Exportación PDF / Excel',
      '✗ Conexión bancaria Plaid',
    ],
  },
  PLUS: {
    name: 'Plus',
    price: '$29 / mes',
    color: 'border-blue-400',
    badge: 'bg-blue-100 text-blue-700',
    features: [
      '✓ Transacciones ilimitadas',
      '✓ Hasta 3 negocios',
      '✓ Importación CSV y XLSX',
      '✓ Clasificación automática con IA',
      '✓ Reglas aprendidas por IA',
      '✓ Escaneo de recibos (IA)',
      '✓ Reportes completos P&L',
      '✓ Exportación PDF y Excel',
      '✓ Conexión bancaria Plaid',
      '✗ Negocios ilimitados',
      '✗ Soporte prioritario',
    ],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: '$79 / mes',
    color: 'border-purple-400',
    badge: 'bg-purple-100 text-purple-700',
    features: [
      '✓ Transacciones ilimitadas',
      '✓ Negocios ilimitados',
      '✓ Importación CSV y XLSX',
      '✓ Clasificación automática con IA',
      '✓ Reglas aprendidas por IA',
      '✓ Escaneo de recibos (IA)',
      '✓ Reportes completos P&L',
      '✓ Exportación PDF y Excel',
      '✓ Conexión bancaria Plaid',
      '✓ Acceso multi-usuario (contador)',
      '✓ Soporte prioritario',
    ],
  },
}

export default function PlansPage() {
  const [stats, setStats] = useState<PlanStats | null>(null)

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then((users: any[]) => {
        if (!Array.isArray(users)) return
        const s = { BASIC: 0, PLUS: 0, ENTERPRISE: 0 }
        for (const u of users) {
          if (u.plan in s) s[u.plan as keyof PlanStats]++
        }
        setStats(s)
      })
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Planes</h1>
        <p className="text-sm text-gray-500 mt-1">Comparativa de planes y usuarios activos por plan</p>
      </div>

      {/* User counts per plan */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {(['BASIC', 'PLUS', 'ENTERPRISE'] as const).map(plan => (
            <div key={plan} className="card p-4 text-center">
              <p className="text-3xl font-bold text-[#1B4965]">{stats[plan]}</p>
              <p className="text-sm text-gray-500 mt-1">usuarios en {PLAN_FEATURES[plan].name}</p>
            </div>
          ))}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(['BASIC', 'PLUS', 'ENTERPRISE'] as const).map(key => {
          const plan = PLAN_FEATURES[key]
          return (
            <div key={key} className={`card border-2 ${plan.color} overflow-hidden`}>
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${plan.badge}`}>{plan.name}</span>
                  <span className="text-lg font-bold text-gray-900">{plan.price}</span>
                </div>
              </div>
              <ul className="p-5 space-y-2.5">
                {plan.features.map((f, i) => (
                  <li key={i} className={`text-sm flex gap-2 ${f.startsWith('✗') ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className="shrink-0">{f.slice(0, 1)}</span>
                    <span>{f.slice(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400">
        Los precios son de referencia. Para cambiar el plan de un usuario ve a la sección Cuentas y usa el selector de plan en la tabla.
      </p>
    </div>
  )
}
