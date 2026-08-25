'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import InvoiceCard from '../../../../../../components/InvoiceCard'
import Breadcrumbs from '../../../../../../components/Breadcrumbs'
import TenantSwitcher from '../../../../../../components/TenantSwitcher'
import { useBusinessTenantNav } from '../../../../../../components/BusinessTenantNav'
import Header, { Wordmark } from '../../../../../../components/Header'
import { AdminGate, useBilling } from '../../../../../../components/providers/BillingProvider'
import {
  fetchBusinessById,
  fetchBusinessCycleBill,
  fetchComplexSettings,
  fetchCycleDetail,
} from '../../../../../../services/supabase'
import { getEvidenceObjectUrl } from '../../../../../../services/evidenceStore'
import { buildPlazaCrumbs } from '../../../../../../utils/breadcrumbs'
import { plazaPath } from '../../../../../../utils/plaza'
import {
  getCachedCycleShell,
  setCachedCycleShell,
  getCachedInvoice,
  setCachedInvoice,
} from '../../../../../../utils/tenantNavCache'

function InvoiceContent({
  businessId,
  cycleId,
  complexId,
  plazaSlug,
  plazaName,
  role,
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const fromParam = searchParams.get('from')
  const nav = useBusinessTenantNav()

  const cachedInvoice = getCachedInvoice(businessId, cycleId)
  const cachedShell = getCachedCycleShell(cycleId)

  const [payload, setPayload] = useState(() => (
    cachedInvoice
      ? { business: cachedInvoice.business, bill: cachedInvoice.bill, cycle: cachedInvoice.cycle }
      : null
  ))
  const [settings, setSettings] = useState(() => cachedShell?.settings || cachedInvoice?.settings || null)
  const [cycle, setCycle] = useState(() => cachedInvoice?.cycle || cachedShell?.cycle || null)
  const [evidenceUrl, setEvidenceUrl] = useState(() => cachedInvoice?.evidenceUrl || null)
  const [error, setError] = useState(null)
  const [bodyLoading, setBodyLoading] = useState(() => !cachedInvoice)

  const path = (p) => (plazaSlug ? plazaPath(plazaSlug, p) : p)

  const fromQuery = useMemo(() => {
    if (!fromParam || !fromParam.startsWith('/')) return ''
    return `?from=${encodeURIComponent(fromParam)}`
  }, [fromParam])

  // Settings / shell meta once per cycle (tenant list lives in layout provider)
  useEffect(() => {
    const cached = getCachedCycleShell(cycleId)
    if (cached?.settings) {
      setSettings(cached.settings)
      return undefined
    }

    let cancelled = false
    fetchCycleDetail(cycleId)
      .then(async (detail) => {
        if (cancelled) return
        const siblings = (detail || [])
          .filter(b => b.business_id != null)
          .map(b => ({
            id: b.business_id,
            name: b.business_name || 'Tenant',
          }))
        const first = siblings[0]
        let complexSettings = null
        if (first?.id) {
          const biz = await fetchBusinessById(first.id)
          if (cancelled) return
          if (biz?.complex_id) {
            complexSettings = await fetchComplexSettings(biz.complex_id)
          }
        }
        if (cancelled) return
        if (complexSettings) setSettings(complexSettings)
        setCachedCycleShell(cycleId, {
          ...(getCachedCycleShell(cycleId) || {}),
          siblings,
          settings: complexSettings,
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [cycleId])

  // Tenant invoice body — cache hit skips network
  useEffect(() => {
    let cancelled = false
    const hit = getCachedInvoice(businessId, cycleId)
    if (hit) {
      setPayload({ business: hit.business, bill: hit.bill, cycle: hit.cycle })
      setCycle(hit.cycle)
      if (hit.settings) setSettings(hit.settings)
      setEvidenceUrl(hit.evidenceUrl || null)
      setBodyLoading(false)
      setError(null)
      return undefined
    }

    setError(null)
    setBodyLoading(true)

    Promise.all([
      fetchBusinessById(businessId),
      fetchBusinessCycleBill(businessId, cycleId),
    ])
      .then(async ([business, pair]) => {
        if (cancelled) return
        if (!business || !pair?.bill || !pair?.cycle) {
          setError('Invoice not found.')
          setBodyLoading(false)
          return
        }
        if (complexId && business.complex_id !== complexId) {
          setError('Invoice not found.')
          setBodyLoading(false)
          return
        }
        const nextCycle = pair.cycle
        if (nextCycle.status && nextCycle.status !== 'published' && nextCycle.status !== 'concluded') {
          setError('Invoice not found.')
          setBodyLoading(false)
          return
        }

        let nextSettings = settings
        if (!nextSettings && business.complex_id) {
          try {
            nextSettings = await fetchComplexSettings(business.complex_id)
            if (!cancelled && nextSettings) setSettings(nextSettings)
          } catch {
            // ignore
          }
        }

        let nextEvidence = null
        if (pair.bill.evidence_file_id) {
          try {
            nextEvidence = await getEvidenceObjectUrl(pair.bill.evidence_file_id)
          } catch {
            // ignore
          }
        }
        if (cancelled) return

        setCycle(nextCycle)
        setPayload({ business, bill: pair.bill, cycle: nextCycle })
        setEvidenceUrl(nextEvidence)
        setBodyLoading(false)
        setCachedInvoice(businessId, cycleId, {
          business,
          bill: pair.bill,
          cycle: nextCycle,
          settings: nextSettings || null,
          evidenceUrl: nextEvidence,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load invoice.')
          setBodyLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [businessId, cycleId, complexId])

  const tenants = nav?.tenants?.length ? nav.tenants : []

  useEffect(() => {
    for (const t of tenants) {
      if (t.href) router.prefetch(t.href)
    }
    if (plazaSlug && cycleId) {
      router.prefetch(path(`/cycles/${cycleId}/invoices`))
    }
  }, [tenants, router, plazaSlug, cycleId])

  const activeName = payload?.business?.name
    || tenants.find(t => String(t.id) === String(businessId))?.name
    || 'Tenant'

  const crumbs = buildPlazaCrumbs({
    role,
    plazaSlug,
    plazaName,
    trail: [
      {
        label: cycle?.name || payload?.cycle?.name || 'Cycle',
        href: path(`/cycles/${cycleId}`),
      },
      {
        label: activeName,
        href: `${path(`/businesses/${businessId}`)}${fromQuery}`,
      },
      { label: 'Invoice' },
    ],
  })

  if (!payload && bodyLoading && !tenants.length) {
    return (
      <div className="status-screen">
        <div className="spinner" />
        <p>Loading invoice...</p>
      </div>
    )
  }

  return (
    <main className="main main--invoice">
      <div className="page-nav no-print">
        <div className="invoice-nav-lead">
          <Breadcrumbs items={crumbs} />
        </div>
        <div className="invoice-nav-actions">
          <Link
            href={path(`/cycles/${cycleId}/invoices`)}
            className="btn btn-sm btn-ghost"
            prefetch
            scroll={false}
          >
            View all
          </Link>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => window.print()}
            disabled={!payload?.bill}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {tenants.length > 1 && (
        <div className="invoice-tenant-nav no-print">
          <TenantSwitcher
            tenants={tenants}
            currentId={businessId}
            ariaLabel="Switch tenant invoice"
          />
        </div>
      )}

      {error && !payload && (
        <p className="error-text">{error}</p>
      )}

      {!error && !payload && bodyLoading && (
        <div className="invoice-body-loading">
          <div className="spinner" />
          <p>Loading invoice...</p>
        </div>
      )}

      {payload && (
        <InvoiceCard
          business={payload.business}
          bill={payload.bill}
          cycle={payload.cycle}
          settings={settings}
          evidenceUrl={evidenceUrl}
          compact
          loading={bodyLoading}
        />
      )}
    </main>
  )
}

function PublicInvoiceShell({ businessId, cycleId, plazaSlug }) {
  return (
    <div className="app">
      <header className="header no-print">
        <div className="header-inner">
          <div className="logo">
            <Wordmark />
          </div>
        </div>
      </header>
      <Suspense fallback={
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading invoice...</p>
        </div>
      }>
        <InvoiceContent businessId={businessId} cycleId={cycleId} plazaSlug={plazaSlug} />
      </Suspense>
    </div>
  )
}

function AdminInvoiceShell({ businessId, cycleId, plazaSlug }) {
  const { complex, role } = useBilling()

  return (
    <AdminGate showHome>
      <Suspense fallback={null}>
        <InvoiceContent
          businessId={businessId}
          cycleId={cycleId}
          complexId={complex?.id}
          plazaSlug={plazaSlug}
          plazaName={complex?.name}
          role={role}
        />
      </Suspense>
    </AdminGate>
  )
}

function InvoicePageInner() {
  const params = useParams()
  const businessId = params.id
  const cycleId = params.cycleId
  const plazaSlug = params.plazaSlug
  const { session, ready } = useBilling()

  if (!ready) {
    return (
      <div className="app">
        <Header />
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <PublicInvoiceShell businessId={businessId} cycleId={cycleId} plazaSlug={plazaSlug} />
  }

  return <AdminInvoiceShell businessId={businessId} cycleId={cycleId} plazaSlug={plazaSlug} />
}

export default function InvoicePageClient() {
  return <InvoicePageInner />
}
