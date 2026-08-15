import { useMemo, useState } from 'react'
import { decodePayload, buildShareUrl, shareOrCopyLink } from '../utils/share'
import { downloadBillImage } from '../utils/billImage'
import { formatNaira } from '../utils/billing'
import Toast from './Toast'

export default function BillPage({ encoded }) {
  const [toast, setToast] = useState(null)

  const payload = useMemo(() => {
    try {
      return decodePayload(encoded)
    } catch {
      return null
    }
  }, [encoded])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  if (!payload) {
    return (
      <div className="app">
        <div className="status-screen">
          <p className="error-text">This bill link is invalid or incomplete.</p>
        </div>
      </div>
    )
  }

  async function handleShare() {
    const url = buildShareUrl(payload)
    const outcome = await shareOrCopyLink(url, `${payload.businessName} — Electricity Bill`)
    if (outcome === 'copied') showToast('Link copied to clipboard')
    if (outcome === 'failed') showToast('Could not copy link')
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

      <main className="main bill-page-main">
        <section className="card bill-card">
          <div className="bill-card-header">
            <span className="bill-tag">Electricity Bill</span>
            <h1>{payload.businessName}</h1>
            <p className="muted">{payload.cycleDate}</p>
          </div>

          <div className="bill-lines">
            <div className="bill-line">
              <span>Previous Reading</span>
              <span className="mono">{payload.prev.toFixed(2)} kWh</span>
            </div>
            <div className="bill-line">
              <span>Current Reading</span>
              <span className="mono">{payload.curr.toFixed(2)} kWh</span>
            </div>
            <div className="bill-line">
              <span>Units Consumed</span>
              <span className="mono">{payload.units.toFixed(2)} kWh</span>
            </div>
            <div className="bill-line">
              <span>Rate per Unit</span>
              <span className="mono">{formatNaira(payload.ratePerUnit)}</span>
            </div>
            <div className="bill-line">
              <span>Unit Charge</span>
              <span className="mono">{formatNaira(payload.unitAmount)}</span>
            </div>
            {payload.misc > 0 && (
              <div className="bill-line">
                <span>Miscellaneous Bill</span>
                <span className="mono">{formatNaira(payload.misc)}</span>
              </div>
            )}
            {payload.hasLineLoss && payload.lineLossShare !== 0 && (
              <div className="bill-line">
                <span>{payload.lineLossShare >= 0 ? 'Shared Line Loss' : 'Shared Surplus'}</span>
                <span className={`mono ${payload.lineLossShare < 0 ? 'loss-negative' : ''}`}>
                  {payload.lineLossShare >= 0 ? '+' : '−'}{formatNaira(Math.abs(payload.lineLossShare))}
                </span>
              </div>
            )}
          </div>

          <div className="bill-total">
            <span>Total Amount Due</span>
            <span className="mono">{formatNaira(payload.finalAmount)}</span>
          </div>

          <div className="bill-actions">
            <button className="btn btn-sm btn-ghost" onClick={handleShare}>Copy / Share Link</button>
            <button className="btn btn-sm btn-primary" onClick={() => downloadBillImage(payload)}>
              Download Image
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
          </div>

          <p className="bill-footer">Generated via MeterCalc</p>
        </section>
      </main>

      <Toast message={toast} />
    </div>
  )
}
