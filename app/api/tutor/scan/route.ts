import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAssignment, getAssignmentByScanCode } from '@/lib/assignments'
import { parseScanInput } from '@/lib/scan-codes'
import { getTutorAccount } from '@/lib/tutor-accounts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 })

  let body: { input?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  if (typeof body.input !== 'string' || body.input.length > 200) {
    return NextResponse.json({ error: 'Codice non valido.' }, { status: 400 })
  }

  const target = parseScanInput(body.input)
  if (!target) {
    return NextResponse.json({ error: 'Non sembra il codice di un biglietto OpenVolta.' }, { status: 400 })
  }

  const assignment = 'code' in target
    ? await getAssignmentByScanCode(target.code)
    : await getAssignment(target.participantId)

  if (!assignment) {
    return NextResponse.json({ error: 'Codice non riconosciuto. Chiedi al ragazzo di riaprire il biglietto.' }, { status: 404 })
  }

  if (session.role === 'tutor') {
    const account = session.tutorId ? await getTutorAccount(session.tutorId) : null
    if (!account || !account.active) {
      return NextResponse.json({ error: 'Account disattivato. Chiedi alla regia.' }, { status: 401 })
    }
    if (assignment.participant.assignedTutorName !== account.displayName) {
      return NextResponse.json({ error: 'Questo gruppo è di un altro tutor.' }, { status: 403 })
    }
  }

  // I biglietti dei turni terminati non si scansionano più: sono in archivio.
  if (assignment.participant.completedAt) {
    return NextResponse.json(
      { error: 'Questo turno è già terminato: il gruppo è nell’archivio della regia.', code: 'ARCHIVED' },
      { status: 409 },
    )
  }

  return NextResponse.json(
    {
      id: assignment.participant.id,
      code: assignment.participant.scanCode,
      name: assignment.participant.displayName,
      groupSize: assignment.participant.groupSize,
      status: assignment.participant.status,
      // A questo punto il turno è per forza aperto (i terminati sono in archivio).
      completedAt: null,
      tutorName: assignment.participant.assignedTutorName,
      stations: assignment.stops.map((stop) => ({
        slug: stop.slug,
        code: stop.stationCode,
        title: stop.title,
        room: stop.room,
        accent: stop.accent,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
