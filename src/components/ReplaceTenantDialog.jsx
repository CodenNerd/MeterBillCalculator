'use client'

import { useState } from 'react'
import { formatKwh } from '../utils/billing'

export default function ReplaceTenantDialog({ business, onReplace, onCancel }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const currentName = business?.name || 'this business'
  const prevReading = Number(business?.previous_reading) || 0

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (trimmed === currentName.trim()) {
      setError('Enter the new tenant’s business name.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onReplace(trimmed)
    } catch (err) {
      setError(err.message || 'Could not replace tenant.')
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>Replace tenant</h3>
        <p>
          Hand this shop to a new business. The meter reading stays at{' '}
          <strong className="mono">{formatKwh(prevReading)}</strong>. Past invoices keep
          the name <strong>{currentName}</strong>; only new bills use the name below.
        </p>
        <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
          <div className="input-wrap">
            <label htmlFor="replace-tenant-name">New business name</label>
            <input
              id="replace-tenant-name"
              className="reading-input auth-input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              placeholder="New tenant name"
              autoComplete="off"
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !name.trim()}
            >
              {busy ? 'Replacing…' : 'Replace tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
