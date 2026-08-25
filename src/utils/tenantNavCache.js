/**
 * In-memory caches for tenant navigation so switching back and forth
 * does not refetch or flash empty chrome on App Router [id] remounts.
 */

const businessesByComplex = new Map()
const cycleShellById = new Map()
const timelineByBusiness = new Map()
const invoiceByKey = new Map()

function invoiceKey(businessId, cycleId) {
  return `${businessId}:${cycleId}`
}

export function getCachedBusinesses(complexId) {
  if (complexId == null) return null
  return businessesByComplex.get(String(complexId)) || null
}

export function setCachedBusinesses(complexId, list) {
  if (complexId == null) return
  businessesByComplex.set(String(complexId), list || [])
}

export function getCachedCycleShell(cycleId) {
  if (cycleId == null) return null
  return cycleShellById.get(String(cycleId)) || null
}

export function setCachedCycleShell(cycleId, shell) {
  if (cycleId == null) return
  cycleShellById.set(String(cycleId), shell)
}

export function getCachedTimeline(businessId) {
  if (businessId == null) return null
  return timelineByBusiness.get(String(businessId)) || null
}

export function setCachedTimeline(businessId, entry) {
  if (businessId == null) return
  timelineByBusiness.set(String(businessId), entry)
}

export function getCachedInvoice(businessId, cycleId) {
  if (businessId == null || cycleId == null) return null
  return invoiceByKey.get(invoiceKey(businessId, cycleId)) || null
}

export function setCachedInvoice(businessId, cycleId, entry) {
  if (businessId == null || cycleId == null) return
  invoiceByKey.set(invoiceKey(businessId, cycleId), entry)
}
