'use client'

import { useEffect } from 'react'
import Home from '../../components/Home'
import Breadcrumbs from '../../components/Breadcrumbs'
import { AdminGate, useBilling } from '../../components/providers/BillingProvider'
import { navigate } from '../../utils/navigation'
import { buildPlazaCrumbs } from '../../utils/breadcrumbs'

export default function PlazaHomePage() {
  const {
    complex,
    plazaSlug,
    historyKey,
    role,
    href,
    startFreshCycle,
  } = useBilling()

  useEffect(() => {
    if (complex?.slug && plazaSlug && complex.slug !== plazaSlug) {
      navigate(`/${complex.slug}/`)
    }
  }, [complex?.slug, plazaSlug])

  const breadcrumbs = role === 'superadmin'
    ? (
      <Breadcrumbs
        items={buildPlazaCrumbs({
          role,
          plazaSlug,
          plazaName: complex?.name,
          trail: [],
        })}
      />
      )
    : null

  return (
    <AdminGate showHome={false}>
      <Home
        complexId={complex?.id}
        complexName={complex?.name}
        plazaSlug={plazaSlug}
        href={href}
        onRefreshKey={historyKey}
        onStartCycle={startFreshCycle}
        bannerEnabled={complex?.banner_enabled}
        bannerText={complex?.banner_text}
        breadcrumbs={breadcrumbs}
      />
    </AdminGate>
  )
}
