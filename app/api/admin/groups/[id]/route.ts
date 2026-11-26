import { NextResponse } from 'next/server'
import { asc, eq, inArray } from 'drizzle-orm'
import { promoteQueuedGroups } from '@/lib/assignments'
import { guardApi } from '@/lib/auth'
import { db } from '@/lib/db'
import { openDayParticipantStations, openDayParticipants, openDayStations } from '@/lib/db/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await guardApi('staff')
  if (denied) return denied

  const { id } = await params
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'ID gruppo non valido.' }, { status: 400 })
  }

  let body: {
    name?: unknown
    groupSize?: unknown
    tutorName?: unknown
    status?: unknown
    arrived?: unknown
    completed?: unknown
    stationSlugs?: unknown
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  try {
    const existing = await db
      .select()
      .from(openDayParticipants)
      .where(eq(openDayParticipants.id, id))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Gruppo non trovato.' }, { status: 404 })
    }

    const current = existing[0]
    const updates: Partial<typeof openDayParticipants.$inferInsert> = {}

    if (typeof body.name === 'string') {
      const trimmed = body.name.trim()
      if (!trimmed) {
        return NextResponse.json({ error: 'Il nome del gruppo non può essere vuoto.' }, { status: 400 })
      }
      updates.displayName = trimmed
    }

    if (body.groupSize !== undefined) {
      const rawSize = Number(body.groupSize)
      if (!Number.isInteger(rawSize) || rawSize < 1 || rawSize > 6) {
        return NextResponse.json({ error: 'Il numero di partecipanti deve essere compreso tra 1 e 6.' }, { status: 400 })
      }
      updates.groupSize = rawSize
    }

    if (body.tutorName !== undefined) {
      if (body.tutorName === null || body.tutorName === '') {
        updates.assignedTutorName = null
      } else if (typeof body.tutorName === 'string') {
        updates.assignedTutorName = body.tutorName.trim()
      }
    }

    if (typeof body.status === 'string') {
      const validStatuses = ['assigned', 'queued', 'arrived']
      if (validStatuses.includes(body.status)) {
        updates.status = body.status
        if (body.status === 'arrived' && !current.arrivedAt) {
          updates.arrivedAt = new Date()
        } else if (body.status !== 'arrived' && current.status === 'arrived') {
          updates.arrivedAt = null
        }
      }
    }

    if (typeof body.arrived === 'boolean') {
      if (body.arrived) {
        updates.arrivedAt = new Date()
        updates.status = 'arrived'
      } else {
        updates.arrivedAt = null
        if (current.status === 'arrived') {
          updates.status = 'assigned'
        }
      }
    }

    if (typeof body.completed === 'boolean') {
      updates.completedAt = body.completed ? new Date() : null
    }

    let stationSlugsToUpdate: string[] | null = null
    if (Array.isArray(body.stationSlugs)) {
      const slugs = body.stationSlugs.filter((s): s is string => typeof s === 'string' && s.length > 0)
      if (slugs.length === 0) {
        return NextResponse.json({ error: 'Il percorso deve comprendere almeno una tappa.' }, { status: 400 })
      }

      const verified = await db
        .select({ slug: openDayStations.slug })
        .from(openDayStations)
        .where(inArray(openDayStations.slug, slugs))

      if (verified.length === 0) {
        return NextResponse.json({ error: 'Nessuna tappa valida specificata.' }, { status: 400 })
      }

      stationSlugsToUpdate = slugs.filter((slug) => verified.some((v) => v.slug === slug))
      updates.assignedStationSlug = stationSlugsToUpdate[0]
    }

    const updated = await db.transaction(async (tx) => {
      let participant = current
      if (Object.keys(updates).length > 0) {
        const [res] = await tx
          .update(openDayParticipants)
          .set(updates)
          .where(eq(openDayParticipants.id, id))
          .returning()
        participant = res
      }

      if (stationSlugsToUpdate && stationSlugsToUpdate.length > 0) {
        await tx.delete(openDayParticipantStations).where(eq(openDayParticipantStations.participantId, id))
        await tx.insert(openDayParticipantStations).values(
          stationSlugsToUpdate.map((slug, index) => ({
            participantId: id,
            stationSlug: slug,
            sortOrder: index,
          })),
        )
      }

      // Raccogli tappe aggiornate
      const routeRows = await tx
        .select({
          slug: openDayStations.slug,
          code: openDayStations.stationCode,
          title: openDayStations.title,
        })
        .from(openDayParticipantStations)
        .innerJoin(openDayStations, eq(openDayParticipantStations.stationSlug, openDayStations.slug))
        .where(eq(openDayParticipantStations.participantId, id))
        .orderBy(asc(openDayParticipantStations.sortOrder))

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
        stations: routeRows,
      }
    })

    // Una modifica può liberare capacità (turno chiuso, tutor tolto, gruppo più piccolo):
    // la coda deve avanzare subito, senza aspettare il polling del biglietto.
    await promoteQueuedGroups().catch((error) => {
      console.error('Avanzamento della coda dopo la modifica del gruppo non riuscito', error)
    })

    return NextResponse.json({ group: updated })
  } catch (error) {
    console.error('Errore nell’aggiornamento del gruppo:', error)
    return NextResponse.json({ error: 'Impossibile aggiornare il gruppo. Riprova.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await guardApi('staff')
  if (denied) return denied

  const { id } = await params
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'ID gruppo non valido.' }, { status: 400 })
  }

  try {
    const deleted = await db.transaction(async (tx) => {
      await tx.delete(openDayParticipantStations).where(eq(openDayParticipantStations.participantId, id))
      const res = await tx
        .delete(openDayParticipants)
        .where(eq(openDayParticipants.id, id))
        .returning({ id: openDayParticipants.id })
      return res
    })

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Gruppo non trovato.' }, { status: 404 })
    }

    // Eliminare un gruppo libera il tutor che lo seguiva: servi subito chi è in coda.
    await promoteQueuedGroups().catch((error) => {
      console.error('Avanzamento della coda dopo l’eliminazione del gruppo non riuscito', error)
    })

    return NextResponse.json({ ok: true, deleted: id })
  } catch (error) {
    console.error('Errore durante l’eliminazione del gruppo:', error)
    return NextResponse.json({ error: 'Impossibile eliminare il gruppo. Riprova.' }, { status: 500 })
  }
}
