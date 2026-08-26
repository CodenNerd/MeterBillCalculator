'use client'

import { useState } from 'react'

export default function AddBusinessDialog({
  onAdd,
  onRestore,
  onCancel,
  archived = [],
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onAdd({ name: name.trim() })
    } catch (err) {
      setError(err.message || 'Failed to add business.')
      setBusy(false)
    }
  }

  async function handleRestore(biz) {
    setError(null)
    setBusy(true)
    try {
      await onRestore(biz)
    } catch (err) {
      setError(err.message || 'Failed to restore business.')
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>Add a Business</h3>

        {archived.length > 0 && (
          <div className="add-biz-restore">
            <p className="add-biz-restore-label">Restore removed</p>
            <div className="add-biz-restore-list">
              {archived.map(biz => (
                <button
                  key={biz.id}
                  type="button"
                  className="add-biz-restore-chip"
                  disabled={busy}
                  onClick={() => handleRestore(biz)}
                >
                  {biz.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-wrap">
            <label htmlFor="new-biz-name">
              {archived.length > 0 ? 'Or add a new business' : 'Business Name'}
            </label>
            <input
              id="new-biz-name"
              className="reading-input auth-input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
              {busy ? 'Adding...' : 'Add Business'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
