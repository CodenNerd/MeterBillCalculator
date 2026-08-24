'use client'

import { useState } from 'react'
import { isReadingValid } from '../utils/billing'

export default function InputRow({
  biz,
  displayNumber,
  previous,
  currentValue,
  miscValue,
  noteValue,
  onChange,
  onMiscChange,
  onNoteChange,
  onRename,
  onRemove,
  live,
  readOnly = false,
}) {
  const hasExtras =
    (miscValue !== '' && miscValue != null && parseFloat(miscValue) > 0)
    || Boolean(noteValue && String(noteValue).trim())

  const [editingName, setEditingName] = useState(false)
  const [extrasOpen, setExtrasOpen] = useState(hasExtras)
  const prev = previous[biz.id] ?? 0
  const valid = isReadingValid(currentValue, prev)

  function handleNameBlur(e) {
    onRename(biz.id, e.target.value)
    setEditingName(false)
  }

  return (
    <article className={`biz-block ${!valid ? 'invalid' : ''}`}>
      <header className="biz-block-head">
        <div className="biz-info">
          <span className="biz-num">{displayNumber}</span>
          {editingName && !readOnly ? (
            <input
              className="name-input"
              defaultValue={biz.name}
              onBlur={handleNameBlur}
              onKeyDown={e => e.key === 'Enter' && e.target.blur()}
              autoFocus
            />
          ) : (
            <button
              className="biz-name"
              onClick={() => !readOnly && setEditingName(true)}
              title={readOnly ? undefined : 'Click to rename'}
              type="button"
              disabled={readOnly}
            >
              {biz.name}
              {!readOnly && <span className="edit-hint">edit</span>}
            </button>
          )}
        </div>
        {!readOnly && (
          <button
            className="remove-btn"
            onClick={() => onRemove(biz.id)}
            title="Remove business"
            aria-label="Remove business"
            type="button"
          >
            Remove
          </button>
        )}
      </header>

      <div className="biz-block-layout">
        <div className="biz-block-controls">
          <div className="input-wrap">
            <label>Previous reading (kWh)</label>
            <div className="prev-readonly mono">{prev.toFixed(2)} kWh</div>
          </div>

          <div className="input-wrap">
            <label htmlFor={`curr-${biz.id}`}>Current reading (kWh)</label>
            <input
              id={`curr-${biz.id}`}
              type="number"
              className={`reading-input biz-current-input ${!valid ? 'input-error' : ''}`}
              placeholder="0.00"
              value={currentValue ?? ''}
              onChange={e => onChange(biz.id, e.target.value)}
              step="0.01"
              min={prev}
              disabled={readOnly}
            />
            {!valid && (
              <span className="error-msg">Must be ≥ {prev.toFixed(2)} kWh</span>
            )}
          </div>

          <div className="biz-extras">
            <button
              type="button"
              className="biz-extras-toggle"
              onClick={() => setExtrasOpen(open => !open)}
              aria-expanded={extrasOpen}
            >
              <span>More</span>
              <span className={`biz-extras-caret ${extrasOpen ? 'is-open' : ''}`} aria-hidden="true">
                ▾
              </span>
              {hasExtras && !extrasOpen && (
                <span className="biz-extras-badge">set</span>
              )}
            </button>

            {extrasOpen && (
              <div className="biz-extras-fields">
                <div className="input-wrap">
                  <label htmlFor={`misc-${biz.id}`}>
                    Misc charge (₦) <span className="optional-tag">optional</span>
                  </label>
                  <input
                    id={`misc-${biz.id}`}
                    type="number"
                    className="reading-input misc-input"
                    placeholder="0.00"
                    value={miscValue ?? ''}
                    onChange={e => onMiscChange(biz.id, e.target.value)}
                    step="0.01"
                    min="0"
                    disabled={readOnly}
                  />
                </div>
                <div className="input-wrap">
                  <label htmlFor={`note-${biz.id}`}>
                    Note <span className="optional-tag">optional</span>
                  </label>
                  <input
                    id={`note-${biz.id}`}
                    type="text"
                    className="reading-input"
                    placeholder="e.g. generator share"
                    value={noteValue ?? ''}
                    onChange={e => onNoteChange?.(biz.id, e.target.value)}
                    disabled={readOnly}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className={`biz-block-stats ${live?.pulse ? 'biz-block-stats--pulse' : ''}`}
          aria-live="polite"
        >
          <div className="gstat">
            <span className="gstat-label">Used this cycle</span>
            <span className="gstat-value mono">
              {live?.usedLabel ?? '—'}
            </span>
          </div>
          <div className="gstat">
            <span className="gstat-label">Energy (₦)</span>
            <span className="gstat-value mono">
              {live?.energyLabel ?? '—'}
            </span>
          </div>
          {live?.shareLabel != null && (
            <div className="gstat">
              <span className="gstat-label">Share of offset</span>
              <span className={`gstat-value mono ${live.shareNegative ? 'loss-negative' : 'loss-positive'}`}>
                {live.shareLabel}
              </span>
            </div>
          )}
          <div className="gstat gstat--total">
            <span className="gstat-label">Amount due</span>
            <span className={`gstat-value mono amount ${live?.pulse ? 'pulse' : ''}`}>
              {live?.amountLabel ?? '—'}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
