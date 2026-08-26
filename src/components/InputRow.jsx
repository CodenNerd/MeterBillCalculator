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
  excludeFromOffset = false,
  carryOver = false,
  onChange,
  onMiscChange,
  onNoteChange,
  onExcludeFromOffsetChange,
  onCarryOverChange,
  onRename,
  onReplaceTenant,
  onRemove,
  live,
  readOnly = false,
}) {
  const hasExtras =
    (miscValue !== '' && miscValue != null && parseFloat(miscValue) > 0)
    || Boolean(noteValue && String(noteValue).trim())
    || excludeFromOffset
    || carryOver

  const [editingName, setEditingName] = useState(false)
  const [extrasOpen, setExtrasOpen] = useState(hasExtras)
  const prev = Number(previous[biz.id] ?? previous[String(biz.id)] ?? 0)
  const displayCurrent = carryOver ? String(prev) : currentValue
  const valid = carryOver || isReadingValid(displayCurrent, prev)

  function handleNameBlur(e) {
    onRename(biz.id, e.target.value)
    setEditingName(false)
  }

  return (
    <article className={`biz-block ${!valid ? 'invalid' : ''} ${carryOver ? 'biz-block--carry-over' : ''}`}>
      <div className="biz-block-layout">
        <div className="biz-block-main">
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
              <div className="biz-block-actions">
                <button
                  className="btn-text biz-action-btn"
                  onClick={() => onReplaceTenant?.(biz)}
                  type="button"
                >
                  Replace tenant
                </button>
                <button
                  className="remove-btn"
                  onClick={() => onRemove(biz.id)}
                  title="Remove business"
                  aria-label="Remove business"
                  type="button"
                >
                  Remove
                </button>
              </div>
            )}
          </header>

          {carryOver && (
            <p className="biz-carry-hint">Vacant this cycle — omitted from bills</p>
          )}

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
                value={displayCurrent ?? ''}
                onChange={e => onChange(biz.id, e.target.value)}
                step="0.01"
                min={prev}
                disabled={readOnly || carryOver}
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
                      disabled={readOnly || carryOver}
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
                      disabled={readOnly || carryOver}
                    />
                  </div>

                  {!readOnly && (
                    <div className="biz-flag-toggles">
                      <label className="biz-flag-check">
                        <input
                          type="checkbox"
                          checked={excludeFromOffset && !carryOver}
                          disabled={carryOver}
                          onChange={e => onExcludeFromOffsetChange?.(biz.id, e.target.checked)}
                        />
                        <span>
                          Exclude from offset sharing
                          <span className="biz-flag-hint">
                            Still billed for energy and misc; no share of the office-bill offset.
                          </span>
                        </span>
                      </label>
                      <label className="biz-flag-check">
                        <input
                          type="checkbox"
                          checked={carryOver}
                          onChange={e => onCarryOverChange?.(biz.id, e.target.checked)}
                        />
                        <span>
                          Carry over previous only
                          <span className="biz-flag-hint">
                            Vacant shop — omit from this cycle’s bills; keep previous reading for next cycle.
                          </span>
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className={`biz-block-stats ${live?.pulse ? 'biz-block-stats--pulse' : ''}`}
          aria-live="polite"
        >
          {carryOver ? (
            <div className="gstat gstat--total">
              <span className="gstat-label">This cycle</span>
              <span className="gstat-value mono">Omitted</span>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </article>
  )
}
