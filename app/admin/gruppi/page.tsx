import type { Metadata } from 'next'
import Link from 'next/link'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { ArrowLeft, KeyRound, ShieldCheck, UsersRound } from 'lucide-react'
import { Brand } from '@/components/brand'
import { LogoutButton } from '@/components/auth/logout-button'
import { GroupManager, type ManagedGroup, type StationOption, type TutorOption } from '@/components/admin/group-manager'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { openDayParticipantStations, openDayParticipants, openDayStations, openDayTutorAccounts } from '@/lib/db/schema'

export const metadata: Metadata = {
  title: 'Gestione gruppi',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function GruppiPage() {
  await requireRole('staff', '/admin')

  // Recupera tutti i gruppi (attivi e conclusi)
  const participants = await db
    .select({
      id: openDayParticipants.id,
      name: openDayParticipants.displayName,
      code: openDayParticipants.scanCode,
      groupSize: openDayParticipants.groupSize,
      status: openDayParticipants.status,
      tutorName: openDayParticipants.assignedTutorName,
      createdAt: openDayParticipants.createdAt,
      arrivedAt: openDayParticipants.arrivedAt,
      completedAt: openDayParticipants.completedAt,
    })
    .from(openDayParticipants)
    .orderBy(desc(openDayParticipants.createdAt))

  const participantIds = participants.map((participant) => participant.id)
  const routeRows = participantIds.length > 0
    ? await db
        .select({
          participantId: openDayParticipantStations.participantId,
          slug: openDayStations.slug,
          code: openDayStations.stationCode,
          title: openDayStations.title,
        })
        .from(openDayParticipantStations)
        .innerJoin(openDayStations, eq(openDayParticipantStations.stationSlug, openDayStations.slug))
        .where(inArray(openDayParticipantStations.participantId, participantIds))
        .orderBy(asc(openDayParticipantStations.sortOrder))
    : []

  const stationsByParticipant = new Map<string, ManagedGroup['stations']>()
  for (const route of routeRows) {
    const stations = stationsByParticipant.get(route.participantId) ?? []
    stations.push({ slug: route.slug, code: route.code, title: route.title })
    stationsByParticipant.set(route.participantId, stations)
  }

  // Recupera stazioni disponibili
  const stationsList: StationOption[] = await db
    .select({
      slug: openDayStations.slug,
      code: openDayStations.stationCode,
      title: openDayStations.title,
      room: openDayStations.room,
      capacity: openDayStations.capacity,
    })
    .from(openDayStations)
    .where(eq(openDayStations.active, true))
    .orderBy(asc(openDayStations.sortOrder))

  // Recupera tutor disponibili
  const tutorsList: TutorOption[] = await db
    .select({
      id: openDayTutorAccounts.id,
      name: openDayTutorAccounts.displayName,
      username: openDayTutorAccounts.username,
      active: openDayTutorAccounts.active,
    })
    .from(openDayTutorAccounts)
    .orderBy(asc(openDayTutorAccounts.displayName))

  const groups: ManagedGroup[] = participants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    code: participant.code,
    groupSize: participant.groupSize,
    status: participant.status,
    tutorName: participant.tutorName,
    createdAt: participant.createdAt.toISOString(),
    arrivedAt: participant.arrivedAt?.toISOString() ?? null,
    completedAt: participant.completedAt?.toISOString() ?? null,
    stations: stationsByParticipant.get(participant.id) ?? [],
  }))

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="section-shell flex h-[72px] items-center justify-between gap-4">
          <Brand />
          <div className="flex items-center gap-1.5">
            <Button nativeButton={false} render={<Link href="/admin/gruppi" />} variant="outline" className="h-10 rounded-lg font-bold border-foreground bg-foreground/5">
              <UsersRound aria-hidden="true" />
              Gestione gruppi
            </Button>
            <Button nativeButton={false} render={<Link href="/admin" />} variant="ghost" className="h-10 rounded-lg">
              <KeyRound aria-hidden="true" />
              Accessi tutor
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
        <h1 className="display mt-4 text-[clamp(2rem,3.8vw,3.2rem)]">Gestione gruppi</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Tutti i gruppi dell’Open Day in un unico posto: registra i nuovi arrivi, assegna tutor e percorso, apri i
          biglietti con QR e chiudi i turni conclusi.
        </p>

        <div className="mt-8">
          <GroupManager
            initialGroups={groups}
            availableStations={stationsList}
            availableTutors={tutorsList}
          />
        </div>
      </main>
    </div>
  )
}
