/**
 * Local stub is on unless real Supabase credentials are present.
 * Set VITE_USE_LOCAL_STUB=true/false to force either mode.
 */
export function isLocalMode() {
  const flag = import.meta.env.VITE_USE_LOCAL_STUB
  if (flag === 'true') return true
  if (flag === 'false') return false

  const url = import.meta.env.VITE_SUPABASE_URL || ''
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  const placeholderUrl = !url || url.includes('your-project-id')
  const placeholderKey = !key || key.includes('your-anon')
  return placeholderUrl || placeholderKey
}
