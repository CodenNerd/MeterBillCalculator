import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useBusinesses } from './hooks/useBusinesses'
import { useStorage } from './hooks/useStorage'
import { calculateBills, applyLineLoss, RATE_PER_UNIT } from './utils/billing'
import { saveBillingCycle } from './services/supabase'
import { useHashRoute, navigate } from './utils/hashRouter'
import { buildBillPayload, buildShareUrl, shareOrCopyLink } from './utils/share'
import { downloadBillImage } from './utils/billImage'
import Header from './components/Header'
import InputGrid from './components/InputGrid'
import ResultsPage from './components/ResultsPage'
import BillPage from './components/BillPage'
import CycleHistory from './components/CycleHistory'
import ConfirmDialog from './components/ConfirmDialog'
import AddBusinessDialog from './components/AddBusinessDialog'
import AuthGate from './components/AuthGate'
import TenantPortal from './components/TenantPortal'
import Toast from './components/Toast'
import './App.css'

export default function App() {
  const route = useHashRoute()

  const { session, role, complex, business, ready, authError } = useAuth()

  // Remote data — businesses + their previous readings, scoped to this complex
  const { businesses, loading, error, add, rename, remove, setPrevious, saveCycle, reload } =
    useBusinesses(complex?.id)

  // Current readings still live locally (in-progress, not saved yet)
  const [current, setCurrent] = useStorage('mc_current', {})

  // Optional miscellaneous bill per business, also in-progress/local
  const [misc, setMisc] = useStorage('mc_misc', {})

  const [result, setResult] = useState(null)
  const [flash, setFlash] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showAddBusiness, setShowAddBusiness] = useState(false)

  // Build the shape InputGrid and calculateBills expect
  const bizList = businesses.map(b => ({ id: b.id, name: b.name }))
  const previous = Object.fromEntries(businesses.map(b => [b.id, b.previous_reading]))

  // ---- Input handlers ----
  function handleCurrentChange(id, value) {
    setCurrent({ ...current, [id]: value })
  }

  function handleMiscChange(id, value) {
    setMisc({ ...misc, [id]: value })
  }

  async function handleRename(id, newName) {
    await rename(id, newName)
  }

  async function handleSetPrevious(id, value) {
    await setPrevious(id, value)
    setResult(null)
  }

  function handleRemove(id) {
    setConfirm({
      message: 'Remove this business?',
      detail: 'Their reading history for this cycle will be lost.',
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        await remove(id)
        const { [id]: _, ...rest } = current
        setCurrent(rest)
        const { [id]: __, ...restMisc } = misc
        setMisc(restMisc)
        setResult(null)
        setConfirm(null)
      },
    })
  }

  async function handleAddBusiness(biz) {
    const saved = await add(biz)
    if (saved) {
      setShowAddBusiness(false)
      showToast('New business added')
    }
  }

  // ---- Calculate ----
  function handleCalculate() {
    const res = calculateBills(bizList, previous, current, misc)
    setResult(res)
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
    navigate('/results')
  }

  // Redirect to the input page if someone lands on #/results with nothing computed
  // (e.g. a stale bookmark or a page refresh).
  useEffect(() => {
    if (route.path === 'results' && !result) {
      navigate('/')
    }
  }, [route.path, result])

  // ---- Line loss reconciliation ----
  function handleApplyLineLoss(actualBill) {
    setResult(prev => applyLineLoss(prev, actualBill))
  }

  function handleResetLineLoss() {
    setResult(calculateBills(bizList, previous, current, misc))
  }

  // ---- Share / download an individual business's bill ----
  function billContext() {
    const hasLineLoss = result?.lineLoss !== undefined
    return {
      ratePerUnit: RATE_PER_UNIT,
      hasLineLoss,
      cycleDate: new Date().toLocaleDateString('en-NG', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      }),
    }
  }

  async function handleShareRow(row) {
    const payload = buildBillPayload(row, billContext())
    const url = buildShareUrl(payload)
    const outcome = await shareOrCopyLink(url, `${row.name} — Electricity Bill`)
    if (outcome === 'copied') showToast('Link copied to clipboard')
    if (outcome === 'failed') showToast('Could not copy link')
  }

  function handleDownloadRow(row) {
    const payload = buildBillPayload(row, billContext())
    downloadBillImage(payload)
  }

  // ---- Save cycle ----
  function handleSave() {
    setConfirm({
      message: 'Save as previous readings?',
      detail: "Current readings become next cycle's starting point for everyone. This cycle's bill breakdown will be saved to history.",
      confirmLabel: 'Save & Continue',
      danger: false,
      onConfirm: async () => {
        try {
          const hasLineLoss = result.lineLoss !== undefined
          const calculatedUnitTotal = hasLineLoss
            ? result.calculatedUnitTotal
            : result.rows.reduce((sum, r) => sum + r.unitAmount, 0)

          const summary = {
            actualBill: hasLineLoss ? result.actualBill : calculatedUnitTotal,
            calculatedUnitTotal,
            totalMisc: result.totalMisc,
            lineLoss: hasLineLoss ? result.lineLoss : 0,
          }

          await saveBillingCycle(summary, result.rows, complex.id)
          await saveCycle(current)
          setCurrent({})
          setMisc({})
          setResult(null)
          setConfirm(null)
          navigate('/')
          showToast('Saved — ready for next billing cycle')
        } catch {
          showToast('Save failed. Please try again.')
          setConfirm(null)
        }
      },
    })
  }

  // ---- Clear inputs ----
  function handleClear() {
    setConfirm({
      message: 'Clear current readings?',
      detail: 'All values entered this cycle will be removed. Previous readings stay intact.',
      confirmLabel: 'Clear',
      danger: true,
      onConfirm: () => {
        setCurrent({})
        setMisc({})
        setResult(null)
        setConfirm(null)
        showToast('Inputs cleared')
      },
    })
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  // ---- Auth gating ----
  // The shared bill page is fully self-contained (data lives in the URL) —
  // render it without any of the app chrome, auth, or Supabase state.
  if (route.path === 'bill') {
    return <BillPage encoded={route.params.d} />
  }

  if (!ready) {
    return (
      <div className="app">
        <Header />
        <div className="status-screen">
          <div className="spinner" />
          <p>Checking your account...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthGate />
  }

  if (authError) {
    return (
      <div className="app">
        <Header />
        <div className="status-screen">
          <p className="error-text">{authError}</p>
        </div>
      </div>
    )
  }

  if (role === 'business') {
    return <TenantPortal business={business} />
  }

  // ---- Admin app: loading / error states ----
  if (loading) {
    return (
      <div className="app">
        <Header complexName={complex?.name} showSignOut />
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading readings...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app">
        <Header complexName={complex?.name} showSignOut />
        <div className="status-screen">
          <p className="error-text">{error}</p>
          <button className="btn btn-primary" onClick={reload}>Try Again</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Header
        complexName={complex?.name}
        showSignOut
        onShowHistory={() => setShowHistory(true)}
      />

      {route.path === 'results' && result ? (
        <ResultsPage
          result={result}
          flash={flash}
          onBack={() => navigate('/')}
          onSave={handleSave}
          onPrint={() => window.print()}
          onApplyLineLoss={handleApplyLineLoss}
          onResetLineLoss={handleResetLineLoss}
          onShareRow={handleShareRow}
          onDownloadRow={handleDownloadRow}
        />
      ) : (
        <main className="main">
          <InputGrid
            businesses={bizList}
            previous={previous}
            current={current}
            misc={misc}
            onChange={handleCurrentChange}
            onMiscChange={handleMiscChange}
            onRename={handleRename}
            onRemove={handleRemove}
            onSetPrevious={handleSetPrevious}
            onAddBusiness={() => setShowAddBusiness(true)}
            onCalculate={handleCalculate}
            onClear={handleClear}
          />

          {result && (
            <div className="results-resume">
              <button className="btn btn-sm btn-outline" onClick={() => navigate('/results')}>
                View Last Calculated Results →
              </button>
            </div>
          )}
        </main>
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          detail={confirm.detail}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {showAddBusiness && (
        <AddBusinessDialog
          onAdd={handleAddBusiness}
          onCancel={() => setShowAddBusiness(false)}
        />
      )}

      {showHistory && <CycleHistory complexId={complex?.id} onClose={() => setShowHistory(false)} />}

      <Toast message={toast} />
    </div>
  )
}
