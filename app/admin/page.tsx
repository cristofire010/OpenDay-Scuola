import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, KeyRound, ShieldCheck, UsersRound } from 'lucide-react'
import { Brand } from '@/components/brand'
import { LogoutButton } from '@/components/auth/logout-button'
import { TutorAccountsManager } from '@/components/admin/tutor-accounts-manager'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { listTutorAccounts } from '@/lib/tutor-accounts'

export const metadata: Metadata = {
  title: 'Accessi tutor',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'
export default async function AdminPage() {
  await requireRole('staff', '/admin')
  const accounts = await listTutorAccounts()

  const serialized = accounts.map((account) => ({
    ...account,
    lastLoginAt: account.lastLoginAt ? account.lastLoginAt.toISOString() : null,
    createdAt: account.createdAt.toISOString(),
  }))

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="section-shell flex h-[72px] items-center justify-between gap-4">
          <Brand />
          <div className="flex items-center gap-1.5">
            <Button nativeButton={false} render={<Link href="/admin" />} variant="outline" className="h-10 rounded-lg font-bold border-foreground bg-foreground/5">
              <KeyRound aria-hidden="true" />
              Accessi tutor
            </Button>
            <Button nativeButton={false} render={<Link href="/admin/gruppi" />} variant="ghost" className="h-10 rounded-lg">
              <UsersRound aria-hidden="true" />
              Gestione gruppi
            </Button>
            <Button nativeButton={false} render={<Link href="/staff" />} variant="ghost" className="h-10 rounded-lg">
              <ArrowLeft aria-hidden="true" />
              Regia
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
        <h1 className="display mt-4 text-[clamp(2rem,3.8vw,3.2rem)]">Accessi tutor</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          I tutor sono le persone che accompagnano i gruppi. Ogni tutor entra con nome utente e password: qui puoi
          creare gli account, cambiare la password, disattivarli o eliminarli.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <KeyRound className="size-4" aria-hidden="true" />
          Questa pagina non è linkata dal sito: aprila digitando “admin” dalla home.
        </p>

        <div className="mt-8">
          <TutorAccountsManager accounts={serialized} />
        </div>
      </main>
    </div>
  )
}
