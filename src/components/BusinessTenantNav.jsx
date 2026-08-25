'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import { fetchBusinesses, fetchCycleDetail } from '../services/supabase'
import {
  getCachedBusinesses,
  setCachedBusinesses,
  getCachedCycleShell,
  setCachedCycleShell,
} from '../utils/tenantNavCache'
import { plazaPath } from '../utils/plaza'

const BusinessTenantNavContext = createContext(null)

/**
 * Lives in businesses/layout so tenant lists survive [id] remounts.
 */
export function BusinessTenantNavProvider({ children }) {
  const params = useParams()
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const plazaSlug = params.plazaSlug
  const businessId = params.id
  const cycleId = params.cycleId
  const isInvoice = pathname.includes('/invoices/')

  const fromParam = searchParams.get('from')
  const fromQuery = useMemo(() => {
    if (!fromParam || !fromParam.startsWith('/')) return ''
    return `?from=${encodeURIComponent(fromParam)}`
  }, [fromParam])

  const path = useCallback(
    (p) => (plazaSlug ? plazaPath(plazaSlug, p) : p),
    [plazaSlug],
  )

  const [cycleTenants, setCycleTenants] = useState(
    () => (cycleId ? getCachedCycleShell(cycleId)?.siblings : null) || [],
  )
  const [plazaTenants, setPlazaTenants] = useState([])
  const [plazaComplexId, setPlazaComplexId] = useState(null)

  useEffect(() => {
    if (!isInvoice || !cycleId) return undefined

    const cached = getCachedCycleShell(cycleId)
    if (cached?.siblings?.length) {
      setCycleTenants(cached.siblings)
      return undefined
    }

    let cancelled = false
    fetchCycleDetail(cycleId)
      .then((detail) => {
        if (cancelled) return
        const siblings = (detail || [])
          .filter(b => b.business_id != null)
          .map(b => ({
            id: b.business_id,
            name: b.business_name || 'Tenant',
          }))
        setCycleTenants(siblings)
        setCachedCycleShell(cycleId, {
          ...(getCachedCycleShell(cycleId) || {}),
          siblings,
        })
      })
      .catch(() => {
        if (!cancelled) setCycleTenants([])
      })

    return () => {
      cancelled = true
    }
  }, [isInvoice, cycleId])

  useEffect(() => {
    if (isInvoice || !plazaComplexId) return undefined

    const cached = getCachedBusinesses(plazaComplexId)
    if (cached?.length) {
      setPlazaTenants(cached)
      return undefined
    }

    let cancelled = false
    fetchBusinesses(plazaComplexId)
      .then((list) => {
        if (cancelled) return
        const rows = list || []
        setPlazaTenants(rows)
        setCachedBusinesses(plazaComplexId, rows)
      })
      .catch(() => {
        if (!cancelled) setPlazaTenants([])
      })

    return () => {
      cancelled = true
    }
  }, [isInvoice, plazaComplexId])

  const registerPlazaComplex = useCallback((complexId) => {
    if (!complexId) return
    const key = String(complexId)
    setPlazaComplexId((prev) => {
      if (prev === key) return prev
      const cached = getCachedBusinesses(complexId)
      if (cached?.length) setPlazaTenants(cached)
      return key
    })
  }, [])

  const rawTenants = isInvoice ? cycleTenants : plazaTenants

  const tenants = useMemo(() => (
    (rawTenants || []).map(t => {
      const id = t.id ?? t.business_id
      const name = t.name || t.business_name || 'Tenant'
      const href = isInvoice && cycleId
        ? `${path(`/businesses/${id}/invoices/${cycleId}`)}${fromQuery}`
        : `${path(`/businesses/${id}`)}${fromQuery}`
      return { id, name, href }
    })
  ), [rawTenants, isInvoice, cycleId, path, fromQuery])

  const value = useMemo(() => ({
    tenants,
    businessId,
    cycleId,
    isInvoice,
    plazaSlug,
    fromQuery,
    registerPlazaComplex,
  }), [tenants, businessId, cycleId, isInvoice, plazaSlug, fromQuery, registerPlazaComplex])

  return (
    <BusinessTenantNavContext.Provider value={value}>
      {children}
    </BusinessTenantNavContext.Provider>
  )
}

export function useBusinessTenantNav() {
  return useContext(BusinessTenantNavContext)
}
