import { randomInt } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { openDayParticipantStations, openDayParticipants, openDayStations, openDayTutorAccounts } from '@/lib/db/schema'
import type { ExperimentAccent } from '@/lib/experiments'
import type { StaffOverview, StationAvailability } from '@/lib/open-day-types'
import { SCAN_ALPHABET, SCAN_CODE_LENGTH } from '@/lib/scan-codes'
import { pickTutor } from '@/lib/tutor-matching'
import type { TutorLoad } from '@/lib/tutor-matching'
import { getStationOccupancy } from '@/lib/get-station-occupancy'

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

function buildOverview(stationRows: StationRow[], stationOccupancy: Record<string, number>): StationAvailability[] {
  const stations: StationAvailability[] = stationRows.map((station) => {
    const occupancy = stationOccupancy[station.slug] ?? 0
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
      total: station.capacity,
      arrived: 0,
      remaining: Math.max(0, station.capacity - occupancy),
    }
  })

  return stations
}

export async function getStaffOverview(): Promise<StaffOverview> {
  const stationRows = await db
    .select().from(openDayStations).where(eq(openDayStations.active, true)).orderBy(asc(openDayStations.sortOrder))

  const stationOccupancy = await getStationOccupancy(stationRows.map((s) => s.slug))

  const stations = buildOverview(stationRows, stationOccupancy)

  const total = stations.reduce((sum, station) => sum + station.total, 0)
  const activeStations = stations.length

  return {
    stations,
    total,
    arrived: 0,
    activeStations,
  }
}
type Queryable = Pick<typeof db, 'select'>

/** Numero di gruppi in coda (status = 'queued') che sono posizionati prima di questo,
 *  oppure 0 se il partecipante non è in coda. Usato solo per mostrare la posizione
 *  al partecipante: non è una colonna, perché la posizione reale cambia non appena un
 *  gruppo anteriore viene promosso, e una query di sola lettura restituisce sempre il
 *  valore aggiornato senza blocco.
 */
export async function queuePositionOf(id: string): Promise<number | null> {
  if (!UUID_PATTERN.test(id)) return null

  const my = await db
    .select({ createdAt: openDayParticipants.createdAt, id: openDayParticipants.id })
    .from(openDayParticipants)
    .where(eq(openDayParticipants.id, id))
    .limit(1)

  const row = my[0]
  if (!row) return null

  const [count] = await db
    .select({ position: sql<number>`count(*)::integer` })
    .from(openDayParticipants)
    .where(
      and(
        eq(openDayParticipants.status, 'queued'),
        sql`(${openDayParticipants.createdAt}, ${openDayParticipants.id}) <= (${row.createdAt}::timestamptz, ${row.id}::uuid)`,
      ),
    )

  return count?.position ?? null
}

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
      .where(and(
        eq(openDayParticipants.deviceId, deviceId),
        isNull(openDayParticipants.completedAt),
      ))

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

    // Usa la funzione unificata per l'occupanza
    const stationOccupancy = await getStationOccupancy(
      requestedStationSlugs ?? undefined,
    )

    // Carico attuale dei tutor
    const loads = await getTutorLoads(tx)

    // Persone già attese in ogni laboratorio (senza turni, il conteggio è unico).
    const routeOptions: string[][] = requestedStationSlugs
      ? [requestedStationSlugs]
      : stationRows
          .map((station) => [station.slug])
          .sort(() => Math.random() - 0.5)

    let candidate: { slugs: string[]; tutorName: string } | undefined
    let fittingSlugs: string[] | undefined
    let anyRouteAvailable = false

    for (const slugs of routeOptions) {
      const fits = slugs.every((slug) => {
        const station = stationRows.find((row) => row.slug === slug)
        // Se non c'è occupazione registrata per questo station, assumiamo 0
        // (getStationOccupancy restituisce solo gli station con almeno un partecipante)
        const occupancy = stationOccupancy[slug] ?? 0
        return station ? occupancy + groupSize <= station.capacity : false
      })
      if (!fits) continue

      anyRouteAvailable = true
      if (!fittingSlugs) fittingSlugs = slugs

      const tutorName = pickTutor(loads, slugs, groupSize)
      if (tutorName) {
        candidate = { slugs, tutorName }
        break
      }
    }

    if (candidate) {
      const inserted = await tx
        .insert(openDayParticipants)
        .values({
          displayName,
          scanCode: createScanCode(),
          requestedStationSlug: requestedStationSlugs?.[0] ?? null,
          assignedStationSlug: candidate.slugs[0],
          assignedTutorName: candidate.tutorName,
          groupSize,
          deviceId,
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
    }

    // La scelta dei laboratori entra in capienza, ma non c'è un tutor libero:
    // si mette in coda invece di rifiutare l'iscrizione.
    if (fittingSlugs) {
      const inserted = await tx
        .insert(openDayParticipants)
        .values({
          displayName,
          scanCode: createScanCode(),
          requestedStationSlug: requestedStationSlugs?.[0] ?? null,
          assignedStationSlug: fittingSlugs[0],
          assignedTutorName: null,
          groupSize,
          status: 'queued',
          deviceId,
        })
        .returning({ id: openDayParticipants.id, createdAt: openDayParticipants.createdAt })

      const participantId = inserted[0].id
      await tx.insert(openDayParticipantStations).values(
        fittingSlugs.map((slug, sortOrder) => ({
          participantId,
          stationSlug: slug,
          sortOrder,
        })),
      )

      return { id: participantId, existing: false, queued: true }
    }

    if (requestedStationSlugs) {
      throw new AssignmentError(
        'FULL',
        'Questo giro è al completo. Scegli meno tappe oppure fatti sorprendere.',
      )
    }
    throw new AssignmentError(
      'ALL_FULL',
      'Tutti i laboratori sono al completo. Rivolgiti all’accoglienza.',
    )
  })
}

