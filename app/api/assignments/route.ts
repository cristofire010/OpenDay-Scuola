import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { AssignmentError, createAssignment } from '@/lib/assignments'
import { DEVICE_COOKIE_NAME } from '@/lib/device'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request'

export const runtime = 'nodejs'

const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ .'’\-][\p{L}\p{M}]+)*$/u
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function POST(request: Request) {
  // Limite generoso per IP: a scuola molti telefoni condividono lo stesso Wi-Fi.
  const ip = await getClientIp()
  const limit = await rateLimit(`assign:${ip}`, 150, 600)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Troppe richieste da questa rete. Riprova tra qualche minuto o rivolgiti all’accoglienza.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  let body: {
    displayName?: unknown
    requestedStationSlug?: unknown
    selectedStationSlugs?: unknown
    groupSize?: unknown
  }

  try {
    const parsedBody: unknown = await request.json()
    if (typeof parsedBody !== 'object' || parsedBody === null || Array.isArray(parsedBody)) {
      return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
    }
    body = parsedBody as typeof body
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  const displayName = typeof body.displayName === 'string'
    ? body.displayName.trim().replace(/\s+/g, ' ')
    : ''

  if (displayName.length > 40 || !NAME_PATTERN.test(displayName)) {
    return NextResponse.json(
      { error: 'Inserisci un nome valido, usando solo lettere, spazi, apostrofi o trattini.' },
      { status: 400 },
    )
  }

  const rawSelection = body.selectedStationSlugs ?? (
    typeof body.requestedStationSlug === 'string' ? [body.requestedStationSlug] : body.requestedStationSlug
  )
  let selectedStationSlugs: string[] | null = null

  if (Array.isArray(rawSelection)) {
    if (
      rawSelection.length < 1
      || rawSelection.length > 6
      || rawSelection.some((slug) => typeof slug !== 'string' || !SLUG_PATTERN.test(slug))
      || new Set(rawSelection).size !== rawSelection.length
    ) {
      return NextResponse.json({ error: 'Scegli da una a sei tappe diverse.' }, { status: 400 })
    }
    selectedStationSlugs = rawSelection
  } else if (rawSelection !== null && rawSelection !== undefined) {
    return NextResponse.json({ error: 'Scelta dei laboratori non valida.' }, { status: 400 })
  }

  const groupSize = body.groupSize === undefined ? 1 : body.groupSize
  if (typeof groupSize !== 'number' || !Number.isInteger(groupSize) || groupSize < 1 || groupSize > 6) {
    return NextResponse.json({ error: 'Il gruppo può avere da una a sei persone.' }, { status: 400 })
  }

  const jar = await cookies()
  const deviceId = jar.get(DEVICE_COOKIE_NAME)?.value ?? randomUUID()

  try {
    const assignment = await createAssignment(displayName, selectedStationSlugs, groupSize, deviceId)
    const response = NextResponse.json({ id: assignment.id }, { status: assignment.existing ? 200 : 201 })
    response.cookies.set(DEVICE_COOKIE_NAME, deviceId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return response
  } catch (error) {
    if (error instanceof AssignmentError) {
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'DEVICE_LIMIT' ? 429 : 409
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }

    console.error('createAssignment fallita', error)
    return NextResponse.json(
      { error: 'Non siamo riusciti a completare l’assegnazione. Riprova tra un momento.' },
      { status: 500 },
    )
  }
}
