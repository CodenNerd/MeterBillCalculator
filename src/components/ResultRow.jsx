'use client'

import { formatNaira } from '../utils/billing'

export default function ResultRow({ row, displayNumber, maxUnits, hasLineLoss, onClick, interactive }) {
  const barWidth = row.units > 0 ? (row.units / maxUnits) * 100 : 0
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`table-row ${hasLineLoss ? 'table-row--with-loss' : ''} ${interactive || onClick ? 'table-row--clickable' : ''}`}
      onClick={onClick}
    >
      <div className="cell-biz">
        <span className="biz-num-sm">{displayNumber}</span>
        <span>{row.name}</span>
      </div>
      <span className="align-right mono muted">{row.prev.toFixed(2)}</span>
      <span className="align-right mono">{row.curr.toFixed(2)}</span>
      <div className="cell-units align-right">
        <span className="mono">{row.units.toFixed(2)} kWh</span>
        <div className="spark-bar">
          <div className="spark-fill" style={{ width: `${barWidth}%` }} />
        </div>
      </div>
      <span className="align-right mono muted cell-misc">{row.misc > 0 ? formatNaira(row.misc) : '—'}</span>
      {hasLineLoss && (
        <span className={`align-right mono cell-line-loss ${row.lineLossShare < 0 ? 'negative' : ''}`}>
          {row.lineLossShare >= 0 ? '+' : ''}{formatNaira(row.lineLossShare)}
        </span>
      )}
      <span className="align-right mono amount">
        {formatNaira(hasLineLoss ? row.finalAmount : row.amount)}
      </span>
    </Tag>
  )
}
