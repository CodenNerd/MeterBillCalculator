import { useState } from 'react'
import { isReadingValid } from '../utils/billing'

export default function InputRow({ biz, previous, currentValue, miscValue, onChange, onMiscChange, onRename, onRemove, onSetPrevious }) {
  const [editingName, setEditingName] = useState(false)
  const [editingPrev, setEditingPrev] = useState(false)
  const prev = previous[biz.id] ?? 0
  const valid = isReadingValid(currentValue, prev)

  function handleNameBlur(e) {
    onRename(biz.id, e.target.value)
    setEditingName(false)
  }

  function handlePrevBlur(e) {
    const parsed = parseFloat(e.target.value)
    onSetPrevious(biz.id, Number.isFinite(parsed) && parsed >= 0 ? parsed : 0)
    setEditingPrev(false)
  }

  return (
    <div className={`input-row ${!valid ? 'invalid' : ''}`}>
      <div className="biz-info">
        <span className="biz-num">{biz.id}</span>

        {editingName ? (
          <input
            className="name-input"
            defaultValue={biz.name}
            onBlur={handleNameBlur}
            onKeyDown={e => e.key === 'Enter' && e.target.blur()}
            autoFocus
          />
        ) : (
          <button className="biz-name" onClick={() => setEditingName(true)} title="Click to rename">
            {biz.name}
            <span className="edit-hint">✎</span>
          </button>
        )}
      </div>

      <div className="reading-fields">
        <div className="prev-reading">
          <label>Previous</label>
          {editingPrev ? (
            <input
              className="name-input prev-input"
              type="number"
              step="0.01"
              min="0"
              defaultValue={prev}
              onBlur={handlePrevBlur}
              onKeyDown={e => e.key === 'Enter' && e.target.blur()}
              autoFocus
            />
          ) : (
            <button
              className="prev-val-btn"
              onClick={() => setEditingPrev(true)}
              title="Click to set former cumulative reading"
            >
              <span className="mono prev-val">{prev.toFixed(2)}</span>
              <span className="edit-hint">✎</span>
            </button>
          )}
        </div>

        <div className="input-wrap misc-wrap">
          <label htmlFor={`misc-${biz.id}`}>Misc (₦) <span className="optional-tag">optional</span></label>
          <input
            id={`misc-${biz.id}`}
            type="number"
            className="reading-input misc-input"
            placeholder="0.00"
            value={miscValue ?? ''}
            onChange={e => onMiscChange(biz.id, e.target.value)}
            step="0.01"
            min="0"
          />
        </div>

        <div className="input-wrap">
          <label htmlFor={`curr-${biz.id}`}>Current</label>
          <input
            id={`curr-${biz.id}`}
            type="number"
            className={`reading-input ${!valid ? 'input-error' : ''}`}
            placeholder="0.00"
            value={currentValue ?? ''}
            onChange={e => onChange(biz.id, e.target.value)}
            step="0.01"
            min={prev}
          />
          {!valid && (
            <span className="error-msg">Must be ≥ {prev.toFixed(2)}</span>
          )}
        </div>
      </div>

      <button className="remove-btn" onClick={() => onRemove(biz.id)} title="Remove business">
        ✕
      </button>
    </div>
  )
}
