'use client'

import CyclePage from './CyclePage'
import { useBilling } from './providers/BillingProvider'
import { ALLOCATION_EQUAL } from '../utils/billing'

/** Shared worksheet form wired to BillingProvider draft state. */
export default function CycleWorksheetView() {
  const b = useBilling()

  return (
    <CyclePage
      businesses={b.bizList}
      previous={b.previous}
      current={b.current}
      misc={b.misc}
      notes={b.notes}
      excludeFromOffset={b.excludeFromOffset}
      carryOver={b.carryOver}
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
      onExcludeFromOffsetChange={b.handleExcludeFromOffsetChange}
      onCarryOverChange={b.handleCarryOverChange}
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
  )
}
