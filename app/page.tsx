import { Suspense } from 'react'
import type { Metadata } from 'next'
import { QrCode } from 'lucide-react'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { OpenVoltaExperience } from '@/components/home/openvolta-experience'
import { getStaffOverview } from '@/lib/assignments'

export const metadata: Metadata = {
  title: 'OpenVolta — Open Day di Fisica',
  description: 'Inquadra il QR, scrivi il tuo nome e la dimensione del gruppo, scegli i laboratori sulla mappa e ricevi il tutor.',
}

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const stations = await getStaffOverview()
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <WelcomePage stations={stations} />
    </Suspense>
  )
}

function WelcomePage({ stations }: { stations: Awaited<ReturnType<typeof getStaffOverview>> }) {
  return <OpenVoltaExperience stations={stations.stations} />
}
