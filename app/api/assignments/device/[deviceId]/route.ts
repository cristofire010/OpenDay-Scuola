import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { openDayParticipants, openDayParticipantStations, openDayStations } from '@/lib/db/schema'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { DEVICE_COOKIE_NAME } from '@/lib/device'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params

    const jar = await cookies()
    const storedDeviceId = jar.get(DEVICE_COOKIE_NAME)?.value
    if (!storedDeviceId || storedDeviceId !== deviceId) {
      return NextResponse.json({ error: 'Biglietto non trovato.' }, { status: 404 })
    }

    const assignments = await db
      .select({
        id: openDayParticipants.id,
        displayName: openDayParticipants.displayName,
        status: openDayParticipants.status,
        groupSize: openDayParticipants.groupSize,
        assignedTutorName: openDayParticipants.assignedTutorName,
      })
      .from(openDayParticipants)
      .where(and(
        eq(openDayParticipants.deviceId, deviceId),
        isNull(openDayParticipants.completedAt),
      ))
      .orderBy(desc(openDayParticipants.createdAt))

    // Get station info for each assignment
    const assignmentIds = assignments.map((a) => a.id)
    const stations = assignmentIds.length > 0
      ? await db
        .select({
          participantId: openDayParticipantStations.participantId,
          stationSlug: openDayParticipantStations.stationSlug,
          stationCode: openDayStations.stationCode,
          title: openDayStations.title,
        })
        .from(openDayParticipantStations)
        .innerJoin(openDayStations, eq(openDayParticipantStations.stationSlug, openDayStations.slug))
        .where(inArray(openDayParticipantStations.participantId, assignmentIds))
      : []

    // Group stations by participant ID
    const stationsByParticipant: Record<string, any> = {}
    stations.forEach((s: any) => {
      if (!stationsByParticipant[s.participantId]) {
        stationsByParticipant[s.participantId] = []
      }
      stationsByParticipant[s.participantId].push({
        stationSlug: s.stationSlug,
        stationCode: s.stationCode,
        title: s.title,
      })
    })

    const enriched = assignments.map((assignment) => ({
      ...assignment,
      stations: stationsByParticipant[assignment.id] || [],
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('Error fetching device assignments:', error)
    return NextResponse.json(
      { error: 'Errore durante il recupero dei biglietti. Riprova.' },
      { status: 500 }
    )
  }
}