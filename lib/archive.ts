import { and, asc, desc, eq, inArray, isNotNull, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { openDayParticipantStations, openDayParticipants, openDayStations } from '@/lib/db/schema'
import type { ExperimentAccent } from '@/lib/experiments'

/** Giorni in cui un turno terminato resta nell'archivio prima di sparire. */
export const ARCHIVE_RETENTION_DAYS = 30

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ArchivedGroup = {
  id: string
  name: string
  code: string
  groupSize: number
  status: string
  tutorName: string | null
  completedAt: string
  stations: Array<{
    slug: string
    code: string
    title: string
    room: string
    accent: ExperimentAccent
  }>
}

function retentionCutoff() {
  return new Date(Date.now() - ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000)
}

/**
 * Cancella i turni archiviati da più di ARCHIVE_RETENTION_DAYS giorni.
 * Con `force` svuota tutto l'archivio. Le tappe spariscono per cascata.
 */
export async function purgeArchive(force = false) {
  const where = force
    ? isNotNull(openDayParticipants.completedAt)
    : and(isNotNull(openDayParticipants.completedAt), lt(openDayParticipants.completedAt, retentionCutoff()))

  const removed = await db
    .delete(openDayParticipants)
    .where(where)
    .returning({ id: openDayParticipants.id })

  return removed.length
}

/** Gruppi con il turno concluso: li vede solo la regia. */
export async function listArchive(): Promise<{ groups: ArchivedGroup[]; purgeDays: number }> {
  await purgeArchive()

  const rows = await db
    .select({
      id: openDayParticipants.id,
      name: openDayParticipants.displayName,
      code: openDayParticipants.scanCode,
      groupSize: openDayParticipants.groupSize,
      status: openDayParticipants.status,
      tutorName: openDayParticipants.assignedTutorName,
      completedAt: openDayParticipants.completedAt,
    })
    .from(openDayParticipants)
    .where(isNotNull(openDayParticipants.completedAt))
    .orderBy(desc(openDayParticipants.completedAt))

  const ids = rows.map((row) => row.id)
  const routeRows = ids.length > 0
    ? await db
        .select({
          participantId: openDayParticipantStations.participantId,
          slug: openDayStations.slug,
          code: openDayStations.stationCode,
          title: openDayStations.title,
          room: openDayStations.room,
          accent: openDayStations.accent,
        })
        .from(openDayParticipantStations)
        .innerJoin(openDayStations, eq(openDayParticipantStations.stationSlug, openDayStations.slug))
        .where(inArray(openDayParticipantStations.participantId, ids))
        .orderBy(asc(openDayParticipantStations.sortOrder))
    : []

  return {
    purgeDays: ARCHIVE_RETENTION_DAYS,
    groups: rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      groupSize: row.groupSize,
      status: row.status,
      tutorName: row.tutorName,
      completedAt: (row.completedAt as Date).toISOString(),
      stations: routeRows
        .filter((route) => route.participantId === row.id)
        .map(({ slug, code, title, room, accent }) => ({
          slug,
          code,
          title,
          room,
          accent: accent as ExperimentAccent,
        })),
    })),
  }
}

/** Elimina un solo gruppo archiviato. */
export async function deleteArchivedGroup(id: string) {
  if (!UUID_PATTERN.test(id)) return false

  const removed = await db
    .delete(openDayParticipants)
    .where(and(eq(openDayParticipants.id, id), isNotNull(openDayParticipants.completedAt)))
    .returning({ id: openDayParticipants.id })

  return removed.length > 0
}
