'use client'

/**
 * Imperative navigation for call sites that are not React components.
 * Bound from NavigationBinder in the root providers (synchronously on render).
 */
let pushImpl = null

export function bindNavigate(push) {
  pushImpl = push
}

export function navigate(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (pushImpl) {
    pushImpl(normalized)
    return
  }
  if (typeof window !== 'undefined') {
    // Should be rare: NavigationBinder binds during render before children run.
    console.warn('navigate() called before router bind; using history API')
    window.history.pushState({}, '', normalized)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}
