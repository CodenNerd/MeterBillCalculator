/** sessionStorage helpers for guest worksheet sandbox (no DB writes). */

export function guestSandboxStorageKey(plazaSlug, cycleId) {
  const slug = plazaSlug || 'plaza'
  const id = cycleId != null && cycleId !== '' ? String(cycleId) : 'latest'
  return `mc_guest_sandbox_${slug}_${id}`
}

export function saveGuestSandbox(plazaSlug, cycleId, snapshot) {
  if (typeof sessionStorage === 'undefined') return
  const key = guestSandboxStorageKey(plazaSlug, cycleId)
  sessionStorage.setItem(key, JSON.stringify({
    ...snapshot,
    plazaSlug,
    cycleId: cycleId ?? null,
    savedAt: Date.now(),
  }))
  sessionStorage.setItem('mc_guest_sandbox_active', key)
}

export function loadActiveGuestSandbox() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const key = sessionStorage.getItem('mc_guest_sandbox_active')
    if (!key) return null
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
