'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import BusinessTimeline from '../../../../components/BusinessTimeline'
import Header, { Wordmark } from '../../../../components/Header'
import { AdminGate, useBilling } from '../../../../components/providers/BillingProvider'

function PublicBusinessView({ businessId, plazaSlug }) {
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
          <p>Loading timeline...</p>
        </div>
      }>
        <BusinessTimeline businessId={businessId} plazaSlug={plazaSlug} isPublic />
      </Suspense>
    </div>
  )
}

function AdminBusinessView({ businessId }) {
  const { complex, plazaSlug, role } = useBilling()

  if (!complex?.id) {
    return (
      <AdminGate showHome>
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading timeline...</p>
        </div>
      </AdminGate>
    )
  }

  return (
    <AdminGate showHome>
      <Suspense fallback={
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading timeline...</p>
        </div>
      }>
        <BusinessTimeline
          businessId={businessId}
          complexId={complex.id}
          plazaSlug={plazaSlug}
          plazaName={complex.name}
          role={role}
        />
      </Suspense>
    </AdminGate>
  )
}

function BusinessPageInner() {
  const params = useParams()
  const businessId = params.id
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
    return <PublicBusinessView businessId={businessId} plazaSlug={plazaSlug} />
  }

  return <AdminBusinessView businessId={businessId} />
}

export default function BusinessPage() {
  return <BusinessPageInner />
}
