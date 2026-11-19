import Link from 'next/link'
import { Home, MapPinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

const REDIRECT_SECONDS = 6

export function TripEnded({ reason }: { reason: 'completed' | 'missing' }) {
  return (
    <main id="main-content" className="section-shell flex min-h-svh items-center justify-center py-10">
      {/* Redirect affidabile anche senza JavaScript. */}
      <meta httpEquiv="refresh" content={`${REDIRECT_SECONDS}; url=/`} />

      <div className="w-full max-w-xl rounded-xl border bg-card p-6 text-center shadow-sm sm:p-9">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary">
          <MapPinOff className="size-6" aria-hidden="true" />
        </span>
        <h1 className="display mt-4 text-[clamp(1.9rem,6vw,2.8rem)] leading-tight">Viaggio terminato</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
          {reason === 'completed'
            ? 'Questo gruppo ha già concluso il giro: il biglietto non serve più.'
            : 'Questo biglietto non è più attivo: non risulta nella bacheca dei gruppi.'}
        </p>
        <p className="mt-4 text-sm font-bold">Ti riportiamo alla home tra {REDIRECT_SECONDS} secondi.</p>
        <Button nativeButton={false} render={<Link href="/" />} size="lg" className="mt-6 h-12 rounded-md px-6 text-base font-bold">
          <Home aria-hidden="true" />
          Torna alla home adesso
        </Button>
      </div>
    </main>
  )
}
