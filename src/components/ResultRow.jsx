'use client'

import {
  formatNaira,
  PAYMENT_AWAITING,
  PAYMENT_PAID,
  PAYMENT_UNPAID,
} from '../utils/billing'

const STATUS_LABEL = {
  [PAYMENT_AWAITING]: 'Awaiting payment',
  [PAYMENT_PAID]: 'Paid',
  [PAYMENT_UNPAID]: "Didn't pay",
}

export default function ResultRow({
  row,
  displayNumber,
  maxUnits,
  hasLineLoss,
  onClick,
  interactive,
  showPaymentStatus = false,
  canMarkPayment = false,
  onMarkPaid,
  onMarkUnpaid,
  onClearPayment,
}) {
  const barWidth = row.units > 0 ? (row.units / maxUnits) * 100 : 0
  const due = hasLineLoss ? row.finalAmount : row.amount
  const status = row.paymentStatus || PAYMENT_AWAITING
  const isPaidStamp = showPaymentStatus && status === PAYMENT_PAID
  const isUnpaidStamp = showPaymentStatus && status === PAYMENT_UNPAID
  // Avoid nested <button> when payment mark controls are shown.
  const useNativeButton = Boolean(onClick) && !canMarkPayment
  const Tag = useNativeButton ? 'button' : 'div'

  return (
    <Tag
      type={useNativeButton ? 'button' : undefined}
      role={!useNativeButton && onClick ? 'button' : undefined}
      tabIndex={!useNativeButton && onClick ? 0 : undefined}
      className={`table-row ${hasLineLoss ? 'table-row--with-loss' : ''} ${interactive || onClick ? 'table-row--clickable' : ''}`}
      onClick={onClick}
      onKeyDown={!useNativeButton && onClick
        ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onClick(e)
            }
          }
        : undefined}
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
      <div
        className={[
          'align-right mono amount cell-final',
          showPaymentStatus ? 'cell-final--status' : '',
          isPaidStamp ? 'cell-final--stamped' : '',
          isUnpaidStamp ? 'cell-final--stamped' : '',
        ].filter(Boolean).join(' ')}
      >
        <span className={`cell-final-amount cell-final-amount--${status}`}>
          {formatNaira(due)}
        </span>

        {showPaymentStatus && status === PAYMENT_PAID && (
          <span className="payment-stamp payment-stamp--paid" aria-label="Paid">
            <span className="payment-stamp-label">PAID</span>
            <span className="payment-stamp-amt">
              {formatNaira(row.amountPaid != null ? row.amountPaid : due)}
            </span>
          </span>
        )}

        {showPaymentStatus && status === PAYMENT_UNPAID && (
          <span className="payment-stamp payment-stamp--unpaid" aria-label="Unpaid">
            <span className="payment-stamp-label">UNPAID</span>
          </span>
        )}

        {showPaymentStatus && status === PAYMENT_AWAITING && (
          <span className={`payment-status-cue payment-status-cue--${status}`}>
            <span className="payment-status-dot" aria-hidden="true" />
            <span className="payment-status-text">{STATUS_LABEL[status]}</span>
          </span>
        )}

        {canMarkPayment && showPaymentStatus && (
          <span
            className="payment-stamp-actions no-print"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
          >
            {status === PAYMENT_AWAITING && (
              <>
                <button type="button" className="btn-text payment-mark-btn" onClick={() => onMarkPaid?.(row)}>
                  Mark as paid
                </button>
                <button type="button" className="btn-text payment-mark-btn" onClick={() => onMarkUnpaid?.(row)}>
                  Didn&apos;t pay
                </button>
              </>
            )}
            {(status === PAYMENT_UNPAID || status === PAYMENT_PAID) && (
              <button type="button" className="btn-text payment-mark-btn" onClick={() => onClearPayment?.(row)}>
                Clear
              </button>
            )}
          </span>
        )}
      </div>
    </Tag>
  )
}
