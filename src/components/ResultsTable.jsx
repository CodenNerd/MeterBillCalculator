import ResultRow from './ResultRow'
import Totals from './Totals'

export default function ResultsTable({ result, flash, onSave, onPrint }) {
  const maxUnits = Math.max(...result.rows.map(r => r.units), 0.01)

  return (
    <section className={`card results-card ${flash ? 'flash' : ''}`}>
      <div className="card-header">
        <h2 className="card-title">Billing Summary</h2>
        <div className="result-actions">
          <button className="btn btn-sm btn-ghost" onClick={onPrint}>Print</button>
          <button className="btn btn-sm btn-success" onClick={onSave}>
            Save & Next Cycle
          </button>
        </div>
      </div>

      <div className="results-table">
        <div className="table-head">
          <span>Business</span>
          <span className="align-right">Prev</span>
          <span className="align-right">Current</span>
          <span className="align-right">Units</span>
          <span className="align-right">Misc</span>
          <span className="align-right">Amount</span>
        </div>

        {result.rows.map(row => (
          <ResultRow key={row.id} row={row} maxUnits={maxUnits} />
        ))}
      </div>

      <Totals totalUnits={result.totalUnits} totalMisc={result.totalMisc} totalAmount={result.totalAmount} />
    </section>
  )
}
