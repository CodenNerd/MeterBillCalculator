'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  fetchConcludedCycles,
  fetchPublishedCycles,
} from '../services/supabase'
import { formatNaira } from '../utils/billing'
import { plazaPath } from '../utils/plaza'

function CycleRow({ cycle, href }) {
  return (
    <Link href={href} className="home-cycle-row" prefetch scroll={false}>
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
    </Link>
  )
}

export default function Home({
  complexId,
  complexName,
  plazaSlug,
  href,
  onRefreshKey,
  onStartCycle,
  bannerEnabled,
  bannerText,
  breadcrumbs,
  readOnly = false,
}) {
  const [published, setPublished] = useState(null)
  const [concluded, setConcluded] = useState(null)
  const [error, setError] = useState(null)
  const path = (p) => (href ? href(p) : plazaPath(plazaSlug, p))

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

  return (
    <main className="main main--home">
      {breadcrumbs}

      {bannerEnabled && bannerText?.trim() && (
        <div className="home-banner" role="status">
          {bannerText.trim()}
        </div>
      )}

      {!readOnly && (
        <section className="home-hero-band">
          <div className="home-hero-copy-block">
            <p className="home-kicker">{complexName || 'Your plaza'}</p>
            <h1 className="home-hero-title">Next billing cycle</h1>
            <p className="home-hero-copy">
              Start a blank worksheet. Previous meter readings are taken from the
              latest cycle by date (then last published). Edit open cycles from the list below.
            </p>
          </div>
          <div className="home-hero-cta">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => onStartCycle?.()}
            >
              Start cycle
            </button>
          </div>
        </section>
      )}

      {readOnly && (
        <section className="home-hero-band">
          <div className="home-hero-copy-block">
            <p className="home-kicker">{complexName || 'Plaza'}</p>
            <h1 className="home-hero-title">Billing cycles</h1>
            <p className="home-hero-copy">
              View published and past cycles for this plaza. Open a cycle to see bills,
              tenant timelines, and invoices.
            </p>
          </div>
        </section>
      )}

      {published && published.length > 0 && (
        <section className="home-published-strip">
          <div className="readings-section-head">
            <div>
              <h2 className="section-title">Open cycles</h2>
              <p className="section-sub">
                {readOnly ? 'Published cycles' : 'Published — open to edit or conclude'}
              </p>
            </div>
          </div>
          <div className="home-list">
            {published.map(cycle => (
              <CycleRow
                key={cycle.id}
                cycle={cycle}
                href={path(`/cycles/${cycle.id}`)}
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
              {readOnly
                ? 'No concluded cycles yet.'
                : 'No concluded cycles yet. Publish a draft, then conclude it to lock readings here.'}
            </div>
          </div>
        )}

        {concluded && concluded.length > 0 && (
          <div className="home-list">
            {concluded.map(cycle => (
              <CycleRow
                key={cycle.id}
                cycle={cycle}
                href={path(`/cycles/${cycle.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
