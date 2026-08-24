'use client'

import { RATE_PER_UNIT } from '../utils/billing'
import { signOut } from '../services/auth'
import { navigate } from '../utils/navigation'
import { plazaPath } from '../utils/plaza'

function Wordmark({ className = '' }) {
  return (
    <span className={`wordmark ${className}`.trim()}>
      Plaza<span className="wordmark-calc">Bills</span>
    </span>
  )
}

export default function Header({
  complexName,
  plazaSlug,
  ratePerUnit,
  showSignOut,
  showHome,
  showSettings,
  homeHref,
  settingsHref,
}) {
  const today = new Date().toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const rate = Number(ratePerUnit) > 0 ? Number(ratePerUnit) : RATE_PER_UNIT
  const home = homeHref || (plazaSlug ? plazaPath(plazaSlug, '/') : '/')
  const settings = settingsHref || (plazaSlug ? plazaPath(plazaSlug, '/settings') : '/settings')

  return (
    <header className="header no-print">
      <div className="header-inner">
        <div className="logo">
          <button
            type="button"
            className="logo-btn"
            onClick={() => navigate(home)}
            title="Home"
          >
            <Wordmark />
          </button>
          {complexName && <span className="complex-label">{complexName}</span>}
        </div>
        <div className="header-meta">
          <span className="meta-rate">₦{rate}/kWh</span>
          <span className="date">{today}</span>
          {showHome && (
            <button className="btn-text" onClick={() => navigate(home)}>Home</button>
          )}
          {(showSettings || showSignOut) && (
            <button className="btn-text" onClick={() => navigate(settings)}>Settings</button>
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
