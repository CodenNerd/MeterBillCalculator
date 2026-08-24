'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase, fetchPlazaBySlug } from '../services/supabase'
import { ensureComplex, onAuthStateChange } from '../services/auth'
import { isSupabaseConfigured } from '../lib/env'

export function useAuth(plazaSlugHint = null) {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [complex, setComplex] = useState(null)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState(null)
  const bootedRef = useRef(false)

  // Subscribe to auth once for the lifetime of the provider.
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSession(null)
      setRole(null)
      setComplex(null)
      setAuthError(null)
      setReady(true)
      bootedRef.current = true
      return undefined
    }

    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
    })

    const subscription = onAuthStateChange((sess) => {
      setSession(sess)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  // Resolve role + plaza when session or URL plaza slug changes — without
  // tearing down the auth listener or flashing the full-page auth spinner.
  useEffect(() => {
    let cancelled = false

    async function resolve() {
      if (!session) {
        setRole(null)
        setComplex(null)
        setAuthError(null)
        setReady(true)
        bootedRef.current = true
        return
      }

      const user = session.user
      const userRole = user.user_metadata?.role || 'admin'
      setRole(userRole)
      setAuthError(null)

      // Only block the UI on the first bootstrap; later plaza switches update quietly.
      if (!bootedRef.current) setReady(false)

      try {
        if (userRole === 'superadmin') {
          if (plazaSlugHint) {
            const plaza = await fetchPlazaBySlug(plazaSlugHint)
            if (cancelled) return
            if (!plaza) {
              setAuthError(`No plaza found for “${plazaSlugHint}”.`)
              setComplex(null)
              return
            }
            setComplex(plaza)
            return
          }
          setComplex(null)
          return
        }

        if (userRole !== 'admin') {
          setAuthError('This account is not a plaza admin. Sign in with a plaza admin login.')
          setComplex(null)
          return
        }

        const c = await ensureComplex(user)
        if (cancelled) return
        if (plazaSlugHint && c.slug && c.slug !== plazaSlugHint) {
          setAuthError(`This account manages /${c.slug}/, not /${plazaSlugHint}/.`)
          setComplex(c)
          return
        }
        setComplex(c)
      } catch (err) {
        if (cancelled) return
        setAuthError(err.message)
        setComplex(null)
      } finally {
        if (!cancelled) {
          bootedRef.current = true
          setReady(true)
        }
      }
    }

    resolve()
    return () => { cancelled = true }
  }, [session, plazaSlugHint])

  return { session, role, complex, ready, authError, setComplex }
}
