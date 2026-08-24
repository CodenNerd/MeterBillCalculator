'use client'

import { useState } from 'react'

export function useStorage(key, fallback) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return fallback
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  })

  function set(newValue) {
    setValue(newValue)
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(newValue))
    }
  }

  function clear() {
    setValue(fallback)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key)
    }
  }

  return [value, set, clear]
}
