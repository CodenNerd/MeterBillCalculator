'use client'

import { useParams } from 'next/navigation'
import CycleWorksheetView from '../../components/CycleWorksheetView'
import GuestWorksheetSandbox from '../../components/GuestWorksheetSandbox'
import Header from '../../components/Header'
import { AdminGate, useBilling } from '../../components/providers/BillingProvider'

export default function NewWorksheetPage() {
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
    return <GuestWorksheetSandbox plazaSlug={params.plazaSlug} />
  }

  return (
    <AdminGate showHome>
      <CycleWorksheetView />
    </AdminGate>
  )
}
