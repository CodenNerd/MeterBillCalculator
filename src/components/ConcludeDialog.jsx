'use client'

import { useMemo, useState } from 'react'
import {
  formatNaira,
  PAYMENT_AWAITING,
  PAYMENT_PAID,
  PAYMENT_UNPAID,
} from '../utils/billing'

/**
 * Conclude with required payment status + optional evidence per business.
 */
export default function ConcludeDialog({ rows, initialStatuses = {}, onConfirm, onCancel }) {
  const [statuses, setStatuses] = useState(() =>
    Object.fromEntries(
      rows.map(r => [r.id, initialStatuses[r.id] || r.paymentStatus || PAYMENT_AWAITING]),
    ),
  )
  const [notes, setNotes] = useState(() => Object.fromEntries(rows.map(r => [r.id, ''])))
  const [files, setFiles] = useState(() => Object.fromEntries(rows.map(r => [r.id, null])))
  const [busy, setBusy] = useState(false)

  const allResolved = useMemo(
    () => rows.every(r => statuses[r.id] === PAYMENT_PAID || statuses[r.id] === PAYMENT_UNPAID),
    [rows, statuses],
  )

  async function handleSubmit(e) {
    e.preventDefault()
    if (!allResolved) return
    setBusy(true)
    try {
      const evidence = {}
      for (const row of rows) {
        evidence[row.id] = {
          note: notes[row.id]?.trim() || '',
          file: files[row.id] || null,
          paymentStatus: statuses[row.id],
        }
      }
      await onConfirm(evidence)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog dialog--wide" onClick={e => e.stopPropagation()}>
        <h3>Conclude this cycle?</h3>
        <p>
          Mark each tenant as paid or didn&apos;t pay. Readings become next cycle&apos;s starting point.
          You cannot conclude while any bill is still awaiting payment.
        </p>

        <form onSubmit={handleSubmit} className="conclude-form">
          <div className="conclude-list">
            {rows.map(row => (
              <div key={row.id} className="conclude-item">
                <div className="conclude-item-head">
                  <strong>{row.name}</strong>
                  <span className="mono">{formatNaira(row.finalAmount ?? row.amount)}</span>
                </div>

                <div className="input-wrap">
                  <label htmlFor={`pay-${row.id}`}>Payment status</label>
                  <select
                    id={`pay-${row.id}`}
                    className="reading-input"
                    value={statuses[row.id] || PAYMENT_AWAITING}
                    onChange={e => setStatuses({ ...statuses, [row.id]: e.target.value })}
                    required
                  >
                    <option value={PAYMENT_AWAITING}>Still awaiting</option>
                    <option value={PAYMENT_PAID}>Paid</option>
                    <option value={PAYMENT_UNPAID}>Didn&apos;t pay</option>
                  </select>
                </div>

                <div className="conclude-item-fields">
                  <div className="input-wrap">
                    <label htmlFor={`ev-note-${row.id}`}>Note</label>
                    <input
                      id={`ev-note-${row.id}`}
                      className="reading-input"
                      value={notes[row.id] || ''}
                      onChange={e => setNotes({ ...notes, [row.id]: e.target.value })}
                      placeholder="Optional payment note"
                    />
                  </div>
                  <div className="input-wrap">
                    <label htmlFor={`ev-file-${row.id}`}>Evidence</label>
                    <input
                      id={`ev-file-${row.id}`}
                      type="file"
                      accept="image/*,.pdf"
                      className="file-input"
                      onChange={e => setFiles({ ...files, [row.id]: e.target.files?.[0] || null })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!allResolved && (
            <p className="error-text">Resolve every tenant (paid or didn&apos;t pay) to continue.</p>
          )}

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !allResolved}>
              {busy ? 'Concluding...' : 'Conclude cycle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
