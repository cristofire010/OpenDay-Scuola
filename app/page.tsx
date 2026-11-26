import { Suspense } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { CookieConsent } from '@/components/home/cookie-consent'
import { OpenVoltaExperienceStations } from '@/components/home/home-page-client'
import { getActiveDeviceTicket, getStaffOverview } from '@/lib/assignments'
import { DEVICE_COOKIE_NAME } from '@/lib/device'

export const metadata: Metadata = {
  title: 'OpenVolta — Open Day della Scuola',
  description: 'Inquadra il QR, scrivi il tuo nome e la dimensione del gruppo, scegli i laboratori dall’elenco e ricevi il tutor.',
}

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const cookieStore = await cookies()
  const deviceId = cookieStore.get(DEVICE_COOKIE_NAME)?.value
  const [overview, existingTicket] = await Promise.all([
    getStaffOverview(),
    deviceId ? getActiveDeviceTicket(deviceId) : Promise.resolve(null),
  ])

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CookieConsent />
      <OpenVoltaExperienceStations
        stations={overview.stations}
        existingTicket={existingTicket}
      />
    </Suspense>
  )
}