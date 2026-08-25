'use client'

import { useEffect, useState } from 'react'
import { useBilling } from '../../components/providers/BillingProvider'
import { createPlaza, listPlazas, updatePlaza } from '../../services/supabase'
import { navigate } from '../../utils/navigation'
import { slugifyPlazaName, isValidPlazaSlug, plazaPath } from '../../utils/plaza'
import { signOut } from '../../services/auth'
import { Wordmark } from '../../components/Header'
import AuthGate from '../../components/AuthGate'

function PlazaEditForm({ plaza, onSaved, onCancel }) {
  const [name, setName] = useState(plaza.name || '')
  const [slug, setSlug] = useState(plaza.slug || '')
  const [ownerEmail, setOwnerEmail] = useState(plaza.owner_email || '')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const patch = {
        name,
        slug,
        ownerEmail,
      }
      if (ownerPassword.trim()) {
        patch.ownerPassword = ownerPassword
      }
      const updated = await updatePlaza(plaza.id, patch)
      onSaved(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="auth-form plaza-edit-form" autoComplete="off">
      <div className="input-wrap">
        <label htmlFor={`edit-name-${plaza.id}`}>Name</label>
        <input
          id={`edit-name-${plaza.id}`}
          className="reading-input"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </div>
      <div className="input-wrap">
        <label htmlFor={`edit-slug-${plaza.id}`}>URL slug</label>
        <input
          id={`edit-slug-${plaza.id}`}
          className="reading-input"
          value={slug}
          onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          required
        />
        <p className="alloc-hint">
          {isValidPlazaSlug(slug)
            ? `Path: /${slug}/`
            : 'Use lowercase letters, numbers, and hyphens.'}
        </p>
      </div>
      <div className="input-wrap">
        <label htmlFor={`edit-email-${plaza.id}`}>Plaza admin email</label>
        <input
          id={`edit-email-${plaza.id}`}
          type="email"
          className="reading-input"
          value={ownerEmail}
          onChange={e => setOwnerEmail(e.target.value)}
          required
          autoComplete="off"
        />
      </div>
      <div className="input-wrap">
        <label htmlFor={`edit-password-${plaza.id}`}>New admin password</label>
        <input
          id={`edit-password-${plaza.id}`}
          type="password"
          className="reading-input"
          value={ownerPassword}
          onChange={e => setOwnerPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
          placeholder="Leave blank to keep current password"
        />
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="plaza-edit-actions">
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={busy || !isValidPlazaSlug(slug) || !ownerEmail}
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function SuperadminPage() {
  const { session, role, ready } = useBilling()
  const [plazas, setPlazas] = useState(null)
  const [error, setError] = useState(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    if (!ready) return
    if (!session) return
    if (role !== 'superadmin') return
    listPlazas()
      .then(setPlazas)
      .catch(() => setError('Could not load plazas'))
  }, [ready, session, role])

  if (!ready) {
    return (
      <div className="app">
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthGate />
  }

  if (role !== 'superadmin') {
    return (
      <div className="app">
        <div className="status-screen">
          <p className="error-text">Superadmin access required.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
            Home
          </button>
        </div>
      </div>
    )
  }

  async function handleCreate(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const created = await createPlaza({
        name,
        slug,
        ownerEmail,
        ownerPassword,
      })
      setPlazas(prev => [created, ...(prev || [])])
      setName('')
      setSlug('')
      setOwnerEmail('')
      setOwnerPassword('')
      setSlugTouched(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <Wordmark />
            <span className="complex-label">Superadmin</span>
          </div>
          <div className="header-meta">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <header className="cycle-page-titles">
          <h1 className="page-title">Plazas</h1>
          <p className="page-lede">
            Create and manage plazas. Each gets a URL like <code>/kmsplaza/</code>.
          </p>
        </header>

        <section className="card" style={{ padding: 24 }}>
          <h2 className="section-title">Create plaza</h2>
          <form
            onSubmit={handleCreate}
            className="auth-form"
            style={{ marginTop: 16 }}
            autoComplete="off"
          >
            <div className="input-wrap">
              <label htmlFor="plaza-name">Name</label>
              <input
                id="plaza-name"
                className="reading-input"
                value={name}
                onChange={e => {
                  const v = e.target.value
                  setName(v)
                  if (!slugTouched) setSlug(slugifyPlazaName(v))
                }}
                required
                placeholder="KMS Plaza"
                autoComplete="off"
              />
            </div>
            <div className="input-wrap">
              <label htmlFor="plaza-slug">URL slug</label>
              <input
                id="plaza-slug"
                className="reading-input"
                value={slug}
                onChange={e => {
                  setSlugTouched(true)
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }}
                required
                placeholder="kmsplaza"
                autoComplete="off"
              />
              <p className="alloc-hint">
                {isValidPlazaSlug(slug)
                  ? `Share base: /${slug}/cycles/…`
                  : 'Use lowercase letters, numbers, and hyphens.'}
              </p>
            </div>
            <div className="input-wrap">
              <label htmlFor="owner-email">Plaza admin email</label>
              <input
                id="owner-email"
                type="email"
                className="reading-input"
                value={ownerEmail}
                onChange={e => setOwnerEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                autoComplete="off"
              />
            </div>
            <div className="input-wrap">
              <label htmlFor="owner-password">Plaza admin password</label>
              <input
                id="owner-password"
                type="password"
                className="reading-input"
                value={ownerPassword}
                onChange={e => setOwnerPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !isValidPlazaSlug(slug) || !ownerEmail || !ownerPassword}
            >
              {busy ? 'Creating...' : 'Create plaza'}
            </button>
          </form>
        </section>

        <section className="card" style={{ padding: 0, marginTop: 24 }}>
          <div className="readings-section-head" style={{ padding: '18px 22px 0' }}>
            <h2 className="section-title">All plazas</h2>
          </div>
          {!plazas && (
            <div className="status-screen" style={{ padding: 32 }}>
              <div className="spinner" />
            </div>
          )}
          {plazas && plazas.length === 0 && (
            <p className="muted" style={{ padding: 22 }}>No plazas yet.</p>
          )}
          {plazas && plazas.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {plazas.map(p => (
                <li
                  key={p.id}
                  style={{
                    padding: '14px 22px',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  {editingId === p.id ? (
                    <PlazaEditForm
                      plaza={p}
                      onCancel={() => setEditingId(null)}
                      onSaved={updated => {
                        setPlazas(prev =>
                          (prev || []).map(row => (row.id === updated.id ? updated : row)),
                        )
                        setEditingId(null)
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16,
                      }}
                    >
                      <div>
                        <strong>{p.name}</strong>
                        <div className="muted" style={{ fontSize: '0.85rem' }}>
                          /{p.slug}
                          {p.owner_email ? ` · admin ${p.owner_email}` : ''}
                          {p.owner_id ? ' · provisioned' : ' · pending'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => setEditingId(p.id)}
                        >
                          Edit
                        </button>
                        <a
                          className="btn btn-sm btn-ghost"
                          href={plazaPath(p.slug, '/')}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Log on
                        </a>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
