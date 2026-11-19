import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Brand } from '@/components/brand'
import { AdminLoginForm } from '@/components/auth/admin-login-form'
import { Button } from '@/components/ui/button'
import { getSession, isStaffLoginConfigured, safeNextPath } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Accesso riservato',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminAccessPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getSession()
  if (session?.role === 'staff') redirect('/admin')

  const { next } = await searchParams
  const requested = safeNextPath(next)
  const target = requested.startsWith('/admin') || requested.startsWith('/staff') ? requested : '/admin'

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="section-shell flex h-[72px] items-center justify-between gap-4">
          <Brand />
          <Button nativeButton={false} render={<Link href="/" />} variant="ghost" className="h-10 rounded-lg">
            <ArrowLeft aria-hidden="true" />
            Torna al sito
          </Button>
        </div>
      </header>
      <main id="main-content" className="section-shell flex justify-center py-12 sm:py-20">
        <div className="w-full max-w-md">
          <p className="inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-sm font-bold text-background">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Area riservata
          </p>
          <h1 className="display mt-4 text-3xl sm:text-4xl">Accesso riservato</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">Inserisci la password di accesso.</p>

          {!isStaffLoginConfigured() && (
            <p role="alert" className="mt-6 flex gap-3 rounded-xl bg-giallo p-4 text-base text-giallo-foreground">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              L’accesso riservato non è configurato. Imposta STAFF_PASSWORD nelle variabili d’ambiente del server.
            </p>
          )}

          <div className="mt-8 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
            <AdminLoginForm next={target} />
          </div>
        </div>
      </main>
    </div>
  )
}
