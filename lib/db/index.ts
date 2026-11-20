import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const isProduction = process.env.NODE_ENV === 'production'
const connectionString = process.env.DATABASE_URL

export const pool = new Pool({
  connectionString,
  ssl: isProduction || connectionString?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
})

export const db = drizzle(pool, { schema })
