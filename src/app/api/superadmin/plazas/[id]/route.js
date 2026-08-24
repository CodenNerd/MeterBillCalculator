import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  createServiceSupabase,
  findAuthUserByEmail,
} from '../../../../../lib/supabaseAdmin'
import { env, getSupabaseUrl, getSupabasePublishableKey } from '../../../../../lib/env'
import { isValidPlazaSlug, slugifyPlazaName } from '../../../../../utils/plaza'

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

/**
 * PATCH — update plaza name/slug and/or plaza admin email/password.
 * Body: { name?, slug?, ownerEmail?, ownerPassword? }
 * Password is optional; omit to leave the current password unchanged.
 */
export async function PATCH(request, { params }) {
  const gate = await requireSuperadmin(request)
  if (gate.error) return gate.error

  const plazaId = params?.id
  if (!plazaId) {
    return NextResponse.json({ error: 'Plaza id required' }, { status: 400 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const hasName = body.name !== undefined
  const hasSlug = body.slug !== undefined
  const hasEmail = body.ownerEmail !== undefined || body.adminEmail !== undefined
  const hasPassword = body.ownerPassword !== undefined || body.adminPassword !== undefined

  if (!hasName && !hasSlug && !hasEmail && !hasPassword) {
    return NextResponse.json({ error: 'No updates provided.' }, { status: 400 })
  }

  try {
    const admin = createServiceSupabase()

    const { data: plaza, error: loadError } = await admin
      .from('complexes')
      .select('*')
      .eq('id', plazaId)
      .maybeSingle()

    if (loadError) throw new Error(loadError.message)
    if (!plaza) {
      return NextResponse.json({ error: 'Plaza not found.' }, { status: 404 })
    }

    const patch = {}

    if (hasName) {
      const name = String(body.name || '').trim() || plaza.name || 'Untitled Plaza'
      patch.name = name
    }

    if (hasSlug) {
      const slug = String(body.slug || slugifyPlazaName(patch.name || plaza.name))
        .toLowerCase()
        .trim()
      if (!isValidPlazaSlug(slug)) {
        return NextResponse.json(
          { error: 'Invalid plaza slug. Use lowercase letters, numbers, and hyphens.' },
          { status: 400 },
        )
      }
      if (slug !== plaza.slug) {
        const { data: taken } = await admin
          .from('complexes')
          .select('id')
          .eq('slug', slug)
          .neq('id', plazaId)
          .maybeSingle()
        if (taken) {
          return NextResponse.json({ error: 'That plaza slug is already taken.' }, { status: 409 })
        }
      }
      patch.slug = slug
    }

    const ownerEmail = hasEmail
      ? String(body.ownerEmail || body.adminEmail || '').trim().toLowerCase()
      : (plaza.owner_email || '').toLowerCase()
    const ownerPassword = hasPassword
      ? String(body.ownerPassword || body.adminPassword || '')
      : ''

    if (hasEmail && !ownerEmail) {
      return NextResponse.json({ error: 'Plaza admin email cannot be empty.' }, { status: 400 })
    }
    if (hasPassword && ownerPassword.length > 0 && ownerPassword.length < 6) {
      return NextResponse.json(
        { error: 'Plaza admin password must be at least 6 characters.' },
        { status: 400 },
      )
    }

    const superEmail = (env('SUPERADMIN_EMAIL') || '').trim().toLowerCase()
    if (ownerEmail && superEmail && ownerEmail === superEmail) {
      return NextResponse.json(
        { error: 'Plaza admin email cannot be the same as the superadmin email.' },
        { status: 400 },
      )
    }

    if (hasEmail || (hasPassword && ownerPassword)) {
      let owner = ownerEmail ? await findAuthUserByEmail(admin, ownerEmail) : null

      // Prefer existing plaza owner when email unchanged and we only reset password.
      if (!owner && plaza.owner_id && !hasEmail) {
        const { data } = await admin.auth.admin.getUserById(plaza.owner_id)
        owner = data?.user || null
      }

      const authPatch = {
        email_confirm: true,
        user_metadata: { role: 'admin' },
      }
      if (hasEmail && ownerEmail) authPatch.email = ownerEmail
      if (hasPassword && ownerPassword) authPatch.password = ownerPassword

      if (owner) {
        const meta = { ...(owner.user_metadata || {}), role: 'admin' }
        authPatch.user_metadata = meta
        const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(
          owner.id,
          authPatch,
        )
        if (updateError) throw new Error(updateError.message)
        owner = updated.user
      } else {
        if (!ownerEmail || !ownerPassword) {
          return NextResponse.json(
            {
              error: hasEmail && !ownerPassword
                ? 'New plaza admin email needs a password (user does not exist yet).'
                : 'Plaza admin email and password are required to provision a login.',
            },
            { status: 400 },
          )
        }
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email: ownerEmail,
          password: ownerPassword,
          email_confirm: true,
          user_metadata: { role: 'admin' },
        })
        if (createError) throw new Error(createError.message)
        owner = created.user
      }

      if (ownerEmail) patch.owner_email = ownerEmail
      if (owner?.id) patch.owner_id = owner.id
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ plaza })
    }

    const { data: updatedPlaza, error: plazaError } = await admin
      .from('complexes')
      .update(patch)
      .eq('id', plazaId)
      .select()
      .single()

    if (plazaError) throw new Error(plazaError.message)
    return NextResponse.json({ plaza: updatedPlaza })
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Could not update plaza' },
      { status: 500 },
    )
  }
}
