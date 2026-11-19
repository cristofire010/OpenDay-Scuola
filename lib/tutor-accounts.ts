import { asc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { openDayTutorAccounts } from '@/lib/db/schema'
import { hashPassword, verifyPassword, type Session } from '@/lib/auth'

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/
export const MIN_PASSWORD_LENGTH = 8

export type TutorAccount = {
  id: string
  username: string
  displayName: string
  active: boolean
  lastLoginAt: Date | null
  createdAt: Date
}

export class TutorAccountError extends Error {
  constructor(public code: 'INVALID' | 'DUPLICATE' | 'NOT_FOUND', message: string) {
    super(message)
    this.name = 'TutorAccountError'
  }
}

const columns = {
  id: openDayTutorAccounts.id,
  username: openDayTutorAccounts.username,
  displayName: openDayTutorAccounts.displayName,
  active: openDayTutorAccounts.active,
  lastLoginAt: openDayTutorAccounts.lastLoginAt,
  createdAt: openDayTutorAccounts.createdAt,
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

export async function listTutorAccounts(): Promise<TutorAccount[]> {
  return db.select(columns).from(openDayTutorAccounts).orderBy(asc(openDayTutorAccounts.displayName))
}

export async function countTutorAccounts() {
  try {
    const rows = await db.select({ value: sql<number>`count(*)::integer` }).from(openDayTutorAccounts)
    return rows[0]?.value ?? 0
  } catch {
    return 0
  }
}

export async function getTutorAccount(id: string): Promise<TutorAccount | null> {
  const rows = await db.select(columns).from(openDayTutorAccounts).where(eq(openDayTutorAccounts.id, id)).limit(1)
  return rows[0] ?? null
}

/** Verifica nome utente e password. Restituisce la sessione oppure null. */
export async function authenticateTutor(username: string, password: string): Promise<Session | null> {
  const normalized = normalizeUsername(username)
  if (!normalized || !password) return null

  const rows = await db
    .select({ ...columns, passwordHash: openDayTutorAccounts.passwordHash })
    .from(openDayTutorAccounts)
    .where(eq(openDayTutorAccounts.username, normalized))
    .limit(1)

  const account = rows[0]
  if (!account || !account.active) return null
  if (!verifyPassword(password, account.passwordHash)) return null

  await db
    .update(openDayTutorAccounts)
    .set({ lastLoginAt: new Date() })
    .where(eq(openDayTutorAccounts.id, account.id))

  return { role: 'tutor', tutorId: account.id, name: account.displayName, username: account.username }
}

type CreateInput = {
  username: string
  displayName: string
  password: string
}

export async function createTutorAccount(input: CreateInput): Promise<TutorAccount> {
  const username = normalizeUsername(input.username)
  const displayName = input.displayName.trim()

  if (!USERNAME_PATTERN.test(username)) {
    throw new TutorAccountError('INVALID', 'Il nome utente deve avere 3–32 caratteri: lettere minuscole, numeri, punto, trattino.')
  }
  if (displayName.length < 2 || displayName.length > 80) {
    throw new TutorAccountError('INVALID', 'Inserisci nome e cognome del tutor (2–80 caratteri).')
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new TutorAccountError('INVALID', `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`)
  }

  try {
    const rows = await db
      .insert(openDayTutorAccounts)
      .values({
        username,
        displayName,
        passwordHash: hashPassword(input.password),
      })
      .returning(columns)

    return rows[0]
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new TutorAccountError('DUPLICATE', 'Questo nome utente è già in uso.')
    }
    throw error
  }
}

type UpdateInput = {
  active?: boolean
  displayName?: string
  password?: string
}

export async function updateTutorAccount(id: string, input: UpdateInput): Promise<TutorAccount> {
  const patch: Partial<typeof openDayTutorAccounts.$inferInsert> = {}

  if (typeof input.active === 'boolean') patch.active = input.active
  if (typeof input.displayName === 'string') {
    const displayName = input.displayName.trim()
    if (displayName.length < 2 || displayName.length > 80) {
      throw new TutorAccountError('INVALID', 'Inserisci nome e cognome del tutor (2–80 caratteri).')
    }
    patch.displayName = displayName
  }
  if (typeof input.password === 'string') {
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new TutorAccountError('INVALID', `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`)
    }
    patch.passwordHash = hashPassword(input.password)
  }

  if (Object.keys(patch).length === 0) {
    throw new TutorAccountError('INVALID', 'Nessuna modifica da salvare.')
  }

  const rows = await db
    .update(openDayTutorAccounts)
    .set(patch)
    .where(eq(openDayTutorAccounts.id, id))
    .returning(columns)

  if (!rows[0]) throw new TutorAccountError('NOT_FOUND', 'Account non trovato.')
  return rows[0]
}

export async function deleteTutorAccount(id: string) {
  const rows = await db
    .delete(openDayTutorAccounts)
    .where(eq(openDayTutorAccounts.id, id))
    .returning({ id: openDayTutorAccounts.id })

  if (!rows[0]) throw new TutorAccountError('NOT_FOUND', 'Account non trovato.')
}
