'use client'

import { useState } from 'react'
import {
  signUpAdmin,
  signInAdmin,
  startLocalDemo,
  startLocalSuperadmin,
  isLocalMode,
} from '../services/auth'
import { Wordmark } from './Header'

export default function AuthGate() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  function switchMode() {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setError(null)
    setNotice(null)
  }

  async function handleDemo() {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      await startLocalDemo()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSuperDemo() {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      await startLocalSuperadmin()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const res = await signUpAdmin(email, password)
        if (!res.session) {
          setNotice('Check your email to confirm your account, then sign in below.')
          setMode('signin')
        }
      } else {
        await signInAdmin(email, password)
      }
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
            {isLocalMode() && (
              <p className="auth-notice">
                Local demo — nothing is sent to Supabase. Data stays in this browser.
              </p>
            )}

            {isLocalMode() && (
              <>
                <button
                  type="button"
                  className="btn btn-primary auth-demo-btn"
                  onClick={handleDemo}
                  disabled={busy}
                >
                  {busy ? 'Please wait...' : 'Start as plaza admin (sample data)'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline auth-demo-btn"
                  onClick={handleSuperDemo}
                  disabled={busy}
                  style={{ marginTop: 8 }}
                >
                  Start as superadmin
                </button>
                <div className="auth-divider"><span>or sign in locally</span></div>
              </>
            )}

            <h2 className="card-title auth-title">
              {mode === 'signin' ? 'Sign in' : 'Create plaza admin account'}
            </h2>
            <p className="card-sub auth-subtitle">
              {isLocalMode()
                ? 'Any email and password work in demo mode. Superadmin: superadmin@local.test / demo123'
                : 'Plaza admins are invited by a superadmin. Sign up with your invited email.'}
            </p>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="input-wrap">
                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  className="reading-input auth-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="input-wrap">
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  className="reading-input auth-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {error && <p className="error-text">{error}</p>}
              {notice && <p className="auth-notice">{notice}</p>}

              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <button type="button" className="btn-link" onClick={switchMode}>
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </section>
        </div>
      </main>
    </div>
  )
}
