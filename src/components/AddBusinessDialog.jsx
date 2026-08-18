import { useState } from 'react'

export default function AddBusinessDialog({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onAdd({ name: name.trim(), email: email.trim() || null })
    } catch (err) {
      setError(err.message || 'Failed to add business.')
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>Add a Business</h3>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-wrap">
            <label htmlFor="new-biz-name">Business Name</label>
            <input
              id="new-biz-name"
              className="reading-input auth-input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="input-wrap">
            <label htmlFor="new-biz-email">
              Email <span className="optional-tag">optional — lets them log in to see their own bills</span>
            </label>
            <input
              id="new-biz-email"
              type="email"
              className="reading-input auth-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
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
