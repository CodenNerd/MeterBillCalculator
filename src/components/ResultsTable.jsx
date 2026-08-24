'use client'

import { useMemo, useState } from 'react'
import ResultRow from './ResultRow'
import Totals from './Totals'

function billAmount(row, hasLineLoss) {
  return hasLineLoss ? row.finalAmount : row.amount
}

function HeadCell({ label, sub, align, sortKey, sort, onSort }) {
  const sortable = Boolean(sortKey && onSort)
  const active = sortable && sort?.key === sortKey
  const Tag = sortable ? 'button' : 'span'

  return (
    <Tag
      type={sortable ? 'button' : undefined}
      className={`th-cell ${align === 'right' ? 'align-right' : ''} ${sortable ? 'th-cell--sortable' : ''} ${active ? 'th-cell--active' : ''}`}
      onClick={sortable ? () => onSort(sortKey) : undefined}
      aria-sort={
        !active ? undefined : sort?.dir === 'asc' ? 'ascending' : 'descending'
      }
    >
      <span className="th-label">
        {label}
        {sortable && (
          <span className="th-sort" aria-hidden="true">
            {active ? (sort?.dir === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        )}
      </span>
      {sub && <span className="th-sub">{sub}</span>}
    </Tag>
  )
}

function compareRows(a, b, key, dir, hasLineLoss) {
  let av
  let bv
  switch (key) {
    case 'name':
      av = a.name.toLocaleLowerCase()
      bv = b.name.toLocaleLowerCase()
      break
    case 'units':
      av = a.units
      bv = b.units
      break
    case 'misc':
      av = a.misc
      bv = b.misc
      break
    case 'lineLoss':
      av = a.lineLossShare ?? 0
      bv = b.lineLossShare ?? 0
      break
    case 'amount':
    default:
      av = billAmount(a, hasLineLoss)
      bv = billAmount(b, hasLineLoss)
      break
  }

  let cmp = 0
  if (typeof av === 'string') {
    cmp = av.localeCompare(bv)
  } else {
    cmp = av - bv
  }
  if (cmp === 0) cmp = a.name.localeCompare(b.name)
  return dir === 'asc' ? cmp : -cmp
}

export default function ResultsTable({ result, onRowClick, interactive }) {
  const hasLineLoss = result.lineLoss !== undefined
  const [sort, setSort] = useState({ key: 'amount', dir: 'desc' })

  const sortedRows = useMemo(
    () => [...result.rows].sort((a, b) => compareRows(a, b, sort.key, sort.dir, hasLineLoss)),
    [result.rows, sort, hasLineLoss],
  )

  const maxUnits = Math.max(...result.rows.map(r => r.units), 0.01)

  function handleSort(key) {
    setSort(prev => (
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' }
    ))
  }

  return (
    <section className="card results-card">
      <div className="results-table">
        <div className={`table-head ${hasLineLoss ? 'table-head--with-loss' : ''}`}>
          <HeadCell
            label="Business"
            sub="Tenant"
            sortKey="name"
            sort={sort}
            onSort={handleSort}
          />
          <HeadCell label="Prev" sub="kWh start" align="right" />
          <HeadCell label="Current" sub="kWh end" align="right" />
          <HeadCell
            label="Units"
            sub="current − prev (kWh)"
            align="right"
            sortKey="units"
            sort={sort}
            onSort={handleSort}
          />
          <HeadCell
            label="Misc"
            sub="₦ optional"
            align="right"
            sortKey="misc"
            sort={sort}
            onSort={handleSort}
          />
          {hasLineLoss && (
            <HeadCell
              label="Line loss"
              sub="share of office − meter gap (₦)"
              align="right"
              sortKey="lineLoss"
              sort={sort}
              onSort={handleSort}
            />
          )}
          <HeadCell
            label={hasLineLoss ? 'Final' : 'Amount'}
            sub={hasLineLoss ? 'energy + misc + share (₦)' : 'energy + misc (₦)'}
            align="right"
            sortKey="amount"
            sort={sort}
            onSort={handleSort}
          />
        </div>

        {sortedRows.map((row, index) => (
          <ResultRow
            key={row.id}
            row={row}
            displayNumber={index + 1}
            maxUnits={maxUnits}
            hasLineLoss={hasLineLoss}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            interactive={interactive}
          />
        ))}
      </div>

      <Totals
        totalUnits={result.totalUnits}
        totalMisc={result.totalMisc}
        totalAmount={hasLineLoss ? result.totalFinalAmount : result.totalAmount}
        lineLoss={hasLineLoss ? result.lineLoss : undefined}
      />
    </section>
  )
}
