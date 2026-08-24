'use client'

import { useEffect } from 'react'
import Home from '../../components/Home'
import { AdminGate, useBilling } from '../../components/providers/BillingProvider'
import { navigate } from '../../utils/navigation'

export default function PlazaHomePage() {
  const {
    complex,
    plazaSlug,
    href,
    current,
    misc,
    notes,
    actualBill,
    activeCycleId,
    historyKey,
    handleContinuePublished,
  } = useBilling()

  useEffect(() => {
    if (complex?.slug && plazaSlug && complex.slug !== plazaSlug) {
      navigate(`/${complex.slug}/`)
    }
  }, [complex?.slug, plazaSlug])

  return (
    <AdminGate showHome={false}>
      <Home
        complexId={complex?.id}
        complexName={complex?.name}
        plazaSlug={plazaSlug}
        href={href}
        current={current}
        misc={misc}
        notes={notes}
        actualBill={actualBill}
        activeCycleId={activeCycleId}
        onRefreshKey={historyKey}
        onContinuePublished={handleContinuePublished}
        bannerEnabled={complex?.banner_enabled}
        bannerText={complex?.banner_text}
      />
    </AdminGate>
  )
}
