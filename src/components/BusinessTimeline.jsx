'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Breadcrumbs from './Breadcrumbs'
import TenantSwitcher from './TenantSwitcher'
import {
  fetchBusinessBillTimeline,
  fetchBusinessById,
  fetchBusinesses,
} from '../services/supabase'
import { getEvidenceObjectUrl } from '../services/evidenceStore'
import {
  formatKwh,
  formatNaira,
  paymentStatusLabel,
  PAYMENT_AWAITING,
  PAYMENT_PAID,
  PAYMENT_UNPAID,
} from '../utils/billing'
import { buildPlazaCrumbs } from '../utils/breadcrumbs'
import { plazaPath } from '../utils/plaza'

function statusClass(cycle, bill) {
  const status = bill.payment_status || PAYMENT_AWAITING
  if (cycle.status === 'published' && status === PAYMENT_AWAITING) return 'timeline-card--active'
  if (status === PAYMENT_PAID) return 'timeline-card--paid'
  if (status === PAYMENT_UNPAID) return 'timeline-card--unpaid'
  return ''
}

function isPublicCycle(cycle) {
  if (!cycle) return false
  if (!cycle.status) return true
  return cycle.status === 'published' || cycle.status === 'concluded'
}

export default function BusinessTimeline({
  businessId,
  complexId,
  plazaSlug,
  plazaName,
  role,
  isPublic = false,
}) {
  const searchParams = useSearchParams()
  const fromParam = searchParams.get('from')
  const [business, setBusiness] = useState(null)
  const [siblings, setSiblings] = useState([])
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [thumbs, setThumbs] = useState({})

  const path = (p) => (plazaSlug ? plazaPath(plazaSlug, p) : p)

  const fromQuery = useMemo(() => {
    if (!fromParam || !fromParam.startsWith('/')) return ''
    return `?from=${encodeURIComponent(fromParam)}`
  }, [fromParam])

  const cycleFrom = useMemo(() => {
    if (!fromParam || !fromParam.startsWith('/')) return null
    const match = fromParam.match(/\/cycles\/([^/?#]+)/)
    return match ? match[1] : null
  }, [fromParam])

  useEffect(() => {
    let cancelled = false
    setError(null)
    setItems(null)
    Promise.all([
      fetchBusinessById(businessId),
      fetchBusinessBillTimeline(businessId),
    ])
      .then(async ([biz, timeline]) => {
        if (cancelled) return
        if (!biz || (complexId && biz.complex_id !== complexId)) {
          setError('Business not found.')
          return
        }
        setBusiness(biz)
        const visible = (timeline || []).filter(({ cycle }) => isPublicCycle(cycle))
        setItems(visible)

        try {
          const list = await fetchBusinesses(biz.complex_id)
          if (!cancelled) setSiblings(list || [])
        } catch {
          if (!cancelled) setSiblings([])
        }

        const urls = {}
        for (const { bill } of visible) {
          if (bill.evidence_file_id) {
            try {
              const url = await getEvidenceObjectUrl(bill.evidence_file_id)
              if (url) urls[bill.id] = url
            } catch {
              // ignore
            }
          }
        }
        if (!cancelled) setThumbs(urls)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load bill history.')
      })

    return () => {
      cancelled = true
    }
  }, [businessId, complexId])

  const tenants = useMemo(() => (
    (siblings || []).map(b => ({
      id: b.id,
      name: b.name,
      href: `${path(`/businesses/${b.id}`)}${fromQuery}`,
    }))
  ), [siblings, plazaSlug, fromQuery])

  const crumbs = buildPlazaCrumbs({
    role: isPublic ? undefined : role,
    plazaSlug,
    plazaName,
    trail: [
      ...(cycleFrom
        ? [{ label: 'Cycle', href: path(`/cycles/${cycleFrom}`) }]
        : []),
      { label: business?.name || 'Tenant' },
    ],
  })

  return (
    <main className="main">
      <div className="page-nav">
        <Breadcrumbs items={crumbs} />
      </div>

      {error && <p className="error-text">{error}</p>}
      {!error && !business && (
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading timeline...</p>
        </div>
      )}

      {business && (
        <>
          <header className="cycle-page-titles">
            <h1 className="page-title">{business.name}</h1>
            <p className="page-lede">
              Bill timeline · Previous reading on file:{' '}
              <span className="mono">{formatKwh(business.previous_reading)}</span>
            </p>
          </header>

          <TenantSwitcher
            tenants={tenants}
            currentId={businessId}
            ariaLabel="Switch tenant"
          />

          {items && items.length === 0 && (
            <div className="empty-state empty-state--panel">
              No bills recorded for this business yet.
            </div>
          )}

          {items && items.length > 0 && (
            <ol className="timeline-rail">
              {items.map(({ bill, cycle }) => {
                const payStatus = bill.payment_status || PAYMENT_AWAITING
                const label = paymentStatusLabel(payStatus, cycle.status)
                return (
                  <li key={bill.id} className="timeline-item">
                    <div className="timeline-dot" aria-hidden="true" />
                    <article className={`timeline-card ${statusClass(cycle, bill)}`}>
                      <div className="timeline-card-head">
                        <div>
                          <strong>{cycle.name || 'Billing cycle'}</strong>
                          <p className="muted">
                            {new Date(cycle.cycle_date).toLocaleDateString('en-NG', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                            {' · '}
                            {cycle.status === 'published' ? 'Published' : 'Concluded'}
                          </p>
                          {bill.business_name
                            && business.name
                            && bill.business_name.trim() !== business.name.trim() && (
                            <p className="muted timeline-tenant-snap">
                              Billed as <strong>{bill.business_name}</strong>
                            </p>
                          )}
                        </div>
                        <span className="mono amount">{formatNaira(bill.final_amount)}</span>
                      </div>

                      <div className={`payment-badge payment-badge--${payStatus}`}>
                        {label}
                      </div>

                      <div className="timeline-card-meta">
                        <span>Used: <strong className="mono">{formatKwh(bill.units)}</strong></span>
                        <span>Energy: <strong className="mono">{formatNaira(bill.unit_amount)}</strong></span>
                        <span>Misc: <strong className="mono">{formatNaira(bill.misc)}</strong></span>
                        <span>
                          Offset share:{' '}
                          <strong className="mono">{formatNaira(bill.line_loss_share)}</strong>
                        </span>
                      </div>

                      {(bill.evidence_note || thumbs[bill.id]) && (
                        <div className="timeline-evidence">
                          {bill.evidence_note && <p>{bill.evidence_note}</p>}
                          {thumbs[bill.id] && (
                            <img src={thumbs[bill.id]} alt="Payment evidence" className="evidence-thumb" />
                          )}
                        </div>
                      )}

                      <div className="timeline-card-actions">
                        <Link
                          href={path(`/cycles/${cycle.id}`)}
                          className="btn btn-sm btn-ghost"
                          prefetch
                        >
                          View cycle overview
                        </Link>
                        <Link
                          href={`${path(`/businesses/${businessId}/invoices/${cycle.id}`)}${fromQuery}`}
                          className="btn btn-sm btn-primary"
                          prefetch
                        >
                          View as invoice
                        </Link>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ol>
          )}
        </>
      )}
    </main>
  )
}
