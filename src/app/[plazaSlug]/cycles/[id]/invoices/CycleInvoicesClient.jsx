'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Breadcrumbs from '../../../../../components/Breadcrumbs'
import Header from '../../../../../components/Header'
import InvoiceCard from '../../../../../components/InvoiceCard'
import { AdminGate, useBilling } from '../../../../../components/providers/BillingProvider'
import {
  fetchBusinessById,
  fetchCycleById,
  fetchCycleDetail,
  fetchComplexSettings,
  fetchPublicCycle,
} from '../../../../../services/supabase'
import { getEvidenceObjectUrl } from '../../../../../services/evidenceStore'
import { buildPlazaCrumbs } from '../../../../../utils/breadcrumbs'
import { plazaPath } from '../../../../../utils/plaza'

function StackedInvoices({ cycleId, complexId, plazaSlug, role, plazaName }) {
  const [cycle, setCycle] = useState(null)
  const [rows, setRows] = useState(null)
  const [settings, setSettings] = useState(null)
  const [evidenceMap, setEvidenceMap] = useState({})
  const [error, setError] = useState(null)

  const path = (p) => (plazaSlug ? plazaPath(plazaSlug, p) : p)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setRows(null)

    Promise.all([
      complexId ? fetchCycleById(cycleId, complexId) : fetchPublicCycle(cycleId),
      fetchCycleDetail(cycleId),
    ])
      .then(async ([cyc, detail]) => {
        if (cancelled) return
        if (!cyc || (complexId && cyc.complex_id !== complexId)) {
          setError('Cycle not found.')
          return
        }
        if (cyc.status && cyc.status !== 'published' && cyc.status !== 'concluded') {
          setError('Cycle not found.')
          return
        }

        const bills = (detail || []).filter(b => b.business_id != null)
        const businesses = await Promise.all(
          bills.map(b => fetchBusinessById(b.business_id)),
        )
        if (cancelled) return

        const stacked = bills.map((bill, i) => ({
          bill,
          business: businesses[i] || { id: bill.business_id, name: bill.business_name },
        }))

        const complexSettings = await fetchComplexSettings(cyc.complex_id)
        if (cancelled) return

        const urls = {}
        for (const { bill } of stacked) {
          if (bill.evidence_file_id) {
            try {
              const url = await getEvidenceObjectUrl(bill.evidence_file_id)
              if (url) urls[bill.id] = url
            } catch {
              // ignore
            }
          }
        }
        if (cancelled) return

        setCycle(cyc)
        setRows(stacked)
        setSettings(complexSettings)
        setEvidenceMap(urls)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load invoices.')
      })

    return () => {
      cancelled = true
    }
  }, [cycleId, complexId])

  useEffect(() => {
    return () => {
      Object.values(evidenceMap).forEach((url) => {
        try {
          URL.revokeObjectURL(url)
        } catch {
          // ignore
        }
      })
    }
  }, [evidenceMap])

  const jumpTenants = useMemo(() => {
    if (!rows) return []
    return rows.map(({ business, bill }) => ({
      id: business.id,
      name: bill.business_name || business.name || 'Tenant',
      href: `#invoice-${business.id}`,
    }))
  }, [rows])

  const crumbs = buildPlazaCrumbs({
    role,
    plazaSlug,
    plazaName,
    trail: [
      {
        label: cycle?.name || 'Cycle',
        href: path(`/cycles/${cycleId}`),
      },
      { label: 'All invoices' },
    ],
  })

  if (error) {
    return <p className="error-text" style={{ padding: 24 }}>{error}</p>
  }

  if (!cycle || !rows) {
    return (
      <div className="status-screen">
        <div className="spinner" />
        <p>Loading invoices...</p>
      </div>
    )
  }

  return (
    <main className="main main--stacked-invoices">
      <div className="page-nav page-nav--row no-print">
        <Breadcrumbs items={crumbs} />
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => window.print()}
        >
          Print / Save PDF
        </button>
      </div>

      <header className="cycle-page-titles no-print">
        <h1 className="page-title">All invoices</h1>
        <p className="page-lede">
          {cycle.name || 'Billing cycle'}
          {' · '}
          {new Date(cycle.cycle_date).toLocaleDateString('en-NG', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </p>
      </header>

      {jumpTenants.length > 1 && (
        <nav className="stacked-invoices-jump no-print" aria-label="Jump to tenant invoice">
          {jumpTenants.map(t => (
            <a key={t.id} href={t.href} className="stacked-invoices-jump-link">
              {t.name}
            </a>
          ))}
        </nav>
      )}

      <div className="stacked-invoices-list">
        {rows.map(({ business, bill }) => (
          <section
            key={bill.id}
            id={`invoice-${business.id}`}
            className="stacked-invoice-block"
          >
            <div className="stacked-invoice-toolbar no-print">
              <Link
                href={path(`/businesses/${business.id}/invoices/${cycleId}`)}
                className="btn btn-sm btn-ghost"
                prefetch
              >
                Open single view
              </Link>
            </div>
            <InvoiceCard
              business={business}
              bill={bill}
              cycle={cycle}
              settings={settings}
              evidenceUrl={evidenceMap[bill.id] || null}
              compact
            />
          </section>
        ))}
      </div>
    </main>
  )
}

function AdminShell({ cycleId, plazaSlug }) {
  const { complex, role } = useBilling()
  return (
    <AdminGate showHome>
      <StackedInvoices
        cycleId={cycleId}
        complexId={complex?.id}
        plazaSlug={plazaSlug}
        role={role}
        plazaName={complex?.name}
      />
    </AdminGate>
  )
}

function PublicShell({ cycleId, plazaSlug }) {
  return (
    <div className="app">
      <Header />
      <StackedInvoices cycleId={cycleId} plazaSlug={plazaSlug} />
    </div>
  )
}

function CycleInvoicesInner() {
  const params = useParams()
  const cycleId = params.id
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
    return <PublicShell cycleId={cycleId} plazaSlug={plazaSlug} />
  }

  return <AdminShell cycleId={cycleId} plazaSlug={plazaSlug} />
}

export default function CycleInvoicesClient() {
  return (
    <Suspense fallback={
      <div className="status-screen">
        <div className="spinner" />
        <p>Loading invoices...</p>
      </div>
    }>
      <CycleInvoicesInner />
    </Suspense>
  )
}
