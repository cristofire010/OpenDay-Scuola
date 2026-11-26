import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { Clock, MapPin } from 'lucide-react'
import { Brand } from '@/components/brand'
import { Badge } from '@/components/assignment/badge'
import { TicketCompletionWatcher } from '@/components/assignment/ticket-completion-watcher'
import { TripEnded } from '@/components/assignment/trip-ended'
import { getAssignment, getQueueStatus } from '@/lib/assignments'
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

  // Turno concluso: il biglietto non è "sparito", è stato completato. Mostriamo
  // uno stato esplicito invece della generica pagina "biglietto non trovato".
  if (assignment.participant.completedAt) return <TripEnded reason="completed" />

  const { participant, station } = assignment
  const stops = assignment.stops

  const queueStatus = await getQueueStatus(id)
  const isQueued = queueStatus?.queued ?? false
  const queuePosition = queueStatus?.position ?? 1
  const tutorName = isQueued
    ? 'In attesa di un tutor libero'
    : participant.assignedTutorName ?? 'Da assegnare'

  const firstExperiment = getExperiment(stops[0]?.slug ?? station.slug)
  // Il QR contiene solo il codice del biglietto: niente link, niente indirizzi da aggiornare.
  const qr = await QRCode.toDataURL(participant.scanCode, {
    width: 180,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#141c3a', light: '#ffffff' },
  })

  // Colore casuale unico per biglietto, deterministico su id.
  // Luminosità ≥ 60% e saturazione ≤ 50% per testo bianco leggibile.
  const seed = hashString(id)
  const hue = seed % 360
  const sat = 35 + (seed % 20) // 35-55%
  const light = 60 + (seed % 15) // 60-75%
  const color = `hsl(${hue},${sat}%,${light}%)`

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <TicketCompletionWatcher id={id} />
      <header className="border-b bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[820px] items-center px-4 sm:px-6">
          <Brand className="[&_svg]:size-6 [&_span]:text-sm sm:[&_svg]:size-7 sm:[&_span]:text-base" />
        </div>
      </header>

      <main id="main-content" className="flex min-h-0 flex-1 flex-col pb-6 pt-4 sm:pb-8 sm:pt-6">
        <div className="mx-auto flex min-h-0 w-full max-w-[820px] flex-1 flex-col sm:max-w-none">
          <div className="mx-4 sm:mx-8">
            <h1 className="mb-3 text-center text-[clamp(1.6rem,4vw,2.4rem)] font-bold tracking-tight text-[#141C3A] sm:text-left sm:text-3xl">
              Il tuo biglietto
            </h1>
            <p className="mb-4 text-center text-sm text-gray-500 sm:text-left sm:text-base">
              Mostra questo biglietto al tutor quando arrivi al laboratorio.
            </p>

            {isQueued && (
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-amber-800 sm:mb-6 sm:p-5">
                <Clock className="shrink-0 size-5 text-amber-600" aria-hidden="true" />
                <p className="text-sm font-semibold sm:text-base">
                  Sei in coda, posizione <span className="tabular-nums font-bold" data-queue-position>{queuePosition}</span>.
                  Il tuo tutor ti verrà assegnato automaticamente: mostra questo biglietto quando sei chiamato.
                </p>
              </div>
            )}

            <div className="overflow-hidden rounded-3xl bg-white/90 p-4 shadow-[0_8px_24px_-8px_rgba(20,28,58,0.16),0_4px_8px_-2px_rgba(20,28,58,0.06)] sm:p-6 sm:shadow-[0_16px_36px_-16px_rgba(20,28,58,0.22)]">
              {/* Header colorato: saluto + titolo + contatori */}
              <div style={{ background: color }} className="mx-0 mb-0 shrink-0 rounded-t-2xl px-4 py-4 sm:mx-0 sm:px-6 sm:py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-white/90">Ciao, {participant.displayName}</p>
                    <h2 className="display mt-0.5 text-2xl sm:text-3xl text-white">Il tuo giro</h2>
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

              <div className="mx-0 flex items-center justify-between gap-3 border-b-2 border-[#EEF1F6] bg-[#F8FAFD] px-4 py-3 sm:px-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#14339E]">Percorso assegnato</p>
                <p className="text-sm font-bold text-[#141C3A]">{stops.length} {stops.length === 1 ? 'tappa' : 'tappe'} da completare</p>
              </div>

              <div className="mx-0 grid gap-5 px-1 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(130px,0.38fr)] sm:items-start sm:px-2 sm:py-6">
                <div className="min-w-0">
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 sm:text-xs">Le tappe del tuo giro</h3>
                  <ol>
                    {stops.map((stop, index) => (
                      <li key={stop.slug} className="flex items-start gap-3 border-b-2 border-[#EEF1F6] py-3 last:border-b-0 first:pt-1 sm:gap-4 sm:py-4">
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

                {/* QR — a destra, centrato verticalmente */}
                <div className="flex flex-col items-center justify-center gap-2 border-t-2 border-[#EEF1F6] pt-5 sm:border-l-2 sm:border-t-0 sm:pl-5 sm:pt-0">
                  <div className="flex w-full max-w-[138px] items-center justify-center rounded-2xl bg-[#F8FAFD] p-3 shadow-[0_4px_12px_-4px_rgba(20,28,58,0.14)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt="Codice del biglietto da mostrare al tutor" className="aspect-square w-full" />
                  </div>
                  <p className="text-xs font-semibold text-gray-500">Mostra al tutor</p>
                </div>
              </div>

              {/* Da mostrare al tutor — codice + nome tutor */}
              <div className="mx-0 grid gap-3 border-t-2 border-[#EEF1F6] bg-[#F8FAFD] px-4 py-4 sm:grid-cols-2 sm:items-center sm:px-6 sm:py-5">
                <div className="min-w-0">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 sm:text-xs">Tutor assegnato</p>
                  {isQueued ? (
                    <p className="text-lg font-bold leading-tight text-gray-400">
                      In attesa <span className="tabular-nums text-base" data-queue-position>{queuePosition}</span>ª in coda
                    </p>
                  ) : (
                    <p className="text-lg font-bold leading-tight text-[#141C3A]">{tutorName}</p>
                  )}
                </div>
                <div className="border-t-2 border-[#EEF1F6] pt-3 sm:border-l-2 sm:border-t-0 sm:pl-5 sm:pt-0">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 sm:text-xs">Il tuo codice</p>
                  <p className="text-xl font-bold tracking-[0.16em] tabular-nums text-[#141C3A]">{formatScanCode(participant.scanCode)}</p>
                </div>
              </div>
            </div>

            {/* Nota finale — stile discreto */}
            <p className="mt-3 text-xs leading-snug text-gray-500 sm:mt-4 sm:text-sm">
              Conserva questo link. Se ti perdi, torna all'accoglienza e mostra il codice.
            </p>
          </div>
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
