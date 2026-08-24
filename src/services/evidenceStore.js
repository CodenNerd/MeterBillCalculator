const DB_NAME = 'metercalc_evidence'
const STORE = 'files'
const DB_VERSION = 1

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function evidenceKey(complexId, cycleId, businessId) {
  return `${complexId}/${cycleId}/${businessId}`
}

/**
 * Store a payment-evidence blob. Returns the key used.
 * Swap this module later for Supabase Storage while keeping the same API.
 */
export async function putEvidence(key, file) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({
      blob: file,
      name: file.name,
      type: file.type,
      size: file.size,
      updatedAt: new Date().toISOString(),
    }, key)
    tx.oncomplete = () => resolve(key)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getEvidence(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteEvidence(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getEvidenceObjectUrl(key) {
  const record = await getEvidence(key)
  if (!record?.blob) return null
  return URL.createObjectURL(record.blob)
}
