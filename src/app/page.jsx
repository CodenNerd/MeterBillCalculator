'use client'

import { useEffect } from 'react'
import AuthGate from '../components/AuthGate'
import Header from '../components/Header'
import { useBilling } from '../components/providers/BillingProvider'
import { navigate } from '../utils/navigation'
import { plazaPath } from '../utils/plaza'

/** Root: login, or redirect plaza admin / superadmin to their home. */
export default function RootPage() {
  const { session, role, complex, ready, authError } = useBilling()

  useEffect(() => {
    if (!ready || !session) return
    if (role === 'superadmin') {
      navigate('/superadmin')
      return
    }
    if (role === 'admin' && complex?.slug) {
      navigate(plazaPath(complex.slug, '/'))
    }
  }, [ready, session, role, complex?.slug])

  if (!ready) {
    return (
      <div className="app">
        <Header />
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthGate />
  }

  if (authError) {
    return (
      <div className="app">
        <Header showSignOut />
        <div className="status-screen">
          <p className="error-text">{authError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Header showSignOut />
      <div className="status-screen">
        <div className="spinner" />
        <p>Opening your plaza...</p>
      </div>
    </div>
  )
}
