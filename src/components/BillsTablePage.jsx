'use client'

import { useEffect, useMemo, useState } from 'react'
import ResultsTable from './ResultsTable'
import ConcludeDialog from './ConcludeDialog'
import MarkPaymentDialog from './MarkPaymentDialog'
import Toast from './Toast'
import { Wordmark } from './Header'
import {
  fetchCycleById,
  fetchCycleDetail,
  fetchPublicCycle,
  fetchPublicCycleForPlaza,
  fetchComplexSettings,
  fetchPlazaBySlug,
  markBillPayment,
} from '../services/supabase'
import { putEvidence, evidenceKey } from '../services/evidenceStore'
import {
  RATE_PER_UNIT,
  ALLOCATION_PROPORTIONAL,
  formatKwh,
  formatNaira,
  PAYMENT_AWAITING,
  PAYMENT_PAID,
  PAYMENT_UNPAID,
} from '../utils/billing'
import {
  buildCycleTablePayload,
  buildCycleShareUrl,
  buildShareUrl,
  decodePayload,
  openWhatsAppShare,
  resultFromSavedCycle,
  shareOrCopyLink,
} from '../utils/share'
import { navigate } from '../utils/navigation'
import { plazaPath } from '../utils/plaza'

const SHOW_PAYMENT_KEY = 'mc_show_payment_status'

