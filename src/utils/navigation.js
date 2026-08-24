'use client'

/**
 * Imperative navigation for call sites that are not React components.
 * Bound once from NavigationBinder in the root providers.
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
    window.location.href = normalized
  }
}
