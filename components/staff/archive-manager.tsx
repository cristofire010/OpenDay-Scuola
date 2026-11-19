'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ArchivedGroup } from '@/lib/archive'

const dateFormat = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' })

async function readError(response: Response) {
  try {
    const body = await response.json() as { error?: string }
    return body.error ?? 'Operazione non riuscita.'
  } catch {
    return 'Operazione non riuscita.'
  }
}

export function ArchiveManager({ groups, purgeDays }: { groups: ArchivedGroup[]; purgeDays: number }) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; restore: boolean } | { id: 'all'; restore: false } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(id: string | null, action: 'restore' | 'delete' | 'empty') {
    setPending(id ?? 'all')
    setError(null)
    try {
      const response = action === 'restore'
        ? await fetch('/api/tutor/completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, completed: false }),
          })
        : await fetch(id ? `/api/staff/archive?id=${encodeURIComponent(id)}` : '/api/staff/archive', { method: 'DELETE' })

      if (!response.ok) {
        setError(await readError(response))
        return
      }

      router.refresh()
    } catch {
      setError('Controlla la connessione e riprova.')
    } finally {
      setPending(null)
      setConfirm(null)
    }
  }

  return (
    <section aria-labelledby="archive-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="archive-title" className="display-sm text-2xl">Archivio dei turni</h2>
          <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Qui finiscono i gruppi chiusi dai tutor: i tutor non li vedono più e i loro QR non vengono accettati.
            Dopo {purgeDays} giorni spariscono da soli; puoi anche eliminarli subito.
          </p>
        </div>
        {groups.length > 0 && (
          confirm && confirm.id === 'all' ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold">Svuotare tutto l’archivio?</p>
              <Button type="button" variant="outline" disabled={pending !== null} onClick={() => setConfirm(null)} className="h-10 rounded-md text-sm">
                Annulla
              </Button>
              <Button type="button" disabled={pending !== null} onClick={() => run(null, 'empty')} className="h-10 rounded-md text-sm">
                {pending === 'all' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                Sì, svuota
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirm({ id: 'all', restore: false })}
              className="h-10 rounded-md text-sm"
            >
              <Trash2 aria-hidden="true" />
              Svuota archivio
            </Button>
          )
        )}
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-base text-destructive">{error}</p>}

      {groups.length === 0 ? (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-dashed p-6 text-base text-muted-foreground">
          <Archive className="size-5" aria-hidden="true" />
          Ancora nessun turno archiviato.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {groups.map((group) => {
            const isOpenConfirm = confirm !== null && confirm.id !== 'all' && confirm.id === group.id
            return (
              <li key={group.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold">
                      {group.name}
                      {group.groupSize > 1 ? ` · ${group.groupSize} persone` : ' · 1 persona'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {group.tutorName ? `Tutor: ${group.tutorName}` : 'Senza tutor'} · chiuso il {dateFormat.format(new Date(group.completedAt))}
                    </p>
                  </div>
                  <span className="rounded-md bg-secondary px-2.5 py-1 text-sm font-bold tabular-nums">{group.code}</span>
                </div>

                {group.stations.length > 0 && (
                  <ol className="mt-3 flex flex-wrap gap-2">
                    {group.stations.map((station, index) => (
                      <li key={station.slug} className="rounded-md border px-2.5 py-1 text-sm">
                        <span className="font-bold">{station.code}</span> {station.title}
                        {index < group.stations.length - 1 && <span className="sr-only">, poi</span>}
                      </li>
                    ))}
                  </ol>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                  {isOpenConfirm ? (
                    <>
                      <p className="mr-auto text-sm font-bold">
                        {confirm.restore ? `Riaprire il turno di ${group.name}?` : `Eliminare ${group.name} dall’archivio?`}
                      </p>
                      <Button type="button" variant="outline" disabled={pending !== null} onClick={() => setConfirm(null)} className="h-10 rounded-md text-sm">
                        Annulla
                      </Button>
                      <Button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => run(group.id, confirm.restore ? 'restore' : 'delete')}
                        className="h-10 rounded-md text-sm"
                      >
                        {pending === group.id ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : confirm.restore ? <RotateCcw aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                        {confirm.restore ? 'Sì, riapri' : 'Sì, elimina'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending !== null}
                        onClick={() => setConfirm({ id: group.id, restore: true })}
                        className="h-10 rounded-md text-sm"
                      >
                        <RotateCcw aria-hidden="true" />
                        Ripristina
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending !== null}
                        onClick={() => setConfirm({ id: group.id, restore: false })}
                        className="h-10 rounded-md text-sm"
                      >
                        <Trash2 aria-hidden="true" />
                        Elimina
                      </Button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
