import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { ensureComplex, claimBusinessRow, onAuthStateChange } from '../services/auth'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [complex, setComplex] = useState(null)
  const [business, setBusiness] = useState(null)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState(null)

  const resolveContext = useCallback(async (sess) => {
    if (!sess) {
      setRole(null)
      setComplex(null)
      setBusiness(null)
      setReady(true)
      return
    }
    const user = sess.user
    const userRole = user.user_metadata?.role || 'admin'
    setRole(userRole)
    setAuthError(null)
    try {
      if (userRole === 'admin') {
        const c = await ensureComplex(user)
        setComplex(c)
      } else {
        const b = await claimBusinessRow(user)
        setBusiness(b)
      }
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

  return { session, role, complex, business, ready, authError, setComplex }
}
