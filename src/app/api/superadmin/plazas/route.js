import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  createServiceSupabase,
  findAuthUserByEmail,
} from '../../../../lib/supabaseAdmin'
import { env, getSupabaseUrl, getSupabasePublishableKey } from '../../../../lib/env'
import { isValidPlazaSlug, slugifyPlazaName } from '../../../../utils/plaza'

async function requireSuperadmin(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const url = getSupabaseUrl()
  const anon = getSupabasePublishableKey()
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error } = await userClient.auth.getUser(token)
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const role = user.user_metadata?.role
  const superEmail = (env('SUPERADMIN_EMAIL') || '').trim().toLowerCase()
  const isSuper = role === 'superadmin'
    || (superEmail && (user.email || '').toLowerCase() === superEmail)

  if (!isSuper) {
    return { error: NextResponse.json({ error: 'Superadmin only' }, { status: 403 }) }
  }

  return { user }
}

export async function POST(request) {
  const gate = await requireSuperadmin(request)
  if (gate.error) return gate.error

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = String(body.name || '').trim() || 'Untitled Plaza'
  const slug = String(body.slug || slugifyPlazaName(name)).toLowerCase()
  const ownerEmail = String(body.ownerEmail || body.adminEmail || '').trim().toLowerCase()
  const ownerPassword = String(body.ownerPassword || body.adminPassword || '')

  if (!isValidPlazaSlug(slug)) {
    return NextResponse.json(
      { error: 'Invalid plaza slug. Use lowercase letters, numbers, and hyphens.' },
      { status: 400 },
    )
  }
  if (!ownerEmail || !ownerPassword) {
    return NextResponse.json(
      { error: 'Plaza admin email and password are required.' },
      { status: 400 },
    )
  }
  if (ownerPassword.length < 6) {
    return NextResponse.json(
      { error: 'Plaza admin password must be at least 6 characters.' },
      { status: 400 },
    )
  }

  const superEmail = (env('SUPERADMIN_EMAIL') || '').trim().toLowerCase()
  if (superEmail && ownerEmail === superEmail) {
    return NextResponse.json(
      { error: 'Plaza admin email cannot be the same as the superadmin email.' },
      { status: 400 },
    )
  }

  try {
    const admin = createServiceSupabase()

    const { data: existingPlaza } = await admin
      .from('complexes')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existingPlaza) {
      return NextResponse.json({ error: 'That plaza slug is already taken.' }, { status: 409 })
    }

    let owner = await findAuthUserByEmail(admin, ownerEmail)

    if (owner) {
      const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(owner.id, {
        password: ownerPassword,
        email_confirm: true,
        user_metadata: { ...(owner.user_metadata || {}), role: 'admin' },
      })
      if (updateError) throw new Error(updateError.message)
      owner = updated.user
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
        user_metadata: { role: 'admin' },
      })
      if (createError) throw new Error(createError.message)
      owner = created.user
    }

    const { data: plaza, error: plazaError } = await admin
      .from('complexes')
      .insert({
        name,
        slug,
        owner_email: ownerEmail,
        owner_id: owner.id,
      })
      .select()
      .single()

    if (plazaError) throw new Error(plazaError.message)

    return NextResponse.json({ plaza })
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Could not create plaza' },
      { status: 500 },
    )
  }
}
