import { db } from '@/lib/db'
import { openDayParticipantStations, openDayParticipants, openDayStations } from '@/lib/db/schema'
import { and, eq, isNull, inArray, sql } from 'drizzle-orm'
import type { StationAvailability } from '@/lib/open-day-types'

/**
 * Unified function to get station occupancy.
 * Uses the same counting logic as createAssignment for consistency.
 * Returns a map of stationSlug -> current occupancy (total groupSize sum).
 */
export async function getStationOccupancy(
  stationSlugs?: string[]
): Promise<Record<string, number>> {
  // Build the base query: count groupSize per station, only non-completed participants
  const baseConditions = [isNull(openDayParticipants.completedAt)]

  if (stationSlugs && stationSlugs.length > 0) {
    baseConditions.push(inArray(openDayParticipantStations.stationSlug, stationSlugs))
  }

  const rows = await db
    .select({
      slug: openDayParticipantStations.stationSlug,
      occupancy: sql<number>`sum(${openDayParticipants.groupSize})::integer`,
    })
    .from(openDayParticipantStations)
    .innerJoin(openDayParticipants, eq(openDayParticipants.id, openDayParticipantStations.participantId))
    .where(and(...baseConditions))
    .groupBy(openDayParticipantStations.stationSlug)

  const result: Record<string, number> = {}

  rows.forEach((row) => {
    // Type assertion to help TypeScript narrow the type
    const occupancy = row.occupancy as number | undefined
    if (occupancy !== undefined) {
      result[row.slug] = occupancy
    }
  })

  return result
}