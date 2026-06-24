'use client'
import { useState, useEffect } from 'react'

export const BIZ_CHANGE_EVENT = 'activeBusiness:change'

export function switchBusiness(id: string) {
  localStorage.setItem('activeBusiness', id)
  window.dispatchEvent(new CustomEvent(BIZ_CHANGE_EVENT, { detail: { id } }))
}

export function useActiveBiz() {
  const [businesses, setBusinesses] = useState<any[]>([])
  const [activeBizId, setActiveBizIdInner] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/businesses')
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        if (!Array.isArray(d) || d.length === 0) { setLoading(false); return }
        setBusinesses(d)
        const saved = localStorage.getItem('activeBusiness')
        const biz = (saved && d.find((b: any) => b.id === saved)) || d[0]
        if (biz?.id) setActiveBizIdInner(biz.id)
      })
      .catch(() => setLoading(false))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail.id
      setActiveBizIdInner(id)
    }
    window.addEventListener(BIZ_CHANGE_EVENT, handler)
    return () => window.removeEventListener(BIZ_CHANGE_EVENT, handler)
  }, [])

  function setActiveBizId(id: string) {
    switchBusiness(id)
    setActiveBizIdInner(id)
  }

  return { businesses, activeBizId, setActiveBizId, loading }
}
