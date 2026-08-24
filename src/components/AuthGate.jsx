'use client'

import { useState } from 'react'
import { signInAdmin } from '../services/auth'
import { isSupabaseConfigured } from '../lib/env'
import { Wordmark } from './Header'

export default function AuthGate() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const configured = isSupabaseConfigured()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signInAdmin(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <main className="auth-shell">
        <div className="auth-compose">
          <div className="auth-hero">
            <Wordmark className="wordmark--hero" />
            <p className="auth-tagline">
              Shared electricity billing for your plaza.
            </p>
          </div>

          <section className="card auth-card">
            {!configured ? (
              <>
                <h2 className="card-title auth-title">Configure Supabase</h2>
                <p className="card-sub auth-subtitle">
                  Copy your project URL and anon key into <code>.env</code>, then restart{' '}
                  <code>npm run dev</code>.
                </p>
                <p className="error-text" style={{ marginTop: 12 }}>
                  Missing or placeholder NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
                </p>
              </>
            ) : (
              <>
                <h2 className="card-title auth-title">Sign in</h2>
                <p className="card-sub auth-subtitle">
                  Enter your email and password to continue.
                </p>

                <form
                  onSubmit={handleSubmit}
                  className="auth-form"
                  method="post"
                  action="/sign-in"
                  name="login"
                  autoComplete="on"
                >
                  <div className="input-wrap">
                    <label htmlFor="username">Email</label>
                    <input
                      id="username"
                      name="username"
                      type="email"
                      inputMode="email"
                      className="reading-input auth-input"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </div>
                  <div className="input-wrap">
                    <label htmlFor="password">Password</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      className="reading-input auth-input"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="current-password"
                    />
                  </div>

                  {error && <p className="error-text">{error}</p>}

                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    {busy ? 'Please wait...' : 'Sign in'}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
