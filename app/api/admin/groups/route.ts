import { NextResponse } from 'next/server'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { guardApi } from '@/lib/auth'
import { db } from '@/lib/db'
import { openDayParticipantStations, openDayParticipants, openDayStations } from '@/lib/db/schema'
import { generateScanCode } from '@/lib/scan-codes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await guardApi('staff')
  if (denied) return denied

  try {
    const participants = await db
      .select({
        id: openDayParticipants.id,
        name: openDayParticipants.displayName,
        code: openDayParticipants.scanCode,
        groupSize: openDayParticipants.groupSize,
        status: openDayParticipants.status,
        tutorName: openDayParticipants.assignedTutorName,
        createdAt: openDayParticipants.createdAt,
        arrivedAt: openDayParticipants.arrivedAt,
        completedAt: openDayParticipants.completedAt,
      })
      .from(openDayParticipants)
      .orderBy(desc(openDayParticipants.createdAt))

    const participantIds = participants.map((p) => p.id)
    const routeRows = participantIds.length > 0
      ? await db
          .select({
            participantId: openDayParticipantStations.participantId,
            slug: openDayStations.slug,
            code: openDayStations.stationCode,
            title: openDayStations.title,
          })
          .from(openDayParticipantStations)
          .innerJoin(openDayStations, eq(openDayParticipantStations.stationSlug, openDayStations.slug))
          .where(inArray(openDayParticipantStations.participantId, participantIds))
          .orderBy(asc(openDayParticipantStations.sortOrder))
      : []

    const stationsByParticipant = new Map<string, Array<{ slug: string; code: string; title: string }>>()
    for (const route of routeRows) {
      const stations = stationsByParticipant.get(route.participantId) ?? []
      stations.push({ slug: route.slug, code: route.code, title: route.title })
      stationsByParticipant.set(route.participantId, stations)
    }

    const groups = participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      code: participant.code,
      groupSize: participant.groupSize,
      status: participant.status,
      tutorName: participant.tutorName,
      createdAt: participant.createdAt.toISOString(),
      arrivedAt: participant.arrivedAt?.toISOString() ?? null,
      completedAt: participant.completedAt?.toISOString() ?? null,
      stations: stationsByParticipant.get(participant.id) ?? [],
    }))

    return NextResponse.json({ groups }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Errore nel recupero dei gruppi:', error)
    return NextResponse.json({ error: 'Impossibile recuperare i gruppi.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await guardApi('staff')
  if (denied) return denied

  let body: {
    name?: unknown
    groupSize?: unknown
    stationSlugs?: unknown
    tutorName?: unknown
    status?: unknown
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'Il nome del gruppo è obbligatorio.' }, { status: 400 })
  }

  const rawSize = Number(body.groupSize)
  const groupSize = Number.isInteger(rawSize) && rawSize >= 1 && rawSize <= 6 ? rawSize : 1

  const stationSlugs = Array.isArray(body.stationSlugs)
    ? body.stationSlugs.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : []

  if (stationSlugs.length === 0) {
    return NextResponse.json({ error: 'Seleziona almeno un laboratorio o tappa per il gruppo.' }, { status: 400 })
  }

  // Verifica che le stazioni esistano
  const existingStations = await db
    .select({ slug: openDayStations.slug, code: openDayStations.stationCode, title: openDayStations.title })
    .from(openDayStations)
    .where(inArray(openDayStations.slug, stationSlugs))

  if (existingStations.length === 0) {
    return NextResponse.json({ error: 'Nessuna delle tappe indicate è valida.' }, { status: 400 })
  }

  const validStationSlugs = stationSlugs.filter((slug) => existingStations.some((s) => s.slug === slug))
  const primaryStationSlug = validStationSlugs[0]

  const rawStatus = typeof body.status === 'string' ? body.status.trim() : 'assigned'
  const status = ['assigned', 'queued', 'arrived'].includes(rawStatus) ? rawStatus : 'assigned'
  const tutorName = typeof body.tutorName === 'string' && body.tutorName.trim() ? body.tutorName.trim() : null
  const arrivedAt = status === 'arrived' ? new Date() : null

  try {
    let scanCode = generateScanCode()
    // Verifica eventuale collisione codice
    for (let attempts = 0; attempts < 3; attempts++) {
      const existing = await db
        .select({ id: openDayParticipants.id })
        .from(openDayParticipants)
        .where(eq(openDayParticipants.scanCode, scanCode))
        .limit(1)
      if (existing.length === 0) break
      scanCode = generateScanCode()
    }

    const createdGroup = await db.transaction(async (tx) => {
      const [participant] = await tx
        .insert(openDayParticipants)
        .values({
          displayName: name,
          scanCode,
          requestedStationSlug: primaryStationSlug,
          assignedStationSlug: primaryStationSlug,
          assignedTutorName: tutorName,
          groupSize,
          status,
          arrivedAt,
        })
        .returning()

      if (validStationSlugs.length > 0) {
        await tx.insert(openDayParticipantStations).values(
          validStationSlugs.map((slug, index) => ({
            participantId: participant.id,
            stationSlug: slug,
            sortOrder: index,
          })),
        )
      }

      return {
        id: participant.id,
        name: participant.displayName,
        code: participant.scanCode,
        groupSize: participant.groupSize,
        status: participant.status,
        tutorName: participant.assignedTutorName,
        createdAt: participant.createdAt.toISOString(),
        arrivedAt: participant.arrivedAt?.toISOString() ?? null,
        completedAt: participant.completedAt?.toISOString() ?? null,
        stations: validStationSlugs.map((slug) => {
          const match = existingStations.find((s) => s.slug === slug)
          return {
            slug,
            code: match?.code ?? slug,
            title: match?.title ?? slug,
          }
        }),
      }
    })

    return NextResponse.json({ group: createdGroup }, { status: 201 })
  } catch (error) {
    console.error('Errore nella creazione del gruppo:', error)
    return NextResponse.json({ error: 'Impossibile creare il gruppo. Riprova.' }, { status: 500 })
  }
}
