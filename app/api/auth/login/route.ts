import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  checkStaffPassword,
  createSessionToken,
  safeNextPath,
  sessionCookieOptions,
  type Session,
} from '@/lib/auth'
import { authenticateTutor } from '@/lib/tutor-accounts'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const ip = await getClientIp()
  const limit = await rateLimit(`login:${ip}`, 10, 300)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Troppi tentativi. Riprova tra qualche minuto.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  let body: { username?: unknown; password?: unknown; next?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!password) {
    return NextResponse.json({ error: 'Inserisci la password.' }, { status: 400 })
  }

  let session: Session | null = null
  try {
    if (username) {
      session = await authenticateTutor(username, password)
    } else if (checkStaffPassword(password)) {
      session = { role: 'staff' }
    }
  } catch (error) {
    console.error('Login non riuscito', error)
    return NextResponse.json(
      { error: 'Il servizio di accesso non è raggiungibile. Riprova tra poco.' },
      { status: 503 },
    )
  }

  if (!session) {
    return NextResponse.json(
      { error: username ? 'Nome utente o password non corretti.' : 'Password di accesso non corretta.' },
      { status: 401 },
    )
  }

  const jar = await cookies()
  jar.set(SESSION_COOKIE, createSessionToken(session), sessionCookieOptions)

  const requested = safeNextPath(body.next)
  // Un tutor non può finire nelle aree dello staff: lo mandiamo alla sua area.
  const staffOnly = requested.startsWith('/staff') || requested.startsWith('/admin')
  const next = session.role === 'tutor' && staffOnly ? '/tutor' : requested

  return NextResponse.json({ ok: true, role: session.role, name: session.name, next })
}
