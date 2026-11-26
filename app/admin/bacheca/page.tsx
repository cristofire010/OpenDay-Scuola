import type { Metadata } from 'next'
import Link from 'next/link'
import { KeyRound, Megaphone, ShieldCheck, UsersRound } from 'lucide-react'
import { Brand } from '@/components/brand'
import { LogoutButton } from '@/components/auth/logout-button'
import { BulletinManager } from '@/components/admin/bulletin-manager'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { listBulletinMessages } from '@/lib/bulletin'

export const metadata: Metadata = {
  title: 'Bacheca',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function BachecaPage() {
  await requireRole('staff', '/admin/bacheca')
  const messages = await listBulletinMessages()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="section-shell flex h-[72px] items-center justify-between gap-4">
          <Brand />
          <div className="flex items-center gap-1.5">
            <Button nativeButton={false} render={<Link href="/admin/bacheca" />} variant="outline" className="h-10 rounded-lg font-bold border-foreground bg-foreground/5">
              <Megaphone aria-hidden="true" />
              Bacheca
            </Button>
            <Button nativeButton={false} render={<Link href="/admin" />} variant="ghost" className="h-10 rounded-lg">
              <KeyRound aria-hidden="true" />
              Accessi tutor
            </Button>
            <Button nativeButton={false} render={<Link href="/admin/gruppi" />} variant="ghost" className="h-10 rounded-lg">
              <UsersRound aria-hidden="true" />
              Gestione gruppi
            </Button>
            <LogoutButton redirectTo="/admin/accesso" />
          </div>
        </div>
      </header>

      <main id="main-content" className="section-shell py-8 sm:py-10 lg:py-12">
        <p className="inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-sm font-bold text-background">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Area riservata
        </p>
        <h1 className="display mt-4 text-[clamp(2rem,3.8vw,3.2rem)]">Bacheca</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Crea e gestisci le comunicazioni che i tutor vedono nella loro area. Solo lo staff può pubblicare: i tutor
          leggono e basta.
        </p>

        <div className="mt-8">
          <BulletinManager initialMessages={messages} />
        </div>
      </main>
    </div>
  )
}
