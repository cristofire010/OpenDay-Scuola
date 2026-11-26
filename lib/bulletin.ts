import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { openDayBulletinMessages } from '@/lib/db/schema'

export const BULLETIN_MAX_LENGTH = 500
export const BULLETIN_LIMIT = 40

export type BulletinMessage = {
  id: string
  author: string
  body: string
  createdAt: string
}

export async function listBulletinMessages(): Promise<BulletinMessage[]> {
  const rows = await db
    .select({
      id: openDayBulletinMessages.id,
      author: openDayBulletinMessages.authorName,
      body: openDayBulletinMessages.body,
      createdAt: openDayBulletinMessages.createdAt,
    })
    .from(openDayBulletinMessages)
    .orderBy(desc(openDayBulletinMessages.createdAt))
    .limit(BULLETIN_LIMIT)

  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
}

export async function deleteBulletinMessage(id: string): Promise<boolean> {
  const rows = await db
    .delete(openDayBulletinMessages)
    .where(eq(openDayBulletinMessages.id, id))
    .returning({ id: openDayBulletinMessages.id })

  return rows.length > 0
}

export async function createBulletinMessage(author: string, body: string): Promise<BulletinMessage> {
  const rows = await db
    .insert(openDayBulletinMessages)
    .values({ authorName: author, body })
    .returning({
      id: openDayBulletinMessages.id,
      author: openDayBulletinMessages.authorName,
      body: openDayBulletinMessages.body,
      createdAt: openDayBulletinMessages.createdAt,
    })

  const row = rows[0]
  return { ...row, createdAt: row.createdAt.toISOString() }
}
