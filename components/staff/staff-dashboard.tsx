'use client'

import useSWR from 'swr'
import { CheckCircle2, Radio, UsersRound } from 'lucide-react'
import { getLine } from '@/lib/experiments'
import type { StaffOverview } from '@/lib/open-day-types'
import { cn } from '@/lib/utils'

async function fetchOverview(url: string): Promise<StaffOverview> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Aggiornamento non disponibile')
  return response.json() as Promise<StaffOverview>
}

export function StaffDashboard({ initialOverview }: { initialOverview: StaffOverview }) {
  const { data = initialOverview, error, isValidating } = useSWR<StaffOverview>(
    '/api/staff/overview',
    fetchOverview,
    {
      fallbackData: initialOverview,
      refreshInterval: 3000,
      revalidateOnFocus: true,
    },
  )
  const remaining = data.stations.reduce((sum, station) => sum + station.remaining, 0)

  return (
    <section aria-labelledby="live-overview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radio className={cn('size-5', isValidating && 'animate-pulse')} aria-hidden="true" />
            <h2 id="live-overview" className="display-sm text-2xl">Gruppi in tempo reale</h2>
          </div>
          <p className="mt-1 text-base text-muted-foreground">Solo conteggi, nessun nome. I nomi li vedono i tutor.</p>
        </div>
        <span className="rounded-md bg-secondary px-3 py-1.5 text-sm font-bold">Aggiornamento ogni 3 secondi</span>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-base text-destructive">L’ultimo aggiornamento non è riuscito. I dati precedenti restano visibili.</p>}

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 border-y py-6 lg:grid-cols-4">
        {[
          { label: 'Iscritti', value: data.total },
          { label: 'Arrivati alla postazione', value: data.arrived },
          { label: 'Postazioni attive', value: data.activeStations },
          { label: 'Posti ancora liberi', value: remaining },
        ].map((item) => (
          <div key={item.label}>
            <dt className="text-base text-muted-foreground">{item.label}</dt>
            <dd className="display mt-1 text-5xl tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {data.stations.map((station) => {
          const percentage = station.capacity > 0 ? Math.round((station.total / station.capacity) * 100) : 0
          const line = getLine(station.accent)

          return (
            <article key={station.slug} data-line={line.accent} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="display flex size-12 shrink-0 items-center justify-center rounded-md bg-line text-lg text-line-foreground">{station.code}</span>
                  <div>
                    <h3 className="display-sm text-lg">{station.title}</h3>
                    <p className="mt-0.5 text-base text-muted-foreground">{station.guideName}, {station.room}</p>
                  </div>
                </div>
                <span className="shrink-0 text-base font-bold tabular-nums">{station.total}/{station.capacity}</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Occupazione ${station.title}`}
                className="mt-5 h-3 overflow-hidden rounded-full bg-secondary"
              >
                <div className="h-full rounded-full bg-line" style={{ width: `${percentage}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-base text-muted-foreground">
                <span>{percentage}% occupato</span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {station.arrived} arrivati
                </span>
              </div>
            </article>
          )
        })}
      </div>
      {data.total === 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed p-4 text-base text-muted-foreground">
          <UsersRound className="size-5 shrink-0" aria-hidden="true" />
          Nessuna iscrizione ancora. Apri un QR qui sotto per provare il percorso da partecipante.
        </div>
      )}
    </section>
  )
}
