'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import {
  Archive,
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  Copy,
  ExternalLink,
  LoaderCircle,
  Pencil,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Ticket,
  Trash2,
  Undo2,
  UserCheck,
  UsersRound,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatScanCode } from '@/lib/scan-codes'
import { cn } from '@/lib/utils'

export type ManagedGroup = {
  id: string
  name: string
  code: string
  groupSize: number
  status: string
  tutorName: string | null
  createdAt: string
  arrivedAt: string | null
  completedAt: string | null
  stations: Array<{ slug: string; code: string; title: string }>
}

export type StationOption = {
  slug: string
  code: string
  title: string
  room?: string
  capacity?: number
}

export type TutorOption = {
  id: string
  name: string
  username: string
  active: boolean
}

type GroupFilter = 'all' | 'active' | 'queued' | 'waiting' | 'arrived' | 'completed'
type SortOption = 'newest' | 'oldest' | 'name' | 'size'
type GroupStatus = 'assigned' | 'queued' | 'arrived'

const dateFormat = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const timeOnlyFormat = new Intl.DateTimeFormat('it-IT', {
  hour: '2-digit',
  minute: '2-digit',
})

const fieldClass = 'mt-1.5 h-10 rounded-lg bg-background text-sm'
const selectClass =
  'mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const statusOptions: Array<{ value: GroupStatus; label: string }> = [
  { value: 'assigned', label: 'Atteso' },
  { value: 'queued', label: 'In coda' },
  { value: 'arrived', label: 'Presente' },
]

function getStatusBadge(group: ManagedGroup) {
  if (group.completedAt) {
    return {
      label: 'Concluso',
      icon: CheckCheck,
      className: 'bg-muted text-muted-foreground',
    }
  }
  if (group.status === 'queued') {
    return {
      label: 'In coda',
      icon: Clock3,
      className: 'bg-arancio/25 text-foreground',
    }
  }
  if (group.status === 'arrived') {
    return {
      label: 'Presente',
      icon: Check,
      className: 'bg-verde/25 text-foreground',
    }
  }
  return {
    label: 'Atteso',
    icon: UserCheck,
    className: 'bg-blu/10 text-blu',
  }
}

