'use client'

import { useEffect, useState } from 'react'
import {
  fetchBusinessBillTimeline,
  fetchBusinessById,
} from '../services/supabase'
import { getEvidenceObjectUrl } from '../services/evidenceStore'
import { formatKwh, formatNaira } from '../utils/billing'
import { navigate } from '../utils/navigation'

export default function BusinessTimeline({ businessId, complexId }) {
  const [business, setBusiness] = useState(null)
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [thumbs, setThumbs] = useState({})

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
        setItems(timeline)

        const urls = {}
        for (const { bill } of timeline) {
          if (bill.evidence_file_id) {
            try {
              const url = await getEvidenceObjectUrl(bill.evidence_file_id)
              if (url) urls[bill.id] = url
            } catch {
              // ignore missing evidence
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
      Object.values(thumbs).forEach(url => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, complexId])

  return (
    <main className="main">
      <div className="page-nav">
        <button type="button" className="btn-text" onClick={() => navigate('/')}>
          ← Home
        </button>
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

          {items && items.length === 0 && (
            <div className="empty-state empty-state--panel">
              No bills recorded for this business yet.
            </div>
          )}

          {items && items.length > 0 && (
            <div className="timeline-list">
              {items.map(({ bill, cycle }) => (
                <button
                  key={bill.id}
                  type="button"
                  className="timeline-card"
                  onClick={() => navigate(`/cycles/${cycle.id}`)}
                >
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
                    </div>
                    <span className="mono amount">{formatNaira(bill.final_amount)}</span>
                  </div>
                  <div className="timeline-card-meta">
                    <span>Used: <strong className="mono">{formatKwh(bill.units)}</strong></span>
                    <span>Energy: <strong className="mono">{formatNaira(bill.unit_amount)}</strong></span>
                    <span>Misc: <strong className="mono">{formatNaira(bill.misc)}</strong></span>
                    <span>
                      Share:{' '}
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
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
