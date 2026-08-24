'use client'

export default function ConfirmDialog({ message, detail, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>{message}</h3>
        {detail && <p>{detail}</p>}
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
