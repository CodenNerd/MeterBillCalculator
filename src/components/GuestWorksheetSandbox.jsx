'use client'

import { useEffect, useMemo, useState } from 'react'
import Header from './Header'
import CyclePage from './CyclePage'
import {
  ALLOCATION_EQUAL,
  defaultCycleName,
  toDateInputValue,
} from '../utils/billing'
import {
  fetchCycleDetail,
  fetchLatestSeedCycle,
  fetchPlazaBySlug,
  fetchPublicCycleForPlaza,
} from '../services/supabase'
import { navigate } from '../utils/navigation'
import { plazaPath } from '../utils/plaza'
import { saveGuestSandbox } from '../utils/guestSandbox'

function seedFromCycle(cycle, rows) {
  const businesses = []
  const previous = {}
  const current = {}
  const misc = {}
  const notes = {}
  const excludeFromOffset = {}
  const carryOver = {}

  for (const r of rows || []) {
    if (r.business_id == null) continue
    const id = r.business_id
    businesses.push({ id, name: r.business_name || 'Business' })
    previous[id] = Number(r.previous_reading) || 0
    current[id] = String(r.current_reading ?? '')
    misc[id] = r.misc ? String(r.misc) : ''
    notes[id] = r.misc_note || ''
    if (r.exclude_from_offset) excludeFromOffset[id] = true
  }

  return {
    businesses,
    previous,
    current,
    misc,
    notes,
    excludeFromOffset,
    carryOver,
    actualBill: cycle?.actual_bill != null ? String(cycle.actual_bill) : '',
    allocationMethod: cycle?.allocation_method || ALLOCATION_EQUAL,
    cycleDate: toDateInputValue(cycle?.cycle_date),
    cycleName: cycle?.name || defaultCycleName(cycle?.cycle_date),
    sourceCycleId: cycle?.id ?? null,
  }
}

export default function GuestWorksheetSandbox({ plazaSlug, cycleId = null }) {
  const [plaza, setPlaza] = useState(null)
  const [seed, setSeed] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const [current, setCurrent] = useState({})
  const [misc, setMisc] = useState({})
  const [notes, setNotes] = useState({})
  const [excludeFromOffset, setExcludeFromOffset] = useState({})
  const [carryOver, setCarryOver] = useState({})
  const [actualBill, setActualBill] = useState('')
  const [allocationMethod, setAllocationMethod] = useState(ALLOCATION_EQUAL)
  const [cycleDate, setCycleDate] = useState(toDateInputValue())
  const [cycleName, setCycleName] = useState(defaultCycleName())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const plazaRow = await fetchPlazaBySlug(plazaSlug)
        if (cancelled) return
        if (!plazaRow) {
          setError('Plaza not found')
          setLoading(false)
          return
        }
        setPlaza(plazaRow)

        let cycle = null
        let rows = []

        if (cycleId) {
          const pair = await fetchPublicCycleForPlaza(cycleId, plazaSlug)
          if (cancelled) return
          if (!pair?.cycle) {
            setError('This cycle is not available.')
            setLoading(false)
            return
          }
          cycle = pair.cycle
          rows = await fetchCycleDetail(cycle.id)
        } else {
          const latest = await fetchLatestSeedCycle(plazaRow.id)
          if (cancelled) return
          if (!latest) {
            setSeed(null)
            setLoading(false)
            return
          }
          cycle = latest
          rows = await fetchCycleDetail(latest.id)
        }

        if (cancelled) return
        const next = seedFromCycle(cycle, rows)
        setSeed(next)
        setCurrent(next.current)
        setMisc(next.misc)
        setNotes(next.notes)
        setExcludeFromOffset(next.excludeFromOffset)
        setCarryOver(next.carryOver)
        setActualBill(next.actualBill)
        setAllocationMethod(next.allocationMethod)
        setCycleDate(next.cycleDate)
        setCycleName(next.cycleName)
      } catch {
        if (!cancelled) setError('Failed to load sandbox worksheet.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [plazaSlug, cycleId])

  const ratePerUnit = Number(plaza?.rate_per_unit) > 0
    ? Number(plaza.rate_per_unit)
    : 250

  const href = useMemo(
    () => (path = '/') => plazaPath(plazaSlug, path),
    [plazaSlug],
  )

  function setFlag(setter, id, checked) {
    setter(prev => {
      const next = { ...prev }
      if (checked) next[id] = true
      else {
        delete next[id]
        delete next[String(id)]
      }
      return next
    })
  }

  function handleViewBills(result) {
    const sourceId = seed?.sourceCycleId ?? cycleId
    saveGuestSandbox(plazaSlug, sourceId, {
      draftResult: result,
      draftCycleDate: cycleDate,
      draftCycleName: cycleName,
      complexName: plaza?.name,
      ratePerUnit,
      worksheetPath: sourceId
        ? `/cycles/${sourceId}/worksheet`
        : '/worksheet',
    })
    navigate(href('/cycles/draft?sandbox=1'))
  }

  if (loading) {
    return (
      <div className="app">
        <Header />
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading sandbox...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app">
        <Header />
        <div className="status-screen">
          <p className="error-text">{error}</p>
        </div>
      </div>
    )
  }

  if (!seed || !seed.businesses.length) {
    return (
      <div className="app">
        <Header
          complexName={plaza?.name}
          plazaSlug={plazaSlug}
          ratePerUnit={ratePerUnit}
          homeHref={href('/')}
        />
        <div className="status-screen">
          <p className="error-text">
            No published or concluded cycle to explore yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Header
        complexName={plaza?.name}
        plazaSlug={plazaSlug}
        ratePerUnit={ratePerUnit}
        homeHref={href('/')}
      />
      <div className="guest-sandbox-banner" role="status">
        Sandbox — changes stay on this device and are not saved.
      </div>
      <CyclePage
        businesses={seed.businesses}
        previous={seed.previous}
        current={current}
        misc={misc}
        notes={notes}
        excludeFromOffset={excludeFromOffset}
        carryOver={carryOver}
        actualBill={actualBill}
        allocationMethod={allocationMethod}
        cycleDate={cycleDate}
        cycleName={cycleName}
        activeCycleId={seed.sourceCycleId}
        ratePerUnit={ratePerUnit}
        href={href}
        plazaSlug={plazaSlug}
        plazaName={plaza?.name}
        role={null}
        guestMode
        onCurrentChange={(id, value) => setCurrent(prev => ({ ...prev, [id]: value }))}
        onMiscChange={(id, value) => setMisc(prev => ({ ...prev, [id]: value }))}
        onNoteChange={(id, value) => setNotes(prev => ({ ...prev, [id]: value }))}
        onExcludeFromOffsetChange={(id, checked) => setFlag(setExcludeFromOffset, id, checked)}
        onCarryOverChange={(id, checked) => {
          setFlag(setCarryOver, id, checked)
          if (checked) {
            const prev = seed.previous[id] ?? seed.previous[String(id)] ?? 0
            setCurrent(c => ({ ...c, [id]: String(prev) }))
          }
        }}
        onActualBillChange={setActualBill}
        onAllocationMethodChange={setAllocationMethod}
        onCycleDateChange={setCycleDate}
        onCycleNameChange={setCycleName}
        onViewBills={handleViewBills}
      />
    </div>
  )
}
