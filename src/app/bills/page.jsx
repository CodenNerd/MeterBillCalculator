'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import BillsTablePage from '../../components/BillsTablePage'

function LegacyBillsInner() {
  const searchParams = useSearchParams()
  const encoded = searchParams.get('d')
  return <BillsTablePage mode="public" encoded={encoded} />
}

export default function LegacyBillsPage() {
  return (
    <Suspense fallback={
      <div className="app">
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      </div>
    }>
      <LegacyBillsInner />
    </Suspense>
  )
}