function cycleDateLabel(isoOrLabel) {
  if (!isoOrLabel) {
    return new Date().toLocaleDateString('en-NG', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
  }
  const d = new Date(isoOrLabel)
  if (Number.isNaN(d.getTime())) return isoOrLabel
  return d.toLocaleDateString('en-NG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function RowDrawer({ row, onClose }) {
  if (!row) return null
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog drawer-dialog" onClick={e => e.stopPropagation()}>
        <h3>{row.name}</h3>
        <dl className="breakdown-list">
          <div><dt>Previous</dt><dd className="mono">{formatKwh(row.prev)}</dd></div>
          <div><dt>Current</dt><dd className="mono">{formatKwh(row.curr)}</dd></div>
          <div><dt>Used</dt><dd className="mono">{formatKwh(row.units)}</dd></div>
          <div><dt>Energy</dt><dd className="mono">{formatNaira(row.unitAmount)}</dd></div>
          <div><dt>Misc</dt><dd className="mono">{formatNaira(row.misc)}</dd></div>
          {row.lineLossShare !== undefined && (
            <div>
              <dt>Line loss share</dt>
              <dd className="mono">{formatNaira(row.lineLossShare)}</dd>
            </div>
          )}
          <div>
            <dt>Amount due</dt>
            <dd className="mono amount">
              {formatNaira(row.finalAmount ?? row.amount)}
            </dd>
          </div>
        </dl>
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BillsTablePage({
  mode,
  cycleId,
  complexId,
  complexName,
  plazaSlug,
  draftResult,
  draftCycleDate,
  draftCycleName,
  encoded,
  activeCycleId = null,
  isAdmin = false,
  preview = false,
  onBack,
  onPublish,
  onConclude,
  onEditWorksheet,
}) {
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(mode === 'saved' || mode === 'public-cycle')
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showConclude, setShowConclude] = useState(false)
  const [drawerRow, setDrawerRow] = useState(null)
  const [shareHint, setShareHint] = useState(null)
  const [markTarget, setMarkTarget] = useState(null)
  const [showPaymentStatus, setShowPaymentStatus] = useState(false)
  const [paySettings, setPaySettings] = useState(null)

  useEffect(() => {
    try {
      const fromUrl = typeof window !== 'undefined'
        && new URLSearchParams(window.location.search).get('status') === '1'
      if (fromUrl) {
        setShowPaymentStatus(true)
        localStorage.setItem(SHOW_PAYMENT_KEY, '1')
        return
      }
      setShowPaymentStatus(localStorage.getItem(SHOW_PAYMENT_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  function shareOpts(extra = {}) {
    return { withStatus: showPaymentStatus, ...extra }
  }

  function sharePath(cycleIdForPath, extra = {}) {
    const absolute = buildCycleShareUrl(cycleIdForPath, plazaSlug, shareOpts(extra))
    try {
      const u = new URL(absolute)
      return u.pathname + u.search
    } catch {
      return absolute
    }
  }

  function syncStatusInUrl(next) {
    if (typeof window === 'undefined') return
    if (mode === 'draft' || mode === 'public') return
    const id = cycleId || saved?.cycle?.id
    if (!id) return
    try {
      const url = new URL(window.location.href)
      if (next) url.searchParams.set('status', '1')
      else url.searchParams.delete('status')
      const nextPath = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '')
      window.history.replaceState(null, '', nextPath)
    } catch {
      /* ignore */
    }
  }

  function setPaymentStatusVisible(next) {
    setShowPaymentStatus(next)
    try {
      localStorage.setItem(SHOW_PAYMENT_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
    syncStatusInUrl(next)
  }

  const viewMode = (
    mode === 'public'
    || mode === 'public-cycle'
    || (isAdmin && mode === 'saved' && preview)
  ) ? 'client' : 'admin'

  const isClientView = viewMode === 'client'
  const isAdminPreview = isAdmin && mode === 'saved' && preview

  const publicPayload = useMemo(() => {
    if (mode !== 'public' || !encoded) return null
    try {
      return decodePayload(encoded)
    } catch {
      return null
    }
  }, [mode, encoded])

  useEffect(() => {
    if (mode !== 'saved' && mode !== 'public-cycle') return
    if (!cycleId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    const loadCycle = mode === 'public-cycle'
      ? (plazaSlug
          ? fetchPublicCycleForPlaza(cycleId, plazaSlug).then(p => p?.cycle || null)
          : fetchPublicCycle(cycleId))
      : fetchCycleById(cycleId, complexId)

    Promise.all([loadCycle, fetchCycleDetail(cycleId)])
      .then(([cycle, rows]) => {
        if (cancelled) return
        if (!cycle) {
          setError('This billing cycle was not found.')
          setSaved(null)
          return
        }
        setSaved({ cycle, rows })
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load this billing cycle.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [mode, cycleId, complexId, plazaSlug])

  useEffect(() => {
    let cancelled = false

    async function loadPaySettings() {
      try {
        let settings = null
        const id = complexId || saved?.cycle?.complex_id || null
        if (id) {
          settings = await fetchComplexSettings(id)
        } else if (plazaSlug) {
          settings = await fetchPlazaBySlug(plazaSlug)
        }
        if (!cancelled) setPaySettings(settings)
      } catch {
        if (!cancelled) setPaySettings(null)
      }
    }

    loadPaySettings()
    return () => { cancelled = true }
  }, [complexId, plazaSlug, saved?.cycle?.complex_id, mode])

  const result = useMemo(() => {
    if (mode === 'draft') return draftResult
    if ((mode === 'saved' || mode === 'public-cycle') && saved) {
      return resultFromSavedCycle(saved.cycle, saved.rows)
    }
    if (mode === 'public' && publicPayload) {
      return {
        rows: publicPayload.rows.map(r => ({
          ...r,
          amount: r.amount ?? (r.unitAmount + r.misc),
          finalAmount: r.finalAmount,
        })),
        totalUnits: publicPayload.totalUnits,
        totalMisc: publicPayload.totalMisc,
        totalAmount: publicPayload.totalAmount,
        totalFinalAmount: publicPayload.totalAmount,
        actualBill: publicPayload.actualBill,
        calculatedUnitTotal: publicPayload.calculatedUnitTotal,
        lineLoss: publicPayload.hasLineLoss ? publicPayload.lineLoss : undefined,
        allocationMethod: publicPayload.allocationMethod,
      }
    }
    return null
  }, [mode, draftResult, saved, publicPayload])

  const cycleStatus = saved?.cycle?.status || (mode === 'draft' ? 'draft' : null)
  const isPublished = cycleStatus === 'published'
  const isConcluded = cycleStatus === 'concluded' || (saved?.cycle && !saved.cycle.status)
  const canManage = isAdmin && !isClientView && (mode === 'draft' || mode === 'saved')
  const canPublish = canManage && (mode === 'draft' || isPublished)
  const canConclude = canManage && mode === 'saved' && isPublished
  const canMarkPayment = canManage && mode === 'saved' && (isPublished || isConcluded)
  const canPreviewShared = isAdmin && mode === 'saved' && !isClientView && (isPublished || isConcluded)
  const publishLabel = isPublished || (mode === 'draft' && activeCycleId)
    ? 'Update published'
    : 'Publish'

  const titleDate = mode === 'draft'
    ? cycleDateLabel(draftCycleDate)
    : mode === 'saved' || mode === 'public-cycle'
      ? cycleDateLabel(saved?.cycle?.cycle_date)
      : mode === 'public' && publicPayload
        ? publicPayload.cycleDate
        : cycleDateLabel()

  const displayName = mode === 'draft'
    ? (draftCycleName || 'Draft cycle')
    : saved?.cycle?.name || (mode === 'draft' ? 'Draft bills' : 'Billing summary')

  const splitCaption = result?.allocationMethod === ALLOCATION_PROPORTIONAL
    ? 'By usage'
    : result?.lineLoss !== undefined
      ? 'Even split'
      : null

  const statusLabel = isAdminPreview
    ? 'Shared preview'
    : mode === 'draft'
      ? (activeCycleId ? 'Editing published' : 'Draft')
      : isPublished
        ? 'Published'
        : isConcluded
          ? 'Concluded'
          : mode === 'public' || mode === 'public-cycle'
            ? 'Shared'
            : ''

  function cycleHref(path) {
    return plazaSlug ? plazaPath(plazaSlug, path) : path
  }

  useEffect(() => {
    const id = cycleId || saved?.cycle?.id
    if ((isPublished || isConcluded) && id) {
      setShareHint(buildCycleShareUrl(id, plazaSlug, shareOpts()))
    } else if (mode === 'draft') {
      setShareHint(null)
    }
  }, [isPublished, isConcluded, cycleId, saved?.cycle?.id, mode, plazaSlug, showPaymentStatus])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const canShare = mode === 'public' || mode === 'public-cycle' || isPublished || isConcluded

  function resolveShareUrl() {
    const stableId = mode === 'draft' ? null : (cycleId || saved?.cycle?.id)
    if (stableId && mode !== 'public') {
      return buildCycleShareUrl(stableId, plazaSlug, shareOpts())
    }
    if (!result) return null
    const payload = mode === 'public' && publicPayload
      ? publicPayload
      : buildCycleTablePayload(result, {
          cycleDate: titleDate,
          complexName: complexName || publicPayload?.complexName,
          ratePerUnit: RATE_PER_UNIT,
        })
    const url = buildShareUrl(payload, 'bills')
    return showPaymentStatus ? `${url}${url.includes('?') ? '&' : '?'}status=1` : url
  }

  async function handleShare() {
    const url = resolveShareUrl()
    if (!url) return
    const title = `Electricity bills — ${displayName || titleDate}`
    const outcome = await shareOrCopyLink(url, title)
    if (outcome === 'copied') showToast('Link copied to clipboard')
    if (outcome === 'failed') showToast('Could not copy link')
  }

  function handleWhatsAppShare() {
    const url = resolveShareUrl()
    if (!url) return
    openWhatsAppShare(url, `Electricity bills — ${displayName || titleDate}`)
  }

  async function handlePublish() {
    if (!onPublish || !result) return
    setBusy(true)
    try {
      const cycle = await onPublish(result)
      if (cycle?.id) {
        setShareHint(buildCycleShareUrl(cycle.id, plazaSlug, shareOpts()))
      }
    } catch {
      showToast('Publish failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleConcludeConfirm(evidenceFromDialog) {
    if (!onConclude || !result || !cycleId || !complexId) return
    const evidenceMap = {}
    for (const row of result.rows) {
      const entry = evidenceFromDialog[row.id] || {}
      let fileId = null
      if (entry.file) {
        fileId = evidenceKey(complexId, cycleId, row.id)
        await putEvidence(fileId, entry.file)
      }
      const status = entry.paymentStatus || PAYMENT_UNPAID
      evidenceMap[row.id] = {
        note: entry.note || '',
        fileId,
        paymentStatus: status,
        amountPaid: status === PAYMENT_PAID
          ? (row.amountPaid != null ? row.amountPaid : (row.finalAmount ?? row.amount))
          : status === PAYMENT_UNPAID ? 0 : null,
      }
    }
    try {
      await onConclude(result, evidenceMap)
      setShowConclude(false)
    } catch (err) {
      showToast(err?.message || 'Conclude failed')
    }
  }

  async function applyMarkPayment({ status, amountPaid, note, file }) {
    if (!cycleId || !complexId || !markTarget?.row) return
    const businessId = markTarget.row.id
    if (businessId == null) {
      throw new Error('Missing business id for this bill row.')
    }
    let fileId = null
    if (file) {
      fileId = evidenceKey(complexId, cycleId, businessId)
      await putEvidence(fileId, file)
    }
    const updated = await markBillPayment({
      cycleId,
      businessId,
      status,
      amountPaid,
      note: note || '',
      ...(fileId ? { fileId } : {}),
    })
    setSaved(prev => {
      if (!prev) return prev
      return {
        ...prev,
        rows: prev.rows.map(r =>
          String(r.business_id) === String(businessId)
            ? {
                ...r,
                payment_status: updated.payment_status,
                amount_paid: updated.amount_paid,
                evidence_note: updated.evidence_note,
                evidence_file_id: updated.evidence_file_id,
              }
            : r,
        ),
      }
    })
    setMarkTarget(null)
    showToast('Payment updated')
  }

  async function handleClearPayment(row) {
    if (!cycleId || row?.id == null) return
    try {
      const updated = await markBillPayment({
        cycleId,
        businessId: row.id,
        status: PAYMENT_AWAITING,
      })
      setSaved(prev => {
        if (!prev) return prev
        return {
          ...prev,
          rows: prev.rows.map(r =>
            String(r.business_id) === String(row.id)
              ? {
                  ...r,
                  payment_status: updated.payment_status,
                  amount_paid: updated.amount_paid,
                  evidence_note: updated.evidence_note,
                  evidence_file_id: updated.evidence_file_id,
                }
              : r,
          ),
        }
      })
      showToast('Payment cleared')
    } catch {
      showToast('Could not clear payment')
    }
  }

  function handleRowClick(row) {
    if (row?.id == null) {
      setDrawerRow(row)
      return
    }
    // Legacy encoded /bills snapshots may lack stable business ids.
    if (mode === 'public' && publicPayload) {
      setDrawerRow(row)
      return
    }
    const fromId = cycleId || saved?.cycle?.id
    const fromPath = fromId ? sharePath(fromId) : ''
    const from = fromPath ? `?from=${encodeURIComponent(fromPath)}` : ''
    navigate(`${cycleHref(`/businesses/${row.id}`)}${from}`)
  }

  function enterPreview() {
    const id = cycleId || saved?.cycle?.id
    if (!id) return
    navigate(sharePath(id, { preview: true }))
  }

  function exitPreview() {
    const id = cycleId || saved?.cycle?.id
    if (!id) return
    navigate(sharePath(id))
  }

  const showClientChrome = isClientView

  if (mode === 'public' && !publicPayload) {
    return (
      <div className="app">
        <div className="status-screen">
          <p className="error-text">This bills link is invalid or incomplete.</p>
        </div>
      </div>
    )
  }

  if (mode === 'draft' && !draftResult) {
    return (
      <div className="app">
        <div className="status-screen">
          <p className="error-text">No draft cycle to show.</p>
          <button className="btn btn-primary" onClick={() => navigate(cycleHref('/cycle'))}>
            Back to worksheet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={showClientChrome ? 'app' : undefined}>
      {isAdminPreview && (
        <div className="preview-banner no-print">
          <span>Preview: client shared view</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={exitPreview}>
            Exit preview
          </button>
        </div>
      )}

      {showClientChrome && (
        <header className="header no-print">
          <div className="header-inner">
            <div className="logo">
              <Wordmark />
              {(complexName || publicPayload?.complexName || saved?.cycle?.complex_name) && (
                <span className="complex-label">
                  {complexName || publicPayload?.complexName || saved?.cycle?.complex_name}
                </span>
              )}
            </div>
          </div>
        </header>
      )}

      <main className={`main ${showClientChrome ? 'bills-table-public' : ''} ${canManage ? 'main--with-sticky' : ''}`}>
        {!showClientChrome && (
          <div className="page-nav no-print">
            <button type="button" className="btn-text" onClick={onBack}>
              ← {mode === 'draft' ? 'Back to worksheet' : 'Home'}
            </button>
          </div>
        )}

        <section className="card bills-hero bills-table-header-card">
          <div className="bills-page-head">
            <div className="bills-page-intro">
              <p className="home-kicker">{statusLabel}</p>
              <h2 className="page-title bills-page-title">{displayName}</h2>
              <p className="page-lede">
                {titleDate}
                {splitCaption ? ` · ${splitCaption}` : ''}
              </p>

              {(paySettings?.account_name || paySettings?.bank_name || paySettings?.account_number) ? (
                <div className="bills-payinto">
                  <p className="bills-payinto-kicker">Pay into</p>
                  <div className="bills-payinto-grid">
                    {paySettings.account_name && (
                      <div className="bills-payinto-item">
                        <span className="invoice-pay-label">Account name</span>
                        <strong>{paySettings.account_name}</strong>
                      </div>
                    )}
                    {paySettings.bank_name && (
                      <div className="bills-payinto-item">
                        <span className="invoice-pay-label">Bank</span>
                        <strong>{paySettings.bank_name}</strong>
                      </div>
                    )}
                    {paySettings.account_number && (
                      <div className="bills-payinto-item">
                        <span className="invoice-pay-label">Account number</span>
                        <strong className="mono">{paySettings.account_number}</strong>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                isAdmin && !isClientView && (
                  <p className="bills-payinto-empty muted no-print">
                    No pay-into account yet.{' '}
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => navigate(cycleHref('/settings'))}
                    >
                      Add it in Settings
                    </button>
                  </p>
                )
              )}

              <div className="bills-toolbar no-print">
                <div className="bills-toolbar-group">
                  <span className="bills-toolbar-label">Payment Status</span>
                  <div className="payment-view-toggle" role="group" aria-label="Payment status display">
                    <button
                      type="button"
                      className={`payment-view-tab ${showPaymentStatus ? 'active' : ''}`}
                      onClick={() => setPaymentStatusVisible(true)}
                    >
                      Show
                    </button>
                    <button
                      type="button"
                      className={`payment-view-tab ${!showPaymentStatus ? 'active' : ''}`}
                      onClick={() => setPaymentStatusVisible(false)}
                    >
                      Hide
                    </button>
                  </div>
                </div>

                {(canPreviewShared || (canManage && isPublished && onEditWorksheet)) && (
                  <div className="bills-toolbar-group">
                    <span className="bills-toolbar-label">Manage</span>
                    <div className="bills-toolbar-actions">
                      {canPreviewShared && (
                        <button className="btn btn-sm btn-ghost" onClick={enterPreview}>
                          Preview shared view
                        </button>
                      )}
                      {canManage && isPublished && onEditWorksheet && (
                        <button className="btn btn-sm btn-ghost" onClick={onEditWorksheet}>
                          Edit worksheet
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {canShare && (
                  <div className="bills-toolbar-group">
                    <span className="bills-toolbar-label">Share</span>
                    <div className="bills-toolbar-actions">
                      <button className="btn btn-sm btn-ghost" onClick={() => window.print()}>
                        Print
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={handleShare}>
                        Share
                      </button>
                      <button className="btn btn-sm btn-primary" onClick={handleWhatsAppShare}>
                        WhatsApp
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {canShare && shareHint && !isClientView && (
            <div className="share-hint no-print">
              <span className="share-hint-label">Stable link</span>
              <code className="share-hint-url">{shareHint}</code>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareHint)
                    showToast('Link copied')
                  } catch {
                    showToast('Could not copy link')
                  }
                }}
              >
                Copy
              </button>
            </div>
          )}

          {result?.lineLoss !== undefined && (
            <div className="figures-strip">
              <div className="figure">
                <div className="figure-label">Meter total</div>
                <div className="figure-value">{formatNaira(result.calculatedUnitTotal)}</div>
              </div>
              <div className="figure">
                <div className="figure-label">NEPA office bill</div>
                <div className="figure-value">{formatNaira(result.actualBill)}</div>
              </div>
              <div className="figure">
                <div className="figure-label">
                  {result.lineLoss >= 0 ? 'Offset' : 'Surplus'}
                </div>
                <div className={`figure-value ${result.lineLoss >= 0 ? 'loss-positive' : 'loss-negative'}`}>
                  {formatNaira(Math.abs(result.lineLoss))}
                </div>
              </div>
            </div>
          )}
        </section>

        {loading && <p className="line-loss-hint">Loading...</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && result && (
          <ResultsTable
            result={result}
            onRowClick={handleRowClick}
            interactive
            showPaymentStatus={showPaymentStatus}
            canMarkPayment={canMarkPayment}
            onMarkPaid={row => setMarkTarget({ row, mode: 'paid' })}
            onMarkUnpaid={row => setMarkTarget({ row, mode: 'unpaid' })}
            onClearPayment={handleClearPayment}
          />
        )}
      </main>

      {canManage && (canPublish || canConclude) && (
        <div className="cycle-sticky-bar no-print">
          <div className="cycle-sticky-inner">
            <p className="cycle-sticky-hint">
              {isConcluded
                ? 'This cycle is locked.'
                : isPublished || (mode === 'draft' && activeCycleId)
                  ? 'Update the published table, or conclude when payments are done.'
                  : 'Publish to get a stable share link. Conclude later to lock readings.'}
            </p>
            <div className="cycle-sticky-actions">
              {canPublish && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || result?.lineLoss === undefined}
                  onClick={handlePublish}
                >
                  {busy ? 'Publishing...' : publishLabel}
                </button>
              )}
              {canConclude && (
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() => setShowConclude(true)}
                >
                  Conclude cycle
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showConclude && result && (
        <ConcludeDialog
          rows={result.rows}
          initialStatuses={Object.fromEntries(
            result.rows.map(r => [r.id, r.paymentStatus || PAYMENT_AWAITING]),
          )}
          onConfirm={handleConcludeConfirm}
          onCancel={() => setShowConclude(false)}
        />
      )}

      {markTarget && (
        <MarkPaymentDialog
          row={markTarget.row}
          mode={markTarget.mode}
          onConfirm={async (payload) => {
            try {
              await applyMarkPayment(payload)
            } catch {
              showToast('Could not update payment')
              throw new Error('Could not update payment')
            }
          }}
          onCancel={() => setMarkTarget(null)}
        />
      )}

      {drawerRow && (
        <RowDrawer row={drawerRow} onClose={() => setDrawerRow(null)} />
      )}

      <Toast message={toast} />
    </div>
  )
}
