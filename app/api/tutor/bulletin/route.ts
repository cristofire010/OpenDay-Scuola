import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { BULLETIN_MAX_LENGTH, createBulletinMessage, listBulletinMessages } from '@/lib/bulletin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 })

  const messages = await listBulletinMessages()
  return NextResponse.json({ messages }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 })

  // Solo il personale amministrativo può pubblicare sulla bacheca
  if (session.role !== 'staff') {
    return NextResponse.json({ error: 'Solo il personale amministrativo può pubblicare sulla bacheca.' }, { status: 403 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  const raw = typeof payload === 'object' && payload !== null
    ? (payload as { body?: unknown }).body
    : undefined
  const body = typeof raw === 'string' ? raw.trim() : ''

  if (!body) {
    return NextResponse.json({ error: 'Scrivi un messaggio prima di pubblicarlo.' }, { status: 400 })
  }
  if (body.length > BULLETIN_MAX_LENGTH) {
    return NextResponse.json({ error: `Il messaggio non può superare ${BULLETIN_MAX_LENGTH} caratteri.` }, { status: 400 })
  }

  const author = session.name ?? 'Regia'
  const message = await createBulletinMessage(author, body)

  return NextResponse.json({ message }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
