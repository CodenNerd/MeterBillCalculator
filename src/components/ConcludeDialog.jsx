import { useState } from 'react'
import { formatNaira } from '../utils/billing'

/**
 * Modal to optionally attach payment evidence per business before concluding.
 */
export default function ConcludeDialog({ rows, onConfirm, onCancel }) {
  const [notes, setNotes] = useState(() => Object.fromEntries(rows.map(r => [r.id, ''])))
  const [files, setFiles] = useState(() => Object.fromEntries(rows.map(r => [r.id, null])))
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const evidence = {}
      for (const row of rows) {
        evidence[row.id] = {
          note: notes[row.id]?.trim() || '',
          file: files[row.id] || null,
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
          Readings become the next cycle&apos;s starting point and this month moves to Past months.
          Optionally attach payment evidence for each business.
        </p>

        <form onSubmit={handleSubmit} className="conclude-form">
          <div className="conclude-list">
            {rows.map(row => (
              <div key={row.id} className="conclude-item">
                <div className="conclude-item-head">
                  <strong>{row.name}</strong>
                  <span className="mono">{formatNaira(row.finalAmount ?? row.amount)}</span>
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

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Concluding...' : 'Conclude cycle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
