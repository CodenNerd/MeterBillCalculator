'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { bindNavigate } from '../../utils/navigation'
import { BillingProvider } from './BillingProvider'

function NavigationBinder({ children }) {
  const router = useRouter()
  useEffect(() => {
    bindNavigate((path) => router.push(path))
  }, [router])
  return children
}

/** Redirect legacy hash routes (#/cycles/:id) to path routes. */
function HashRedirect() {
  const router = useRouter()
  useEffect(() => {
    const hash = window.location.hash || ''
    if (!hash.startsWith('#/')) return
    const clean = hash.slice(1) // /cycles/1 or /bills?d=...
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    router.replace(clean)
  }, [router])
  return null
}

export default function AppProviders({ children }) {
  return (
    <NavigationBinder>
      <HashRedirect />
      <BillingProvider>
        {children}
      </BillingProvider>
    </NavigationBinder>
  )
}
