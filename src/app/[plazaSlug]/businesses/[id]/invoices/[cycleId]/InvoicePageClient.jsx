'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import InvoiceCard from '../../../../../../components/InvoiceCard'
import Header, { Wordmark } from '../../../../../../components/Header'
import { AdminGate, useBilling } from '../../../../../../components/providers/BillingProvider'
import {
  fetchBusinessById,
  fetchBusinessCycleBill,
  fetchComplexSettings,
} from '../../../../../../services/supabase'
import { getEvidenceObjectUrl } from '../../../../../../services/evidenceStore'
import { navigate } from '../../../../../../utils/navigation'

function InvoiceContent({ businessId, cycleId, complexId, plazaSlug }) {
  const searchParams = useSearchParams()
  const fromParam = searchParams.get('from')
  const [payload, setPayload] = useState(null)
  const [settings, setSettings] = useState(null)
  const [evidenceUrl, setEvidenceUrl] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setPayload(null)

    Promise.all([
      fetchBusinessById(businessId),
      fetchBusinessCycleBill(businessId, cycleId),
    ])
      .then(async ([business, pair]) => {
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

        setPayload({ business, bill: pair.bill, cycle })
        setSettings(complexSettings)

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

  const backToTimeline = () => {
    const base = plazaSlug
      ? `/${plazaSlug}/businesses/${businessId}`
      : `/businesses/${businessId}`
    const from = fromParam && fromParam.startsWith('/')
      ? `?from=${encodeURIComponent(fromParam)}`
      : ''
    navigate(`${base}${from}`)
  }

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
      onBack={backToTimeline}
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
  const { complex } = useBilling()

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
