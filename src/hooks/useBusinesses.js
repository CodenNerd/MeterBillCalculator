'use client'

import { useState, useEffect } from 'react'
import {
  fetchBusinesses,
  addBusiness,
  renameBusiness,
  replaceTenant,
  removeBusiness,
  saveCycleReadings,
  updatePreviousReading,
} from '../services/supabase'

/**
 * Manages all business data synced with Supabase, scoped to one complex.
 */
export function useBusinesses(complexId) {
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(Boolean(complexId))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!complexId) {
      setBusinesses([])
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchBusinesses(complexId)
        if (!cancelled) setBusinesses(data)
      } catch {
        if (!cancelled) setError('Failed to load data. Check your connection.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [complexId])

  async function load() {
    if (!complexId) {
      setBusinesses([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const data = await fetchBusinesses(complexId)
      setBusinesses(data)
    } catch {
      setError('Failed to load data. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  async function add(biz) {
    try {
      const saved = await addBusiness(biz, complexId)
      setBusinesses(prev => [...prev, saved])
      return saved
    } catch (err) {
      setError('Failed to add business.')
      throw err
    }
  }

  async function rename(id, newName) {
    try {
      await renameBusiness(id, newName)
      setBusinesses(prev =>
        prev.map(b => b.id === id ? { ...b, name: newName.trim() } : b)
      )
    } catch {
      setError('Failed to rename business.')
    }
  }

  async function replace(id, newName) {
    try {
      const trimmed = String(newName || '').trim()
      await replaceTenant(id, trimmed)
      setBusinesses(prev =>
        prev.map(b => (b.id === id ? { ...b, name: trimmed } : b))
      )
    } catch (err) {
      setError('Failed to replace tenant.')
      throw err
    }
  }

  async function remove(id) {
    try {
      await removeBusiness(id)
      setBusinesses(prev => prev.filter(b => b.id !== id))
    } catch {
      setError('Failed to remove business.')
    }
  }

  async function setPrevious(id, value) {
    const parsed = parseFloat(value)
    const nextReading = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    try {
      await updatePreviousReading(id, nextReading)
      setBusinesses(prev =>
        prev.map(b => (b.id === id ? { ...b, previous_reading: nextReading } : b))
      )
    } catch {
      setError('Failed to update previous reading.')
    }
  }

  async function saveCycle(currentReadings) {
    try {
      const updates = businesses.map(b => {
        const parsed = parseFloat(currentReadings[b.id])
        const nextReading = Number.isFinite(parsed) ? parsed : b.previous_reading

        return {
          id: b.id,
          name: b.name,
          previous_reading: nextReading,
        }
      })

      await saveCycleReadings(updates)

      setBusinesses(prev =>
        prev.map(b => ({
          ...b,
          previous_reading: parseFloat(currentReadings[b.id]) || b.previous_reading,
        }))
      )
    } catch (err) {
      setError('Failed to save readings.')
      throw err
    }
  }

  return { businesses, loading, error, add, rename, replace, remove, setPrevious, saveCycle, reload: load }
}
