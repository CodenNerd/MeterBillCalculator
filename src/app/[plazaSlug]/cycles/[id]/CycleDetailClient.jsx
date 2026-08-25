'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import BillsTablePage from '../../../../components/BillsTablePage'
import Header from '../../../../components/Header'
import { AdminGate, useBilling } from '../../../../components/providers/BillingProvider'
import { navigate } from '../../../../utils/navigation'
import { toDateInputValue } from '../../../../utils/billing'

function PublicCycleView({ cycleId, plazaSlug }) {
  return (
    <div className="app">
      <BillsTablePage
        mode="public-cycle"
        cycleId={cycleId}
        plazaSlug={plazaSlug}
        isAdmin={false}
      />
    </div>
  )
}

function AdminCycleView({ cycleId, preview }) {
  const b = useBilling()

  return (
    <AdminGate showHome={!preview} hideHeader={preview}>
      <BillsTablePage
        mode="saved"
        cycleId={cycleId}
        complexId={b.complex?.id}
        complexName={b.complex?.name}
        plazaSlug={b.plazaSlug}
        isAdmin
        preview={preview}
        role={b.role}
        onBack={() => navigate(b.href('/'))}
        onPublish={async (result) => {
          const cycle = await b.fetchCycleById(cycleId, b.complex.id)
          return b.handlePublish(result, {
            cycleId,
            name: cycle?.name || b.cycleName,
            cycleDate: cycle ? toDateInputValue(cycle.cycle_date) : b.cycleDate,
          })
        }}
        onConclude={async (result, evidenceMap) => {
          const cycle = await b.fetchCycleById(cycleId, b.complex.id)
          return b.handleConclude(result, evidenceMap, {
            cycleId,
            name: cycle?.name || b.cycleName,
            cycleDate: cycle ? toDateInputValue(cycle.cycle_date) : b.cycleDate,
          })
        }}
        onEditWorksheet={async () => {
          try {
            await b.hydrateFromCycle(cycleId)
            navigate(b.href('/cycle'))
          } catch {
            b.showToast('Could not open worksheet')
          }
        }}
      />
    </AdminGate>
  )
}

function CycleDetailInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const cycleId = params.id
  const plazaSlug = params.plazaSlug
  const preview = searchParams.get('preview') === '1'
  const { session, ready } = useBilling()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted || !ready) {
    return (
      <div className="app">
        <Header />
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading cycle...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <PublicCycleView cycleId={cycleId} plazaSlug={plazaSlug} />
  }

  return <AdminCycleView cycleId={cycleId} preview={preview} />
}

export default function CycleDetailClient() {
  return (
    <Suspense fallback={
      <div className="app">
        <Header />
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading cycle...</p>
        </div>
      </div>
    }>
      <CycleDetailInner />
    </Suspense>
  )
}
