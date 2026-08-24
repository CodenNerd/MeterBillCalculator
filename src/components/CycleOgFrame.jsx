import { Wordmark } from './Header'
import { formatNaira } from '../utils/billing'

/**
 * Fixed 1200×630 frame mirroring the public cycle bills view for OG screenshots.
 */
export default function CycleOgFrame({ plaza, cycle, rows }) {
  const name = cycle?.name || 'Billing cycle'
  const date = cycle?.cycle_date
    ? new Date(cycle.cycle_date).toLocaleDateString('en-NG', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : ''
  const status = cycle?.status === 'concluded' ? 'Concluded' : 'Published'
  const split = cycle?.allocation_method === 'proportional' ? 'By usage' : 'Even split'
  const meterTotal = Number(cycle?.calculated_total) || 0
  const office = Number(cycle?.actual_bill) || 0
  const offset = Number(cycle?.line_loss) || 0
  const offsetLabel = offset >= 0 ? 'Offset' : 'Surplus'
  const sorted = [...(rows || [])].sort(
    (a, b) => Number(b.final_amount) - Number(a.final_amount),
  )
  const visible = sorted.slice(0, 5)
  const more = Math.max(0, sorted.length - visible.length)

  return (
    <div id="og-root" className="og-root">
      <header className="og-frame-header">
        <Wordmark />
        {plaza?.name && <span className="complex-label">{plaza.name}</span>}
      </header>

      <section className="card bills-hero og-frame-hero">
        <p className="home-kicker">{status}</p>
        <h1 className="page-title bills-page-title">{name}</h1>
        <p className="page-lede">
          {date}
          {split ? ` · ${split}` : ''}
        </p>

        {(plaza?.account_name || plaza?.bank_name || plaza?.account_number) && (
          <div className="bills-payinto">
            <p className="bills-payinto-kicker">Pay into</p>
            <div className="bills-payinto-grid">
              {plaza.account_name && (
                <div className="bills-payinto-item">
                  <span className="invoice-pay-label">Account name</span>
                  <strong>{plaza.account_name}</strong>
                </div>
              )}
              {plaza.bank_name && (
                <div className="bills-payinto-item">
                  <span className="invoice-pay-label">Bank</span>
                  <strong>{plaza.bank_name}</strong>
                </div>
              )}
              {plaza.account_number && (
                <div className="bills-payinto-item">
                  <span className="invoice-pay-label">Account number</span>
                  <strong className="mono">{plaza.account_number}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="figures-strip">
          <div className="figure">
            <div className="figure-label">Meter total</div>
            <div className="figure-value">{formatNaira(meterTotal)}</div>
          </div>
          <div className="figure">
            <div className="figure-label">NEPA office bill</div>
            <div className="figure-value">{formatNaira(office)}</div>
          </div>
          <div className="figure">
            <div className="figure-label">{offsetLabel}</div>
            <div className={`figure-value ${offset >= 0 ? 'loss-positive' : 'loss-negative'}`}>
              {formatNaira(Math.abs(offset))}
            </div>
          </div>
        </div>
      </section>

      <div className="og-frame-table card">
        <div className="og-frame-table-head">
          <span>Business</span>
          <span className="align-right">Units</span>
          <span className="align-right">Amount due</span>
        </div>
        <ul className="og-frame-table-body">
          {visible.map((row) => (
            <li key={row.id || row.business_id}>
              <span className="og-frame-name">{row.business_name}</span>
              <span className="mono align-right">{Number(row.units).toFixed(1)}</span>
              <span className="mono align-right amount">
                {formatNaira(Number(row.final_amount) || 0)}
              </span>
            </li>
          ))}
        </ul>
        {more > 0 && (
          <p className="og-frame-more muted">+{more} more tenant{more === 1 ? '' : 's'}</p>
        )}
      </div>
    </div>
  )
}
