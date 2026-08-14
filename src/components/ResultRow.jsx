import { formatNaira } from '../utils/billing'

export default function ResultRow({ row, maxUnits }) {
  const barWidth = row.units > 0 ? (row.units / maxUnits) * 100 : 0

  return (
    <div className="table-row">
      <div className="cell-biz">
        <span className="biz-num-sm">{row.id}</span>
        <span>{row.name}</span>
      </div>
      <span className="align-right mono muted">{row.prev.toFixed(2)}</span>
      <span className="align-right mono">{row.curr.toFixed(2)}</span>
      <div className="cell-units align-right">
        <span className="mono">{row.units.toFixed(2)}</span>
        <div className="spark-bar">
          <div className="spark-fill" style={{ width: `${barWidth}%` }} />
        </div>
      </div>
      <span className="align-right mono muted cell-misc">{row.misc > 0 ? formatNaira(row.misc) : '—'}</span>
      <span className="align-right mono amount">{formatNaira(row.amount)}</span>
    </div>
  )
}
