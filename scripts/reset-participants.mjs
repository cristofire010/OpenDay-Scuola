// Crea un script per resettare tutti i partecipanti (gruppi/utenti) eccetto i tutor
// Uso: pnpm db:reset-participants   (legge DATABASE_URL_UNPOOLED o DATABASE_URL da .env.local)

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('DATABASE_URL_UNPOOLED o DATABASE_URL non impostata. Configura la connessione Postgres in .env.local.')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: databaseUrl })

async function main() {
  const client = await pool.connect()
  try {
    // Step 1: Delete all records from the participant-stations junction table
    await client.query('DELETE FROM open_day_participant_stations')
    console.log('✓ Cancellate tutte le associazioni open_day_participant_stations')

    // Step 2: Delete all participant records (groups/users)
    const result = await client.query('DELETE FROM open_day_participants RETURNING id, display_name')
    console.log(`✓ Cancellate ${result.rowCount} partecipanti da open_day_participants`)

    // Step 3: Reset the auto-increment sequence for participants (if needed)
    // This depends on the database, but we'll skip it for safety

    console.log('\nReset completato. Gli account tutor e le postazioni sono stati preservati.')
  } catch (error) {
    await client.query('rollback').catch(() => {})
    console.error('Errore durante il reset:', error.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Reset non riuscito:', error.message)
  process.exit(1)
})