import type { StationAvailability } from '@/lib/open-day-types'
import { OpenVoltaExperience } from '@/components/home/openvolta-experience'

export function OpenVoltaExperienceStations({
  stations,
  existingTicket,
}: {
  stations: StationAvailability[]
  existingTicket: { id: string; displayName: string } | null
}) {
  return (
    <OpenVoltaExperience
      stations={stations}
      existingTicket={existingTicket ?? undefined}
    />
  )
}
