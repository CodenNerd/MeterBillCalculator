import { redirect } from 'next/navigation'
import {
  fetchPublicCycleServer,
  createServerSupabase,
} from '../../../lib/serverSupabase'

/** Legacy /cycles/[id] → /{plazaSlug}/cycles/[id] */
export default async function LegacyCycleRedirect({ params }) {
  const cycle = await fetchPublicCycleServer(params.id)
  if (cycle?.complex_id) {
    const client = createServerSupabase()
    if (client) {
      const { data: plaza } = await client
        .from('complexes')
        .select('slug')
        .eq('id', cycle.complex_id)
        .maybeSingle()
      if (plaza?.slug) {
        redirect(`/${plaza.slug}/cycles/${params.id}`)
      }
    }
  }
  redirect('/')
}
