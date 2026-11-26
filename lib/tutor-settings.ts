import { inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { openDaySettings } from '@/lib/db/schema'
import { hashPassword, verifyPassword } from '@/lib/auth'

/** Password comune dei tutor: stessa lunghezza minima delle password personali. */
export const MIN_SHARED_PASSWORD_LENGTH = 8

const PASSWORD_KEY = 'shared_tutor_password_hash'
const ENABLED_KEY = 'shared_tutor_password_enabled'

export type SharedTutorPasswordState = {
  /** Esiste già una password comune salvata. */
  configured: boolean
  /** La password comune è accettata al login. */
  enabled: boolean
}

export class SharedPasswordError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SharedPasswordError'
  }
}

async function readSettings() {
  const rows = await db
    .select({ key: openDaySettings.key, value: openDaySettings.value })
    .from(openDaySettings)
    .where(inArray(openDaySettings.key, [PASSWORD_KEY, ENABLED_KEY]))

  return new Map(rows.map((row) => [row.key, row.value]))
}

async function writeSetting(key: string, value: string) {
  await db
    .insert(openDaySettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: openDaySettings.key,
      set: { value, updatedAt: new Date() },
    })
}

export async function getSharedTutorPasswordState(): Promise<SharedTutorPasswordState> {
  const settings = await readSettings()
  const configured = Boolean(settings.get(PASSWORD_KEY))
  return { configured, enabled: configured && settings.get(ENABLED_KEY) === '1' }
}

/** Salva una nuova password comune e la attiva. Restituisce lo stato aggiornato. */
export async function setSharedTutorPassword(password: string): Promise<SharedTutorPasswordState> {
  if (password.length < MIN_SHARED_PASSWORD_LENGTH) {
    throw new SharedPasswordError(`La password comune deve avere almeno ${MIN_SHARED_PASSWORD_LENGTH} caratteri.`)
  }

  await writeSetting(PASSWORD_KEY, hashPassword(password))
  await writeSetting(ENABLED_KEY, '1')
  return { configured: true, enabled: true }
}

/** Attiva o disattiva la password comune senza cancellarla. */
export async function setSharedTutorPasswordEnabled(enabled: boolean): Promise<SharedTutorPasswordState> {
  const state = await getSharedTutorPasswordState()

  if (enabled && !state.configured) {
    throw new SharedPasswordError('Imposta prima una password comune, poi puoi attivarla.')
  }

  await writeSetting(ENABLED_KEY, enabled ? '1' : '0')
  return { configured: state.configured, enabled }
}

/** True solo se la password comune è attiva e corrisponde. */
export async function verifySharedTutorPassword(password: string): Promise<boolean> {
  if (!password) return false

  const settings = await readSettings()
  if (settings.get(ENABLED_KEY) !== '1') return false

  const stored = settings.get(PASSWORD_KEY)
  if (!stored) return false

  return verifyPassword(password, stored)
}
