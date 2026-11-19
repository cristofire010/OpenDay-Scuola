import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { ArchiveManager } from '@/components/staff/archive-manager'
import { Brand } from '@/components/brand'
import { LogoutButton } from '@/components/auth/logout-button'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { listArchive } from '@/lib/archive'

export const metadata: Metadata = {
  title: 'Archivio turni',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function ArchivePage() {
  await requireRole('staff', '/archivio')
  const archive = await listArchive()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="section-shell flex h-[72px] items-center justify-between gap-4">
          <Brand />
          <div className="flex items-center gap-1">
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
          Solo regia
        </p>
        <h1 className="display mt-4 text-[clamp(2rem,3.8vw,3.2rem)]">Turni terminati</h1>

        <div className="mt-8">
          <ArchiveManager groups={archive.groups} purgeDays={archive.purgeDays} />
        </div>
      </main>
    </div>
  )
}
