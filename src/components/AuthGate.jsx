import { useState } from 'react'
import { signUpAdmin, signInAdmin, signUpBusinessOwner, signInBusinessOwner } from '../services/auth'

export default function AuthGate() {
  const [tab, setTab] = useState('admin') // 'admin' | 'business'
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [complexName, setComplexName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  function switchTab(next) {
    setTab(next)
    setError(null)
    setNotice(null)
  }

  function switchMode() {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setError(null)
    setNotice(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (tab === 'admin') {
        if (mode === 'signup') {
          const res = await signUpAdmin(email, password, complexName)
          if (!res.session) {
            setNotice('Check your email to confirm your account, then sign in below.')
            setMode('signin')
          }
        } else {
          await signInAdmin(email, password)
        }
      } else {
        if (mode === 'signup') {
          const res = await signUpBusinessOwner(email, password)
          if (!res.session) {
            setNotice('Check your email to confirm your account, then sign in below.')
            setMode('signin')
          }
        } else {
          await signInBusinessOwner(email, password)
        }
      }
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
            <span className="logo-bolt">⚡</span>
            <span className="logo-text">MeterCalc</span>
          </div>
        </div>
      </header>

      <main className="main auth-main">
        <section className="card auth-card">
          <div className="auth-role-tabs">
            <button
              type="button"
              className={`auth-tab ${tab === 'admin' ? 'active' : ''}`}
              onClick={() => switchTab('admin')}
            >
              Complex / Plaza Admin
            </button>
            <button
              type="button"
              className={`auth-tab ${tab === 'business' ? 'active' : ''}`}
              onClick={() => switchTab('business')}
            >
              Business Owner
            </button>
          </div>

          <h2 className="card-title auth-title">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h2>
          {tab === 'business' && (
            <p className="card-sub auth-subtitle">
              Sign in with the email your landlord registered for your business.
            </p>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {tab === 'admin' && mode === 'signup' && (
              <div className="input-wrap">
                <label htmlFor="complex-name">Complex / Plaza Name</label>
                <input
                  id="complex-name"
                  className="reading-input auth-input"
                  value={complexName}
                  onChange={e => setComplexName(e.target.value)}
                  required
                />
              </div>
            )}
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
              {busy ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <button type="button" className="btn-link" onClick={switchMode}>
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </section>
      </main>
    </div>
  )
}
