import { randomInt } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { openDayParticipantStations, openDayParticipants, openDayStations, openDayTutorAccounts } from '@/lib/db/schema'
import type { ExperimentAccent } from '@/lib/experiments'
import type { StaffOverview, StationAvailability } from '@/lib/open-day-types'
import { SCAN_ALPHABET, SCAN_CODE_LENGTH } from '@/lib/scan-codes'
import { pickTutor } from '@/lib/tutor-matching'
import type { TutorLoad } from '@/lib/tutor-matching'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type StationRow = typeof openDayStations.$inferSelect
export const MAX_ASSIGNMENTS_PER_DEVICE = 4

/** Codice breve stampato sotto il QR del biglietto. */
function createScanCode() {
  let code = ''
  for (let index = 0; index < SCAN_CODE_LENGTH; index += 1) {
    code += SCAN_ALPHABET[randomInt(SCAN_ALPHABET.length)]
  }
  return code
}

type CountRow = {
  slug: string
  status: string
  value: number
}

export class AssignmentError extends Error {
  constructor(
    public code: 'FULL' | 'ALL_FULL' | 'NOT_FOUND' | 'DEVICE_LIMIT',
    message: string,
  ) {
    super(message)
    this.name = 'AssignmentError'
  }
}

function buildOverview(stationRows: StationRow[], countRows: CountRow[]): StaffOverview {
  const stations: StationAvailability[] = stationRows.map((station) => {
    const stationCounts = countRows.filter((row) => row.slug === station.slug)
    const total = stationCounts.reduce((sum, row) => sum + row.value, 0)
    const arrived = stationCounts
      .filter((row) => row.status === 'arrived')
      .reduce((sum, row) => sum + row.value, 0)

    return {
      slug: station.slug,
      code: station.stationCode,
      title: station.title,
      guideName: station.guideName,
      guideRole: station.guideRole,
      room: station.room,
      meetingPoint: station.meetingPoint,
      directions: station.directions,
      accent: station.accent as ExperimentAccent,
      capacity: station.capacity,
      total,
      arrived,
      remaining: Math.max(0, station.capacity - total),
    }
  })

  return {
    stations,
    total: stations.reduce((sum, station) => sum + station.total, 0),
    arrived: stations.reduce((sum, station) => sum + station.arrived, 0),
    activeStations: stations.length,
  }
}

async function getCountRows(stationSlugs: string[]) {
  if (stationSlugs.length === 0) return []

  return db
    .select({
      slug: openDayParticipantStations.stationSlug,
      status: openDayParticipants.status,
      value: sql<number>`sum(${openDayParticipants.groupSize})::integer`,
    })
    .from(openDayParticipantStations)
    .innerJoin(openDayParticipants, eq(openDayParticipantStations.participantId, openDayParticipants.id))
    .where(and(
      inArray(openDayParticipantStations.stationSlug, stationSlugs),
      // I gruppi con il turno terminato non occupano più posti.
      isNull(openDayParticipants.completedAt),
    ))
    .groupBy(openDayParticipantStations.stationSlug, openDayParticipants.status)
}

export async function getStaffOverview(): Promise<StaffOverview> {
  const [stationRows, participants] = await Promise.all([
    db.select().from(openDayStations).where(eq(openDayStations.active, true)).orderBy(asc(openDayStations.sortOrder)),
    db
      .select({
        status: openDayParticipants.status,
        value: sql<number>`sum(${openDayParticipants.groupSize})::integer`,
      })
      .from(openDayParticipants)
      .where(isNull(openDayParticipants.completedAt))
      .groupBy(openDayParticipants.status),
  ])
  const countRows = await getCountRows(stationRows.map((station) => station.slug))
  const total = participants.reduce((sum, participant) => sum + participant.value, 0)
  const arrived = participants.find((participant) => participant.status === 'arrived')?.value ?? 0
  const overview = buildOverview(stationRows, countRows)

  return { ...overview, total, arrived }
}

type Queryable = Pick<typeof db, 'select'>

