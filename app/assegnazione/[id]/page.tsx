import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { ArrowLeft, MapPin } from 'lucide-react'
import { ArrivalStatus } from '@/components/assignment/arrival-status'
import { Badge } from '@/components/assignment/badge'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { getAssignment } from '@/lib/assignments'
import { getExperiment } from '@/lib/experiments'
import { formatScanCode } from '@/lib/scan-codes'

export const metadata: Metadata = {
  title: 'Il tuo giro',
  description: 'Laboratori e tutor per il tuo giro all’open day.',
}

export const dynamic = 'force-dynamic'
export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const assignment = await getAssignment(id)

  if (!assignment) notFound()

  const { participant, station } = assignment
  const stops = assignment.stops
  const firstExperiment = getExperiment(stops[0]?.slug ?? station.slug)
  // Il QR contiene solo il codice del biglietto: niente link, niente indirizzi da aggiornare.
  const qr = await QRCode.toDataURL(participant.scanCode, {
    width: 180,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#141c3a', light: '#ffffff' },
  })
  const tutorName = participant.assignedTutorName ?? 'Da assegnare'

  // Colore casuale unico per biglietto, deterministico su id.
  // Luminosità ≥ 60% e saturazione ≤ 50% per testo bianco leggibile.
  const seed = hashString(id)
  const hue = seed % 360
  const sat = 35 + (seed % 20) // 35-55%
  const light = 60 + (seed % 15) // 60-75%
  const color = `hsl(${hue},${sat}%,${light}%)`

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-[#F4F7FB]">
      <header className="shrink-0 border-b">
        <div className="mx-auto flex h-11 max-w-[680px] items-center justify-between gap-3 px-4 sm:px-6">
          <Brand className="[&_svg]:size-6 [&_span]:text-sm sm:[&_svg]:size-7 sm:[&_span]:text-base" />
          <Button nativeButton={false} render={<Link href="/join" />} variant="ghost" className="h-8 rounded-full px-3 text-xs shadow-sm sm:h-9 sm:px-4 sm:text-sm">
            <ArrowLeft aria-hidden="true" className="mr-1.5" />
            Nuova iscrizione
          </Button>
        </div>
      </header>

      <main id="main-content" className="flex min-h-0 flex-1 flex-col pb-2 pt-1 sm:pb-4 sm:pt-2">
        <div className="mx-auto flex min-h-0 w-full max-w-[428px] flex-1 flex-col sm:max-w-[680px]">
          <article className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/40 bg-white/80 shadow-[0_16px_36px_-12px_rgba(0,0,0,0.14),0_4px_16px_-2px_rgba(0,0,0,0.04)] backdrop-blur-sm sm:shadow-xl">
            {/* Header colorato: saluto + titolo + contatori */}
            <div style={{ background: color }} className="shrink-0 rounded-t-2xl px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-white/90">Ciao, {participant.displayName}</p>
                  <h1 className="display mt-0.5 text-2xl sm:text-3xl text-white">Il tuo giro</h1>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5 text-sm font-bold text-white/90 shadow-[0_1px_0_0_rgba(0,0,0,0.08)] sm:col-start-auto sm:gap-2 sm:text-base">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-4 sm:size-5" aria-hidden="true" />
                    {participant.groupSize}{participant.groupSize === 1 ? ' persona' : ' persone'}
                  </span>
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(0,0,0,0.08)] sm:px-3 sm:py-1.5">
                    {stops.length} {stops.length === 1 ? 'tappa' : 'tappe'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
              {/* Blocco meta: QR | Codice | Tutor sotto il codice */}
              <div className="flex min-h-0 flex-col gap-2.5">
                {/* QR a sinistra, Codice e tutor nella colonna a destra */}
                <div className="flex items-start gap-3">
                  {/* QR — cerchio bianco con ombreggiatura */}
                  <div className="flex w-28 flex-col items-center gap-1.5 rounded-2xl bg-white p-2.5 shadow-[0_3px_8px_-2px_rgba(0,0,0,0.08)] sm:w-32 sm:p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500">Il tuo biglietto</p>
                    <div className="flex size-28 items-center justify-center rounded-full bg-white shadow-[0_3px_10px_-2px_rgba(0,0,0,0.12)] sm:size-32">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr} alt="Codice del biglietto da mostrare al tutor" className="aspect-square w-full" />
                    </div>
                    <p className="text-xs text-gray-500">Mostra al tutor</p>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    {/* Codice breve — box con il codice letterale (es. 3yft-q33l) */}
                    <div className="flex min-w-0 flex-1 flex-row items-center gap-2 rounded-2xl border border-white/60 bg-white shadow-[0_1px_4px_-1px_rgba(0,0,0,0.04)] sm:rounded-2xl sm:border sm:p-3">
                      <p className="min-w-0 flex-1 text-xs font-bold uppercase tracking-[0.15em] text-gray-500">Codice</p>
                      <p className="text-lg font-bold tracking-[0.18em] tabular-nums text-[#141C3A]">{formatScanCode(participant.scanCode)}</p>
                    </div>

                    {/* Il tuo tutor — sotto il box del codice */}
                    <div className="flex flex-col gap-1.5 rounded-2xl border border-white/60 bg-white shadow-[0_1px_4px_-1px_rgba(0,0,0,0.04)] sm:rounded-2xl sm:border sm:p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Il tuo tutor</p>
                      <p className="text-lg font-bold leading-tight text-[#141C3A]">{tutorName}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tappe: SOLO questo container scrolla se necessario */}
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto space-y-2">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500 sm:text-xs">Le tappe del tuo giro</h2>
                <ol className="space-y-2">
                  {stops.map((stop, index) => (
                    <li key={stop.slug} className="flex items-start gap-3 overflow-hidden rounded-2xl bg-white p-3 shadow-[0_3px_10px_-2px_rgba(0,0,0,0.06)] sm:gap-4 sm:p-4">
                      {/* Badge tappa con il colore del laboratorio */}
                      <Badge stop={stop} />
                      <div className="min-w-0 flex-1">
                        <span className="block font-bold text-base leading-tight text-[#141C3A]">{stop.title}</span>
                        <span className="block text-xs leading-tight text-gray-500">{stop.room}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-gray-500">
                          {index === 0 ? stop.directions : stop.meetingPoint}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </article>

          {/* Nota finale — stile discreto */}
          <p className="mt-2 text-xs leading-snug text-gray-500 sm:mt-3 sm:text-sm">
            Conserva questo link. Se ti perdi, torna all'accoglienza e mostra il codice.
          </p>
        </div>
      </main>
    </div>
  )
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}