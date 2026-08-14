import { useState } from 'react'
import { useBusinesses } from './hooks/useBusinesses'
import { useStorage } from './hooks/useStorage'
import { calculateBills } from './utils/billing'
import Header from './components/Header'
import InputGrid from './components/InputGrid'
import ResultsTable from './components/ResultsTable'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'
import './App.css'

export default function App() {
  // Remote data — businesses + their previous readings
  const { businesses, loading, error, add, rename, remove, setPrevious, saveCycle, reload } = useBusinesses()

  // Current readings still live locally (in-progress, not saved yet)
  const [current, setCurrent] = useStorage('mc_current', {})

  const [result, setResult] = useState(null)
  const [flash, setFlash] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)

  // Build the shape InputGrid and calculateBills expect
  const bizList = businesses.map(b => ({ id: b.id, name: b.name }))
  const previous = Object.fromEntries(businesses.map(b => [b.id, b.previous_reading]))

  // ---- Input handlers ----
  function handleCurrentChange(id, value) {
    setCurrent({ ...current, [id]: value })
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
        setResult(null)
        setConfirm(null)
      },
    })
  }

  async function handleAddBusiness() {
    const saved = await add()
    if (saved) showToast('New business added — click the name to rename it')
  }

  // ---- Calculate ----
  function handleCalculate() {
    const res = calculateBills(bizList, previous, current)
    setResult(res)
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
  }

  // ---- Save cycle ----
  function handleSave() {
    setConfirm({
      message: 'Save as previous readings?',
      detail: "Current readings become next cycle's starting point for everyone.",
      confirmLabel: 'Save & Continue',
      danger: false,
      onConfirm: async () => {
        try {
          await saveCycle(current)
          setCurrent({})
          setResult(null)
          setConfirm(null)
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

  // ---- Loading / error states ----
  if (loading) {
    return (
      <div className="app">
        <Header />
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
        <Header />
        <div className="status-screen">
          <p className="error-text">{error}</p>
          <button className="btn btn-primary" onClick={reload}>Try Again</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Header />

      <main className="main">
        <InputGrid
          businesses={bizList}
          previous={previous}
          current={current}
          onChange={handleCurrentChange}
          onRename={handleRename}
          onRemove={handleRemove}
          onSetPrevious={handleSetPrevious}
          onAddBusiness={handleAddBusiness}
          onCalculate={handleCalculate}
          onClear={handleClear}
        />

        {result && (
          <ResultsTable
            result={result}
            flash={flash}
            onSave={handleSave}
            onPrint={() => window.print()}
          />
        )}
      </main>

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

      <Toast message={toast} />
    </div>
  )
}
