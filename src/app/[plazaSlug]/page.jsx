'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Home from '../../components/Home'
import Breadcrumbs from '../../components/Breadcrumbs'
import Header, { Wordmark } from '../../components/Header'
import { AdminGate, useBilling } from '../../components/providers/BillingProvider'
import { navigate } from '../../utils/navigation'
import { buildPlazaCrumbs } from '../../utils/breadcrumbs'
import { fetchPlazaBySlug } from '../../services/supabase'
import { plazaPath } from '../../utils/plaza'

function PublicPlazaHome({ plazaSlug }) {
  const [plaza, setPlaza] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!plazaSlug) {
      setError('Plaza not found')
      return undefined
    }
    fetchPlazaBySlug(plazaSlug)
      .then((row) => {
        if (cancelled) return
        if (!row) setError('Plaza not found')
        else setPlaza(row)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load plaza.')
      })
    return () => {
      cancelled = true
    }
  }, [plazaSlug])

  if (error) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-inner">
            <div className="logo"><Wordmark /></div>
          </div>
        </header>
        <div className="status-screen">
          <p className="error-text">{error}</p>
        </div>
      </div>
    )
  }

  if (!plaza) {
    return (
      <div className="app">
        <Header />
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading plaza...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Header
        complexName={plaza.name}
        plazaSlug={plaza.slug || plazaSlug}
        ratePerUnit={plaza.rate_per_unit}
        homeHref={plazaPath(plaza.slug || plazaSlug, '/')}
      />
      <Home
        complexId={plaza.id}
        complexName={plaza.name}
        plazaSlug={plaza.slug || plazaSlug}
        bannerEnabled={plaza.banner_enabled}
        bannerText={plaza.banner_text}
        readOnly
      />
    </div>
  )
}

function AdminPlazaHome() {
  const {
    complex,
    plazaSlug,
    historyKey,
    role,
    href,
    startFreshCycle,
  } = useBilling()

  useEffect(() => {
    if (complex?.slug && plazaSlug && complex.slug !== plazaSlug) {
      navigate(`/${complex.slug}/`)
    }
  }, [complex?.slug, plazaSlug])

  const breadcrumbs = role === 'superadmin'
    ? (
      <Breadcrumbs
        items={buildPlazaCrumbs({
          role,
          plazaSlug,
          plazaName: complex?.name,
          trail: [],
        })}
      />
      )
    : null

  return (
    <AdminGate showHome={false}>
      <Home
        complexId={complex?.id}
        complexName={complex?.name}
        plazaSlug={plazaSlug}
        href={href}
        onRefreshKey={historyKey}
        onStartCycle={startFreshCycle}
        bannerEnabled={complex?.banner_enabled}
        bannerText={complex?.banner_text}
        breadcrumbs={breadcrumbs}
      />
    </AdminGate>
  )
}

export default function PlazaHomePage() {
  const params = useParams()
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
    return <PublicPlazaHome plazaSlug={params.plazaSlug} />
  }

  return <AdminPlazaHome />
}
