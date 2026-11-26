import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ScanLine } from 'lucide-react'
import { Brand } from '@/components/brand'
import { LogoutButton } from '@/components/auth/logout-button'
import { BulletinBoard } from '@/components/tutor/bulletin-board'
import { TutorBoard } from '@/components/tutor/tutor-board'
import { requireRole } from '@/lib/auth'
import { getTutorAccount, listTutorAccounts } from '@/lib/tutor-accounts'

export const metadata: Metadata = {
  title: 'Area tutor',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function TutorPage() {
  const session = await requireRole('tutor', '/tutor')

  let tutors: Array<{ name: string; role: string }> = []
  let identity: { name: string; role: string } | undefined

  if (session.role === 'tutor') {
    const account = session.tutorId ? await getTutorAccount(session.tutorId) : null
    if (!account || !account.active) {
      redirect('/accesso?next=%2Ftutor')
    }

    identity = { name: account.displayName, role: 'Tutor' }
    tutors = [{ name: account.displayName, role: 'Tutor' }]
  } else {
    const accounts = await listTutorAccounts()
    tutors = accounts
      .filter((account) => account.active)
      .map((account) => ({ name: account.displayName, role: 'Tutor' }))
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="section-shell flex h-[72px] items-center justify-between gap-4">
          <Brand />
          <div className="flex items-center gap-1">
            <LogoutButton />
          </div>
        </div>
      </header>
      <main id="main-content" className="section-shell py-8 sm:py-10">
        <h1 className="display text-3xl sm:text-4xl">{identity ? `Ciao, ${identity.name.split(' ')[0]}` : 'Il tuo gruppo'}</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {identity
            ? 'Qui trovi i tuoi gruppi con i laboratori del giro. L’arrivo si registra solo scansionando il QR del biglietto.'
            : 'Scegli il tutor per vedere i suoi gruppi e i laboratori del giro. Gli arrivi si registrano scansionando il QR del biglietto.'}
        </p>
        <p className="mt-2 inline-flex items-center gap-2 text-base text-muted-foreground">
          <ScanLine className="size-4" aria-hidden="true" />
          La lista si aggiorna da sola ogni pochi secondi.
        </p>
        <div className="mt-8">
          <TutorBoard tutors={tutors} identity={identity} />
        </div>
        <div className="mt-12">
          <BulletinBoard canPublish={session.role === 'staff'} />
        </div>
      </main>
    </div>
  )
}
