import LineLossPanel from './LineLossPanel'
import ResultsTable from './ResultsTable'

export default function ResultsPage({
  result,
  flash,
  onBack,
  onSave,
  onPrint,
  onApplyLineLoss,
  onResetLineLoss,
  onShareRow,
  onDownloadRow,
}) {
  return (
    <main className="main">
      <div className="results-page-nav">
        <button className="btn btn-sm btn-ghost" onClick={onBack}>&larr; Back to Inputs</button>
      </div>

      <LineLossPanel
        result={result}
        businessCount={result.rows.length}
        onApply={onApplyLineLoss}
        onReset={onResetLineLoss}
      />

      <ResultsTable
        result={result}
        flash={flash}
        onSave={onSave}
        onPrint={onPrint}
        onShareRow={onShareRow}
        onDownloadRow={onDownloadRow}
      />
    </main>
  )
}
