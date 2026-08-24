import { NextResponse } from 'next/server'
import {
  createServiceSupabase,
  findAuthUserByEmail,
  getSuperadminCredentials,
  isConfiguredSuperadmin,
} from '../../../../lib/supabaseAdmin'

/**
 * Ensures the env-configured superadmin exists in Supabase Auth
 * (email confirmed, role=superadmin, password synced).
 * No-op (204) when credentials are not the configured superadmin.
 */
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!isConfiguredSuperadmin(email, password)) {
    return new NextResponse(null, { status: 204 })
  }

  const cfg = getSuperadminCredentials()
  if (!cfg.email || !cfg.password) {
    return NextResponse.json(
      { error: 'SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD are not set on the server.' },
      { status: 500 },
    )
  }

  try {
    const admin = createServiceSupabase()
    const existing = await findAuthUserByEmail(admin, cfg.email)

    if (existing) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password: cfg.password,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata || {}), role: 'superadmin' },
      })
      if (updateError) throw new Error(updateError.message)
    } else {
      const { error: createError } = await admin.auth.admin.createUser({
        email: cfg.email,
        password: cfg.password,
        email_confirm: true,
        user_metadata: { role: 'superadmin' },
      })
      if (createError) throw new Error(createError.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Could not prepare superadmin account' },
      { status: 500 },
    )
  }
}
