'use client'

import BusinessTimeline from '../../../components/BusinessTimeline'
import { AdminGate, useBilling } from '../../../components/providers/BillingProvider'
import { useParams } from 'next/navigation'

export default function BusinessPage() {
  const params = useParams()
  const { complex } = useBilling()

  return (
    <AdminGate showHome>
      <BusinessTimeline
        businessId={params.id}
        complexId={complex?.id}
      />
    </AdminGate>
  )
}
