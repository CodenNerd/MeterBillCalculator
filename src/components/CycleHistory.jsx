import { useEffect, useState } from 'react'
import { fetchCycleHistory, fetchCycleDetail } from '../services/supabase'
import { formatNaira } from '../utils/billing'

export default function CycleHistory({ complexId, onClose }) {
  const [cycles, setCycles] = useState(null)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    fetchCycleHistory(complexId)
      .then(setCycles)
      .catch(() => setError('Failed to load cycle history.'))
  }, [complexId])

  async function toggleCycle(id) {
    if (openId === id) {
      setOpenId(null)
      setDetail(null)
      return
    }
    setOpenId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      const rows = await fetchCycleDetail(id)
      setDetail(rows)
    } catch {
      setDetail([])
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog history-dialog" onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <h3>Billing Cycle History</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Close</button>
        </div>

        {error && <p className="error-text">{error}</p>}
        {!error && cycles === null && <p className="line-loss-hint">Loading...</p>}
        {!error && cycles && cycles.length === 0 && (
          <p className="line-loss-hint">No saved cycles yet — history appears here after you Save & Next Cycle.</p>
        )}

        <div className="history-list">
          {cycles && cycles.map(cycle => (
            <div key={cycle.id} className="history-item">
              <button className="history-item-head" onClick={() => toggleCycle(cycle.id)}>
                <span>{new Date(cycle.cycle_date).toLocaleDateString('en-NG', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}</span>
                <span className="mono">{formatNaira(cycle.actual_bill)}</span>
                <span className={`mono ${cycle.line_loss >= 0 ? 'loss-positive' : 'loss-negative'}`}>
                  {cycle.line_loss >= 0 ? '+' : '−'}{formatNaira(Math.abs(cycle.line_loss))}
                </span>
              </button>

              {openId === cycle.id && (
                <div className="history-detail">
                  {detailLoading && <p className="line-loss-hint">Loading breakdown...</p>}
                  {!detailLoading && detail && detail.map(row => (
                    <div key={row.id} className="history-detail-row">
                      <span>{row.business_name}</span>
                      <span className="mono muted">{row.units} kWh</span>
                      <span className="mono">{formatNaira(row.final_amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
