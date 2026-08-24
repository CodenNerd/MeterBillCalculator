'use client'

import { RATE_PER_UNIT } from '../utils/billing'
import { signOut, isLocalMode } from '../services/auth'
import { navigate } from '../utils/navigation'

function Wordmark({ className = '' }) {
  return (
    <span className={`wordmark ${className}`.trim()}>
      Meter<span className="wordmark-calc">Calc</span>
    </span>
  )
}

export default function Header({ complexName, showSignOut, showHome }) {
  const today = new Date().toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <header className="header no-print">
      <div className="header-inner">
        <div className="logo">
          <button
            type="button"
            className="logo-btn"
            onClick={() => navigate('/')}
            title="Home"
          >
            <Wordmark />
          </button>
          {complexName && <span className="complex-label">{complexName}</span>}
          {isLocalMode() && <span className="meta-label meta-label--local">Local demo</span>}
        </div>
        <div className="header-meta">
          <span className="meta-rate">₦{RATE_PER_UNIT}/kWh</span>
          <span className="date">{today}</span>
          {showHome && (
            <button className="btn-text" onClick={() => navigate('/')}>Home</button>
          )}
          {showSignOut && (
            <button className="btn btn-sm btn-ghost" onClick={() => signOut()}>Sign out</button>
          )}
        </div>
      </div>
    </header>
  )
}

export { Wordmark }
