import type { Metadata } from 'next'
import Link from 'next/link'
import QRCode from 'qrcode'
import { ExternalLink, QrCode } from 'lucide-react'
import { Brand } from '@/components/brand'
import { LogoutButton } from '@/components/auth/logout-button'
import { StaffDashboard } from '@/components/staff/staff-dashboard'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { getStaffOverview } from '@/lib/assignments'
import { getLine } from '@/lib/experiments'
import { getOrigin } from '@/lib/request'

export const metadata: Metadata = {
  title: 'Regia staff',
  description: 'QR di accesso e occupazione delle postazioni dell’open day.',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

const qrOptions = {
  width: 320,
  margin: 2,
  errorCorrectionLevel: 'M' as const,
  color: { dark: '#141c3a', light: '#ffffff' },
}

export default async function StaffPage() {
  await requireRole('staff', '/staff')
  const origin = await getOrigin()
  const overview = await getStaffOverview()
  const joinUrl = origin
  const genericQr = await QRCode.toDataURL(joinUrl, qrOptions)
  const stationQrs = await Promise.all(
    overview.stations.map(async (station) => {
      const url = `${joinUrl}?esperimento=${encodeURIComponent(station.slug)}`
      return {
        ...station,
        url,
        qr: await QRCode.toDataURL(url, { ...qrOptions, width: 240 }),
      }
    }),
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="section-shell flex h-[72px] items-center justify-between gap-4">
          <Brand />
          <div className="flex items-center gap-1">
            <Link href="/archivio" className="rounded-lg px-3 py-2 text-base font-bold hover:bg-muted">Archivio</Link>
            <Link href="/admin" className="rounded-lg px-3 py-2 text-base font-bold hover:bg-muted">Accessi tutor</Link>
            <Link href="/tutor" className="rounded-lg px-3 py-2 text-base font-bold hover:bg-muted">Vista tutor</Link>
            <LogoutButton redirectTo="/admin/accesso" />
          </div>
        </div>
      </header>
      <main id="main-content" className="section-shell py-8 sm:py-10 lg:py-12">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="display text-[clamp(2rem,3.8vw,3.2rem)]">Regia OpenVolta</h1>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">Stampa o mostra i QR, poi segui l’occupazione dei laboratori. I partecipanti ricevono subito il giro e il tutor.</p>
          </div>
          <Button nativeButton={false} render={<Link href="/join" />} variant="outline" size="lg" className="h-11 rounded-md px-5">
            Prova come partecipante
            <ExternalLink data-icon="inline-end" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-9">
          <StaffDashboard initialOverview={overview} />
        </div>

        <section className="mt-14 border-t pt-10" aria-labelledby="qr-title">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-giallo text-giallo-foreground">
              <QrCode className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="qr-title" className="display-sm text-2xl">QR per l’accoglienza</h2>
              <p className="mt-1 text-base leading-snug text-muted-foreground">Il QR generale lascia scegliere; quelli delle postazioni preselezionano l’esperimento.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
            <article className="rounded-2xl bg-giallo p-6 text-giallo-foreground sm:p-8">
              <h3 className="display text-3xl">Inquadra. Scegli. Parti.</h3>
              <div className="mx-auto mt-6 max-w-xs rounded-xl bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={genericQr} alt="QR code per aprire la scelta dell’esperimento" width={320} height={320} className="aspect-square w-full" />
              </div>
              <a href={joinUrl} className="mt-5 block break-all rounded-lg bg-foreground/10 px-3 py-2 text-center text-sm font-bold underline-offset-4 hover:underline">{joinUrl}</a>
              {origin.includes('localhost') && <p className="mt-3 text-sm leading-snug">Per inquadrarlo da un telefono imposta SITE_URL con l’indirizzo pubblico del sito.</p>}
            </article>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {stationQrs.map((station) => (
                <article key={station.slug} data-line={getLine(station.accent).accent} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <span className="display flex size-11 items-center justify-center rounded-md bg-line text-lg text-line-foreground">{station.code}</span>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold">{station.title}</h3>
                      <p className="truncate text-sm text-muted-foreground">{station.guideName}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={station.qr} alt={`QR code per ${station.title}`} width={240} height={240} className="aspect-square w-full" />
                  </div>
                  <a href={station.url} className="mt-3 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-bold hover:bg-muted">
                    Apri il link
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
