import InputRow from './InputRow'

export default function InputGrid({
  businesses,
  previous,
  current,
  onChange,
  onRename,
  onRemove,
  onSetPrevious,
  onAddBusiness,
  onCalculate,
  onClear,
}) {
  return (
    <section className="card input-card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Current Readings</h2>
          <p className="card-sub">Enter cumulative meter readings for this billing cycle</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onAddBusiness}>
          + Add Business
        </button>
      </div>

      <div className="input-grid">
        {businesses.map(biz => (
          <InputRow
            key={biz.id}
            biz={biz}
            previous={previous}
            currentValue={current[biz.id]}
            onChange={onChange}
            onRename={onRename}
            onRemove={onRemove}
            onSetPrevious={onSetPrevious}
          />
        ))}

        {businesses.length === 0 && (
          <div className="empty-state">
            No businesses yet. Click <strong>+ Add Business</strong> to get started.
          </div>
        )}
      </div>

      <div className="actions">
        <button className="btn btn-primary" onClick={onCalculate} disabled={businesses.length === 0}>
          Calculate Bills
        </button>
        <button className="btn btn-ghost" onClick={onClear}>
          Clear Inputs
        </button>
      </div>
    </section>
  )
}
