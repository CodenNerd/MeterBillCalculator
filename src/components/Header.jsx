import { RATE_PER_UNIT } from '../utils/billing'

export default function Header({ onShowHistory }) {
  const today = new Date().toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <span className="logo-bolt">⚡</span>
          <span className="logo-text">MeterCalc</span>
        </div>
        <div className="header-meta">
          <span className="rate-badge">₦{RATE_PER_UNIT}/kWh</span>
          <span className="date">{today}</span>
          {onShowHistory && (
            <button className="btn btn-sm btn-ghost" onClick={onShowHistory}>History</button>
          )}
        </div>
      </div>
    </header>
  )
}
