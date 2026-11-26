'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, LoaderCircle, Shuffle } from 'lucide-react'
import { Brand } from '@/components/brand'
import { LabList } from '@/components/home/lab-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { finalStopExperiment, isMandatorySlug } from '@/lib/experiments'
import type { StationAvailability } from '@/lib/open-day-types'

type Stage = 'welcome' | 'map'

export function OpenVoltaExperience({
  stations,
  initialExperiment,
  stationsLoading = false,
  stationsError = null,
  existingTicket,
}: {
  stations: StationAvailability[]
  initialExperiment?: string
  stationsLoading?: boolean
  stationsError?: string | null
  existingTicket?: { id: string; displayName: string }
}) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('welcome')
  const [displayName, setDisplayName] = useState('')
  const [groupSize, setGroupSize] = useState(1)
  const [names, setNames] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // La tappa finale è obbligatoria e automatica: non compare fra i laboratori da scegliere.
  const selectableStations = useMemo(
    () => stations.filter((station) => !isMandatorySlug(station.slug)),
    [stations],
  )

  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() =>
    initialExperiment && selectableStations.some((station) => station.slug === initialExperiment)
      ? [initialExperiment]
      : [],
  )

  const hasAvailableStation = useMemo(
    () => selectableStations.some((station) => station.remaining >= groupSize),
    [selectableStations, groupSize],
  )

  const selectedStations = useMemo(
    () => selectedSlugs
      .map((slug) => stations.find((station) => station.slug === slug))
      .filter((station): station is StationAvailability => station !== undefined),
    [selectedSlugs, stations],
  )

  const routeIsAvailable = selectedStations.length > 0
    && selectedStations.every((station) => station.remaining >= groupSize)

  const extraNames = useMemo(
    () => Array.from({ length: Math.max(groupSize - 1, 0) }, (_, index) => (names[index] ?? '').trim()),
    [groupSize, names],
  )

  const missingExtraNames = extraNames.filter((name) => name.length === 0).length
  const canEnterMap = displayName.trim().length > 0 && missingExtraNames === 0

  function changeGroupSize(nextSize: number) {
    setGroupSize(nextSize)
    // Tieni solo i nomi aggiuntivi che rientrano ancora nella nuova dimensione.
    setNames((current) => (current.length > nextSize - 1 ? current.slice(0, nextSize - 1) : current))
  }

  function setExtraName(index: number, value: string) {
    setNames((current) => {
      const next = [...current]
      next[index] = value
      return next
    })
  }

  function enterMap() {
    if (!canEnterMap) {
      setError(
        displayName.trim().length === 0
          ? 'Scrivi il tuo nome per continuare.'
          : 'Scrivi il nome di tutte le persone del gruppo per continuare.',
      )
      return
    }
    setError(null)
    setStage('map')
  }

  function toggleStation(slug: string) {
    const station = stations.find((item) => item.slug === slug)
    if (!station) return

    if (!selectedSlugs.includes(slug) && station.remaining < groupSize) return

    setSelectedSlugs((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
    )
    setError(null)
  }

  async function assignRoute(route: string[] | null) {
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          groupSize,
          selectedStationSlugs: route,
        }),
      })
      const result = await response.json() as { id?: string; error?: string }
      if (!response.ok || !result.id) {
        setError(result.error ?? 'Non siamo riusciti ad assegnare il tutor. Riprova.')
        setPending(false)
        return
      }

      router.push(`/assegnazione/${result.id}`)
    } catch {
      setError('Connessione non riuscita. Controlla internet e riprova.')
      setPending(false)
    }
  }

  return (
    <div className="min-h-svh bg-foreground text-foreground">
      <div className="relative min-h-svh overflow-hidden">
        <div className="relative section-shell flex min-h-svh flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-4 rounded-full border border-background/15 bg-background/10 px-4 py-2 text-background backdrop-blur-md">
            <Brand tone="light" />
            <Link
              href="/accesso?next=%2Ftutor"
              className="rounded-full border border-background/25 px-3.5 py-1.5 text-sm font-bold text-background outline-none transition-colors hover:border-background/50 hover:bg-background/10 focus-visible:ring-2 focus-visible:ring-background"
            >
              Area tutor
            </Link>
          </header>

          {existingTicket ? (
            <main id="main-content" className="flex flex-1 items-center justify-center py-8">
              <section className="w-full max-w-[620px] rounded-3xl border border-white/40 bg-background/95 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm sm:p-10">
                <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Bentornato, {existingTicket.displayName}
                </p>
                <h1 className="display text-[clamp(2.5rem,8vw,5.5rem)]">Hai già un biglietto</h1>
                <p className="mt-4 max-w-lg text-lg leading-relaxed">
                  Il tuo biglietto è ancora attivo. Puoi riaprire il giro e ritrovare tutte le tappe assegnate.
                </p>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => router.push(`/assegnazione/${existingTicket.id}`)}
                  className="mt-8 h-14 w-full rounded-xl text-base font-bold"
                >
                  Ritorna al tuo biglietto
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Button>
              </section>
            </main>
          ) : stage === 'welcome' ? (
            <main id="main-content" className="flex flex-1 items-center justify-center py-8">
              <section className="w-full max-w-[620px] rounded-3xl border border-white/40 bg-background/95 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm sm:p-10">
                <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">Open day della scuola · laboratori aperti</p>
                <h1 className="display text-[clamp(2.5rem,8vw,5.5rem)]">OpenVolta ti aspetta</h1>
                <p className="mt-4 max-w-lg text-lg leading-relaxed">
                  Scrivi il tuo nome e quante persone siete. Poi scegliete insieme le tappe dall’elenco dei laboratori.
                </p>

                <form
                  className="mt-8 flex flex-col gap-5"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault()
                    enterMap()
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="participant-name" className="text-base font-bold">Come ti chiami?</Label>
                    <Input
                      id="participant-name"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Il tuo nome"
                      autoComplete="given-name"
                      inputMode="text"
                      maxLength={40}
                      className="h-12 rounded-lg border-input bg-card px-4 text-base"
                    />
                    <p className="text-sm text-muted-foreground">Basta il nome, non serve creare un account.</p>
                  </div>

                  {groupSize > 1 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-base font-bold">Nomi delle altre persone</span>
                      <p className="text-sm text-muted-foreground">Scrivete tutti i nomi: servono al tutor per riconoscervi.</p>
                      {Array.from({ length: groupSize - 1 }, (_, index) => (
                        <Input
                          key={index}
                          value={names[index] ?? ''}
                          onChange={(event) => setExtraName(index, event.target.value)}
                          placeholder={`Nome persona ${index + 2}`}
                          maxLength={40}
                          className="h-12 rounded-lg border-input bg-card px-4 text-base"
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="group-size" className="text-base font-bold">Quante persone siete?</Label>
                    <select
                      id="group-size"
                      value={groupSize}
                      onChange={(event) => changeGroupSize(Number(event.target.value))}
                      className="h-12 rounded-lg border border-input bg-card px-4 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {Array.from({ length: 6 }, (_, index) => index + 1).map((count) => (
                        <option key={count} value={count}>
                          {count} {count === 1 ? 'persona' : 'persone'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {error && (
                    <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-base text-destructive">
                      {error}
                    </p>
                  )}

                  <Button
                    type="button"
                    onClick={enterMap}
                    disabled={!canEnterMap}
                    size="lg"
                    className="mt-2 h-14 w-full rounded-xl text-base font-bold"
                  >
                    Scegli le tappe
                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </Button>
                </form>
              </section>
            </main>
          ) : (
            <main id="main-content" className="flex flex-1 flex-col py-5 sm:py-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-background">
                <div>
                  <p className="text-base">Ciao, {displayName.trim()}!</p>
                  <h1 className="display text-3xl sm:text-4xl">Scegli le tue tappe</h1>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStage('welcome')}
                  className="rounded-lg text-background hover:bg-background/15 hover:text-background"
                >
                  <ArrowLeft aria-hidden="true" />
                  Cambia nome
                </Button>
              </div>

              <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
                <LabList
                  stations={stations}
                  selectedSlugs={selectedSlugs}
                  onToggle={toggleStation}
                  unavailableSlugs={selectableStations
                    .filter((station) => station.remaining < groupSize && !selectedSlugs.includes(station.slug))
                    .map((station) => station.slug)}
                />

                <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="route-title">
                  <h2 id="route-title" className="display-sm text-2xl">Il vostro giro</h2>
                  <p className="mt-2 text-base text-muted-foreground">
                    {groupSize} {groupSize === 1 ? 'persona' : 'persone'} · tutor assegnato in automatico
                  </p>

                  {selectedStations.length === 0 ? (
                    <p className="mt-5 rounded-lg bg-secondary p-4 text-base leading-snug">
                      Non sai da dove iniziare? Ci pensa OpenVolta a scegliere una tappa libera per voi.
                    </p>
                  ) : (
                    <>
                      <ol className="mt-5 flex flex-col gap-2">
                        {selectedStations.map((station, index) => (
                          <li key={station.slug} data-line={station.accent} className="flex items-center gap-3 rounded-lg bg-line-soft p-3">
                            <span className="display flex size-10 shrink-0 items-center justify-center rounded-md bg-line text-base text-line-foreground">
                              {station.code}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-bold">{station.title}</span>
                              <span className="block text-sm text-muted-foreground">{station.room}</span>
                            </span>
                            <span className="text-sm font-bold">{index + 1}</span>
                          </li>
                        ))}
                      </ol>
                      {finalStopExperiment && (
                        <div data-line={finalStopExperiment.accent} className="mt-2 flex items-center gap-3 rounded-lg border-2 border-dashed border-line/50 bg-line-soft p-3">
                          <span className="display flex size-10 shrink-0 items-center justify-center rounded-md bg-line text-base text-line-foreground">
                            {finalStopExperiment.station}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold">{finalStopExperiment.title}</span>
                            <span className="block text-sm text-muted-foreground">Tappa finale, sempre inclusa</span>
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {error && (
                    <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-base text-destructive">
                      {error}
                    </p>
                  )}

                  <div className="mt-5 flex flex-col gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      disabled={pending || stationsLoading || Boolean(stationsError) || !hasAvailableStation}
                      onClick={() => assignRoute(null)}
                      className="h-12 w-full rounded-xl text-base"
                    >
                      {pending ? (
                        <LoaderCircle className="animate-spin" aria-hidden="true" />
                      ) : <Shuffle aria-hidden="true" />}
                      Sorprendimi
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      disabled={pending || stationsLoading || Boolean(stationsError) || !routeIsAvailable}
                      onClick={() => assignRoute(selectedSlugs)}
                      className="h-14 w-full rounded-xl text-base font-bold"
                    >
                      {pending ? (
                        <>
                          <LoaderCircle className="animate-spin" aria-hidden="true" />
                          Cerco un tutor libero
                        </>
                      ) : (
                        <>
                          Trova il mio tutor
                          <ArrowRight data-icon="inline-end" aria-hidden="true" />
                        </>
                      )}
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">
                      {stationsLoading
                        ? 'Carico la disponibilità dei laboratori…'
                        : stationsError
                          ? stationsError
                          : stations.length === 0
                            ? 'Nessun laboratorio è attivo al momento. Chiedi aiuto all’accoglienza.'
                            : !hasAvailableStation
                              ? 'Nessun laboratorio può ospitare il vostro gruppo: chiedi aiuto all’accoglienza.'
                              : 'Il tutor riceve il vostro nome e tutte le tappe scelte.'}
                    </p>
                  </div>
                </section>
              </div>
            </main>
          )}
        </div>
      </div>
    </div>
  )
}
