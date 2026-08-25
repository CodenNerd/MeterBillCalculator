'use client'

import Link from 'next/link'
import {
  formatKwh,
  formatNaira,
  paymentStatusLabel,
  RATE_PER_UNIT,
  PAYMENT_AWAITING,
  tenantNameForBill,
} from '../utils/billing'
import Breadcrumbs from './Breadcrumbs'
import TenantSwitcher from './TenantSwitcher'

export default function InvoiceCard({
  business,
  bill,
  cycle,
  settings,
  evidenceUrl,
  onBack,
  breadcrumbs,
  tenants,
  viewAllHref,
  compact = false,
}) {
  const rate = Number(settings?.rate_per_unit) > 0
    ? Number(settings.rate_per_unit)
    : RATE_PER_UNIT
  const status = bill.payment_status || PAYMENT_AWAITING
  const energy = Number(bill.unit_amount) || 0
  const misc = Number(bill.misc) || 0
  const share = Number(bill.line_loss_share) || 0
  const finalAmount = Number(bill.final_amount) || energy + misc + share
  const units = Number(bill.units) || 0
  const prev = Number(bill.previous_reading) || 0
  const curr = Number(bill.current_reading) || 0

  const Root = compact ? 'div' : 'main'

  return (
    <Root className={`main main--invoice ${compact ? 'main--invoice-compact' : ''}`}>
      {!compact && (
        <div className="page-nav no-print">
          <div className="invoice-nav-lead">
            {breadcrumbs?.length ? (
              <Breadcrumbs items={breadcrumbs} />
            ) : onBack ? (
              <button type="button" className="btn-text" onClick={onBack}>
                ← Back to timeline
              </button>
            ) : null}
          </div>
          <div className="invoice-nav-actions">
            {viewAllHref && (
              <Link href={viewAllHref} className="btn btn-sm btn-ghost" prefetch>
                View all
              </Link>
            )}
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => window.print()}
            >
              Print / Save PDF
            </button>
          </div>
        </div>
      )}

      {!compact && tenants?.length > 1 && (
        <div className="no-print" style={{ marginBottom: 12, maxWidth: 560 }}>
          <TenantSwitcher
            tenants={tenants}
            currentId={business?.id}
            ariaLabel="Switch tenant invoice"
          />
        </div>
      )}

      <article className="invoice-card invoice-card--print">
        <header className="invoice-head">
          <div>
            <p className="home-kicker">Invoice</p>
            <h1 className="page-title">{tenantNameForBill(bill, business)}</h1>
            <p className="page-lede">
              {cycle?.name || 'Billing cycle'}
              {' · '}
              {cycle?.cycle_date
                ? new Date(cycle.cycle_date).toLocaleDateString('en-NG', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })
                : ''}
            </p>
          </div>
          <div className={`payment-badge payment-badge--${status}`}>
            {paymentStatusLabel(status, cycle?.status)}
          </div>
        </header>

        <div className="invoice-due">
          <span className="invoice-due-label">Amount due</span>
          <span className="mono invoice-due-value">{formatNaira(finalAmount)}</span>
        </div>

        <section className="invoice-section">
          <h2 className="section-title">Breakdown</h2>
          <dl className="invoice-breakdown">
            <div>
              <dt>Previous reading</dt>
              <dd className="mono">{formatKwh(prev)}</dd>
            </div>
            <div>
              <dt>Current reading</dt>
              <dd className="mono">{formatKwh(curr)}</dd>
            </div>
            <div>
              <dt>Units used</dt>
              <dd className="mono">
                {formatKwh(units)}
                <span className="invoice-formula">current − previous</span>
              </dd>
            </div>
            <div>
              <dt>Energy</dt>
              <dd className="mono">
                {formatNaira(energy)}
                <span className="invoice-formula">
                  {units.toFixed(2)} × ₦{rate}
                </span>
              </dd>
            </div>
            <div>
              <dt>Misc</dt>
              <dd className="mono">
                {formatNaira(misc)}
                {bill.misc_note ? (
                  <span className="invoice-formula">{bill.misc_note}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Offset share</dt>
              <dd className="mono">
                {share >= 0 ? '+' : '−'}{formatNaira(Math.abs(share))}
                <span className="invoice-formula">share of office − meter gap</span>
              </dd>
            </div>
            <div className="invoice-breakdown-total">
              <dt>Final</dt>
              <dd className="mono">
                {formatNaira(finalAmount)}
                <span className="invoice-formula">energy + misc + offset share</span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="invoice-section">
          <h2 className="section-title">Pay into</h2>
          {(settings?.account_number || settings?.account_name || settings?.bank_name) ? (
            <div className="invoice-paybox">
              {settings.account_name && (
                <div>
                  <span className="invoice-pay-label">Account name</span>
                  <strong>{settings.account_name}</strong>
                </div>
              )}
              {settings.bank_name && (
                <div>
                  <span className="invoice-pay-label">Bank</span>
                  <strong>{settings.bank_name}</strong>
                </div>
              )}
              {settings.account_number && (
                <div>
                  <span className="invoice-pay-label">Account number</span>
                  <strong className="mono">{settings.account_number}</strong>
                </div>
              )}
            </div>
          ) : (
            <p className="muted">No payment account configured yet. Add it in Settings.</p>
          )}
        </section>

        {(bill.evidence_note || evidenceUrl) && (
          <section className="invoice-section">
            <h2 className="section-title">Evidence</h2>
            {bill.evidence_note && <p>{bill.evidence_note}</p>}
            {evidenceUrl && (
              <img src={evidenceUrl} alt="Payment evidence" className="evidence-thumb" />
            )}
          </section>
        )}
      </article>
    </Root>
  )
}
