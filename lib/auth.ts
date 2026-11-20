import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

export type Role = 'staff' | 'tutor'

/**
 * Sessione firmata. Per lo staff non ci sono dati personali; per un tutor
 * contiene l'id dell'account e il nome della guida a cui è associato.
 */
export type Session = {
  role: Role
  tutorId?: string
  name?: string
  username?: string
}

export const SESSION_COOKIE = 'md_session'
const SESSION_SECONDS = 60 * 60 * 12
const MAX_TOKEN_FIELD = 160

function loadSessionSecret() {
  const value = process.env.SESSION_SECRET
  if (!value?.trim() || Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error('SESSION_SECRET must be configured with at least 32 bytes of random data.')
  }
  return value
}

const SESSION_SECRET = loadSessionSecret()

function sign(value: string) {
  return createHmac('sha256', SESSION_SECRET).update(value).digest('base64url')
}

function safeEqual(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function isStaffLoginConfigured() {
  return Boolean(process.env.STAFF_PASSWORD)
}

/** Password dello staff (coordinamento): resta una password unica d'ambiente. */
export function checkStaffPassword(input: string) {
  const staff = process.env.STAFF_PASSWORD
  return Boolean(staff && input && safeEqual(input, staff))
}

/** Hash scrypt con sale casuale, nel formato `scrypt$sale$hash`. */
export function hashPassword(password: string) {
  const salt = randomBytes(16)
  const derived = scryptSync(password.normalize('NFKC'), salt, 64)
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, saltPart, hashPart] = stored.split('$')
  if (scheme !== 'scrypt' || !saltPart || !hashPart) return false

  try {
    const expected = Buffer.from(hashPart, 'base64url')
    const derived = scryptSync(password.normalize('NFKC'), Buffer.from(saltPart, 'base64url'), expected.length)
    return expected.length === derived.length && timingSafeEqual(expected, derived)
  } catch {
    return false
  }
}

export function createSessionToken(session: Session) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  const payload = Buffer.from(JSON.stringify({ ...session, exp: expires })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function readToken(token: string | undefined): Session | null {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  if (!safeEqual(signature, sign(payload))) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: unknown
      tutorId?: unknown
      name?: unknown
      username?: unknown
      exp?: unknown
    }
    if (parsed.role !== 'staff' && parsed.role !== 'tutor') return null
    if (typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)) return null
    if (typeof parsed.name === 'string' && parsed.name.length > MAX_TOKEN_FIELD) return null
    if (typeof parsed.username === 'string' && parsed.username.length > MAX_TOKEN_FIELD) return null
    if (typeof parsed.tutorId === 'string' && parsed.tutorId.length > MAX_TOKEN_FIELD) return null

    return {
      role: parsed.role,
      tutorId: typeof parsed.tutorId === 'string' ? parsed.tutorId : undefined,
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      username: typeof parsed.username === 'string' ? parsed.username : undefined,
    }
  } catch {
    return null
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_SECONDS,
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies()
  return readToken(jar.get(SESSION_COOKIE)?.value)
}

/** Lo staff può fare tutto ciò che fa un tutor. */
export function canAccess(role: Role | null, required: Role) {
  if (!role) return false
  return required === 'tutor' ? true : role === 'staff'
}

/** Per le pagine: manda al login se manca il permesso. */
export async function requireRole(required: Role, nextPath: string) {
  const session = await getSession()
  if (!canAccess(session?.role ?? null, required)) {
    const loginPath = required === 'staff' ? '/admin/accesso' : '/accesso'
    redirect(`${loginPath}?next=${encodeURIComponent(nextPath)}`)
  }
  return session as Session
}

/** Per le API: restituisce una risposta 401/403 oppure null se si può procedere. */
export async function guardApi(required: Role): Promise<NextResponse | null> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 })
  if (!canAccess(session.role, required)) return NextResponse.json({ error: 'Permesso insufficiente.' }, { status: 403 })
  return null
}

/** Accetta solo percorsi interni di staff/tutor/admin come destinazione dopo il login. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string') return '/tutor'
  if (!value.startsWith('/') || value.startsWith('//')) return '/tutor'
  const allowed = ['/staff', '/tutor', '/admin']
  if (allowed.some((path) => value === path || value.startsWith(`${path}/`))) return value
  return '/tutor'
}