function SizeSelector({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  return (
    <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Numero di partecipanti">
      {[1, 2, 3, 4, 5, 6].map((size) => (
        <button
          key={size}
          type="button"
          aria-pressed={value === size}
          onClick={() => onChange(size)}
          className={cn(
            'h-10 flex-1 rounded-lg border text-sm font-bold tabular-nums transition-colors',
            value === size
              ? 'border-foreground bg-foreground text-background'
              : 'border-border bg-background hover:bg-muted',
          )}
        >
          {size}
        </button>
      ))}
    </div>
  )
}

function StatusPicker({ value, onChange }: { value: GroupStatus; onChange: (status: GroupStatus) => void }) {
  return (
    <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Stato del gruppo">
      {statusOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-10 flex-1 rounded-lg border px-2 text-sm font-semibold transition-colors',
            value === option.value
              ? 'border-foreground bg-foreground text-background'
              : 'border-border bg-background hover:bg-muted',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function StationPicker({
  stations,
  selected,
  onToggle,
}: {
  stations: StationOption[]
  selected: string[]
  onToggle: (slug: string) => void
}) {
  if (stations.length === 0) {
    return (
      <p className="mt-1.5 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Nessuna tappa attiva disponibile.
      </p>
    )
  }

  return (
    <div className="mt-1.5 grid max-h-56 gap-1.5 overflow-y-auto rounded-xl border bg-muted/40 p-2 sm:grid-cols-2">
      {stations.map((station) => {
        const index = selected.indexOf(station.slug)
        const isSelected = index >= 0
        return (
          <button
            key={station.slug}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(station.slug)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-sm transition-colors',
              isSelected
                ? 'border-foreground bg-card shadow-sm'
                : 'border-transparent bg-card/60 hover:bg-card',
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold tabular-nums',
                isSelected ? 'border-foreground bg-foreground text-background' : 'border-input text-input',
              )}
            >
              {isSelected ? index + 1 : '·'}
            </span>
            <span className="shrink-0 font-mono text-[11px] font-bold text-muted-foreground">{station.code}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{station.title}</span>
            {station.room && (
              <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:block">{station.room}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function GroupManager({
  initialGroups,
  availableStations = [],
  availableTutors = [],
}: {
  initialGroups: ManagedGroup[]
  availableStations?: StationOption[]
  availableTutors?: TutorOption[]
}) {
  const router = useRouter()
  const [groups, setGroups] = useState<ManagedGroup[]>(initialGroups)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<GroupFilter>('all')
  const [stationFilter, setStationFilter] = useState<string>('all')
  const [tutorFilter, setTutorFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('newest')

  // Operational states
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editGroup, setEditGroup] = useState<ManagedGroup | null>(null)
  const [deleteGroup, setDeleteGroup] = useState<ManagedGroup | null>(null)
  const [ticketGroup, setTicketGroup] = useState<ManagedGroup | null>(null)
  const [ticketQrData, setTicketQrData] = useState<string | null>(null)

  // Create form state
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupSize, setNewGroupSize] = useState(1)
  const [newSelectedStations, setNewSelectedStations] = useState<string[]>(
    availableStations.length > 0 ? [availableStations[0].slug] : [],
  )
  const [newTutorName, setNewTutorName] = useState('')
  const [newStatus, setNewStatus] = useState<GroupStatus>('assigned')
  const [isCreating, setIsCreating] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editGroupSize, setEditGroupSize] = useState(1)
  const [editSelectedStations, setEditSelectedStations] = useState<string[]>([])
  const [editTutorName, setEditTutorName] = useState('')
  const [editStatus, setEditStatus] = useState<GroupStatus>('assigned')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  useEffect(() => {
    setGroups(initialGroups)
  }, [initialGroups])

  // Count calculations
  const totalCount = groups.length
  const totalVisitors = groups.reduce((sum, group) => sum + (group.groupSize || 1), 0)
  const activeCount = groups.filter((group) => !group.completedAt).length
  const queuedCount = groups.filter((group) => !group.completedAt && group.status === 'queued').length
  const waitingCount = groups.filter((group) => !group.completedAt && group.status === 'assigned').length
  const arrivedCount = groups.filter((group) => !group.completedAt && group.status === 'arrived').length
  const completedCount = groups.filter((group) => Boolean(group.completedAt)).length

  const stats: Array<{ id: GroupFilter; label: string; hint: string; value: number; dot?: string }> = [
    { id: 'all', label: 'Gruppi', hint: `${totalVisitors} visitatori`, value: totalCount },
    { id: 'active', label: 'In corso', hint: 'turni aperti', value: activeCount },
    { id: 'queued', label: 'In coda', hint: 'da assegnare', value: queuedCount, dot: 'bg-arancio' },
    { id: 'waiting', label: 'Attesi', hint: 'non ancora arrivati', value: waitingCount },
    { id: 'arrived', label: 'Presenti', hint: 'in laboratorio', value: arrivedCount, dot: 'bg-verde' },
    { id: 'completed', label: 'Conclusi', hint: 'in archivio', value: completedCount },
  ]

  const hasActiveFilters =
    query !== '' || statusFilter !== 'all' || stationFilter !== 'all' || tutorFilter !== 'all'

  function resetFilters() {
    setQuery('')
    setStatusFilter('all')
    setStationFilter('all')
    setTutorFilter('all')
  }

  // Filter & sort
  const normalizedQuery = query.trim().toLocaleLowerCase('it')

  const filteredGroups = groups.filter((group) => {
    // Status filter
    if (statusFilter === 'active' && group.completedAt) return false
    if (statusFilter === 'completed' && !group.completedAt) return false
    if (statusFilter === 'queued' && (group.completedAt || group.status !== 'queued')) return false
    if (statusFilter === 'waiting' && (group.completedAt || group.status !== 'assigned')) return false
    if (statusFilter === 'arrived' && (group.completedAt || group.status !== 'arrived')) return false

    // Station filter
    if (stationFilter !== 'all') {
      const hasStation = group.stations.some((station) => station.slug === stationFilter)
      if (!hasStation) return false
    }

    // Tutor filter
    if (tutorFilter === 'unassigned') {
      if (group.tutorName) return false
    } else if (tutorFilter !== 'all') {
      if (group.tutorName !== tutorFilter) return false
    }

    // Search query
    if (normalizedQuery) {
      const searchableText = [
        group.name,
        group.code,
        formatScanCode(group.code),
        group.tutorName ?? '',
        ...group.stations.flatMap((station) => [station.code, station.title, station.slug]),
      ]
        .join(' ')
        .toLocaleLowerCase('it')

      if (!searchableText.includes(normalizedQuery)) return false
    }

    return true
  })

  const sortedGroups = [...filteredGroups].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    if (sortBy === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name, 'it')
    }
    if (sortBy === 'size') {
      return b.groupSize - a.groupSize
    }
    return 0
  })

  // Quick Action: Presence toggle
  async function toggleArrival(group: ManagedGroup) {
    const nextArrived = group.status !== 'arrived'
    setPendingId(group.id)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arrived: nextArrived }),
      })
      const result = await response.json()
      if (!response.ok) {
        setFeedback({ type: 'error', message: result.error ?? 'Aggiornamento presenza fallito.' })
        return
      }

      setGroups((current) =>
        current.map((item) => (item.id === group.id ? (result.group as ManagedGroup) : item)),
      )
      setFeedback({
        type: 'success',
        message: nextArrived
          ? `${group.name} segnato come presente.`
          : `Presenza di ${group.name} annullata.`,
      })
      router.refresh()
    } catch {
      setFeedback({ type: 'error', message: 'Errore di connessione. Riprova.' })
    } finally {
      setPendingId(null)
    }
  }

  // Quick Action: Complete or Restore
  async function toggleCompletion(group: ManagedGroup, completed: boolean) {
    setPendingId(group.id)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      })
      const result = await response.json()
      if (!response.ok) {
        setFeedback({ type: 'error', message: result.error ?? 'Aggiornamento stato turno fallito.' })
        return
      }

      setGroups((current) =>
        current.map((item) => (item.id === group.id ? (result.group as ManagedGroup) : item)),
      )
      setFeedback({
        type: 'success',
        message: completed ? `Turno di ${group.name} chiuso.` : `Turno di ${group.name} riaperto.`,
      })
      router.refresh()
    } catch {
      setFeedback({ type: 'error', message: 'Errore di connessione. Riprova.' })
    } finally {
      setPendingId(null)
    }
  }

  // Delete Action
  async function confirmDeleteGroup() {
    if (!deleteGroup) return
    const id = deleteGroup.id
    setPendingId(id)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/groups/${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) {
        setFeedback({ type: 'error', message: result.error ?? 'Eliminazione gruppo non riuscita.' })
        return
      }

      setGroups((current) => current.filter((item) => item.id !== id))
      setFeedback({ type: 'success', message: `Gruppo "${deleteGroup.name}" eliminato definitivamente.` })
      setDeleteGroup(null)
      router.refresh()
    } catch {
      setFeedback({ type: 'error', message: 'Errore di connessione. Riprova.' })
    } finally {
      setPendingId(null)
    }
  }

  // Create Group Action
  async function handleCreateGroup(event: React.FormEvent) {
    event.preventDefault()
    if (!newGroupName.trim()) {
      setFeedback({ type: 'error', message: 'Inserisci il nome del gruppo.' })
      return
    }
    if (newSelectedStations.length === 0) {
      setFeedback({ type: 'error', message: 'Seleziona almeno un laboratorio per il percorso.' })
      return
    }

    setIsCreating(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          groupSize: newGroupSize,
          stationSlugs: newSelectedStations,
          tutorName: newTutorName.trim() || null,
          status: newStatus,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setFeedback({ type: 'error', message: result.error ?? 'Creazione gruppo fallita.' })
        return
      }

      const created = result.group as ManagedGroup
      setGroups((current) => [created, ...current])
      setFeedback({ type: 'success', message: `Gruppo "${created.name}" aggiunto con successo!` })
      setCreateModalOpen(false)
      // Reset form
      setNewGroupName('')
      setNewGroupSize(1)
      setNewTutorName('')
      setNewStatus('assigned')
      if (availableStations.length > 0) {
        setNewSelectedStations([availableStations[0].slug])
      }
      router.refresh()
    } catch {
      setFeedback({ type: 'error', message: 'Errore durante la creazione del gruppo. Riprova.' })
    } finally {
      setIsCreating(false)
    }
  }

  // Open Edit Modal
  function openEditModal(group: ManagedGroup) {
    setEditGroup(group)
    setEditName(group.name)
    setEditGroupSize(group.groupSize)
    setEditSelectedStations(group.stations.map((station) => station.slug))
    setEditTutorName(group.tutorName ?? '')
    setEditStatus((group.status as GroupStatus) || 'assigned')
  }

  // Save Edit Action
  async function handleSaveEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!editGroup) return
    if (!editName.trim()) {
      setFeedback({ type: 'error', message: 'Il nome del gruppo non può essere vuoto.' })
      return
    }
    if (editSelectedStations.length === 0) {
      setFeedback({ type: 'error', message: 'Seleziona almeno una tappa per il percorso.' })
      return
    }

    setIsSavingEdit(true)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/groups/${editGroup.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          groupSize: editGroupSize,
          stationSlugs: editSelectedStations,
          tutorName: editTutorName.trim() || null,
          status: editStatus,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setFeedback({ type: 'error', message: result.error ?? 'Salvataggio modifiche fallito.' })
        return
      }

      const updated = result.group as ManagedGroup
      setGroups((current) => current.map((item) => (item.id === editGroup.id ? updated : item)))
      setFeedback({ type: 'success', message: `Modifiche a "${updated.name}" salvate con successo.` })
      setEditGroup(null)
      router.refresh()
    } catch {
      setFeedback({ type: 'error', message: 'Errore di salvataggio. Riprova.' })
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Open Ticket / QR Modal
  async function openTicketModal(group: ManagedGroup) {
    setTicketGroup(group)
    setTicketQrData(null)
    try {
      const qrDataUrl = await QRCode.toDataURL(group.code, {
        width: 280,
        margin: 1,
        color: { dark: '#111111', light: '#ffffff' },
      })
      setTicketQrData(qrDataUrl)
    } catch (error) {
      console.error('Generazione QR non riuscita', error)
      setTicketQrData(null)
    }
  }

  // Copy helper
  async function copyToClipboard(text: string, identifier: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCode(identifier)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <section aria-labelledby="groups-title">
      <h2 id="groups-title" className="sr-only">
        Gruppi dell’Open Day
      </h2>

      {/* Riepilogo: le tessere fungono anche da filtro per stato */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => {
          const isActive = statusFilter === stat.id
          return (
            <button
              key={stat.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setStatusFilter(stat.id)}
              className={cn(
                'rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                isActive ? 'border-foreground ring-1 ring-foreground' : 'border-border',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-muted-foreground">{stat.label}</span>
                {stat.dot && <span className={cn('size-2 rounded-full', stat.dot)} aria-hidden="true" />}
              </span>
              <span className="display mt-2 block text-3xl tabular-nums">{stat.value}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{stat.hint}</span>
            </button>
          )
        })}
      </div>

      {/* Barra strumenti */}
      <div className="mt-6 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca per nome, codice biglietto, tutor o tappa…"
              aria-label="Cerca gruppi"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cancella ricerca"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.refresh()}
              className="h-10 rounded-lg"
            >
              <RefreshCw aria-hidden="true" />
              Aggiorna
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/archivio" />}
              variant="outline"
              className="h-10 rounded-lg"
            >
              <Archive aria-hidden="true" />
              Archivio
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3 border-t pt-3">
          {availableStations.length > 0 && (
            <div className="min-w-0">
              <Label htmlFor="filter-station" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tappa
              </Label>
              <select
                id="filter-station"
                value={stationFilter}
                onChange={(event) => setStationFilter(event.target.value)}
                className={cn(selectClass, 'mt-1 min-w-[180px]')}
              >
                <option value="all">Tutte le tappe</option>
                {availableStations.map((station) => (
                  <option key={station.slug} value={station.slug}>
                    {station.code} · {station.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {availableTutors.length > 0 && (
            <div className="min-w-0">
              <Label htmlFor="filter-tutor" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tutor
              </Label>
              <select
                id="filter-tutor"
                value={tutorFilter}
                onChange={(event) => setTutorFilter(event.target.value)}
                className={cn(selectClass, 'mt-1 min-w-[170px]')}
              >
                <option value="all">Tutti i tutor</option>
                <option value="unassigned">Non assegnato</option>
                {availableTutors.map((tutor) => (
                  <option key={tutor.id} value={tutor.name}>
                    {tutor.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="min-w-0 sm:ml-auto">
            <Label htmlFor="sort-by" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ordina
            </Label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className={cn(selectClass, 'mt-1 min-w-[190px]')}
            >
              <option value="newest">Più recenti</option>
              <option value="oldest">Meno recenti</option>
              <option value="name">Nome (A-Z)</option>
              <option value="size">Partecipanti (maggiori prima)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          role="alert"
          className={cn(
            'mt-4 flex items-start justify-between gap-3 rounded-xl border p-3 text-sm font-medium',
            feedback.type === 'success'
              ? 'border-verde/40 bg-verde/10 text-foreground'
              : 'border-destructive/30 bg-destructive/10 text-destructive',
          )}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100"
            aria-label="Chiudi avviso"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Conteggio risultati */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{sortedGroups.length}</span> gruppi visualizzati su{' '}
          {groups.length}
          {statusFilter !== 'all' && (
            <>
              {' · '}
              filtro <span className="font-semibold text-foreground">{stats.find((stat) => stat.id === statusFilter)?.label}</span>
            </>
          )}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-sm font-semibold text-blu underline-offset-4 hover:underline"
          >
            Azzera filtri
          </button>
        )}
      </div>

      {/* Elenco gruppi */}
      {sortedGroups.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed bg-card/60 p-10 text-center">
          <p className="text-base font-semibold">Nessun gruppo trovato</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {groups.length === 0
              ? 'Non ci sono ancora gruppi registrati.'
              : 'Nessun gruppo corrisponde ai filtri impostati.'}
          </p>
          {groups.length > 0 && (
            <Button type="button" variant="outline" onClick={resetFilters} className="mt-4 h-9 rounded-lg">
              Mostra tutti i gruppi
            </Button>
          )}
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {sortedGroups.map((group) => {
            const isBusy = pendingId === group.id
            const isArrived = group.status === 'arrived'
            const isQueued = group.status === 'queued'
            const isCompleted = Boolean(group.completedAt)
            const badge = getStatusBadge(group)
            const BadgeIcon = badge.icon
            const formattedCode = formatScanCode(group.code)

            return (
              <li
                key={group.id}
                className={cn(
                  'rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5',
                  isCompleted ? 'border-border/70 bg-card/70' : 'border-border',
                )}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="display-sm truncate text-xl">{group.name}</h3>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
                          badge.className,
                        )}
                      >
                        <BadgeIcon className="size-3.5" aria-hidden="true" />
                        {badge.label}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(group.code, group.id)}
                        title="Clicca per copiare il codice"
                        className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 font-mono text-xs font-bold text-foreground transition-colors hover:bg-muted"
                      >
                        <Ticket className="size-3.5" aria-hidden="true" />
                        {formattedCode}
                        {copiedCode === group.id ? (
                          <Check className="size-3 text-verde" aria-hidden="true" />
                        ) : (
                          <Copy className="size-3 opacity-60" aria-hidden="true" />
                        )}
                      </button>

                      <span className="inline-flex items-center gap-1.5">
                        <UsersRound className="size-3.5" aria-hidden="true" />
                        {group.groupSize} {group.groupSize === 1 ? 'persona' : 'persone'}
                      </span>

                      <span title="Ora di registrazione">{dateFormat.format(new Date(group.createdAt))}</span>

                      {group.arrivedAt && !group.completedAt && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground" title="Ora di arrivo">
                          <span className="size-1.5 rounded-full bg-verde" aria-hidden="true" />
                          Arrivo {timeOnlyFormat.format(new Date(group.arrivedAt))}
                        </span>
                      )}

                      {group.completedAt && (
                        <span title="Ora di conclusione">
                          Concluso {timeOnlyFormat.format(new Date(group.completedAt))}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    {!isCompleted && !isQueued && (
                      <Button
                        type="button"
                        variant={isArrived ? 'outline' : 'default'}
                        disabled={isBusy}
                        onClick={() => toggleArrival(group)}
                        title={isArrived ? 'Annulla presenza' : 'Segna come presente'}
                        className="h-9 rounded-lg px-3 font-semibold"
                      >
                        {isBusy ? (
                          <LoaderCircle className="animate-spin" aria-hidden="true" />
                        ) : isArrived ? (
                          <Undo2 aria-hidden="true" />
                        ) : (
                          <Check aria-hidden="true" />
                        )}
                        {isArrived ? 'Annulla presenza' : 'Presente'}
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => toggleCompletion(group, !isCompleted)}
                      title={isCompleted ? 'Riapri il turno di questo gruppo' : 'Chiudi il turno di questo gruppo'}
                      className="h-9 rounded-lg px-3 font-semibold"
                    >
                      {isBusy ? (
                        <LoaderCircle className="animate-spin" aria-hidden="true" />
                      ) : isCompleted ? (
                        <RotateCcw aria-hidden="true" />
                      ) : (
                        <CheckCheck aria-hidden="true" />
                      )}
                      {isCompleted ? 'Riapri' : 'Chiudi'}
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openTicketModal(group)}
                        title="Biglietto e codice QR"
                        aria-label={`Biglietto di ${group.name}`}
                        className="size-9 rounded-lg"
                      >
                        <QrCode aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openEditModal(group)}
                        title="Modifica dati gruppo"
                        aria-label={`Modifica ${group.name}`}
                        className="size-9 rounded-lg"
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setDeleteGroup(group)}
                        title="Elimina gruppo definitivamente"
                        aria-label={`Elimina ${group.name}`}
                        className="size-9 rounded-lg"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tutor</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                      {group.tutorName ? (
                        <>
                          <UserCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="truncate">{group.tutorName}</span>
                        </>
                      ) : isQueued ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-arancio/25 px-2 py-0.5 text-foreground">
                          <Clock3 className="size-3.5" aria-hidden="true" />
                          In attesa di assegnazione
                        </span>
                      ) : (
                        <span className="font-normal text-muted-foreground">Non assegnato</span>
                      )}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Percorso · {group.stations.length} {group.stations.length === 1 ? 'tappa' : 'tappe'}
                    </p>
                    {group.stations.length > 0 ? (
                      <ol className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {group.stations.map((station, index) => (
                          <li key={station.slug} className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-xs">
                              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                                {index + 1}
                              </span>
                              <span className="font-mono font-bold">{station.code}</span>
                              <span className="max-w-[180px] truncate font-medium">{station.title}</span>
                            </span>
                            {index < group.stations.length - 1 && (
                              <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">Nessuna tappa assegnata</p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* MODAL: NUOVO GRUPPO */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="display-sm text-xl">Nuovo gruppo</DialogTitle>
            <DialogDescription>
              Registra il gruppo all’ingresso. Il codice biglietto e il QR vengono generati automaticamente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="create-name">Nome gruppo o referente</Label>
              <Input
                id="create-name"
                required
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="Es. Famiglia Rossi · Liceo Volta 4B"
                className={fieldClass}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Partecipanti</Label>
                <SizeSelector value={newGroupSize} onChange={setNewGroupSize} />
              </div>
              <div>
                <Label>Stato iniziale</Label>
                <StatusPicker value={newStatus} onChange={setNewStatus} />
              </div>
            </div>

            <div>
              <Label htmlFor="create-tutor">Tutor da assegnare</Label>
              <select
                id="create-tutor"
                value={newTutorName}
                onChange={(event) => setNewTutorName(event.target.value)}
                className={selectClass}
              >
                <option value="">Nessun tutor (assegna in seguito)</option>
                {availableTutors.map((tutor) => (
                  <option key={tutor.id} value={tutor.name}>
                    {tutor.name} ({tutor.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <Label>Percorso · tappe</Label>
                <span className="text-xs font-semibold text-muted-foreground">
                  {newSelectedStations.length} selezionate
                </span>
              </div>
              <StationPicker
                stations={availableStations}
                selected={newSelectedStations}
                onToggle={(slug) =>
                  setNewSelectedStations((current) =>
                    current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
                  )
                }
              />
            </div>

            <DialogFooter className="rounded-b-2xl">
              <Button
                type="button"
                variant="outline"
                disabled={isCreating}
                onClick={() => setCreateModalOpen(false)}
                className="h-10 rounded-lg"
              >
                Annulla
              </Button>
              <Button type="submit" disabled={isCreating} className="h-10 rounded-lg font-semibold">
                {isCreating ? (
                  <>
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                    Creazione in corso…
                  </>
                ) : (
                  'Crea gruppo'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: MODIFICA GRUPPO */}
      <Dialog open={editGroup !== null} onOpenChange={(open) => !open && setEditGroup(null)}>
        <DialogContent className="rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="display-sm text-xl">Modifica gruppo</DialogTitle>
            <DialogDescription>
              Aggiorna i dati, il tutor, lo stato o il percorso di {editGroup?.name ?? 'questo gruppo'}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="edit-name">Nome gruppo</Label>
              <Input
                id="edit-name"
                required
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className={fieldClass}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Partecipanti</Label>
                <SizeSelector value={editGroupSize} onChange={setEditGroupSize} />
              </div>
              <div>
                <Label>Stato</Label>
                <StatusPicker value={editStatus} onChange={setEditStatus} />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-tutor">Tutor assegnato</Label>
              <select
                id="edit-tutor"
                value={editTutorName}
                onChange={(event) => setEditTutorName(event.target.value)}
                className={selectClass}
              >
                <option value="">Nessun tutor</option>
                {availableTutors.map((tutor) => (
                  <option key={tutor.id} value={tutor.name}>
                    {tutor.name} ({tutor.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <Label>Percorso · tappe</Label>
                <span className="text-xs font-semibold text-muted-foreground">
                  {editSelectedStations.length} selezionate
                </span>
              </div>
              <StationPicker
                stations={availableStations}
                selected={editSelectedStations}
                onToggle={(slug) =>
                  setEditSelectedStations((current) =>
                    current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
                  )
                }
              />
            </div>

            <DialogFooter className="rounded-b-2xl">
              <Button
                type="button"
                variant="outline"
                disabled={isSavingEdit}
                onClick={() => setEditGroup(null)}
                className="h-10 rounded-lg"
              >
                Annulla
              </Button>
              <Button type="submit" disabled={isSavingEdit} className="h-10 rounded-lg font-semibold">
                {isSavingEdit ? (
                  <>
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                    Salvataggio…
                  </>
                ) : (
                  'Salva modifiche'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: QR CODE E BIGLIETTO */}
      <Dialog open={ticketGroup !== null} onOpenChange={(open) => !open && setTicketGroup(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="display-sm text-xl">Biglietto di {ticketGroup?.name}</DialogTitle>
            <DialogDescription>
              Mostra questo codice o QR al tutor all’arrivo.
            </DialogDescription>
          </DialogHeader>

          {ticketGroup && (
            <div className="flex flex-col items-center">
              {ticketQrData ? (
                <div className="rounded-2xl border bg-card p-3 shadow-sm">
                  <img
                    src={ticketQrData}
                    alt={`Codice QR per ${ticketGroup.name}`}
                    className="size-56 object-contain"
                  />
                </div>
              ) : (
                <div className="flex size-56 items-center justify-center rounded-2xl border border-dashed bg-muted/50">
                  <LoaderCircle className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
                </div>
              )}

              <p className="mt-4 font-mono text-2xl font-black tracking-[0.15em]">
                {formatScanCode(ticketGroup.code)}
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Gruppo di {ticketGroup.groupSize} {ticketGroup.groupSize === 1 ? 'persona' : 'persone'}
              </p>

              <div className="mt-5 flex w-full flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    copyToClipboard(`${window.location.origin}/assegnazione/${ticketGroup.id}`, 'ticket-link')
                  }
                  className="h-10 rounded-lg font-semibold"
                >
                  {copiedCode === 'ticket-link' ? (
                    <>
                      <Check className="text-verde" aria-hidden="true" />
                      Link copiato negli appunti
                    </>
                  ) : (
                    <>
                      <Copy aria-hidden="true" />
                      Copia link biglietto
                    </>
                  )}
                </Button>

                <Button
                  nativeButton={false}
                  render={
                    <a href={`/assegnazione/${ticketGroup.id}`} target="_blank" rel="noopener noreferrer" />
                  }
                  className="h-10 rounded-lg font-semibold"
                >
                  <ExternalLink aria-hidden="true" />
                  Apri pagina biglietto
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: CONFERMA ELIMINAZIONE */}
      <Dialog open={deleteGroup !== null} onOpenChange={(open) => !open && setDeleteGroup(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="display-sm text-xl">Eliminare definitivamente?</DialogTitle>
            <DialogDescription>
              Stai per eliminare il gruppo <strong className="text-foreground">{deleteGroup?.name}</strong> con
              codice <span className="font-mono font-bold">{deleteGroup?.code}</span>. Il biglietto e le tappe
              associate verranno rimossi: l’operazione non si può annullare.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="rounded-b-2xl">
            <Button
              type="button"
              variant="outline"
              disabled={pendingId !== null}
              onClick={() => setDeleteGroup(null)}
              className="h-10 rounded-lg"
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pendingId !== null}
              onClick={confirmDeleteGroup}
              className="h-10 rounded-lg bg-destructive font-semibold text-white hover:bg-destructive/90"
            >
              {pendingId === deleteGroup?.id ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                  Eliminazione…
                </>
              ) : (
                'Elimina gruppo'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
