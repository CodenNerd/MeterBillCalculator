'use client'

import { useEffect, useState } from 'react'
import {
  fetchConcludedCycles,
  fetchPublishedCycles,
} from '../services/supabase'
import { formatNaira, hasDraftProgress } from '../utils/billing'
import { navigate } from '../utils/navigation'

function CycleRow({ cycle, onClick }) {
  return (
    <button
      type="button"
      className="home-cycle-row"
      onClick={onClick}
    >
      <span className="home-cycle-date">
        <span className="home-cycle-name">{cycle.name || 'Billing cycle'}</span>
        <span className="home-cycle-when muted">
          {new Date(cycle.cycle_date).toLocaleDateString('en-NG', {
            month: 'long',
            year: 'numeric',
            day: 'numeric',
          })}
        </span>
      </span>
      <span className="home-cycle-meta">
        <span className="home-cycle-bill-label">NEPA office bill</span>
        <span className="home-cycle-bill">{formatNaira(cycle.actual_bill)}</span>
      </span>
      <span className={`home-cycle-extra ${cycle.line_loss >= 0 ? 'loss-positive' : 'loss-negative'}`}>
        <span className="home-cycle-bill-label">
          {cycle.line_loss >= 0 ? 'Offset' : 'Surplus'}
        </span>
        <span>
          {cycle.line_loss >= 0 ? '+' : '−'}{formatNaira(Math.abs(cycle.line_loss))}
        </span>
      </span>
      <span className="home-cycle-chevron" aria-hidden="true">›</span>
    </button>
  )
}

export default function Home({
  complexId,
  complexName,
  plazaSlug,
  href,
  current,
  misc,
  notes,
  actualBill,
  activeCycleId,
  onRefreshKey,
  onContinuePublished,
  bannerEnabled,
  bannerText,
}) {
  const [published, setPublished] = useState(null)
  const [concluded, setConcluded] = useState(null)
  const [error, setError] = useState(null)
  const draftOpen = hasDraftProgress(current, misc, actualBill, notes)
  const go = (path) => navigate(href ? href(path) : path)

  useEffect(() => {
    if (!complexId) return
    setPublished(null)
    setConcluded(null)
    setError(null)
    Promise.all([
      fetchPublishedCycles(complexId),
      fetchConcludedCycles(complexId),
    ])
      .then(([pub, past]) => {
        setPublished(pub)
        setConcluded(past)
      })
      .catch(() => setError('Failed to load billing months.'))
  }, [complexId, onRefreshKey])

  const latestPublished = published?.[0] || null
  const showDraftCallout = draftOpen
  const showPublishedCallout = !draftOpen && latestPublished

  return (
    <main className="main main--home">
      {bannerEnabled && bannerText?.trim() && (
        <div className="home-banner" role="status">
          {bannerText.trim()}
        </div>
      )}

      <section className="home-hero-band">
        <div className="home-hero-copy-block">
          <p className="home-kicker">{complexName || 'Your complex'}</p>
          <h1 className="home-hero-title">
            {showDraftCallout
              ? 'Continue this billing cycle'
              : showPublishedCallout
                ? 'Open published cycle'
                : 'Next billing cycle'}
          </h1>
          <p className="home-hero-copy">
            {showDraftCallout
              ? activeCycleId
                ? 'You are editing a published cycle. Open the worksheet or bills table to continue.'
                : 'You have unsaved readings or a draft office bill. Pick up where you left off.'
              : showPublishedCallout
                ? `${latestPublished.name || 'Published cycle'} is live. Edit readings or conclude when ready.`
                : 'Enter each business\'s current meter reading and the office bill. Publish when the table looks right.'}
          </p>
        </div>
        <div className="home-hero-cta">
          {showPublishedCallout ? (
            <div className="home-cta-stack">
              <button
                className="btn btn-primary btn-lg"
                onClick={() => onContinuePublished?.(latestPublished.id)}
              >
                Continue published
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => go(`/cycles/${latestPublished.id}`)}
              >
                View bills
              </button>
            </div>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={() => go('/cycle')}>
              {showDraftCallout ? 'Continue cycle' : 'Start cycle'}
            </button>
          )}
        </div>
      </section>

      {published && published.length > 0 && draftOpen && (
        <section className="home-published-strip">
          <div className="readings-section-head">
            <div>
              <h2 className="section-title">Published</h2>
              <p className="section-sub">Open to edit or conclude</p>
            </div>
          </div>
          <div className="home-list">
            {published.map(cycle => (
              <CycleRow
                key={cycle.id}
                cycle={cycle}
                onClick={() => go(`/cycles/${cycle.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="home-months">
        <div className="readings-section-head">
          <div>
            <h2 className="section-title">Past months</h2>
            <p className="section-sub">Concluded cycles only</p>
          </div>
        </div>

        {error && <p className="error-text home-msg">{error}</p>}

        {!error && concluded === null && (
          <div className="skeleton-list" aria-hidden="true">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        )}

        {!error && concluded && concluded.length === 0 && (
          <div className="home-list">
            <div className="home-empty">
              <div className="home-empty-mark" aria-hidden="true" />
              No concluded cycles yet. Publish a draft, then conclude it to lock readings here.
            </div>
          </div>
        )}

        {concluded && concluded.length > 0 && (
          <div className="home-list">
            {concluded.map(cycle => (
              <CycleRow
                key={cycle.id}
                cycle={cycle}
                onClick={() => go(`/cycles/${cycle.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
