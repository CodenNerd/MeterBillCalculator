/**
 * Build breadcrumb items. Superadmins always get a Superadmin lead-in.
 * @param {{ role?: string, plazaSlug?: string, plazaName?: string, trail?: { label: string, href?: string }[] }} opts
 */
export function buildPlazaCrumbs({ role, plazaSlug, plazaName, trail = [] }) {
  const items = []
  if (role === 'superadmin') {
    items.push({ label: 'Superadmin', href: '/superadmin' })
  }
  if (plazaSlug) {
    items.push({
      label: plazaName || plazaSlug,
      href: `/${plazaSlug}/`,
    })
  }
  return [...items, ...trail]
}
