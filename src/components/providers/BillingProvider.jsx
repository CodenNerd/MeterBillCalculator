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
  flagOn,
  toDateInputValue,
} from '../../utils/billing'
import {
  publishCycle,
  concludeCycle,
  fetchCycleById,
  fetchCycleDetail,
  fetchLatestSeedCycle,
  seedPreviousFromCycle,
  saveCycleReadings,
  fetchPrecedingCurrentReadings,
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

  const { businesses, archived, loading, error, add, rename, replace, remove, restore, reload } =
    useBusinesses(complex?.id)

  const ratePerUnit = Number(complex?.rate_per_unit) > 0
    ? Number(complex.rate_per_unit)
    : 250

  const [current, setCurrent] = useStorage('mc_current', {})
  const [misc, setMisc] = useStorage('mc_misc', {})
  const [notes, setNotes] = useStorage('mc_notes', {})
  const [excludeFromOffset, setExcludeFromOffset] = useStorage('mc_exclude_offset', {})
  const [carryOver, setCarryOver] = useStorage('mc_carry_over', {})
  const [actualBill, setActualBill] = useStorage('mc_actual_bill', '')
  const [allocationMethod, setAllocationMethod] = useStorage('mc_alloc_method', ALLOCATION_EQUAL)
  const [cycleDate, setCycleDate] = useStorage('mc_cycle_date', toDateInputValue())
  const [cycleName, setCycleName] = useStorage('mc_cycle_name', defaultCycleName())
  const [activeCycleId, setActiveCycleId, clearActiveCycleId] = useStorage('mc_active_cycle_id', null)
  // When editing a published cycle, bill snapshots supply previous readings
  // (businesses.previous_reading may already be rolled forward for a newer draft).
  const [previousOverride, setPreviousOverride, clearPreviousOverride] = useStorage('mc_previous_override', null)

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
  const previousFromBusinesses = Object.fromEntries(
    businesses.map(b => [b.id, b.previous_reading]),
  )
  const previous = previousOverride && typeof previousOverride === 'object'
    ? {
        ...previousFromBusinesses,
        ...Object.fromEntries(
          Object.entries(previousOverride).map(([id, value]) => [id, value]),
        ),
      }
    : previousFromBusinesses

  // Normalize lookups so numeric / string business ids both resolve.
  function previousFor(id) {
    if (previous[id] != null) return Number(previous[id]) || 0
    if (previous[String(id)] != null) return Number(previous[String(id)]) || 0
    return 0
  }

  const previousMap = Object.fromEntries(
    businesses.map(b => [b.id, previousFor(b.id)]),
  )

  const draftResult = useMemo(
    () => computeCycleResult(
      businesses.map(b => ({ id: b.id, name: b.name })),
      previousMap,
      current,
      misc,
      actualBill,
      allocationMethod,
      notes,
      ratePerUnit,
      { excludeFromOffset, carryOver },
    ),
    [businesses, previousMap, current, misc, notes, actualBill, allocationMethod, ratePerUnit, excludeFromOffset, carryOver],
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

  function handleExcludeFromOffsetChange(id, checked) {
    const next = { ...excludeFromOffset }
    if (checked) next[id] = true
    else {
      delete next[id]
      delete next[String(id)]
    }
    setExcludeFromOffset(next)
  }

  function handleCarryOverChange(id, checked) {
    const next = { ...carryOver }
    if (checked) {
      next[id] = true
      const prev = previousFor(id)
      setCurrent({ ...current, [id]: String(prev) })
      const nextMisc = { ...misc }
      delete nextMisc[id]
      delete nextMisc[String(id)]
      setMisc(nextMisc)
    } else {
      delete next[id]
      delete next[String(id)]
    }
    setCarryOver(next)
  }

  function clearBizDraftFields(id) {
    const strip = (obj) => {
      const { [id]: _a, [String(id)]: _b, ...rest } = obj || {}
      return rest
    }
    setCurrent(strip(current))
    setMisc(strip(misc))
    setNotes(strip(notes))
    setExcludeFromOffset(strip(excludeFromOffset))
    setCarryOver(strip(carryOver))
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
      detail: 'It stays in the plaza and can be restored from Add business. It will not appear on this or future worksheets until restored.',
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        await remove(id)
        clearBizDraftFields(id)
        setConfirm(null)
        showToast('Business removed — restore anytime from Add business')
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

  async function handleRestoreBusiness(biz) {
    const saved = await restore(biz.id)
    if (saved) {
      setShowAddBusiness(false)
      showToast(`Restored ${saved.name}`)
    }
  }

  function clearDraft() {
    setCurrent({})
    setMisc({})
    setNotes({})
    setExcludeFromOffset({})
    setCarryOver({})
    setActualBill('')
    setAllocationMethod(ALLOCATION_EQUAL)
    setCycleDate(toDateInputValue())
    setCycleName(defaultCycleName())
    setActiveCycleId(null)
    clearPreviousOverride()
  }

  async function rollCarryOverReadings() {
    const updates = businesses
      .filter(b => flagOn(carryOver, b.id))
      .map(b => ({
        id: b.id,
        previous_reading: previousFor(b.id),
      }))
    if (updates.length) await saveCycleReadings(updates)
  }

  /**
   * Home CTA: blank worksheet. Seed previous meters from the latest
   * published or concluded cycle's current readings.
   */
  async function startFreshCycle() {
    clearDraft()
    const draftDate = toDateInputValue()
    if (complex?.id) {
      try {
        const seeded = await fetchPrecedingCurrentReadings(complex.id, {
          cycle_date: draftDate,
          published_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        if (Object.keys(seeded).length) {
          setPreviousOverride(seeded)
        }
        // Persist onto businesses for live previous when override is cleared later.
        const latest = await fetchLatestSeedCycle(complex.id)
        if (latest?.id) {
          try {
            await seedPreviousFromCycle(latest.id)
            await reload()
          } catch {
            // Keep worksheet override even if persisting previous_reading fails.
          }
        }
      } catch {
        showToast('Could not load previous meter readings')
      }
    }
    navigate(href('/worksheet'))
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

    let precedingCurrents = {}
    try {
      precedingCurrents = await fetchPrecedingCurrentReadings(complex.id, cycle, {
        businessIds: [
          ...(rows || []).map(r => r.business_id),
          ...(businesses || []).map(b => b.id),
        ].filter(id => id != null),
      })
    } catch {
      precedingCurrents = {}
    }

    const nextCurrent = {}
    const nextMisc = {}
    const nextNotes = {}
    const nextPrevious = {}
    const nextExclude = {}
    for (const [id, value] of Object.entries(precedingCurrents)) {
      nextPrevious[id] = Number(value) || 0
    }
    for (const r of rows) {
      nextCurrent[r.business_id] = String(r.current_reading)
      nextMisc[r.business_id] = r.misc ? String(r.misc) : ''
      nextNotes[r.business_id] = r.misc_note || ''
      const chained = precedingCurrents[r.business_id] ?? precedingCurrents[String(r.business_id)]
      if (chained == null) {
        nextPrevious[r.business_id] = Number(r.previous_reading) || 0
      }
      if (r.exclude_from_offset) nextExclude[r.business_id] = true
    }
    setCurrent(nextCurrent)
    setMisc(nextMisc)
    setNotes(nextNotes)
    setExcludeFromOffset(nextExclude)
    setCarryOver({})
    setPreviousOverride(
      Object.fromEntries(
        Object.entries(nextPrevious).map(([id, value]) => [String(id), value]),
      ),
    )
    setActualBill(String(cycle.actual_bill))
    setAllocationMethod(cycle.allocation_method || ALLOCATION_EQUAL)
    setCycleDate(toDateInputValue(cycle.cycle_date))
    setCycleName(cycle.name || defaultCycleName(cycle.cycle_date))
    setActiveCycleId(cycle.id)
    return cycle
  }

  async function handleContinuePublished(cycleId) {
    navigate(href(`/cycles/${cycleId}/worksheet`))
  }

  function resolveExistingCycleId(overrides = {}) {
    if (overrides.cycleId != null) return overrides.cycleId
    if (activeCycleId != null) return activeCycleId
    if (pathname?.includes('/cycles/') && cycleParam && cycleParam !== 'draft') {
      return cycleParam
    }
    return null
  }

  async function rowsWithChainedPrevious(result, dateValue, existingId) {
    let preceding = {}
    try {
      preceding = await fetchPrecedingCurrentReadings(complex.id, {
        id: existingId,
        cycle_date: dateValue ? new Date(dateValue).toISOString() : new Date().toISOString(),
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
    } catch {
      preceding = {}
    }
    if (!Object.keys(preceding).length) {
      return { rows: result.rows, summaryPatch: null }
    }

    const businesses = result.rows.map(r => ({ id: r.id, name: r.name }))
    const previous = {}
    const current = {}
    const miscMap = {}
    const notesMap = {}
    const excludeMap = {}
    for (const r of result.rows) {
      const chained = preceding[r.id] ?? preceding[String(r.id)]
      previous[r.id] = chained != null ? Number(chained) || 0 : r.prev
      current[r.id] = r.curr
      miscMap[r.id] = r.misc
      notesMap[r.id] = r.note || ''
      if (r.excludeFromOffset) excludeMap[r.id] = true
    }

    const recomputed = computeCycleResult(
      businesses,
      previous,
      current,
      miscMap,
      result.actualBill,
      result.allocationMethod || allocationMethod,
      notesMap,
      ratePerUnit,
      { excludeFromOffset: excludeMap },
    )

    const payById = Object.fromEntries(
      result.rows.map(r => [String(r.id), {
        paymentStatus: r.paymentStatus,
        amountPaid: r.amountPaid,
      }]),
    )

    return {
      rows: recomputed.rows.map(r => ({
        ...r,
        paymentStatus: payById[String(r.id)]?.paymentStatus,
        amountPaid: payById[String(r.id)]?.amountPaid,
      })),
      summaryPatch: {
        calculatedUnitTotal: recomputed.calculatedUnitTotal,
        totalMisc: recomputed.totalMisc,
        lineLoss: recomputed.lineLoss,
        allocationMethod: recomputed.allocationMethod || allocationMethod,
        actualBill: recomputed.actualBill,
      },
    }
  }

  async function handlePublish(result, overrides = {}) {
    if (result.lineLoss === undefined) {
      showToast('Enter the office bill before publishing')
      throw new Error('Missing office bill')
    }

    const dateValue = overrides.cycleDate || cycleDate || toDateInputValue()
    const nameValue = overrides.name || cycleName || defaultCycleName(dateValue)
    const existingId = resolveExistingCycleId(overrides)

    const { rows: publishRows, summaryPatch } = await rowsWithChainedPrevious(
      result,
      dateValue,
      existingId,
    )

    const summary = {
      actualBill: summaryPatch?.actualBill ?? result.actualBill,
      calculatedUnitTotal: summaryPatch?.calculatedUnitTotal ?? result.calculatedUnitTotal,
      totalMisc: summaryPatch?.totalMisc ?? result.totalMisc,
      lineLoss: summaryPatch?.lineLoss ?? result.lineLoss,
      allocationMethod: summaryPatch?.allocationMethod || result.allocationMethod || allocationMethod,
      name: nameValue,
      cycleDate: dateValue ? new Date(dateValue).toISOString() : new Date().toISOString(),
    }

    const cycle = await publishCycle(summary, publishRows, complex.id, existingId)
    try {
      await rollCarryOverReadings()
    } catch {
      // Non-fatal: bills are published; previous may already be correct.
    }
    clearDraft()
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
      const { rows: publishRows, summaryPatch } = await rowsWithChainedPrevious(
        result,
        dateValue,
        id,
      )
      const summary = {
        actualBill: summaryPatch?.actualBill ?? result.actualBill,
        calculatedUnitTotal: summaryPatch?.calculatedUnitTotal ?? result.calculatedUnitTotal,
        totalMisc: summaryPatch?.totalMisc ?? result.totalMisc,
        lineLoss: summaryPatch?.lineLoss ?? result.lineLoss,
        allocationMethod: summaryPatch?.allocationMethod || result.allocationMethod || allocationMethod,
        name: nameValue,
        cycleDate: dateValue ? new Date(dateValue).toISOString() : new Date().toISOString(),
      }
      await publishCycle(summary, publishRows, complex.id, id)
      await concludeCycle(id, complex.id, publishRows, evidenceMap)
      try {
        await rollCarryOverReadings()
      } catch {
        // Non-fatal after conclude.
      }
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
    archived,
    loading,
    error,
    reload,
    bizList,
    previous: previousMap,
    current,
    misc,
    notes,
    excludeFromOffset,
    carryOver,
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
    handleExcludeFromOffsetChange,
    handleCarryOverChange,
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
    startFreshCycle,
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
          archived={archived}
          onAdd={handleAddBusiness}
          onRestore={handleRestoreBusiness}
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
