import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getRoster } from '@/lib/assignments'
import { getTutorAccount } from '@/lib/tutor-accounts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 })

  let tutorName: string

  if (session.role === 'tutor') {
    const account = session.tutorId ? await getTutorAccount(session.tutorId) : null
    if (!account || !account.active) {
      return NextResponse.json({ error: 'Account disattivato. Chiedi alla regia.' }, { status: 401 })
    }
    tutorName = account.displayName
  } else {
    tutorName = new URL(request.url).searchParams.get('tutor')?.trim() ?? ''
  }

  if (!tutorName || tutorName.length > 80) {
    return NextResponse.json({ error: 'Tutor non valido.' }, { status: 400 })
  }

  const roster = await getRoster(tutorName)
  return NextResponse.json(roster, { headers: { 'Cache-Control': 'no-store' } })
}
