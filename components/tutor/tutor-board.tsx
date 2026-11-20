'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Bell, BellRing, Check, Flag, LoaderCircle, ScanLine, UsersRound, X } from 'lucide-react'
import { QrScanner } from '@/components/tutor/qr-scanner'
import { Button } from '@/components/ui/button'
import { getLine } from '@/lib/experiments'
import type { Roster } from '@/lib/assignments'
import { cn } from '@/lib/utils'

type TutorOption = { name: string; role: string }

type TutorIdentity = { name: string; role: string }

const STORAGE_KEY = 'openvolta_tutor'
const SEEN_KEY = 'openvolta_seen_groups'

function rememberSeen(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // Storage non disponibile: nessun problema, si riparte dai gruppi attuali.
  }
}

async function fetchRoster(url: string): Promise<Roster> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Elenco non disponibile')
  return response.json() as Promise<Roster>
}

export function TutorBoard({ tutors, identity }: { tutors: TutorOption[]; identity?: TutorIdentity }) {
  const [tutorName, setTutorName] = useState<string>(identity?.name ?? tutors[0]?.name ?? '')
  const [scanOpen, setScanOpen] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ name: string; stations: string } | null>(null)
  const [permission, setPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('unsupported')
  const seenGroups = useRef<Set<string> | null>(null)
  const identityName = identity?.name

  useEffect(() => {
    if (identity) {
      setTutorName(identity.name)
      return
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && tutors.some((tutor) => tutor.name === saved)) setTutorName(saved)
    } catch {
      // Storage non disponibile: si parte dal primo tutor.
    }
  }, [tutors, identity])

  const { data, error, mutate } = useSWR<Roster>(
    tutorName ? `/api/tutor/roster?tutor=${encodeURIComponent(tutorName)}` : null,
    fetchRoster,
    { refreshInterval: 4000, revalidateOnFocus: true },
  )

  // Cambiando tutor si ricomincia a osservare la sua lista.
  useEffect(() => {
    seenGroups.current = null
  }, [tutorName])

  useEffect(() => {
    setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 15000)
    return () => clearTimeout(timer)
  }, [notice])

  // Avvisa il tutor quando nel suo elenco compare un gruppo nuovo.
  useEffect(() => {
    if (!identityName || !data || data.tutor.name !== identityName) return

    const key = `${SEEN_KEY}:${identityName}`
    const ids = data.groups.map((group) => group.id)

    const announce = (groups: Roster['groups']) => {
      const first = groups[0]
      const label = groups.length === 1
        ? first.name
        : `${groups.length} gruppi: ${groups.map((group) => group.name).join(', ')}`
      const stations = first.stations.map((station) => station.code).join(' · ')

      setNotice({ name: label, stations })

      // Su alcuni browser (es. mobile) il costruttore Notification non è utilizzabile:
      // le notifiche OS vanno mostrate tramite ServiceWorkerRegistration.showNotification.
      // Qui l'avviso in-app (notice) resta comunque visibile; la notifica OS è un extra.
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('Nuovo gruppo assegnato', {
            body: stations ? `${label} — ${stations}` : label,
            tag: 'openvolta-nuovo-gruppo',
          })
        } catch {
          // Costruttore non disponibile in questo contesto: ignoro, l'avviso in-app resta.
        }
      }
    }

    if (seenGroups.current === null) {
      let stored: string[] | null = null
      try {
        stored = JSON.parse(localStorage.getItem(key) ?? 'null') as string[] | null
      } catch {
        stored = null
      }

      const known = new Set(stored ?? [])
      seenGroups.current = new Set(ids)
      rememberSeen(key, ids)

      // Alla prima visita non si avvisa: si avvisa quando il gruppo è davvero nuovo.
      if (stored) {
        const fresh = data.groups.filter((group) => !known.has(group.id))
        if (fresh.length > 0) announce(fresh)
      }
      return
    }

    const fresh = data.groups.filter((group) => !seenGroups.current!.has(group.id))
    if (fresh.length === 0) return

    for (const group of fresh) seenGroups.current.add(group.id)
    rememberSeen(key, [...seenGroups.current])
    announce(fresh)
  }, [data, identityName])

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return
    setPermission(await Notification.requestPermission())
  }

  function chooseTutor(next: string) {
    setTutorName(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignora.
    }
  }

  const handleDetected = useCallback(async (value: string) => {
    setScanOpen(false)
    setScanError(null)
    setPending(true)
    try {
      const response = await fetch('/api/tutor/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: value }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) {
        setScanError(result.error ?? 'Non riesco a leggere questo codice.')
        return
      }
      await mutate()
    } catch {
      setScanError('Controlla la connessione e riprova.')
    } finally {
      setPending(false)
    }
  }, [mutate])

  async function setCompleted(id: string, completed: boolean) {
    setPending(true)
    setScanError(null)
    try {
      const response = await fetch('/api/tutor/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completed }),
      })
      if (!response.ok) {
        const result = await response.json() as { error?: string }
        setScanError(result.error ?? 'Non siamo riusciti a chiudere il turno.')
        return
      }
      await mutate()
    } catch {
      setScanError('Controlla la connessione e riprova.')
    } finally {
      setPending(false)
      setConfirmId(null)
    }
  }

  return (
    <div>
      {identity ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
          <span className="display flex size-12 items-center justify-center rounded-lg bg-foreground text-lg text-background">
            {identity.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-lg font-bold">{identity.name}</p>
            <p className="text-sm text-muted-foreground">{identity.role}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {permission === 'granted' ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                <BellRing className="size-4" aria-hidden="true" />
                Avvisi attivi
              </span>
            ) : permission === 'default' ? (
              <Button type="button" variant="outline" onClick={enableNotifications} className="h-10 rounded-md text-sm">
                <Bell aria-hidden="true" />
                Attiva avvisi
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div role="group" aria-label="Seleziona il tutor" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {tutors.map((tutor) => {
            const selected = tutor.name === tutorName
            return (
              <button
                key={tutor.name}
                type="button"
                aria-pressed={selected}
                onClick={() => chooseTutor(tutor.name)}
                className={cn(
                  'flex min-h-16 flex-col items-start justify-center gap-1 rounded-xl border-2 bg-card p-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                  selected ? 'border-foreground bg-giallo' : 'hover:bg-muted',
                )}
              >
                <span className="text-sm font-bold leading-tight">{tutor.name}</span>
                <span className="text-sm text-muted-foreground">{tutor.role}</span>
              </button>
            )
          })}
        </div>
      )}

      <section className="mt-6 rounded-xl border-2 border-foreground bg-giallo p-5 text-giallo-foreground">
        <h2 className="display-sm flex items-center gap-2 text-xl">
          <ScanLine className="size-5" aria-hidden="true" />
          Scansiona il QR del biglietto
        </h2>
        <p className="mt-2 max-w-2xl text-base leading-snug">
          La presenza si registra solo dal biglietto: inquadra il codice con la fotocamera oppure scrivi le otto
          lettere stampate sotto il QR.
        </p>
        <Button
          type="button"
          size="lg"
          onClick={() => {
            setScanError(null)
            setScanOpen(true)
          }}
          className="mt-4 h-12 w-full rounded-md bg-foreground px-5 text-base font-bold text-background sm:w-auto"
        >
          <ScanLine aria-hidden="true" />
          Scansiona il QR
        </Button>
      </section>

      {pending && !scanOpen && (
        <p className="mt-4 inline-flex items-center gap-2 text-base text-muted-foreground" aria-live="polite">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Controllo il codice…
        </p>
      )}

      {scanError && (
        <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-base text-destructive">
          {scanError}
        </p>
      )}

      {error && <p role="alert" className="mt-5 rounded-lg bg-destructive/10 p-3 text-base text-destructive">L’ultimo aggiornamento non è riuscito. L’elenco resta quello precedente.</p>}

      {data && (
        <section className="mt-8" aria-labelledby="groups-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="groups-title" className="display-sm text-2xl">I tuoi gruppi</h2>
            <p className="text-base text-muted-foreground">
              {data.groups.length} {data.groups.length === 1 ? 'gruppo' : 'gruppi'} · {data.people} persone
            </p>
          </div>

          {data.groups.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-dashed p-4 text-base text-muted-foreground">
              <UsersRound className="size-5" aria-hidden="true" />
              Nessun gruppo assegnato: la regia te lo assegna quando arrivano.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {data.groups.map((group) => {
                const arrived = group.status === 'arrived'
                const completed = Boolean(group.completedAt)
                return (
                  <li key={group.id} className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', completed ? 'bg-secondary text-muted-foreground' : arrived ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground')}>
                          {completed ? <Flag className="size-4" aria-hidden="true" /> : arrived ? <Check className="size-4" aria-hidden="true" /> : <UsersRound className="size-4" aria-hidden="true" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-lg font-bold">
                            {group.name}
                            {group.groupSize > 1 ? ` · ${group.groupSize} persone` : ' · 1 persona'}
                          </p>
                          <p className="text-sm text-muted-foreground">{group.stations.length} tappe</p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-md px-3 py-2 text-sm font-bold',
                          completed
                            ? 'bg-secondary text-muted-foreground'
                            : arrived
                              ? 'bg-foreground text-background'
                              : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        {completed ? 'Turno terminato' : arrived ? 'Presente' : 'In attesa del QR'}
                      </span>
                    </div>

                    <ol className="mt-4 flex flex-col gap-2">
                      {group.stations.map((station, index) => {
                        const line = getLine(station.accent)
                        return (
                          <li key={station.slug} data-line={line.accent} className="flex items-center gap-3 rounded-lg bg-line-soft p-2.5">
                            <span className="display flex size-9 shrink-0 items-center justify-center rounded-md bg-line text-sm text-line-foreground">
                              {station.code}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-bold leading-tight">{station.title}</span>
                              <span className="block text-sm text-muted-foreground">{station.room}</span>
                            </span>
                            <span className="text-sm font-bold tabular-nums">{index + 1}</span>
                          </li>
                        )
                      })}
                    </ol>

                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                      {confirmId === group.id ? (
                        <>
                          <p className="mr-auto text-sm font-bold">Terminare il turno di {group.name}?</p>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={pending}
                            onClick={() => setConfirmId(null)}
                            className="h-10 rounded-md text-sm"
                          >
                            Annulla
                          </Button>
                          <Button
                            type="button"
                            disabled={pending}
                            onClick={() => setCompleted(group.id, true)}
                            className="h-10 rounded-md text-sm"
                          >
                            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Flag aria-hidden="true" />}
                            Sì, termina
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setConfirmId(group.id)}
                          className="h-10 rounded-md text-sm"
                        >
                          <Flag aria-hidden="true" />
                          Termina turno
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {scanOpen && <QrScanner onDetected={handleDetected} onClose={() => setScanOpen(false)} />}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="notice-enter fixed inset-x-3 bottom-4 z-50 mx-auto max-w-xl rounded-2xl border-4 border-giallo bg-foreground p-5 text-background shadow-[0_12px_40px_rgba(0,0,0,0.5)] ring-4 ring-foreground/30 sm:p-6"
        >
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-giallo text-giallo-foreground">
              <BellRing className="notice-bell size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold uppercase tracking-[0.14em] text-giallo">Nuovo gruppo assegnato</p>
              <p className="mt-1 text-2xl font-bold leading-tight">{notice.name}</p>
              {notice.stations && <p className="mt-2 text-base font-semibold">Tappe: {notice.stations}</p>}
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Chiudi la notifica"
              className="rounded-md p-2 hover:bg-background/10"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
