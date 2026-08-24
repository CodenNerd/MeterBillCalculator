'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { fetchPlazaBySlug } from '../../services/supabase'
import { isValidPlazaSlug, RESERVED_PLAZA_SLUGS } from '../../utils/plaza'
import { Wordmark } from '../../components/Header'

export default function PlazaLayout({ children }) {
  const params = useParams()
  const slug = params.plazaSlug
  const [plaza, setPlaza] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!slug || RESERVED_PLAZA_SLUGS.has(slug) || !isValidPlazaSlug(slug)) {
      setError('Plaza not found')
      setLoading(false)
      return
    }
    setLoading(true)
    fetchPlazaBySlug(slug)
      .then((row) => {
        if (cancelled) return
        if (!row) setError('Plaza not found')
        else {
          setPlaza(row)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Plaza not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [slug])

  if (loading) {
    return (
      <div className="app">
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading plaza...</p>
        </div>
      </div>
    )
  }

  if (error || !plaza) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-inner">
            <div className="logo"><Wordmark /></div>
          </div>
        </header>
        <div className="status-screen">
          <p className="error-text">{error || 'Plaza not found'}</p>
        </div>
      </div>
    )
  }

  return children
}
