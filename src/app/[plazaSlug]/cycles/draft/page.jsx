'use client'

import BillsTablePage from '../../../../components/BillsTablePage'
import { AdminGate, useBilling } from '../../../../components/providers/BillingProvider'
import { navigate } from '../../../../utils/navigation'

export default function DraftBillsPage() {
  const b = useBilling()

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
        onBack={() => navigate(b.href('/cycle'))}
        onPublish={b.handlePublish}
      />
    </AdminGate>
  )
}