/** Carico attuale dei tutor: gruppi già assegnati e tappe di ciascun gruppo. */
async function getTutorLoads(database: Queryable) {
  const tutors = await database
    .select({ name: openDayTutorAccounts.displayName })
    .from(openDayTutorAccounts)
    .where(eq(openDayTutorAccounts.active, true))
    .orderBy(asc(openDayTutorAccounts.displayName))

  if (tutors.length === 0) return [] as TutorLoad[]

  const groups = await database
    .select({
      id: openDayParticipants.id,
      tutorName: openDayParticipants.assignedTutorName,
      groupSize: openDayParticipants.groupSize,
    })
    .from(openDayParticipants)
    .where(and(
      inArray(openDayParticipants.assignedTutorName, tutors.map((tutor) => tutor.name)),
      // Un turno chiuso libera il tutor per un altro gruppo.
      isNull(openDayParticipants.completedAt),
    ))

  const routeRows = groups.length > 0
    ? await database
        .select({
          participantId: openDayParticipantStations.participantId,
          stationSlug: openDayParticipantStations.stationSlug,
        })
        .from(openDayParticipantStations)
        .where(inArray(openDayParticipantStations.participantId, groups.map((group) => group.id)))
        .orderBy(asc(openDayParticipantStations.sortOrder))
    : []

  return tutors.map<TutorLoad>((tutor) => ({
    name: tutor.name,
    groups: groups
      .filter((group) => group.tutorName === tutor.name)
      .map((group) => ({
        size: group.groupSize,
        slugs: routeRows
          .filter((route) => route.participantId === group.id)
          .map((route) => route.stationSlug),
      })),
  }))
}

export async function createAssignment(
  displayName: string,
  requestedStationSlugs: string[] | null,
  groupSize: number,
  deviceId: string,
) {
  return db.transaction(async (tx) => {
    // Serializza le richieste dello stesso dispositivo: un doppio tap non crea due iscrizioni.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${deviceId}))`)

    const sameDevice = await tx
      .select({
        id: openDayParticipants.id,
        displayName: openDayParticipants.displayName,
      })
      .from(openDayParticipants)
      .where(eq(openDayParticipants.deviceId, deviceId))

    const duplicate = sameDevice.find(
      (row) => row.displayName.toLocaleLowerCase('it') === displayName.toLocaleLowerCase('it'),
    )
    if (duplicate) return { id: duplicate.id, existing: true }

    if (sameDevice.length >= MAX_ASSIGNMENTS_PER_DEVICE) {
      throw new AssignmentError(
        'DEVICE_LIMIT',
        'Da questo telefono sono già state fatte molte iscrizioni. Rivolgiti all’accoglienza.',
      )
    }

    const stationRows = await tx
      .select()
      .from(openDayStations)
      .where(eq(openDayStations.active, true))
      .orderBy(asc(openDayStations.sortOrder))
      .for('update')

    if (requestedStationSlugs && requestedStationSlugs.some(
      (slug) => !stationRows.some((station) => station.slug === slug),
    )) {
      throw new AssignmentError('NOT_FOUND', 'La postazione scelta non è disponibile.')
    }

    // Persone già attese in ogni laboratorio (senza turni, il conteggio è unico).
    const stationAssignments = await tx
      .select({
        slug: openDayParticipantStations.stationSlug,
        occupancy: sql<number>`sum(${openDayParticipants.groupSize})::integer`,
      })
      .from(openDayParticipantStations)
      .innerJoin(openDayParticipants, eq(openDayParticipantStations.participantId, openDayParticipants.id))
      .where(isNull(openDayParticipants.completedAt))
      .groupBy(openDayParticipantStations.stationSlug)

    const occupancyOf = (slug: string) =>
      stationAssignments.find((assignment) => assignment.slug === slug)?.occupancy ?? 0

    // I tutor sono le persone con un account attivo, non i nomi delle postazioni.
    const loads = await getTutorLoads(tx)

    const routeOptions: string[][] = requestedStationSlugs
      ? [requestedStationSlugs]
      : stationRows
          .map((station) => [station.slug])
          .sort(() => Math.random() - 0.5)

    let candidate: { slugs: string[]; tutorName: string } | undefined
    let anyRouteAvailable = false

    for (const slugs of routeOptions) {
      const fits = slugs.every((slug) => {
        const station = stationRows.find((row) => row.slug === slug)
        return station ? occupancyOf(slug) + groupSize <= station.capacity : false
      })
      if (!fits) continue

      anyRouteAvailable = true
      const tutorName = pickTutor(loads, slugs, groupSize)
      if (tutorName) {
        candidate = { slugs, tutorName }
        break
      }
    }

    if (!candidate) {
      if (requestedStationSlugs && anyRouteAvailable) {
        throw new AssignmentError(
          'ALL_FULL',
          'Ogni tutor ha già due gruppi. Chiedi all’accoglienza di aggiungerne uno.',
        )
      }
      if (requestedStationSlugs) {
        throw new AssignmentError(
          'FULL',
          'Questo giro è al completo. Scegli meno tappe oppure fatti sorprendere.',
        )
      }
      throw new AssignmentError('ALL_FULL', 'Tutti i laboratori sono al completo. Rivolgiti all’accoglienza.')
    }

    const inserted = await tx
      .insert(openDayParticipants)
      .values({
        displayName,
        scanCode: createScanCode(),
        requestedStationSlug: requestedStationSlugs?.[0] ?? null,
        assignedStationSlug: candidate.slugs[0],
        assignedTutorName: candidate.tutorName,
        groupSize,
      })
      .returning({ id: openDayParticipants.id })
    await tx.insert(openDayParticipantStations).values(
      candidate.slugs.map((slug, sortOrder) => ({
        participantId: inserted[0].id,
        stationSlug: slug,
        sortOrder,
      })),
    )

    return { id: inserted[0].id, existing: false }
  })
}

