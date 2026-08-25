'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Breadcrumbs from './Breadcrumbs'
import TenantSwitcher from './TenantSwitcher'
import { useBusinessTenantNav } from './BusinessTenantNav'
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
import {
  getCachedBusinesses,
  setCachedBusinesses,
  getCachedTimeline,
  setCachedTimeline,
} from '../utils/tenantNavCache'

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
  const nav = useBusinessTenantNav()

  const cached = getCachedTimeline(businessId)
  const [business, setBusiness] = useState(() => cached?.business || null)
  const [items, setItems] = useState(() => cached?.items ?? null)
  const [error, setError] = useState(null)
  const [thumbs, setThumbs] = useState(() => cached?.thumbs || {})
  const [bodyLoading, setBodyLoading] = useState(() => !cached)

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

  // Register plaza complex with layout provider (persists across id changes)
  const registerPlazaComplex = nav?.registerPlazaComplex
  useEffect(() => {
    if (complexId) {
      registerPlazaComplex?.(complexId)
      return
    }
    if (business?.complex_id) {
      registerPlazaComplex?.(business.complex_id)
    }
  }, [complexId, business?.complex_id, registerPlazaComplex])

  useEffect(() => {
    let cancelled = false
    const hit = getCachedTimeline(businessId)
    if (hit) {
      setBusiness(hit.business)
      setItems(hit.items)
      setThumbs(hit.thumbs || {})
      setBodyLoading(false)
      setError(null)
      return undefined
    }

    setError(null)
    setBodyLoading(true)

    Promise.all([
      fetchBusinessById(businessId),
      fetchBusinessBillTimeline(businessId),
    ])
      .then(async ([biz, timeline]) => {
        if (cancelled) return
        if (!biz || (complexId && biz.complex_id !== complexId)) {
          setError('Business not found.')
          setBodyLoading(false)
          return
        }
        const visible = (timeline || []).filter(({ cycle }) => isPublicCycle(cycle))
        setBusiness(biz)
        setItems(visible)
        setBodyLoading(false)
        nav?.registerPlazaComplex?.(biz.complex_id)

        if (!getCachedBusinesses(biz.complex_id)) {
          try {
            const list = await fetchBusinesses(biz.complex_id)
            if (!cancelled) setCachedBusinesses(biz.complex_id, list || [])
          } catch {
            // ignore
          }
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
        if (cancelled) return
        setThumbs(urls)
        setCachedTimeline(businessId, {
          business: biz,
          items: visible,
          thumbs: urls,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load bill history.')
          setBodyLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [businessId, complexId])

  const tenants = nav?.tenants?.length
    ? nav.tenants
    : []

  const crumbLabel = business?.name
    || tenants.find(b => String(b.id) === String(businessId))?.name
    || 'Tenant'

  const crumbs = buildPlazaCrumbs({
    role: isPublic ? undefined : role,
    plazaSlug,
    plazaName,
    trail: [
      ...(cycleFrom
        ? [{ label: 'Cycle', href: path(`/cycles/${cycleFrom}`) }]
        : []),
      { label: crumbLabel },
    ],
  })

  return (
    <main className="main">
      <div className="page-nav">
        <Breadcrumbs items={crumbs} />
      </div>

      {tenants.length > 1 && (
        <TenantSwitcher
          tenants={tenants}
          currentId={businessId}
          ariaLabel="Switch tenant"
        />
      )}

      {error && <p className="error-text">{error}</p>}

      {!error && !business && bodyLoading && (
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading timeline...</p>
        </div>
      )}

      {!error && (business || !bodyLoading) && (
        <div className={`timeline-body ${bodyLoading ? 'is-soft-loading' : ''}`}>
          <header className="cycle-page-titles">
            <h1 className="page-title">{business?.name || crumbLabel}</h1>
            <p className="page-lede">
              Bill timeline
              {business ? (
                <>
                  {' · Previous reading on file: '}
                  <span className="mono">{formatKwh(business.previous_reading)}</span>
                </>
              ) : null}
            </p>
          </header>

          {bodyLoading && !items && (
            <div className="invoice-body-loading">
              <div className="spinner" />
              <p>Loading timeline...</p>
            </div>
          )}

          {items && items.length === 0 && !bodyLoading && (
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
                            && business?.name
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
                          scroll={false}
                        >
                          View cycle overview
                        </Link>
                        <Link
                          href={`${path(`/businesses/${businessId}/invoices/${cycle.id}`)}${fromQuery}`}
                          className="btn btn-sm btn-primary"
                          prefetch
                          scroll={false}
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
        </div>
      )}
    </main>
  )
}
