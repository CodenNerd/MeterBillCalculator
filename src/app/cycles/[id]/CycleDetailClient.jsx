'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import BillsTablePage from '../../../components/BillsTablePage'
import Header from '../../../components/Header'
import { AdminGate, useBilling } from '../../../components/providers/BillingProvider'
import { navigate } from '../../../utils/navigation'
import { toDateInputValue } from '../../../utils/billing'

function PublicCycleView({ cycleId }) {
  return (
    <div className="app">
      <BillsTablePage
        mode="public-cycle"
        cycleId={cycleId}
        isAdmin={false}
      />
    </div>
  )
}

function AdminCycleView({ cycleId }) {
  const b = useBilling()

  return (
    <AdminGate showHome>
      <BillsTablePage
        mode="saved"
        cycleId={cycleId}
        complexId={b.complex?.id}
        complexName={b.complex?.name}
        isAdmin
        onBack={() => navigate('/')}
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
            navigate('/cycle')
          } catch {
            b.showToast('Could not open worksheet')
          }
        }}
      />
    </AdminGate>
  )
}

export default function CycleDetailClient() {
  const params = useParams()
  const cycleId = params.id
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
    return <PublicCycleView cycleId={cycleId} />
  }

  return <AdminCycleView cycleId={cycleId} />
}
