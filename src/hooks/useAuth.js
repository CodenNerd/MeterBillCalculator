'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { ensureComplex, onAuthStateChange } from '../services/auth'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [complex, setComplex] = useState(null)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState(null)

  const resolveContext = useCallback(async (sess) => {
    if (!sess) {
      setRole(null)
      setComplex(null)
      setReady(true)
      return
    }
    const user = sess.user
    const userRole = user.user_metadata?.role || 'admin'
    setRole(userRole)
    setAuthError(null)
    try {
      if (userRole !== 'admin') {
        setAuthError('This account is not an admin account. Sign in with a complex admin login.')
        return
      }
      const c = await ensureComplex(user)
      setComplex(c)
    } catch (err) {
      setAuthError(err.message)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      resolveContext(data.session)
    })

    const subscription = onAuthStateChange((sess) => {
      setSession(sess)
      setReady(false)
      resolveContext(sess)
    })

    return () => subscription.unsubscribe()
  }, [resolveContext])

  return { session, role, complex, ready, authError, setComplex }
}
