import { useEffect, useMemo, useState } from 'react'
import ResultsTable from './ResultsTable'
import ConcludeDialog from './ConcludeDialog'
import Toast from './Toast'
import { Wordmark } from './Header'
import {
  fetchCycleById,
  fetchCycleDetail,
  fetchPublicCycle,
} from '../services/supabase'
import { putEvidence, evidenceKey } from '../services/evidenceStore'
import {
  RATE_PER_UNIT,
  ALLOCATION_PROPORTIONAL,
  formatKwh,
  formatNaira,
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
import { navigate } from '../utils/hashRouter'

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
  draftResult,
  draftCycleDate,
  draftCycleName,
  encoded,
  activeCycleId = null,
  isAdmin = false,
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
      ? fetchPublicCycle(cycleId)
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
  }, [mode, cycleId, complexId])

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
  const canManage = isAdmin && (mode === 'draft' || mode === 'saved')
  const canPublish = canManage && (mode === 'draft' || isPublished)
  const canConclude = canManage && mode === 'saved' && isPublished
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

  const statusLabel = mode === 'draft'
    ? (activeCycleId ? 'Editing published' : 'Draft')
    : isPublished
      ? 'Published'
      : isConcluded
        ? 'Concluded'
        : mode === 'public' || mode === 'public-cycle'
          ? 'Shared'
          : ''

  useEffect(() => {
    const id = cycleId || saved?.cycle?.id
    if ((isPublished || isConcluded) && id) {
      setShareHint(buildCycleShareUrl(id))
    } else if (mode === 'draft') {
      setShareHint(null)
    }
  }, [isPublished, isConcluded, cycleId, saved?.cycle?.id, mode])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const canShare = mode === 'public' || mode === 'public-cycle' || isPublished || isConcluded

  function resolveShareUrl() {
    const stableId = mode === 'draft' ? null : (cycleId || saved?.cycle?.id)
    if (stableId && mode !== 'public') {
      return buildCycleShareUrl(stableId)
    }
    if (!result) return null
    const payload = mode === 'public' && publicPayload
      ? publicPayload
      : buildCycleTablePayload(result, {
          cycleDate: titleDate,
          complexName: complexName || publicPayload?.complexName,
          ratePerUnit: RATE_PER_UNIT,
        })
    return buildShareUrl(payload, 'bills')
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
        setShareHint(buildCycleShareUrl(cycle.id))
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
      evidenceMap[row.id] = {
        note: entry.note || '',
        fileId,
      }
    }
    await onConclude(result, evidenceMap)
    setShowConclude(false)
  }

  function handleRowClick(row) {
    if (isAdmin && mode !== 'public' && mode !== 'public-cycle') {
      navigate(`/businesses/${row.id}`)
      return
    }
    setDrawerRow(row)
  }

  const isPublicShell = mode === 'public' || mode === 'public-cycle'

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
          <button className="btn btn-primary" onClick={() => navigate('/cycle')}>
            Back to worksheet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={isPublicShell ? 'app' : undefined}>
      {isPublicShell && (
        <header className="header no-print">
          <div className="header-inner">
            <div className="logo">
              <Wordmark />
              {(complexName || publicPayload?.complexName) && (
                <span className="complex-label">
                  {complexName || publicPayload?.complexName}
                </span>
              )}
            </div>
          </div>
        </header>
      )}

      <main className={`main ${isPublicShell ? 'bills-table-public' : ''} ${canManage ? 'main--with-sticky' : ''}`}>
        {!isPublicShell && (
          <div className="page-nav no-print">
            <button type="button" className="btn-text" onClick={onBack}>
              ← {mode === 'draft' ? 'Back to worksheet' : 'Home'}
            </button>
          </div>
        )}

        <section className="card bills-hero bills-table-header-card">
          <div className="bills-page-head">
            <div>
              <p className="home-kicker">{statusLabel}</p>
              <h2 className="page-title bills-page-title">{displayName}</h2>
              <p className="page-lede">
                {titleDate}
                {splitCaption ? ` · ${splitCaption}` : ''}
              </p>
            </div>
            <div className="result-actions no-print">
              {canManage && isPublished && onEditWorksheet && (
                <button className="btn btn-sm btn-ghost" onClick={onEditWorksheet}>
                  Edit worksheet
                </button>
              )}
              {canShare && (
                <>
                  <button className="btn btn-sm btn-ghost" onClick={() => window.print()}>
                    Print
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={handleShare}>
                    Share
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={handleWhatsAppShare}>
                    WhatsApp
                  </button>
                </>
              )}
            </div>
          </div>

          {canShare && shareHint && (
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
                <div className="figure-label">Office bill</div>
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
                  ? 'Update the published table, or open the cycle to conclude when payments are done.'
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
          onConfirm={handleConcludeConfirm}
          onCancel={() => setShowConclude(false)}
        />
      )}

      {drawerRow && (
        <RowDrawer row={drawerRow} onClose={() => setDrawerRow(null)} />
      )}

      <Toast message={toast} />
    </div>
  )
}
