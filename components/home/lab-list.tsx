'use client'

import { Check } from 'lucide-react'
import { getLine, selectableExperiments } from '@/lib/experiments'
import type { StationAvailability } from '@/lib/open-day-types'
import { cn } from '@/lib/utils'

/**
 * Elenco dei laboratori scelti al posto della piantina: ogni riga mostra
 * il colore della linea, il titolo e la descrizione breve.
 */
export function LabList({
  stations,
  selectedSlugs,
  onToggle,
  unavailableSlugs,
}: {
  stations: StationAvailability[]
  selectedSlugs: string[]
  onToggle: (slug: string) => void
  unavailableSlugs: string[]
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="display-sm text-xl">Scegli le tappe</h2>
        <p className="text-sm text-muted-foreground">{selectableExperiments.length} laboratori disponibili</p>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {selectableExperiments.map((experiment) => {
          const availability = stations.find((station) => station.slug === experiment.slug)
          const selected = selectedSlugs.includes(experiment.slug)
          const unavailable = unavailableSlugs.includes(experiment.slug)
          const line = getLine(experiment.accent)
          const places = availability?.remaining

          return (
            <li key={experiment.slug}>
              <button
                type="button"
                data-line={experiment.accent}
                aria-pressed={selected}
                aria-disabled={unavailable}
                disabled={unavailable}
                onClick={() => onToggle(experiment.slug)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border-2 bg-line-soft p-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 sm:items-center sm:gap-4 sm:p-4',
                  selected ? 'border-foreground' : 'border-transparent hover:border-line/40',
                  unavailable && 'cursor-not-allowed opacity-50',
                )}
              >
                <span className="display flex size-12 shrink-0 items-center justify-center rounded-lg bg-line text-base text-line-foreground sm:size-14 sm:text-lg">
                  {experiment.station}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-base font-bold leading-tight">{experiment.title}</span>
                    <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-line-foreground">
                      {line.name}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                    {experiment.shortDescription}
                  </span>
                  <span className="mt-1 block text-xs font-bold text-muted-foreground">
                    {experiment.room}
                    {places !== undefined
                      ? ` · ${unavailable ? 'completo' : `${places} ${places === 1 ? 'posto' : 'posti'}`}`
                      : ''}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border-2',
                    selected ? 'border-foreground bg-foreground text-background' : 'border-input text-transparent',
                  )}
                >
                  <Check className="size-4" />
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
        {selectedSlugs.length === 0
          ? 'Tocca una o più tappe, oppure scegli “Sorprendimi”.'
          : `${selectedSlugs.length} ${selectedSlugs.length === 1 ? 'tappa scelta' : 'tappe scelte'}. Tocca di nuovo per rimuoverne una.`}
      </p>
    </div>
  )
}
