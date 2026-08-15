import { useState } from 'react'
import { formatNaira } from '../utils/billing'

export default function LineLossPanel({ result, businessCount, onApply, onReset }) {
  const [actualBill, setActualBill] = useState('')
  const hasLineLoss = result.lineLoss !== undefined

  function handleApply() {
    const parsed = parseFloat(actualBill)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    onApply(parsed)
  }

  if (hasLineLoss) {
    const perBusiness = businessCount > 0 ? result.lineLoss / businessCount : 0
    return (
      <section className="card line-loss-card">
        <div className="card-header">
          <h2 className="card-title">Electricity Office Reconciliation</h2>
          <button className="btn btn-sm btn-ghost" onClick={onReset}>Edit</button>
        </div>
        <div className="line-loss-summary">
          <div className="line-loss-stat">
            <span className="line-loss-stat-label">Calculated (meters)</span>
            <span className="mono">{formatNaira(result.calculatedUnitTotal)}</span>
          </div>
          <div className="line-loss-stat">
            <span className="line-loss-stat-label">Actual bill received</span>
            <span className="mono">{formatNaira(result.actualBill)}</span>
          </div>
          <div className="line-loss-stat">
            <span className="line-loss-stat-label">
              {result.lineLoss >= 0 ? 'Line loss' : 'Surplus'}
            </span>
            <span className={`mono ${result.lineLoss >= 0 ? 'loss-positive' : 'loss-negative'}`}>
              {formatNaira(Math.abs(result.lineLoss))}
            </span>
          </div>
          <div className="line-loss-stat">
            <span className="line-loss-stat-label">Per business (split evenly)</span>
            <span className="mono">
              {perBusiness >= 0 ? '+' : '−'}{formatNaira(Math.abs(perBusiness))}
            </span>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="card line-loss-card">
      <div className="card-header">
        <h2 className="card-title">Electricity Office Reconciliation</h2>
      </div>
      <p className="line-loss-hint">
        Enter the total bill you actually received from the electricity office to compare it
        against the meter-calculated total. Any difference (line loss) will be split evenly
        across all {businessCount} businesses.
      </p>
      <div className="line-loss-input-row">
        <div className="input-wrap">
          <label htmlFor="actual-bill">Actual Bill from Electricity Office (₦)</label>
          <input
            id="actual-bill"
            type="number"
            className="reading-input"
            placeholder="0.00"
            value={actualBill}
            onChange={e => setActualBill(e.target.value)}
            step="0.01"
            min="0"
          />
        </div>
        <button className="btn btn-sm btn-primary" onClick={handleApply}>
          Compare & Split
        </button>
      </div>
    </section>
  )
}
