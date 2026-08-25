'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import InvoiceCard from '../../../../../../components/InvoiceCard'
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
  const [payload, setPayload] = useState(null)
  const [settings, setSettings] = useState(null)
  const [siblings, setSiblings] = useState([])
  const [evidenceUrl, setEvidenceUrl] = useState(null)
  const [error, setError] = useState(null)

  const path = (p) => (plazaSlug ? plazaPath(plazaSlug, p) : p)

  const fromQuery = useMemo(() => {
    if (!fromParam || !fromParam.startsWith('/')) return ''
    return `?from=${encodeURIComponent(fromParam)}`
  }, [fromParam])

  useEffect(() => {
    let cancelled = false
    setError(null)
    setPayload(null)
    setEvidenceUrl(null)

    Promise.all([
      fetchBusinessById(businessId),
      fetchBusinessCycleBill(businessId, cycleId),
      fetchCycleDetail(cycleId),
    ])
      .then(async ([business, pair, detail]) => {
        if (cancelled) return
        if (!business || !pair?.bill || !pair?.cycle) {
          setError('Invoice not found.')
          return
        }
        if (complexId && business.complex_id !== complexId) {
          setError('Invoice not found.')
          return
        }
        const cycle = pair.cycle
        if (cycle.status && cycle.status !== 'published' && cycle.status !== 'concluded') {
          setError('Invoice not found.')
          return
        }

        const complexSettings = await fetchComplexSettings(business.complex_id)
        if (cancelled) return

        const tenantRows = (detail || [])
          .filter(b => b.business_id != null)
          .map(b => ({
            id: b.business_id,
            name: b.business_name || 'Tenant',
          }))

        setPayload({ business, bill: pair.bill, cycle })
        setSettings(complexSettings)
        setSiblings(tenantRows)

        if (pair.bill.evidence_file_id) {
          try {
            const url = await getEvidenceObjectUrl(pair.bill.evidence_file_id)
            if (!cancelled) setEvidenceUrl(url)
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load invoice.')
      })

    return () => {
      cancelled = true
    }
  }, [businessId, cycleId, complexId])

  useEffect(() => {
    return () => {
      if (evidenceUrl) URL.revokeObjectURL(evidenceUrl)
    }
  }, [evidenceUrl])

  const tenants = useMemo(() => (
    siblings.map(t => ({
      id: t.id,
      name: t.name,
      href: `${path(`/businesses/${t.id}/invoices/${cycleId}`)}${fromQuery}`,
    }))
  ), [siblings, plazaSlug, cycleId, fromQuery])

  useEffect(() => {
    for (const t of tenants) {
      if (t.href) router.prefetch(t.href)
    }
    if (plazaSlug && cycleId) {
      router.prefetch(path(`/cycles/${cycleId}/invoices`))
    }
  }, [tenants, router, plazaSlug, cycleId])

  const crumbs = buildPlazaCrumbs({
    role,
    plazaSlug,
    plazaName,
    trail: [
      {
        label: payload?.cycle?.name || 'Cycle',
        href: path(`/cycles/${cycleId}`),
      },
      {
        label: payload?.business?.name || 'Tenant',
        href: `${path(`/businesses/${businessId}`)}${fromQuery}`,
      },
      { label: 'Invoice' },
    ],
  })

  if (error) {
    return <p className="error-text" style={{ padding: 24 }}>{error}</p>
  }

  if (!payload) {
    return (
      <div className="status-screen">
        <div className="spinner" />
        <p>Loading invoice...</p>
      </div>
    )
  }

  return (
    <InvoiceCard
      business={payload.business}
      bill={payload.bill}
      cycle={payload.cycle}
      settings={settings}
      evidenceUrl={evidenceUrl}
      breadcrumbs={crumbs}
      tenants={tenants}
      viewAllHref={path(`/cycles/${cycleId}/invoices`)}
    />
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
      <Suspense fallback={
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading invoice...</p>
        </div>
      }>
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted || !ready) {
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
