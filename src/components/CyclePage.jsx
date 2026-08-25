'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import InputRow from './InputRow'
import Breadcrumbs from './Breadcrumbs'
import {
  ALLOCATION_EQUAL,
  ALLOCATION_PROPORTIONAL,
  RATE_PER_UNIT,
  computeCycleResult,
  formatKwh,
  formatNaira,
} from '../utils/billing'
import { navigate } from '../utils/navigation'
import { buildPlazaCrumbs } from '../utils/breadcrumbs'

export default function CyclePage({
  businesses,
  previous,
  current,
  misc,
  notes,
  actualBill,
  allocationMethod,
  cycleDate,
  cycleName,
  activeCycleId,
  ratePerUnit = RATE_PER_UNIT,
  href,
  plazaSlug,
  plazaName,
  role,
  onCurrentChange,
  onMiscChange,
  onNoteChange,
  onActualBillChange,
  onAllocationMethodChange,
  onCycleDateChange,
  onCycleNameChange,
  onRename,
  onReplaceTenant,
  onRemove,
  onAddBusiness,
  onClear,
}) {
  const go = (path) => navigate(href ? href(path) : path)
  const rate = Number(ratePerUnit) > 0 ? Number(ratePerUnit) : RATE_PER_UNIT
  const result = useMemo(
    () => computeCycleResult(
      businesses,
      previous,
      current,
      misc,
      actualBill,
      allocationMethod,
      notes,
      rate,
    ),
    [businesses, previous, current, misc, notes, actualBill, allocationMethod, rate],
  )

  const hasLineLoss = result.lineLoss !== undefined
  const billParsed = parseFloat(actualBill)
  const canViewBills = businesses.length > 0 && Number.isFinite(billParsed) && billParsed > 0
  const rowById = Object.fromEntries(result.rows.map(r => [r.id, r]))
  const meterTotal = result.rows.reduce((s, r) => s + r.unitAmount, 0)

  const [pulseIds, setPulseIds] = useState(() => new Set())
  const prevAmounts = useRef({})

  useEffect(() => {
    const next = {}
    const changed = new Set()
    for (const row of result.rows) {
      const amount = hasLineLoss ? row.finalAmount : row.amount
      next[row.id] = amount
      if (prevAmounts.current[row.id] !== undefined && prevAmounts.current[row.id] !== amount) {
        changed.add(row.id)
      }
    }
    prevAmounts.current = next
    if (changed.size === 0) return
    setPulseIds(changed)
    const t = setTimeout(() => setPulseIds(new Set()), 600)
    return () => clearTimeout(t)
  }, [result, hasLineLoss])

  function goToBills() {
    go('/cycles/draft')
  }

  const crumbs = buildPlazaCrumbs({
    role,
    plazaSlug,
    plazaName,
    trail: [{ label: activeCycleId ? 'Edit worksheet' : 'Worksheet' }],
  })

  return (
    <main className="main main--cycle">
      <header className="cycle-page-head">
        <Breadcrumbs items={crumbs} />
        <div className="cycle-page-titles">
          <h1 className="page-title">
            {activeCycleId ? 'Edit published cycle' : 'Billing cycle'}
          </h1>
          <p className="page-lede">
            Set the cycle date and name, enter the NEPA office bill, then update each meter reading (kWh).
            Publish from the bills page when ready.
          </p>
        </div>
      </header>

      <section className="card general-bill-panel">
        <div className="general-bill-layout">
          <div className="general-bill-controls">
            <div className="cycle-meta-row">
              <div className="input-wrap">
                <label htmlFor="cycle-date">Cycle date</label>
                <input
                  id="cycle-date"
                  type="date"
                  className="reading-input"
                  value={cycleDate}
                  onChange={e => onCycleDateChange(e.target.value)}
                />
              </div>
              <div className="input-wrap">
                <label htmlFor="cycle-name">Cycle name / alias</label>
                <input
                  id="cycle-name"
                  type="text"
                  className="reading-input"
                  placeholder="e.g. March 2026"
                  value={cycleName}
                  onChange={e => onCycleNameChange(e.target.value)}
                />
              </div>
            </div>

            <div className="input-wrap">
              <label htmlFor="actual-bill">NEPA office bill (₦)</label>
              <input
                id="actual-bill"
                type="number"
                className="reading-input office-bill-input"
                placeholder="0.00"
                value={actualBill}
                onChange={e => onActualBillChange(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>

            <div className="input-wrap">
              <label>Split method</label>
              <div className="alloc-toggle" role="group" aria-label="Split method">
                <button
                  type="button"
                  className={`alloc-tab ${allocationMethod === ALLOCATION_EQUAL ? 'active' : ''}`}
                  onClick={() => onAllocationMethodChange(ALLOCATION_EQUAL)}
                >
                  Even split
                </button>
                <button
                  type="button"
                  className={`alloc-tab ${allocationMethod === ALLOCATION_PROPORTIONAL ? 'active' : ''}`}
                  onClick={() => onAllocationMethodChange(ALLOCATION_PROPORTIONAL)}
                >
                  By usage
                </button>
              </div>
              <p className="alloc-hint">
                {allocationMethod === ALLOCATION_PROPORTIONAL
                  ? 'Offset (₦) is weighted by each business\'s energy charge.'
                  : 'Offset (₦) is divided evenly across every business.'}
              </p>
            </div>
          </div>

          <div className="general-bill-stats" aria-live="polite">
            <div className="gstat">
              <span className="gstat-label">Meter total (₦)</span>
              <span className="gstat-value mono">{formatNaira(meterTotal)}</span>
            </div>
            <div className="gstat">
              <span className="gstat-label">NEPA office bill (₦)</span>
              <span className="gstat-value mono">
                {hasLineLoss ? formatNaira(result.actualBill) : '—'}
              </span>
            </div>
            <div className="gstat">
              <span className="gstat-label">
                {hasLineLoss && result.lineLoss < 0 ? 'Surplus (₦)' : 'Offset (₦)'}
              </span>
              <span className={`gstat-value mono ${!hasLineLoss ? '' : result.lineLoss >= 0 ? 'loss-positive' : 'loss-negative'}`}>
                {hasLineLoss ? formatNaira(Math.abs(result.lineLoss)) : '—'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="readings-section">
        <div className="readings-section-head">
          <div>
            <h2 className="section-title">Business readings</h2>
            <p className="section-sub">Meter values in kWh · charges in ₦</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onAddBusiness} type="button">
            Add business
          </button>
        </div>

        <div className="biz-list">
          {businesses.map((biz, index) => {
            const row = rowById[biz.id]
            const live = row
              ? {
                  usedLabel: formatKwh(row.units),
                  energyLabel: `${formatNaira(row.unitAmount)} (${row.units.toFixed(2)} × ₦${rate})`,
                  shareLabel: hasLineLoss
                    ? `${row.lineLossShare >= 0 ? '+' : '−'}${formatNaira(Math.abs(row.lineLossShare))}`
                    : null,
                  shareNegative: hasLineLoss && row.lineLossShare < 0,
                  amountLabel: formatNaira(hasLineLoss ? row.finalAmount : row.amount),
                  pulse: pulseIds.has(row.id),
                }
              : null

            return (
              <InputRow
                key={biz.id}
                biz={biz}
                displayNumber={index + 1}
                previous={previous}
                currentValue={current[biz.id]}
                miscValue={misc[biz.id]}
                noteValue={notes?.[biz.id]}
                onChange={onCurrentChange}
                onMiscChange={onMiscChange}
                onNoteChange={onNoteChange}
                onRename={onRename}
                onReplaceTenant={onReplaceTenant}
                onRemove={onRemove}
                live={live}
              />
            )
          })}

          {businesses.length === 0 && (
            <div className="empty-state empty-state--panel">
              No businesses yet. Add a business to start entering readings.
            </div>
          )}
        </div>
      </section>

      <div className="cycle-sticky-bar no-print">
        <div className="cycle-sticky-inner">
          {!canViewBills && businesses.length > 0 && (
            <p className="cycle-sticky-hint">Enter the NEPA office bill (₦) to view the bills table.</p>
          )}
          {businesses.length === 0 && (
            <p className="cycle-sticky-hint">Add at least one business to continue.</p>
          )}
          <div className="cycle-sticky-actions">
            <button className="btn btn-ghost" onClick={onClear} type="button">Clear</button>
            <button
              className="btn btn-primary"
              onClick={goToBills}
              disabled={!canViewBills}
              type="button"
            >
              View bills
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
