import { useEffect, useState } from 'react'

/**
 * A minimal hash-based router — no external dependency needed.
 * Routes look like:  #/            -> input page
 *                     #/results    -> full billing summary page
 *                     #/bill?d=... -> a single business's standalone bill page
 */
export function parseHash(hash) {
  const clean = (hash || '').replace(/^#\/?/, '')
  const [path, queryString] = clean.split('?')
  const params = Object.fromEntries(new URLSearchParams(queryString || ''))
  return { path: path || '', params }
}

export function navigate(path) {
  window.location.hash = path
}

export function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    function onChange() {
      setHash(window.location.hash)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return parseHash(hash)
}
