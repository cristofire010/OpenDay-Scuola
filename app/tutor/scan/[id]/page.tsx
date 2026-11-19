import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, MapPin, SearchX } from 'lucide-react'
import { Brand } from '@/components/brand'
import { ScanConfirm } from '@/components/tutor/scan-confirm'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { getAssignment } from '@/lib/assignments'
import { getLine } from '@/lib/experiments'

export const metadata: Metadata = {
  title: 'Conferma arrivo',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireRole('tutor', `/tutor/scan/${id}`)
  const assignment = await getAssignment(id)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="section-shell flex h-[72px] items-center justify-between gap-4">
          <Brand />
          <Button nativeButton={false} render={<Link href="/tutor" />} variant="ghost" className="h-10 rounded-md">
            <ArrowLeft aria-hidden="true" />
            Il tuo gruppo
          </Button>
        </div>
      </header>
      <main id="main-content" className="section-shell flex justify-center py-8 sm:py-14">
        <div className="w-full max-w-md">
          {!assignment ? (
            <div className="text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-lg bg-giallo text-giallo-foreground">
                <SearchX className="size-7" aria-hidden="true" />
              </span>
              <h1 className="display mt-6 text-3xl">Biglietto non trovato.</h1>
              <p className="mt-3 text-lg text-muted-foreground">Il codice non corrisponde a nessuna iscrizione. Chiedi al ragazzo di riaprire il biglietto.</p>
            </div>
          ) : (
            (() => {
              const { participant, station } = assignment
              const line = getLine(station.accent)
              return (
                <article data-line={line.accent} className="overflow-hidden rounded-2xl border bg-card">
                  <div className="flex items-end justify-between gap-4 bg-line p-6 text-line-foreground">
                    <div>
                      <p className="text-base font-bold">Partecipante</p>
                      <h1 className="display mt-1 text-3xl">{participant.displayName}</h1>
                    </div>
                    <span className="display text-6xl leading-none">{station.stationCode}</span>
                  </div>
                  <div className="p-6">
                    <p className="display-sm text-xl">{station.title}</p>
                    <p className="mt-3 flex items-center gap-2 text-base text-muted-foreground"><MapPin className="size-4" aria-hidden="true" />{station.room}</p>
                    <ScanConfirm id={participant.id} initialArrived={participant.status === 'arrived'} />
                  </div>
                </article>
              )
            })()
          )}
        </div>
      </main>
    </div>
  )
}
