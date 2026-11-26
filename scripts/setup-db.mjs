// Crea le tabelle e carica le postazioni da lib/experiments.json.
// Uso: pnpm db:setup   (legge DATABASE_URL_UNPOOLED o DATABASE_URL da .env.local)
// Si può rilanciare in sicurezza: aggiorna testi e tutor senza toccare iscritti, capienze o stato attivo.

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
    await client.query(`create table if not exists open_day_migrations (name text primary key, applied_at timestamptz not null default now())`)

    const dir = join(root, 'db', 'migrations')
    const files = readdirSync(dir).filter((file) => file.endsWith('.sql')).sort()
    for (const file of files) {
      const done = await client.query('select 1 from open_day_migrations where name = $1', [file])
      if (done.rowCount > 0) {
        console.log(`• ${file} già applicata`)
        continue
      }
      await client.query('begin')
      await client.query(readFileSync(join(dir, file), 'utf8'))
      await client.query('insert into open_day_migrations (name) values ($1)', [file])
      await client.query('commit')
      console.log(`✓ ${file} applicata`)
    }

    const experiments = JSON.parse(readFileSync(join(root, 'lib', 'experiments.json'), 'utf8'))
    for (const [index, e] of experiments.entries()) {
      await client.query(
        `insert into open_day_stations
           (slug, station_code, title, guide_name, guide_role, room, meeting_point, directions, accent, capacity, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict (slug) do update set
           station_code = excluded.station_code,
           title = excluded.title,
           guide_name = excluded.guide_name,
           guide_role = excluded.guide_role,
           room = excluded.room,
           meeting_point = excluded.meeting_point,
           directions = excluded.directions,
           accent = excluded.accent,
           capacity = greatest(open_day_stations.capacity, excluded.capacity),
           sort_order = excluded.sort_order`,
        [
          e.slug,
          e.station,
          e.title,
          e.guide,
          e.guideRole,
          e.room,
          e.meetingPoint,
          e.directions,
          e.accent,
          // La tappa finale accoglie tutti i gruppi, quindi ha capienza praticamente illimitata.
          e.mandatory ? 100000 : 36,
          index,
        ],
      )
    }
    console.log(`✓ ${experiments.length} postazioni caricate`)
  } catch (error) {
    await client.query('rollback').catch(() => {})
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Setup non riuscito:', error.message)
  process.exit(1)
})
