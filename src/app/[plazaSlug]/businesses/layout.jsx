'use client'

import { Suspense } from 'react'
import { BusinessTenantNavProvider } from '../../../components/BusinessTenantNav'

export default function BusinessesLayout({ children }) {
  return (
    <Suspense fallback={children}>
      <BusinessTenantNavProvider>
        {children}
      </BusinessTenantNavProvider>
    </Suspense>
  )
}
