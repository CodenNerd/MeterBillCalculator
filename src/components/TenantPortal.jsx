import { useEffect, useState } from 'react'
import { fetchMyBillHistory, signOut } from '../services/auth'
import { RATE_PER_UNIT, formatNaira } from '../utils/billing'
import { buildBillPayload, buildShareUrl, shareOrCopyLink } from '../utils/share'
import { downloadBillImage } from '../utils/billImage'
import Header from './Header'
import Toast from './Toast'

function rowFor(bill) {
  return {
    id: bill.business_id,
    name: bill.business_name,
    prev: bill.previous_reading,
    curr: bill.current_reading,
    units: bill.units,
    unitAmount: bill.unit_amount,
    misc: bill.misc,
    lineLossShare: bill.line_loss_share,
    finalAmount: bill.final_amount,
    amount: bill.unit_amount + bill.misc,
  }
}

function ctxFor(bill) {
  return {
    ratePerUnit: RATE_PER_UNIT,
    hasLineLoss: bill.line_loss_share !== 0,
    cycleDate: new Date(bill.created_at).toLocaleDateString('en-NG', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    }),
  }
}

export default function TenantPortal({ business }) {
  const [bills, setBills] = useState(null)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    fetchMyBillHistory()
      .then(setBills)
      .catch(() => setError('Failed to load your bill history.'))
  }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleShare(bill) {
    const payload = buildBillPayload(rowFor(bill), ctxFor(bill))
    const url = buildShareUrl(payload)
    const outcome = await shareOrCopyLink(url, `${bill.business_name} — Electricity Bill`)
    if (outcome === 'copied') showToast('Link copied to clipboard')
    if (outcome === 'failed') showToast('Could not copy link')
  }

  function handleDownload(bill) {
    const payload = buildBillPayload(rowFor(bill), ctxFor(bill))
    downloadBillImage(payload)
  }

  return (
    <div className="app">
      <Header />
      <main className="main">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">{business?.name || 'Your Business'}</h2>
              <p className="card-sub">Your billing history</p>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => signOut()}>Sign Out</button>
          </div>

          {error && <p className="error-text tenant-msg">{error}</p>}
          {!error && bills === null && <p className="line-loss-hint tenant-msg">Loading...</p>}
          {!error && bills && bills.length === 0 && (
            <p className="line-loss-hint tenant-msg">
              No bills yet — check back after your next billing cycle.
            </p>
          )}

          {bills && bills.length > 0 && (
            <div className="history-list tenant-history-list">
              {bills.map(bill => (
                <div key={bill.id} className="history-item">
                  <div className="history-item-head tenant-history-head">
                    <span>{new Date(bill.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}</span>
                    <span className="mono muted">{bill.units} kWh</span>
                    <span className="mono">{formatNaira(bill.final_amount)}</span>
                  </div>
                  <div className="history-detail bill-actions tenant-bill-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => handleShare(bill)}>
                      Share Link
                    </button>
                    <button className="btn btn-sm btn-primary" onClick={() => handleDownload(bill)}>
                      Download Image
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Toast message={toast} />
    </div>
  )
}
