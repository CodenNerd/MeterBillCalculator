'use client'

import CyclePage from '../../../components/CyclePage'
import { AdminGate, useBilling } from '../../../components/providers/BillingProvider'
import { ALLOCATION_EQUAL } from '../../../utils/billing'

export default function CycleWorksheetPage() {
  const b = useBilling()

  return (
    <AdminGate showHome>
      <CyclePage
        businesses={b.bizList}
        previous={b.previous}
        current={b.current}
        misc={b.misc}
        notes={b.notes}
        actualBill={b.actualBill}
        allocationMethod={b.allocationMethod || ALLOCATION_EQUAL}
        cycleDate={b.cycleDate}
        cycleName={b.cycleName}
        activeCycleId={b.activeCycleId}
        ratePerUnit={b.ratePerUnit}
        href={b.href}
        plazaSlug={b.plazaSlug}
        plazaName={b.complex?.name}
        role={b.role}
        onCurrentChange={b.handleCurrentChange}
        onMiscChange={b.handleMiscChange}
        onNoteChange={b.handleNoteChange}
        onActualBillChange={b.setActualBill}
        onAllocationMethodChange={b.setAllocationMethod}
        onCycleDateChange={b.setCycleDate}
        onCycleNameChange={b.setCycleName}
        onRename={b.handleRename}
        onReplaceTenant={(biz) => {
          const full = (b.businesses || []).find(row => String(row.id) === String(biz.id))
          b.setReplaceTarget(full || biz)
        }}
        onRemove={b.handleRemove}
        onAddBusiness={() => b.setShowAddBusiness(true)}
        onClear={b.handleClear}
      />
    </AdminGate>
  )
}
