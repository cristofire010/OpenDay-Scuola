import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getParticipantTutorName, setCompleted } from '@/lib/assignments'
import { getTutorAccount } from '@/lib/tutor-accounts'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 })

  let body: { id?: unknown; completed?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  if (typeof body.id !== 'string' || typeof body.completed !== 'boolean') {
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

  const updated = await setCompleted(body.id, body.completed)
  if (!updated) return NextResponse.json({ error: 'Gruppo non trovato.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
