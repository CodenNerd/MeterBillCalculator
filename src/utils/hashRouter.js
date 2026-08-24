import { useEffect, useState } from 'react'

/**
 * Hash router.
 *   #/                 -> home
 *   #/cycle            -> worksheet
 *   #/cycles/draft     -> draft bills table
 *   #/cycles/:id       -> published/concluded bills (stable share)
 *   #/businesses/:id   -> business bill timeline
 *   #/bills?d=...      -> legacy snapshot share
 */
export function parseHash(hash) {
  const clean = (hash || '').replace(/^#\/?/, '')
  const [pathPart, queryString] = clean.split('?')
  const params = Object.fromEntries(new URLSearchParams(queryString || ''))
  const segments = (pathPart || '').split('/').filter(Boolean)

  let path = segments[0] || ''
  if (path === 'cycles' && segments[1]) {
    params.id = segments[1]
    path = 'cycles'
  }
  if (path === 'businesses' && segments[1]) {
    params.id = segments[1]
    path = 'businesses'
  }

  return { path, params, segments }
}

export function navigate(path) {
  window.location.hash = path.startsWith('/') ? path : `/${path}`
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
