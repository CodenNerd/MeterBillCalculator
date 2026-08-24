'use client'

import Home from '../components/Home'
import { AdminGate, useBilling } from '../components/providers/BillingProvider'

export default function HomePage() {
  const {
    complex,
    current,
    misc,
    notes,
    actualBill,
    activeCycleId,
    historyKey,
    handleContinuePublished,
  } = useBilling()

  return (
    <AdminGate showHome={false}>
      <Home
        complexId={complex?.id}
        complexName={complex?.name}
        current={current}
        misc={misc}
        notes={notes}
        actualBill={actualBill}
        activeCycleId={activeCycleId}
        onRefreshKey={historyKey}
        onContinuePublished={handleContinuePublished}
      />
    </AdminGate>
  )
}
