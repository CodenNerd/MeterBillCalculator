'use client'

import { useState } from 'react'
import {
  formatNaira,
  PAYMENT_PAID,
  PAYMENT_UNPAID,
} from '../utils/billing'

/**
 * Mark a single tenant bill as paid (with amount + optional receipt) or didn’t pay.
 */
export default function MarkPaymentDialog({
  row,
  mode = 'paid',
  onConfirm,
  onCancel,
}) {
  const due = Number(row.finalAmount ?? row.amount) || 0
  const isPaid = mode === 'paid'
  const [amount, setAmount] = useState(
    () => (row.amountPaid != null && isPaid ? String(row.amountPaid) : String(due)),
  )
  const [note, setNote] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const parsed = isPaid ? Number(amount) : 0
    if (isPaid && (Number.isNaN(parsed) || parsed < 0)) {
      setError('Enter a valid amount paid.')
      return
    }
    setBusy(true)
    try {
      await onConfirm({
        status: isPaid ? PAYMENT_PAID : PAYMENT_UNPAID,
        amountPaid: isPaid ? parsed : 0,
        note: note.trim(),
        file,
      })
    } catch (err) {
      setError(err?.message || 'Could not save payment')
      setBusy(false)
      return
    }
    setBusy(false)
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>{isPaid ? 'Mark as paid' : 'Mark didn’t pay'}</h3>
        <p>
          {row.name}
          {' · '}
          due {formatNaira(due)}
        </p>

        <form onSubmit={handleSubmit} className="mark-payment-form">
          {isPaid && (
            <div className="input-wrap">
              <label htmlFor="mark-amount">Amount paid</label>
              <input
                id="mark-amount"
                className="reading-input"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>
          )}

          <div className="input-wrap">
            <label htmlFor="mark-note">Receipt note</label>
            <input
              id="mark-note"
              className="reading-input"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="input-wrap">
            <label htmlFor="mark-file">Receipt file</label>
            <input
              id="mark-file"
              type="file"
              accept="image/*,.pdf"
              className="file-input"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving...' : isPaid ? 'Confirm paid' : 'Confirm didn’t pay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
