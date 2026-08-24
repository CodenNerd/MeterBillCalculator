'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'
import { useBusinesses } from '../../hooks/useBusinesses'
import { useStorage } from '../../hooks/useStorage'
import {
  ALLOCATION_EQUAL,
  computeCycleResult,
  defaultCycleName,
  toDateInputValue,
} from '../../utils/billing'
import {
  publishCycle,
  concludeCycle,
  fetchCycleById,
  fetchCycleDetail,
} from '../../services/supabase'
import { navigate } from '../../utils/navigation'
import { plazaPath } from '../../utils/plaza'
import Header from '../Header'
import ConfirmDialog from '../ConfirmDialog'
import AddBusinessDialog from '../AddBusinessDialog'
import ReplaceTenantDialog from '../ReplaceTenantDialog'
import AuthGate from '../AuthGate'
import Toast from '../Toast'

const BillingContext = createContext(null)

export function useBilling() {
  const ctx = useContext(BillingContext)
  if (!ctx) throw new Error('useBilling must be used within BillingProvider')
  return ctx
}

export function BillingProvider({ children }) {
  const pathname = usePathname()
  const params = useParams()
  const cycleParam = params?.id
  const plazaSlugParam = params?.plazaSlug || null

  const { session, role, complex, ready, authError, setComplex } = useAuth(plazaSlugParam)

  const plazaSlug = plazaSlugParam || complex?.slug || null

  function href(path = '/') {
    return plazaPath(plazaSlug, path)
  }

  const { businesses, loading, error, add, rename, replace, remove, reload } =
    useBusinesses(complex?.id)

  const ratePerUnit = Number(complex?.rate_per_unit) > 0
    ? Number(complex.rate_per_unit)
    : 250

  const [current, setCurrent] = useStorage('mc_current', {})
  const [misc, setMisc] = useStorage('mc_misc', {})
  const [notes, setNotes] = useStorage('mc_notes', {})
  const [actualBill, setActualBill] = useStorage('mc_actual_bill', '')
  const [allocationMethod, setAllocationMethod] = useStorage('mc_alloc_method', ALLOCATION_EQUAL)
  const [cycleDate, setCycleDate] = useStorage('mc_cycle_date', toDateInputValue())
  const [cycleName, setCycleName] = useStorage('mc_cycle_name', defaultCycleName())
  const [activeCycleId, setActiveCycleId, clearActiveCycleId] = useStorage('mc_active_cycle_id', null)

  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [showAddBusiness, setShowAddBusiness] = useState(false)
  const [replaceTarget, setReplaceTarget] = useState(null)
  const [historyKey, setHistoryKey] = useState(0)

  // Drop stale cycle ids left over from the old local demo / failed publishes.
  useEffect(() => {
    if (!activeCycleId || !complex?.id || !ready) return undefined
    let cancelled = false
    fetchCycleById(activeCycleId, complex.id)
      .then((cycle) => {
        if (cancelled) return
        if (!cycle) clearActiveCycleId()
      })
      .catch(() => {
        if (!cancelled) clearActiveCycleId()
      })
    return () => { cancelled = true }
    // clearActiveCycleId is stable enough for this one-shot validation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCycleId, complex?.id, ready])

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
      ratePerUnit,
    ),
    [businesses, current, misc, notes, actualBill, allocationMethod, ratePerUnit],
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

  async function handleReplaceTenant(newName) {
    if (!replaceTarget) return
    await replace(replaceTarget.id, newName)
    setReplaceTarget(null)
    showToast('Tenant replaced — meter reading unchanged')
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
      navigate(href(`/cycles/${cycleId}`))
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
      navigate(href('/cycle'))
    } catch {
      showToast('Could not open published cycle')
    }
  }

  function resolveExistingCycleId(overrides = {}) {
    if (overrides.cycleId != null) return overrides.cycleId
    if (activeCycleId != null) return activeCycleId
    if (pathname?.includes('/cycles/') && cycleParam && cycleParam !== 'draft') {
      return cycleParam
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
    navigate(href(`/cycles/${cycle.id}`))
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
      navigate(href('/'))
      showToast('Cycle concluded')
    } catch (err) {
      showToast('Conclude failed. Please try again.')
      throw err
    }
  }

  const value = {
    session,
    role,
    complex,
    setComplex,
    plazaSlug,
    href,
    ready,
    authError,
    businesses,
    loading,
    error,
    reload,
    bizList,
    previous,
    current,
    misc,
    notes,
    actualBill,
    allocationMethod,
    cycleDate,
    cycleName,
    activeCycleId,
    ratePerUnit,
    draftResult,
    historyKey,
    showToast,
    handleCurrentChange,
    handleMiscChange,
    handleNoteChange,
    handleRename,
    setReplaceTarget,
    handleRemove,
    handleClear,
    setActualBill,
    setAllocationMethod,
    setCycleDate,
    setCycleName,
    setShowAddBusiness,
    handlePublish,
    handleConclude,
    hydrateFromCycle,
    handleContinuePublished,
    fetchCycleById,
    toDateInputValue,
  }

  return (
    <BillingContext.Provider value={value}>
      {children}
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
      {replaceTarget && (
        <ReplaceTenantDialog
          business={replaceTarget}
          onReplace={handleReplaceTenant}
          onCancel={() => setReplaceTarget(null)}
        />
      )}
      <Toast message={toast} />
    </BillingContext.Provider>
  )
}

/** Gates private admin pages; public cycle routes skip this. */
export function AdminGate({ children, showHome, hideHeader = false }) {
  const {
    session,
    complex,
    plazaSlug,
    href,
    ready,
    authError,
    loading,
    error,
    reload,
  } = useBilling()

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
        <Header complexName={complex?.name} plazaSlug={plazaSlug} showSignOut />
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
        <Header complexName={complex?.name} plazaSlug={plazaSlug} showSignOut />
        <div className="status-screen">
          <p className="error-text">{error}</p>
          <button className="btn btn-primary" onClick={reload}>Try Again</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {!hideHeader && (
        <Header
          complexName={complex?.name}
          plazaSlug={plazaSlug}
          ratePerUnit={Number(complex?.rate_per_unit) > 0 ? Number(complex.rate_per_unit) : undefined}
          showSignOut
          showHome={showHome}
          homeHref={href('/')}
          settingsHref={href('/settings')}
        />
      )}
      {children}
    </div>
  )
}
