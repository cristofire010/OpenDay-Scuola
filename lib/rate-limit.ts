import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/**
 * Rate limit a finestra fissa, salvato su Postgres (funziona con più istanze).
 * Se il database non risponde lascia passare: meglio un ragazzo in più che un open day bloccato.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  try {
    const result = await db.execute(sql`
      insert into open_day_rate_limits (key, window_start, hits)
      values (${key}, now(), 1)
      on conflict (key) do update set
        hits = case
          when open_day_rate_limits.window_start < now() - (${windowSeconds}::int * interval '1 second') then 1
          else open_day_rate_limits.hits + 1
        end,
        window_start = case
          when open_day_rate_limits.window_start < now() - (${windowSeconds}::int * interval '1 second') then now()
          else open_day_rate_limits.window_start
        end
      returning
        hits,
        greatest(1, ceil(extract(epoch from (window_start + (${windowSeconds}::int * interval '1 second') - now()))))::int as retry_after
    `)
    const row = result.rows[0] as { hits: number; retry_after: number } | undefined
    if (!row) return { ok: true, retryAfter: 0 }
    return { ok: row.hits <= limit, retryAfter: Number(row.retry_after) }
  } catch (error) {
    console.error('rateLimit non disponibile', error)
    return { ok: true, retryAfter: 0 }
  }
}