/** Quando un tutor diventa libero (turno terminato o account riattivato), sposta in
 * assegnazione il primo gruppo in coda che può essere servito.
 * La coda è ordinata per data di accodamento (crea + id). Il primo gruppo viene
 * promosso solo se esiste un tutor che può prendere il suo giro: in tal caso il gruppo
 * esce dalla coda con status = 'assigned' e il nome del tutor. Se nessun tutor può
 * prendere il primo gruppo in coda, non si tocca nessuno: la coda resta fedele alla
 * posizione e il partecipante viene servito non appena un tutor con capacity sufficente
 * termina il turno. I gruppi in coda occupano già i posti (sono stati contati al
 * momento dell'accodamento), quindi la capacità non va ricalcolata.
 */
export async function promoteNextFromQueue(): Promise<boolean> {
  return db.transaction(async (tx) => {
    const first = await tx
      .select({
        id: openDayParticipants.id,
        groupSize: openDayParticipants.groupSize,
      })
      .from(openDayParticipants)
      .where(eq(openDayParticipants.status, 'queued'))
      .orderBy(asc(openDayParticipants.createdAt), asc(openDayParticipants.id))
      .limit(1)

    const queued = first[0]
    if (!queued) return false

    const stationRows = await tx
      .select()
      .from(openDayStations)
      .where(eq(openDayStations.active, true))

    const routeRows = await tx
      .select({ stationSlug: openDayParticipantStations.stationSlug })
      .from(openDayParticipantStations)
      .where(eq(openDayParticipantStations.participantId, queued.id))
      .orderBy(asc(openDayParticipantStations.sortOrder))

    const slugs = routeRows.map((row) => row.stationSlug)
    if (slugs.length === 0) return false

    // Non dovrebbe mai accadere (la capienza è stata riservata all'accodamento),
    // ma se per un errore di dati il primo gruppo in coda occuperebbe posti che non
    // ha più, lo saltiamo: non si promuove nulla, la coda resta coerente.
    const occupancyRows = await tx
      .select({
        slug: openDayParticipantStations.stationSlug,
        occupancy: sql<number>`sum(${openDayParticipants.groupSize})::integer`,
      })
      .from(openDayParticipantStations)
      .innerJoin(openDayParticipants, eq(openDayParticipants.id, openDayParticipantStations.participantId))
      .where(isNull(openDayParticipants.completedAt))
      .groupBy(openDayParticipantStations.stationSlug)

    const occupancyOf = (slug: string) => occupancyRows.find((row) => row.slug === slug)?.occupancy ?? 0
    for (const slug of slugs) {
      const station = stationRows.find((row) => row.slug === slug)
      if (!station || occupancyOf(slug) > station.capacity) return false
    }

    const loads = await getTutorLoads(tx)
    const tutorName = pickTutor(loads, slugs, queued.groupSize)
    if (!tutorName) return false

    const updated = await tx
      .update(openDayParticipants)
      .set({ status: 'assigned', assignedTutorName: tutorName })
      .where(and(eq(openDayParticipants.id, queued.id), eq(openDayParticipants.status, 'queued')))
      .returning({ id: openDayParticipants.id })

    return updated.length > 0
  })
}

/** Stato completato per il partecipante. Dipende solo da completedAt. */
export function isCompleted(row: { completedAt: Date | null }): boolean {
  return row.completedAt !== null
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

export async function getActiveDeviceTicket(deviceId: string) {
  if (!UUID_PATTERN.test(deviceId)) return null

  const rows = await db
    .select({
      id: openDayParticipants.id,
      displayName: openDayParticipants.displayName,
    })
    .from(openDayParticipants)
    .where(and(
      eq(openDayParticipants.deviceId, deviceId),
      isNull(openDayParticipants.completedAt),
    ))
    .orderBy(desc(openDayParticipants.createdAt))
    .limit(1)

  return rows[0] ?? null
}

export async function getParticipantStatus(id: string) {
  if (!UUID_PATTERN.test(id)) return null

  const rows = await db
    .select({
      status: openDayParticipants.status,
      completedAt: openDayParticipants.completedAt,
    })
    .from(openDayParticipants)
    .where(eq(openDayParticipants.id, id))
    .limit(1)

  const row = rows[0]
  return row ? { status: row.status, completed: row.completedAt !== null } : null
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

/** Stato completo di un biglietto, incluso se è in coda e la posizione.
 * È la funzione usata dall'endpoint `/api/assignments/[id]/status` che il biglietto
 * pollinga per capire se il tutor è stato assegnato (o se il turno è finito).
 */
export interface QueueStatus {
  queued: boolean
  position: number
  tutorName: string | null
  arrived: boolean
  completed: boolean
}

export async function getQueueStatus(id: string): Promise<QueueStatus | null> {
  if (!UUID_PATTERN.test(id)) return null

  const rows = await db
    .select({
      status: openDayParticipants.status,
      completedAt: openDayParticipants.completedAt,
      assignedTutorName: openDayParticipants.assignedTutorName,
    })
    .from(openDayParticipants)
    .where(eq(openDayParticipants.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const completed = row.completedAt !== null
  const arrived = row.status === 'arrived'

  if (row.status === 'queued') {
    const position = await queuePositionOf(id)
    return {
      queued: true,
      position: Math.max(1, position ?? 0),
      tutorName: null,
      arrived,
      completed,
    }
  }

  return {
    queued: false,
    position: 0,
    tutorName: row.assignedTutorName ?? null,
    arrived,
    completed,
  }
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
    // I turni chiusi finiscono nell'archivio della regia: il tutor non li vede più.
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