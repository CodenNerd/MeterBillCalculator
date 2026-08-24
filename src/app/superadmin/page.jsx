'use client'

import { useEffect, useState } from 'react'
import { useBilling } from '../../components/providers/BillingProvider'
import { createPlaza, listPlazas } from '../../services/supabase'
import { navigate } from '../../utils/navigation'
import { slugifyPlazaName, isValidPlazaSlug, plazaPath } from '../../utils/plaza'
import { signOut } from '../../services/auth'
import AuthGate from '../../components/AuthGate'

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
            <span className="wordmark">Meter<span className="wordmark-calc">Calc</span></span>
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
            Create plazas (buildings / shared tenancies). Each gets a URL like{' '}
            <code>/kmsplaza/</code>. You set the plaza admin email and password here.
          </p>
        </header>

        <section className="card" style={{ padding: 24 }}>
          <h2 className="section-title">Create plaza</h2>
          <form onSubmit={handleCreate} className="auth-form" style={{ marginTop: 16 }}>
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
                placeholder="admin@kmsplaza.com"
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
                placeholder="At least 6 characters"
              />
              <p className="alloc-hint">
                Give these credentials to the plaza admin. They sign in on the home page —
                no self-signup.
              </p>
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
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    padding: '14px 22px',
                    borderTop: '1px solid var(--border)',
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
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => navigate(plazaPath(p.slug, '/'))}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
