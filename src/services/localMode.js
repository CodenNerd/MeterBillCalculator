/**
 * Local stub is on unless real Supabase credentials are present.
 * Set NEXT_PUBLIC_USE_LOCAL_STUB=true/false to force either mode.
 */
import { env } from '../lib/env'

export function isLocalMode() {
  const flag = env('NEXT_PUBLIC_USE_LOCAL_STUB')
  if (flag === 'true') return true
  if (flag === 'false') return false

  const url = env('NEXT_PUBLIC_SUPABASE_URL', '')
  const key = env('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
  const placeholderUrl = !url || url.includes('your-project-id')
  const placeholderKey = !key || key.includes('your-anon')
  return placeholderUrl || placeholderKey
}
