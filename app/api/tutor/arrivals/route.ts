import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getParticipantTutorName, setArrived } from '@/lib/assignments'
import { getTutorAccount } from '@/lib/tutor-accounts'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 })

  let body: { id?: unknown; arrived?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  if (typeof body.id !== 'string' || typeof body.arrived !== 'boolean') {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  if (session.role === 'tutor') {
    const account = session.tutorId ? await getTutorAccount(session.tutorId) : null
    if (!account || !account.active) {
      return NextResponse.json({ error: 'Account disattivato. Chiedi alla regia.' }, { status: 401 })
    }

    const owner = await getParticipantTutorName(body.id)
    if (owner !== account.displayName) {
      return NextResponse.json({ error: 'Questo gruppo non è assegnato a te.' }, { status: 403 })
    }
  }

  const updated = await setArrived(body.id, body.arrived)
  if (!updated) return NextResponse.json({ error: 'Partecipante non trovato.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