export async function getAssignment(id: string) {
  if (!UUID_PATTERN.test(id)) return null

  const rows = await db
    .select({
      participant: openDayParticipants,
      station: openDayStations,
    })
    .from(openDayParticipants)
    .innerJoin(openDayStations, eq(openDayParticipants.assignedStationSlug, openDayStations.slug))
    .where(eq(openDayParticipants.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const stops = await db
    .select({ station: openDayStations })
    .from(openDayParticipantStations)
    .innerJoin(openDayStations, eq(openDayParticipantStations.stationSlug, openDayStations.slug))
    .where(eq(openDayParticipantStations.participantId, row.participant.id))
    .orderBy(asc(openDayParticipantStations.sortOrder))

  return { ...row, stops: stops.map(({ station: stop }) => stop) }
}

export async function getAssignmentByScanCode(code: string) {
  const rows = await db
    .select({ id: openDayParticipants.id })
    .from(openDayParticipants)
    .where(eq(openDayParticipants.scanCode, code))
    .limit(1)

  return rows[0] ? getAssignment(rows[0].id) : null
}

export async function getParticipantStatus(id: string) {
  if (!UUID_PATTERN.test(id)) return null

  const rows = await db
    .select({ status: openDayParticipants.status })
    .from(openDayParticipants)
    .where(eq(openDayParticipants.id, id))
    .limit(1)

  return rows[0]?.status ?? null
}

export async function getParticipantTutorName(id: string) {
  if (!UUID_PATTERN.test(id)) return null

  const rows = await db
    .select({ tutorName: openDayParticipants.assignedTutorName })
    .from(openDayParticipants)
    .where(eq(openDayParticipants.id, id))
    .limit(1)

  return rows[0]?.tutorName ?? null
}

export async function setCompleted(id: string, completed: boolean) {
  if (!UUID_PATTERN.test(id)) return false

  const updated = await db
    .update(openDayParticipants)
    .set({ completedAt: completed ? new Date() : null })
    .where(eq(openDayParticipants.id, id))
    .returning({ id: openDayParticipants.id })

  return updated.length > 0
}

export async function setArrived(id: string, arrived: boolean) {
  if (!UUID_PATTERN.test(id)) return false

  const updated = await db
    .update(openDayParticipants)
    .set(arrived ? { status: 'arrived', arrivedAt: new Date() } : { status: 'assigned', arrivedAt: null })
    .where(eq(openDayParticipants.id, id))
    .returning({ id: openDayParticipants.id })

  return updated.length > 0
}

export async function listDeviceAssignments(deviceId: string) {
  return db
    .select({
      id: openDayParticipants.id,
      displayName: openDayParticipants.displayName,
      status: openDayParticipants.status,
      stationSlug: openDayStations.slug,
      stationCode: openDayStations.stationCode,
      title: openDayStations.title,
    })
    .from(openDayParticipants)
    .innerJoin(openDayStations, eq(openDayParticipants.assignedStationSlug, openDayStations.slug))
    .where(eq(openDayParticipants.deviceId, deviceId))
    .orderBy(desc(openDayParticipants.createdAt))
}

export type RosterGroup = {
  id: string
  name: string
  status: string
  groupSize: number
  people: number
  completedAt: string | null
  stations: Array<{
    slug: string
    code: string
    title: string
    room: string
    accent: ExperimentAccent
  }>
}

export type Roster = {
  tutor: { name: string; role: string }
  people: number
  groups: RosterGroup[]
}

export async function getRoster(tutorName: string): Promise<Roster> {
  const rows = await db
    .select({
      id: openDayParticipants.id,
      name: openDayParticipants.displayName,
      status: openDayParticipants.status,
      groupSize: openDayParticipants.groupSize,
      completedAt: openDayParticipants.completedAt,
    })
    .from(openDayParticipants)
    // I turni chiusi finiscono nell’archivio della regia: il tutor non li vede più.
    .where(and(
      eq(openDayParticipants.assignedTutorName, tutorName),
      isNull(openDayParticipants.completedAt),
    ))
    .orderBy(asc(openDayParticipants.createdAt))

  const routeRows = rows.length > 0
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
        .where(inArray(openDayParticipantStations.participantId, rows.map((row) => row.id)))
        .orderBy(asc(openDayParticipantStations.sortOrder))
    : []

  return {
    tutor: { name: tutorName, role: 'Tutor' },
    people: rows.reduce((sum, row) => sum + row.groupSize, 0),
    groups: rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      groupSize: row.groupSize,
      people: row.groupSize,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
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
