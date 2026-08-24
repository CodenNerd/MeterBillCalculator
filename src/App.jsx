import { useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useBusinesses } from './hooks/useBusinesses'
import { useStorage } from './hooks/useStorage'
import {
  ALLOCATION_EQUAL,
  computeCycleResult,
  defaultCycleName,
  toDateInputValue,
} from './utils/billing'
import {
  publishCycle,
  concludeCycle,
  fetchCycleById,
  fetchCycleDetail,
} from './services/supabase'
import { useHashRoute, navigate } from './utils/hashRouter'
import Header from './components/Header'
import Home from './components/Home'
import CyclePage from './components/CyclePage'
import BillsTablePage from './components/BillsTablePage'
import BusinessTimeline from './components/BusinessTimeline'
import ConfirmDialog from './components/ConfirmDialog'
import AddBusinessDialog from './components/AddBusinessDialog'
import AuthGate from './components/AuthGate'
import Toast from './components/Toast'
import './App.css'

export default function App() {
  const route = useHashRoute()

  const { session, complex, ready, authError } = useAuth()

  const { businesses, loading, error, add, rename, remove, reload } =
    useBusinesses(complex?.id)

  const [current, setCurrent] = useStorage('mc_current', {})
  const [misc, setMisc] = useStorage('mc_misc', {})
  const [notes, setNotes] = useStorage('mc_notes', {})
  const [actualBill, setActualBill] = useStorage('mc_actual_bill', '')
  const [allocationMethod, setAllocationMethod] = useStorage('mc_alloc_method', ALLOCATION_EQUAL)
  const [cycleDate, setCycleDate] = useStorage('mc_cycle_date', toDateInputValue())
  const [cycleName, setCycleName] = useStorage('mc_cycle_name', defaultCycleName())
  const [activeCycleId, setActiveCycleId] = useStorage('mc_active_cycle_id', null)

  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [showAddBusiness, setShowAddBusiness] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)

  const bizList = businesses.map(b => ({ id: b.id, name: b.name }))
  const previous = Object.fromEntries(businesses.map(b => [b.id, b.previous_reading]))

  const draftResult = useMemo(
    () => computeCycleResult(
      businesses.map(b => ({ id: b.id, name: b.name })),
      Object.fromEntries(businesses.map(b => [b.id, b.previous_reading])),
      current,
      misc,
      actualBill,
      allocationMethod,
      notes,
    ),
    [businesses, current, misc, notes, actualBill, allocationMethod],
  )

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function handleCurrentChange(id, value) {
    setCurrent({ ...current, [id]: value })
  }

  function handleMiscChange(id, value) {
    setMisc({ ...misc, [id]: value })
  }

  function handleNoteChange(id, value) {
    setNotes({ ...notes, [id]: value })
  }

  async function handleRename(id, newName) {
    await rename(id, newName)
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
        const { [id]: ___, ...restNotes } = notes
        setNotes(restNotes)
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

  function clearDraft() {
    setCurrent({})
    setMisc({})
    setNotes({})
    setActualBill('')
    setAllocationMethod(ALLOCATION_EQUAL)
    setCycleDate(toDateInputValue())
    setCycleName(defaultCycleName())
    setActiveCycleId(null)
  }

  function handleClear() {
    setConfirm({
      message: 'Clear this draft cycle?',
      detail: 'All current readings, misc amounts, and the office bill will be removed. Previous readings stay intact.',
      confirmLabel: 'Clear',
      danger: true,
      onConfirm: () => {
        clearDraft()
        setConfirm(null)
        showToast('Draft cleared')
      },
    })
  }

  async function hydrateFromCycle(cycleId) {
    const [cycle, rows] = await Promise.all([
      fetchCycleById(cycleId, complex.id),
      fetchCycleDetail(cycleId),
    ])
    if (!cycle) {
      showToast('Cycle not found')
      return null
    }
    if (cycle.status === 'concluded') {
      navigate(`/cycles/${cycleId}`)
      return cycle
    }

    const nextCurrent = {}
    const nextMisc = {}
    const nextNotes = {}
    for (const r of rows) {
      nextCurrent[r.business_id] = String(r.current_reading)
      nextMisc[r.business_id] = r.misc ? String(r.misc) : ''
      nextNotes[r.business_id] = r.misc_note || ''
    }
    setCurrent(nextCurrent)
    setMisc(nextMisc)
    setNotes(nextNotes)
    setActualBill(String(cycle.actual_bill))
    setAllocationMethod(cycle.allocation_method || ALLOCATION_EQUAL)
    setCycleDate(toDateInputValue(cycle.cycle_date))
    setCycleName(cycle.name || defaultCycleName(cycle.cycle_date))
    setActiveCycleId(cycle.id)
    return cycle
  }

  async function handleContinuePublished(cycleId) {
    try {
      await hydrateFromCycle(cycleId)
      navigate('/cycle')
    } catch {
      showToast('Could not open published cycle')
    }
  }

  function resolveExistingCycleId(overrides = {}) {
    if (overrides.cycleId != null) return overrides.cycleId
    if (activeCycleId != null) return activeCycleId
    if (route.path === 'cycles' && route.params.id && route.params.id !== 'draft') {
      return route.params.id
    }
    return null
  }

  async function handlePublish(result, overrides = {}) {
    if (result.lineLoss === undefined) {
      showToast('Enter the office bill before publishing')
      throw new Error('Missing office bill')
    }

    const dateValue = overrides.cycleDate || cycleDate || toDateInputValue()
    const nameValue = overrides.name || cycleName || defaultCycleName(dateValue)
    const existingId = resolveExistingCycleId(overrides)

    const summary = {
      actualBill: result.actualBill,
      calculatedUnitTotal: result.calculatedUnitTotal,
      totalMisc: result.totalMisc,
      lineLoss: result.lineLoss,
      allocationMethod: result.allocationMethod || allocationMethod,
      name: nameValue,
      cycleDate: dateValue ? new Date(dateValue).toISOString() : new Date().toISOString(),
    }

    const cycle = await publishCycle(summary, result.rows, complex.id, existingId)
    setActiveCycleId(cycle.id)
    setCycleName(cycle.name || nameValue)
    setCycleDate(toDateInputValue(cycle.cycle_date || dateValue))
    setHistoryKey(k => k + 1)
    showToast(existingId ? 'Published cycle updated' : 'Cycle published')
    navigate(`/cycles/${cycle.id}`)
    return cycle
  }

  async function handleConclude(result, evidenceMap, overrides = {}) {
    const id = resolveExistingCycleId(overrides)
    if (!id) {
      showToast('Publish this cycle before concluding')
      throw new Error('No cycle id')
    }
    if (result.lineLoss === undefined) {
      showToast('Enter the office bill before concluding')
      throw new Error('Missing office bill')
    }

    const dateValue = overrides.cycleDate || cycleDate || toDateInputValue()
    const nameValue = overrides.name || cycleName || defaultCycleName(dateValue)

    try {
      const summary = {
        actualBill: result.actualBill,
        calculatedUnitTotal: result.calculatedUnitTotal,
        totalMisc: result.totalMisc,
        lineLoss: result.lineLoss,
        allocationMethod: result.allocationMethod || allocationMethod,
        name: nameValue,
        cycleDate: dateValue ? new Date(dateValue).toISOString() : new Date().toISOString(),
      }
      await publishCycle(summary, result.rows, complex.id, id)
      await concludeCycle(id, complex.id, result.rows, evidenceMap)
      clearDraft()
      setHistoryKey(k => k + 1)
      await reload()
      navigate('/')
      showToast('Cycle concluded')
    } catch (err) {
      showToast('Conclude failed. Please try again.')
      throw err
    }
  }

  // Legacy encoded snapshot — no auth
  if (route.path === 'bills') {
    return <BillsTablePage mode="public" encoded={route.params.d} />
  }

  // Public stable cycle link — no auth required
  if (
    route.path === 'cycles'
    && route.params.id
    && route.params.id !== 'draft'
    && ready
    && !session
  ) {
    return (
      <BillsTablePage
        mode="public-cycle"
        cycleId={route.params.id}
        isAdmin={false}
      />
    )
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
        <Header showSignOut />
        <div className="status-screen">
          <p className="error-text">{authError}</p>
        </div>
      </div>
    )
  }

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

  const onWorksheet = route.path === 'cycle'
  const onCycleTable = route.path === 'cycles'
  const onBusiness = route.path === 'businesses'

  return (
    <div className="app">
      <Header
        complexName={complex?.name}
        showSignOut
        showHome={onWorksheet || onCycleTable || onBusiness}
      />

      {route.path === 'cycle' ? (
        <CyclePage
          businesses={bizList}
          previous={previous}
          current={current}
          misc={misc}
          notes={notes}
          actualBill={actualBill}
          allocationMethod={allocationMethod || ALLOCATION_EQUAL}
          cycleDate={cycleDate}
          cycleName={cycleName}
          activeCycleId={activeCycleId}
          onCurrentChange={handleCurrentChange}
          onMiscChange={handleMiscChange}
          onNoteChange={handleNoteChange}
          onActualBillChange={setActualBill}
          onAllocationMethodChange={setAllocationMethod}
          onCycleDateChange={setCycleDate}
          onCycleNameChange={setCycleName}
          onRename={handleRename}
          onRemove={handleRemove}
          onAddBusiness={() => setShowAddBusiness(true)}
          onClear={handleClear}
        />
      ) : route.path === 'cycles' && route.params.id === 'draft' ? (
        <BillsTablePage
          mode="draft"
          complexId={complex?.id}
          complexName={complex?.name}
          draftResult={draftResult}
          draftCycleDate={cycleDate}
          draftCycleName={cycleName}
          activeCycleId={activeCycleId}
          isAdmin
          onBack={() => navigate('/cycle')}
          onPublish={handlePublish}
        />
      ) : route.path === 'cycles' && route.params.id ? (
        <BillsTablePage
          mode="saved"
          cycleId={route.params.id}
          complexId={complex?.id}
          complexName={complex?.name}
          isAdmin
          onBack={() => navigate('/')}
          onPublish={async (result) => {
            const cycle = await fetchCycleById(route.params.id, complex.id)
            return handlePublish(result, {
              cycleId: route.params.id,
              name: cycle?.name || cycleName,
              cycleDate: cycle ? toDateInputValue(cycle.cycle_date) : cycleDate,
            })
          }}
          onConclude={async (result, evidenceMap) => {
            const cycle = await fetchCycleById(route.params.id, complex.id)
            return handleConclude(result, evidenceMap, {
              cycleId: route.params.id,
              name: cycle?.name || cycleName,
              cycleDate: cycle ? toDateInputValue(cycle.cycle_date) : cycleDate,
            })
          }}
          onEditWorksheet={async () => {
            try {
              await hydrateFromCycle(route.params.id)
              navigate('/cycle')
            } catch {
              showToast('Could not open worksheet')
            }
          }}
        />
      ) : route.path === 'businesses' && route.params.id ? (
        <BusinessTimeline
          businessId={route.params.id}
          complexId={complex?.id}
        />
      ) : (
        <Home
          complexId={complex?.id}
          complexName={complex?.name}
          current={current}
          misc={misc}
          notes={notes}
          actualBill={actualBill}
          activeCycleId={activeCycleId}
          onRefreshKey={historyKey}
          onContinuePublished={handleContinuePublished}
        />
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

      <Toast message={toast} />
    </div>
  )
}
