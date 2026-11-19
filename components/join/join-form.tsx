'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, LoaderCircle, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldDescription, FieldError, FieldLabel, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { getLine } from '@/lib/experiments'
import type { StationAvailability } from '@/lib/open-day-types'
import { cn } from '@/lib/utils'

type JoinStation = StationAvailability & {
  number: string
  category: string
  duration: string
}

export function JoinForm({
  stations,
  initialExperiment,
}: {
  stations: JoinStation[]
  initialExperiment?: string
}) {
  const router = useRouter()
  const validInitial = stations.some((station) => station.slug === initialExperiment && station.remaining > 0)
  const [choice, setChoice] = useState(validInitial ? initialExperiment! : 'auto')
  const [displayName, setDisplayName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const totalRemaining = stations.reduce((sum, station) => sum + station.remaining, 0)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          requestedStationSlug: choice === 'auto' ? null : choice,
        }),
      })
      const result = await response.json() as { id?: string; error?: string }

      if (!response.ok || !result.id) {
        setError(result.error ?? 'Non siamo riusciti a completare l’assegnazione. Riprova.')
        if (response.status === 409 || response.status === 404) router.refresh()
        setPending(false)
        return
      }

      router.push(`/assegnazione/${result.id}`)
    } catch {
      setError('Controlla la connessione e riprova.')
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-5 sm:p-7">
      <h2 className="display-sm text-2xl">1. Come ti chiami?</h2>
      <div className="mt-4">
        <Label htmlFor="display-name" className="sr-only">Nome del partecipante</Label>
        <Input
          id="display-name"
          name="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Il tuo nome…"
          autoComplete="given-name"
          maxLength={40}
          required
          disabled={pending}
          className="h-12 rounded-md bg-background px-4 text-base"
        />
        <FieldDescription className="mt-2 text-sm">Basta il nome, senza cognome.</FieldDescription>
      </div>

      <FieldSet className="mt-8">
        <h2 className="display-sm text-2xl">2. Cosa vuoi provare?</h2>
        <RadioGroup
          value={choice}
          onValueChange={(value) => setChoice(String(value))}
          aria-label="Scegli un esperimento"
          className="gap-3"
        >
          <FieldLabel className="w-full cursor-pointer rounded-lg border-2 bg-background p-4 transition-colors hover:bg-muted has-data-checked:border-foreground has-data-checked:bg-giallo/40">
            <RadioGroupItem value="auto" className="mt-1" disabled={pending || totalRemaining === 0} />
            <span className="flex min-w-0 flex-1 items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-giallo text-giallo-foreground">
                <Shuffle className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-bold">Mi sorprendete</span>
                  <span className="text-sm text-muted-foreground">{totalRemaining} posti in tutto</span>
                </span>
                <span className="mt-1 block text-base font-normal leading-snug text-muted-foreground">Ti mettiamo nella tappa con più spazio.</span>
              </span>
            </span>
          </FieldLabel>

          {stations.map((station) => {
            const full = station.remaining === 0
            const selected = choice === station.slug
            const line = getLine(station.accent)

            return (
              <FieldLabel
                key={station.slug}
                data-line={line.accent}
                className={cn(
                  'w-full rounded-lg border-2 bg-background p-4 transition-colors',
                  full ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-muted',
                  selected && 'border-foreground bg-line-soft',
                )}
              >
                <RadioGroupItem value={station.slug} className="mt-1" disabled={pending || full} />
                <span className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="display flex size-12 shrink-0 items-center justify-center rounded-md bg-line text-lg text-line-foreground">{station.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                      <span className="text-base font-bold">{station.title}</span>
                      <span className={cn('text-sm font-bold', full ? 'text-destructive' : 'text-foreground')}>
                        {full ? 'Completo' : `${station.remaining} ${station.remaining === 1 ? 'posto' : 'posti'}`}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-base font-normal text-muted-foreground">
                      {line.name}, {station.duration}, con {station.guideName}
                    </span>
                  </span>
                </span>
              </FieldLabel>
            )
          })}
        </RadioGroup>
      </FieldSet>

      <div aria-live="polite">
        {error && <FieldError className="mt-5 rounded-lg bg-destructive/10 p-3 text-base">{error}</FieldError>}
      </div>
      <Button type="submit" size="lg" disabled={pending || totalRemaining === 0} className="mt-6 h-14 w-full rounded-md text-base font-bold">
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            Assegnazione in corso
          </>
        ) : (
          <>
            Trova la mia postazione
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </>
        )}
      </Button>
      <p className="mt-3 text-center text-sm leading-snug text-muted-foreground">Niente password né email. Il biglietto che ricevi è personale: tienilo aperto per raggiungere la postazione.</p>
    </form>
  )
}
