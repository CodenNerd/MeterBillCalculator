'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import BillsTablePage from '../../../../components/BillsTablePage'
import Header from '../../../../components/Header'
import { AdminGate, useBilling } from '../../../../components/providers/BillingProvider'
import { navigate } from '../../../../utils/navigation'
import { plazaPath } from '../../../../utils/plaza'
import { loadActiveGuestSandbox } from '../../../../utils/guestSandbox'

function GuestDraftBills() {
  const params = useParams()
  const plazaSlug = params.plazaSlug
  const [snapshot, setSnapshot] = useState(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const data = loadActiveGuestSandbox()
    if (!data?.draftResult) {
      setMissing(true)
      return
    }
    setSnapshot(data)
  }, [])

  if (missing) {
    return (
      <div className="app">
        <Header />
        <div className="status-screen">
          <p className="error-text">No sandbox bills to show. Open a worksheet first.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate(plazaPath(plazaSlug, '/worksheet'))}
          >
            Open sandbox worksheet
          </button>
        </div>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="app">
        <Header />
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading bills...</p>
        </div>
      </div>
    )
  }

  const backPath = snapshot.worksheetPath
    ? plazaPath(plazaSlug, snapshot.worksheetPath)
    : plazaPath(plazaSlug, '/worksheet')

  return (
    <div className="app">
      <Header
        complexName={snapshot.complexName}
        plazaSlug={plazaSlug}
        ratePerUnit={snapshot.ratePerUnit}
        homeHref={plazaPath(plazaSlug, '/')}
      />
      <div className="guest-sandbox-banner" role="status">
        Sandbox bills — not saved. Sign in as plaza admin to publish real cycles.
      </div>
      <BillsTablePage
        mode="draft"
        complexName={snapshot.complexName}
        plazaSlug={plazaSlug}
        draftResult={snapshot.draftResult}
        draftCycleDate={snapshot.draftCycleDate}
        draftCycleName={snapshot.draftCycleName}
        activeCycleId={snapshot.cycleId}
        isAdmin={false}
        onBack={() => navigate(backPath)}
      />
    </div>
  )
}

function DraftBillsInner() {
  const b = useBilling()

  if (!b.ready) {
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

  if (!b.session) {
    return <GuestDraftBills />
  }

  return (
    <AdminGate showHome>
      <BillsTablePage
        mode="draft"
        complexId={b.complex?.id}
        complexName={b.complex?.name}
        plazaSlug={b.plazaSlug}
        draftResult={b.draftResult}
        draftCycleDate={b.cycleDate}
        draftCycleName={b.cycleName}
        activeCycleId={b.activeCycleId}
        isAdmin
        role={b.role}
        onBack={() => navigate(
          b.activeCycleId
            ? b.href(`/cycles/${b.activeCycleId}/worksheet`)
            : b.href('/worksheet'),
        )}
        onPublish={b.handlePublish}
      />
    </AdminGate>
  )
}

export default function DraftBillsPage() {
  return (
    <Suspense fallback={
      <div className="app">
        <Header />
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      </div>
    }>
      <DraftBillsInner />
    </Suspense>
  )
}
