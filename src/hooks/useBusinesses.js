import { useState, useEffect } from 'react'
import {
  fetchBusinesses,
  addBusiness,
  renameBusiness,
  removeBusiness,
  saveCycleReadings,
  updatePreviousReading,
} from '../services/supabase'

/**
 * Manages all business data synced with Supabase.
 * Replaces the old useStorage hook for businesses and previous readings.
 */
export function useBusinesses() {
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load businesses from DB on mount
  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchBusinesses()
      setBusinesses(data)
    } catch (err) {
      setError('Failed to load data. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  async function add() {
    const nextId = businesses.length > 0
      ? Math.max(...businesses.map(b => b.id)) + 1
      : 1
    const newBiz = { id: nextId, name: `Business ${nextId}` }
    try {
      const saved = await addBusiness(newBiz)
      setBusinesses(prev => [...prev, saved])
      return saved
    } catch (err) {
      setError('Failed to add business.')
    }
  }

  async function rename(id, newName) {
    try {
      await renameBusiness(id, newName)
      setBusinesses(prev =>
        prev.map(b => b.id === id ? { ...b, name: newName } : b)
      )
    } catch (err) {
      setError('Failed to rename business.')
    }
  }

  async function remove(id) {
    try {
      await removeBusiness(id)
      setBusinesses(prev => prev.filter(b => b.id !== id))
    } catch (err) {
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
    } catch (err) {
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
          updated_at: new Date().toISOString(),
        }
      })

      await saveCycleReadings(updates)

      // Update local state so UI reflects new previous readings immediately
      setBusinesses(prev =>
        prev.map(b => ({
          ...b,
          previous_reading: parseFloat(currentReadings[b.id]) || b.previous_reading,
        }))
      )
    } catch (err) {
      setError('Failed to save readings.')
      throw err // re-throw so App.jsx can handle it
    }
  }

  return { businesses, loading, error, add, rename, remove, setPrevious, saveCycle, reload: load }
}
