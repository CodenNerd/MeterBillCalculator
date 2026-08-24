import { formatNaira } from '../utils/billing'

export default function Totals({ totalUnits, totalMisc, totalAmount, lineLoss }) {
  const hasLineLoss = lineLoss !== undefined

  return (
    <div className={`totals-row ${hasLineLoss ? 'totals-row--with-loss' : ''}`}>
      <span className="totals-label">Total</span>
      <span className="align-right totals-empty" aria-hidden="true" />
      <span className="align-right totals-empty" aria-hidden="true" />
      <span className="align-right mono totals-units">{totalUnits.toFixed(2)} kWh</span>
      <span className="align-right mono totals-misc">
        {totalMisc > 0 ? formatNaira(totalMisc) : '—'}
      </span>
      {hasLineLoss && (
        <span className={`align-right mono totals-offset ${lineLoss < 0 ? 'loss-negative' : ''}`}>
          {lineLoss >= 0 ? '+' : '−'}{formatNaira(Math.abs(lineLoss))}
        </span>
      )}
      <span className="align-right mono totals-amount">{formatNaira(totalAmount)}</span>
    </div>
  )
}
