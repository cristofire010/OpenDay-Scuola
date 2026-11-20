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
  Filter,
  LoaderCircle,
  Pencil,
  Plus,
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

const statusFilters: Array<{ id: GroupFilter; label: string }> = [
  { id: 'all', label: 'Tutti' },
  { id: 'active', label: 'In corso' },
  { id: 'queued', label: 'In coda' },
  { id: 'waiting', label: 'Attesi' },
  { id: 'arrived', label: 'Presenti' },
  { id: 'completed', label: 'Conclusi' },
]

function getStatusBadge(group: ManagedGroup) {
  if (group.completedAt) {
    return {
      label: 'Concluso',
      icon: <CheckCheck className="size-3.5" aria-hidden="true" />,
      className: 'bg-muted text-muted-foreground border border-border',
    }
  }
  if (group.status === 'queued') {
    return {
      label: 'In coda',
      icon: <Clock3 className="size-3.5" aria-hidden="true" />,
      className: 'bg-[#e61919] text-white',
    }
  }
  if (group.status === 'arrived') {
    return {
      label: 'Presente',
      icon: <Check className="size-3.5" aria-hidden="true" />,
      className: 'bg-[#111] text-white',
    }
  }
  return {
    label: 'Atteso',
    icon: <UserCheck className="size-3.5" aria-hidden="true" />,
    className: 'bg-[#e7e4dc] text-[#111] border border-[#d0cdc4]',
  }
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
  const [newStatus, setNewStatus] = useState<'assigned' | 'queued' | 'arrived'>('assigned')
  const [isCreating, setIsCreating] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editGroupSize, setEditGroupSize] = useState(1)
  const [editSelectedStations, setEditSelectedStations] = useState<string[]>([])
  const [editTutorName, setEditTutorName] = useState('')
  const [editStatus, setEditStatus] = useState<'assigned' | 'queued' | 'arrived'>('assigned')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  useEffect(() => {
    setGroups(initialGroups)
  }, [initialGroups])

  // Count calculations
  const totalCount = groups.length
  const totalVisitors = groups.reduce((sum, g) => sum + (g.groupSize || 1), 0)
  const activeCount = groups.filter((g) => !g.completedAt).length
  const queuedCount = groups.filter((g) => !g.completedAt && g.status === 'queued').length
  const waitingCount = groups.filter((g) => !g.completedAt && g.status === 'assigned').length
  const arrivedCount = groups.filter((g) => !g.completedAt && g.status === 'arrived').length
  const completedCount = groups.filter((g) => Boolean(g.completedAt)).length

  const counts: Record<GroupFilter, number> = {
    all: totalCount,
    active: activeCount,
    queued: queuedCount,
    waiting: waitingCount,
    arrived: arrivedCount,
    completed: completedCount,
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
      const hasStation = group.stations.some((s) => s.slug === stationFilter)
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
        ...group.stations.flatMap((s) => [s.code, s.title, s.slug]),
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
    setEditSelectedStations(group.stations.map((s) => s.slug))
    setEditTutorName(group.tutorName ?? '')
    setEditStatus((group.status as 'assigned' | 'queued' | 'arrived') || 'assigned')
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
    try {
      const qrDataUrl = await QRCode.toDataURL(group.code, {
        width: 280,
        margin: 1,
        color: { dark: '#111111', light: '#ffffff' },
      })
      setTicketQrData(qrDataUrl)
    } catch (e) {
      console.error('Generazione QR non riuscita', e)
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
    <section aria-labelledby="groups-title" className="text-[#111]">
      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 gap-px border-2 border-[#111] bg-[#111] sm:grid-cols-3 lg:grid-cols-6">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-4 text-left transition-colors hover:bg-neutral-100 ${
            statusFilter === 'all' ? 'bg-white' : 'bg-[#f4f4f0]'
          }`}
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Tutti i gruppi
          </p>
          <p className="mt-1 text-3xl font-black tabular-nums">{totalCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">{totalVisitors} visitatori</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('active')}
          className={`p-4 text-left transition-colors hover:bg-neutral-100 ${
            statusFilter === 'active' ? 'bg-white' : 'bg-[#f4f4f0]'
          }`}
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            In corso
          </p>
          <p className="mt-1 text-3xl font-black tabular-nums">{activeCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">attivi ora</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('queued')}
          className={`p-4 text-left transition-colors hover:bg-neutral-100 ${
            statusFilter === 'queued' ? 'bg-white' : 'bg-[#f4f4f0]'
          }`}
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#e61919]">
            In coda
          </p>
          <p className="mt-1 text-3xl font-black tabular-nums text-[#e61919]">{queuedCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">in attesa tutor</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('waiting')}
          className={`p-4 text-left transition-colors hover:bg-neutral-100 ${
            statusFilter === 'waiting' ? 'bg-white' : 'bg-[#f4f4f0]'
          }`}
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Attesi
          </p>
          <p className="mt-1 text-3xl font-black tabular-nums">{waitingCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">assegnati</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('arrived')}
          className={`p-4 text-left transition-colors hover:bg-neutral-100 ${
            statusFilter === 'arrived' ? 'bg-white' : 'bg-[#f4f4f0]'
          }`}
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#111]">
            Presenti
          </p>
          <p className="mt-1 text-3xl font-black tabular-nums">{arrivedCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">in laboratorio</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('completed')}
          className={`p-4 text-left transition-colors hover:bg-neutral-100 ${
            statusFilter === 'completed' ? 'bg-white' : 'bg-[#f4f4f0]'
          }`}
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Conclusi
          </p>
          <p className="mt-1 text-3xl font-black tabular-nums">{completedCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">in archivio</p>
        </button>
      </div>

      {/* FEEDBACK ALERT */}
      {feedback && (
        <div
          role="alert"
          className={`mt-4 flex items-center justify-between border-2 p-3 font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
              : 'border-[#e61919] bg-red-50 text-[#a31313]'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:opacity-75"
            aria-label="Chiudi avviso"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* TOOLBAR CONTROLS */}
      <div className="mt-6 flex flex-col gap-4 border-y-2 border-[#111] py-4">
        {/* Row 1: Status filters & Primary Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" aria-label="Filtra gruppi per stato">
            {statusFilters.map((item) => {
              const active = statusFilter === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(item.id)}
                  className={`flex h-9 items-center gap-2 border px-3 text-xs font-bold transition-colors ${
                    active
                      ? 'border-[#111] bg-[#111] text-white'
                      : 'border-[#111] bg-white text-[#111] hover:bg-neutral-100'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 ${
                      active ? 'bg-white/20 text-white' : 'bg-neutral-100 text-[#111]'
                    }`}
                  >
                    {counts[item.id]}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="h-9 rounded-none border-2 border-[#111] bg-[#111] px-4 font-bold text-white hover:bg-neutral-800"
            >
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Nuovo gruppo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.refresh()}
              className="h-9 rounded-none border border-[#111] px-3 font-semibold"
            >
              <RefreshCw className="mr-1.5 size-3.5" aria-hidden="true" />
              Aggiorna
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/archivio" />}
              variant="outline"
              className="h-9 rounded-none border border-[#111] px-3 font-semibold"
            >
              <Archive className="mr-1.5 size-3.5" aria-hidden="true" />
              Archivio
            </Button>
          </div>
        </div>

        {/* Row 2: Secondary Filters & Search */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per nome, codice QR, tutor o tappa..."
              className="h-9 w-full border border-[#111] bg-white pl-9 pr-8 text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-[#111]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Cancella ricerca"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Filter by Station */}
          {availableStations.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <label htmlFor="filter-station" className="font-mono font-bold uppercase text-muted-foreground shrink-0">
                Tappa:
              </label>
              <select
                id="filter-station"
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="h-9 border border-[#111] bg-white px-2.5 text-xs outline-none focus:ring-1 focus:ring-[#111]"
              >
                <option value="all">Tutte le tappe</option>
                {availableStations.map((station) => (
                  <option key={station.slug} value={station.slug}>
                    {station.code} - {station.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filter by Tutor */}
          {availableTutors.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <label htmlFor="filter-tutor" className="font-mono font-bold uppercase text-muted-foreground shrink-0">
                Tutor:
              </label>
              <select
                id="filter-tutor"
                value={tutorFilter}
                onChange={(e) => setTutorFilter(e.target.value)}
                className="h-9 border border-[#111] bg-white px-2.5 text-xs outline-none focus:ring-1 focus:ring-[#111]"
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

          {/* Sort order */}
          <div className="flex items-center gap-1.5 text-xs ml-auto">
            <label htmlFor="sort-by" className="font-mono font-bold uppercase text-muted-foreground shrink-0">
              Ordina:
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-9 border border-[#111] bg-white px-2.5 text-xs outline-none focus:ring-1 focus:ring-[#111]"
            >
              <option value="newest">Più recenti</option>
              <option value="oldest">Meno recenti</option>
              <option value="name">Nome (A-Z)</option>
              <option value="size">Partecipanti (maggiori prima)</option>
            </select>
          </div>
        </div>
      </div>

      {/* LIST HEADER / SUMMARY */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono font-bold uppercase tracking-[0.1em]">
        <p>
          Gruppi visualizzati: {sortedGroups.length} di {groups.length}
        </p>
        {(query || statusFilter !== 'all' || stationFilter !== 'all' || tutorFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setStatusFilter('all')
              setStationFilter('all')
              setTutorFilter('all')
            }}
            className="text-[#e61919] hover:underline"
          >
            Azzera filtri
          </button>
        )}
      </div>

      {/* GROUPS LIST */}
      {sortedGroups.length === 0 ? (
        <div className="mt-4 border-2 border-dashed border-[#111] bg-[#f4f4f0] p-10 text-center">
          <p className="text-base font-semibold">Nessun gruppo trovato</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {groups.length === 0
              ? 'Non ci sono gruppi registrati. Usa "+ Nuovo gruppo" per crearne uno.'
              : 'Nessun gruppo corrisponde ai filtri impostati.'}
          </p>
          {groups.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery('')
                setStatusFilter('all')
                setStationFilter('all')
                setTutorFilter('all')
              }}
              className="mt-4 h-9 rounded-none border border-[#111]"
            >
              Mostra tutti i gruppi
            </Button>
          )}
        </div>
      ) : (
        <ul className="mt-4 border-t-2 border-[#111]">
          {sortedGroups.map((group) => {
            const isBusy = pendingId === group.id
            const isArrived = group.status === 'arrived'
            const isQueued = group.status === 'queued'
            const isCompleted = Boolean(group.completedAt)
            const badge = getStatusBadge(group)
            const formattedCode = formatScanCode(group.code)

            return (
              <li
                key={group.id}
                className={`grid gap-4 border-b border-[#111] p-4 transition-colors sm:p-5 lg:grid-cols-[minmax(260px,1.2fr)_minmax(180px,0.9fr)_minmax(240px,1.2fr)_auto] lg:items-center ${
                  isCompleted ? 'bg-neutral-50/70' : 'bg-white'
                }`}
              >
                {/* 1. Group info & tickets */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="display-sm text-xl font-bold tracking-tight text-[#111]">
                      {group.name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide ${badge.className}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(group.code, group.id)}
                      title="Clicca per copiare il codice"
                      className="inline-flex items-center gap-1 font-bold text-[#111] hover:underline"
                    >
                      <Ticket className="size-3.5" aria-hidden="true" />
                      {formattedCode}
                      {copiedCode === group.id ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3 opacity-60" />
                      )}
                    </button>

                    <span className="inline-flex items-center gap-1 font-semibold text-[#111]">
                      <UsersRound className="size-3.5" aria-hidden="true" />
                      {group.groupSize} {group.groupSize === 1 ? 'persona' : 'persone'}
                    </span>

                    <span title="Ora di registrazione">
                      {dateFormat.format(new Date(group.createdAt))}
                    </span>

                    {group.arrivedAt && !group.completedAt && (
                      <span className="text-emerald-700" title="Ora di arrivo">
                        • Arrivo: {timeOnlyFormat.format(new Date(group.arrivedAt))}
                      </span>
                    )}

                    {group.completedAt && (
                      <span className="text-muted-foreground" title="Ora di conclusione">
                        • Concluso: {timeOnlyFormat.format(new Date(group.completedAt))}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Tutor info */}
                <div className="min-w-0 border-l-2 border-[#111] pl-3">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Tutor
                  </p>
                  <p className="mt-1 truncate font-semibold text-sm">
                    {group.tutorName ? (
                      <span className="inline-flex items-center gap-1 text-[#111]">
                        <UserCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        {group.tutorName}
                      </span>
                    ) : isQueued ? (
                      <span className="text-[#e61919] font-medium">In attesa di assegnazione</span>
                    ) : (
                      <span className="text-muted-foreground font-normal">Non assegnato</span>
                    )}
                  </p>
                </div>

                {/* 3. Station route */}
                <div className="min-w-0 border-l-2 border-[#111] pl-3">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Percorso assegnato ({group.stations.length})
                  </p>
                  {group.stations.length > 0 ? (
                    <ol className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                      {group.stations.map((station, index) => (
                        <li key={station.slug} className="text-xs">
                          <span className="font-mono font-bold bg-neutral-200 px-1 py-0.5 text-[#111]">
                            {station.code}
                          </span>{' '}
                          <span className="font-medium">{station.title}</span>
                          {index < group.stations.length - 1 && (
                            <ArrowRight className="inline-block ml-1 size-3 text-[#e61919]" aria-hidden="true" />
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Nessuna tappa assegnata</p>
                  )}
                </div>

                {/* 4. Action buttons */}
                <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                  {/* Presence button */}
                  {!isCompleted && !isQueued && (
                    <Button
                      type="button"
                      variant={isArrived ? 'outline' : 'default'}
                      disabled={isBusy}
                      onClick={() => toggleArrival(group)}
                      title={isArrived ? 'Annulla presenza' : 'Segna come presente'}
                      className="h-8 rounded-none border border-[#111] px-2.5 text-xs font-bold"
                    >
                      {isBusy ? (
                        <LoaderCircle className="animate-spin size-3.5" aria-hidden="true" />
                      ) : isArrived ? (
                        <>
                          <Undo2 className="size-3.5 mr-1" aria-hidden="true" />
                          Annulla presenza
                        </>
                      ) : (
                        <>
                          <Check className="size-3.5 mr-1" aria-hidden="true" />
                          Presente
                        </>
                      )}
                    </Button>
                  )}

                  {/* Complete / Restore button */}
                  {!isCompleted ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => toggleCompletion(group, true)}
                      title="Chiudi il turno di questo gruppo"
                      className="h-8 rounded-none border border-[#111] px-2.5 text-xs font-semibold"
                    >
                      {isBusy ? (
                        <LoaderCircle className="animate-spin size-3.5" aria-hidden="true" />
                      ) : (
                        <>
                          <CheckCheck className="size-3.5 mr-1" aria-hidden="true" />
                          Chiudi
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => toggleCompletion(group, false)}
                      title="Riapri il turno di questo gruppo"
                      className="h-8 rounded-none border border-[#111] px-2.5 text-xs font-semibold"
                    >
                      {isBusy ? (
                        <LoaderCircle className="animate-spin size-3.5" aria-hidden="true" />
                      ) : (
                        <>
                          <RotateCcw className="size-3.5 mr-1" aria-hidden="true" />
                          Riapri
                        </>
                      )}
                    </Button>
                  )}

                  {/* QR Ticket button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openTicketModal(group)}
                    title="Vedi biglietto e codice QR"
                    className="h-8 rounded-none border border-[#111] px-2 text-xs"
                  >
                    <QrCode className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">QR</span>
                  </Button>

                  {/* Edit button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openEditModal(group)}
                    title="Modifica dati gruppo"
                    className="h-8 rounded-none border border-[#111] px-2 text-xs"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">Modifica</span>
                  </Button>

                  {/* Delete button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDeleteGroup(group)}
                    title="Elimina gruppo definitivamente"
                    className="h-8 rounded-none border border-red-300 text-red-700 hover:bg-red-50 px-2 text-xs"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">Elimina</span>
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* MODAL: NUOVO GRUPPO */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-lg rounded-none border-2 border-[#111] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight">
              Aggiungi nuovo gruppo
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Inserisci i dati del gruppo da registrare. Verrà generato automaticamente un codice biglietto univoco.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
            <div>
              <Label htmlFor="create-name" className="text-xs font-bold uppercase">
                Nome gruppo / referente *
              </Label>
              <Input
                id="create-name"
                required
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="es. Famiglia Rossi, Liceo Volta 4B..."
                className="mt-1 h-10 rounded-none border-[#111] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="create-size" className="text-xs font-bold uppercase">
                  Partecipanti (1-6) *
                </Label>
                <Input
                  id="create-size"
                  type="number"
                  min={1}
                  max={6}
                  required
                  value={newGroupSize}
                  onChange={(e) => setNewGroupSize(Math.max(1, Math.min(6, Number(e.target.value))))}
                  className="mt-1 h-10 rounded-none border-[#111] text-sm"
                />
              </div>

              <div>
                <Label htmlFor="create-status" className="text-xs font-bold uppercase">
                  Stato iniziale
                </Label>
                <select
                  id="create-status"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as 'assigned' | 'queued' | 'arrived')}
                  className="mt-1 h-10 w-full border border-[#111] bg-white px-2.5 text-sm outline-none"
                >
                  <option value="assigned">Atteso (Assegnato)</option>
                  <option value="queued">In coda</option>
                  <option value="arrived">Già presente</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="create-tutor" className="text-xs font-bold uppercase">
                Tutor da assegnare
              </Label>
              <select
                id="create-tutor"
                value={newTutorName}
                onChange={(e) => setNewTutorName(e.target.value)}
                className="mt-1 h-10 w-full border border-[#111] bg-white px-2.5 text-sm outline-none"
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
              <Label className="text-xs font-bold uppercase">
                Percorso / Tappe (seleziona almeno una) *
              </Label>
              <div className="mt-2 max-h-48 overflow-y-auto border border-[#111] p-2 space-y-1.5 bg-neutral-50">
                {availableStations.map((station) => {
                  const isChecked = newSelectedStations.includes(station.slug)
                  return (
                    <label
                      key={station.slug}
                      className={`flex items-center gap-2.5 p-2 text-xs cursor-pointer border transition-colors ${
                        isChecked
                          ? 'border-[#111] bg-white font-bold'
                          : 'border-transparent hover:bg-neutral-200/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewSelectedStations((prev) => [...prev, station.slug])
                          } else {
                            setNewSelectedStations((prev) => prev.filter((s) => s !== station.slug))
                          }
                        }}
                        className="size-4 rounded-none accent-[#111]"
                      />
                      <span className="font-mono bg-neutral-200 px-1 py-0.5">{station.code}</span>
                      <span className="flex-1 truncate">{station.title}</span>
                      {station.room && (
                        <span className="text-[10px] text-muted-foreground">{station.room}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            <DialogFooter className="mt-6 flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isCreating}
                onClick={() => setCreateModalOpen(false)}
                className="h-10 rounded-none border-[#111]"
              >
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={isCreating}
                className="h-10 rounded-none bg-[#111] text-white hover:bg-neutral-800"
              >
                {isCreating ? (
                  <>
                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                    Creazione in corso...
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
        <DialogContent className="max-w-lg rounded-none border-2 border-[#111] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight">
              Modifica gruppo
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Modifica i dati, il tutor o il percorso assegnato a {editGroup?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
            <div>
              <Label htmlFor="edit-name" className="text-xs font-bold uppercase">
                Nome gruppo *
              </Label>
              <Input
                id="edit-name"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 h-10 rounded-none border-[#111] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-size" className="text-xs font-bold uppercase">
                  Partecipanti (1-6) *
                </Label>
                <Input
                  id="edit-size"
                  type="number"
                  min={1}
                  max={6}
                  required
                  value={editGroupSize}
                  onChange={(e) => setEditGroupSize(Math.max(1, Math.min(6, Number(e.target.value))))}
                  className="mt-1 h-10 rounded-none border-[#111] text-sm"
                />
              </div>

              <div>
                <Label htmlFor="edit-status" className="text-xs font-bold uppercase">
                  Stato
                </Label>
                <select
                  id="edit-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'assigned' | 'queued' | 'arrived')}
                  className="mt-1 h-10 w-full border border-[#111] bg-white px-2.5 text-sm outline-none"
                >
                  <option value="assigned">Atteso (Assegnato)</option>
                  <option value="queued">In coda</option>
                  <option value="arrived">Presente</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-tutor" className="text-xs font-bold uppercase">
                Tutor assegnato
              </Label>
              <select
                id="edit-tutor"
                value={editTutorName}
                onChange={(e) => setEditTutorName(e.target.value)}
                className="mt-1 h-10 w-full border border-[#111] bg-white px-2.5 text-sm outline-none"
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
              <Label className="text-xs font-bold uppercase">
                Percorso assegnato *
              </Label>
              <div className="mt-2 max-h-48 overflow-y-auto border border-[#111] p-2 space-y-1.5 bg-neutral-50">
                {availableStations.map((station) => {
                  const isChecked = editSelectedStations.includes(station.slug)
                  return (
                    <label
                      key={station.slug}
                      className={`flex items-center gap-2.5 p-2 text-xs cursor-pointer border transition-colors ${
                        isChecked
                          ? 'border-[#111] bg-white font-bold'
                          : 'border-transparent hover:bg-neutral-200/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditSelectedStations((prev) => [...prev, station.slug])
                          } else {
                            setEditSelectedStations((prev) => prev.filter((s) => s !== station.slug))
                          }
                        }}
                        className="size-4 rounded-none accent-[#111]"
                      />
                      <span className="font-mono bg-neutral-200 px-1 py-0.5">{station.code}</span>
                      <span className="flex-1 truncate">{station.title}</span>
                      {station.room && (
                        <span className="text-[10px] text-muted-foreground">{station.room}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            <DialogFooter className="mt-6 flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSavingEdit}
                onClick={() => setEditGroup(null)}
                className="h-10 rounded-none border-[#111]"
              >
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={isSavingEdit}
                className="h-10 rounded-none bg-[#111] text-white hover:bg-neutral-800"
              >
                {isSavingEdit ? (
                  <>
                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                    Salvataggio...
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
        <DialogContent className="max-w-md rounded-none border-2 border-[#111] p-6 shadow-2xl text-center">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight">
              Biglietto {ticketGroup?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Mostra questo codice o QR al tutor all’arrivo.
            </DialogDescription>
          </DialogHeader>

          {ticketGroup && (
            <div className="mt-4 flex flex-col items-center">
              {ticketQrData ? (
                <div className="border-2 border-[#111] p-3 bg-white shadow-sm">
                  <img
                    src={ticketQrData}
                    alt={`Codice QR per ${ticketGroup.name}`}
                    className="size-56 object-contain"
                  />
                </div>
              ) : (
                <div className="flex size-56 items-center justify-center border-2 border-dashed border-[#111] bg-neutral-100">
                  <LoaderCircle className="animate-spin size-8 text-muted-foreground" />
                </div>
              )}

              <p className="mt-4 font-mono text-2xl font-black tracking-widest text-[#111]">
                {formatScanCode(ticketGroup.code)}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Gruppo di {ticketGroup.groupSize} {ticketGroup.groupSize === 1 ? 'persona' : 'persone'}
              </p>

              <div className="mt-6 flex w-full flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    copyToClipboard(
                      `${window.location.origin}/assegnazione/${ticketGroup.id}`,
                      'ticket-link',
                    )
                  }
                  className="h-10 rounded-none border border-[#111] text-xs font-bold"
                >
                  {copiedCode === 'ticket-link' ? (
                    <>
                      <Check className="mr-1.5 size-4 text-emerald-600" />
                      Link copiato negli appunti!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 size-4" />
                      Copia link biglietto
                    </>
                  )}
                </Button>

                <Button
                  nativeButton={false}
                  render={
                    <a
                      href={`/assegnazione/${ticketGroup.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                  variant="default"
                  className="h-10 rounded-none bg-[#111] text-white hover:bg-neutral-800 text-xs font-bold"
                >
                  <ExternalLink className="mr-1.5 size-4" />
                  Apri pagina biglietto
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: CONFERMA ELIMINAZIONE */}
      <Dialog open={deleteGroup !== null} onOpenChange={(open) => !open && setDeleteGroup(null)}>
        <DialogContent className="max-w-md rounded-none border-2 border-[#e61919] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight text-[#e61919]">
              Eliminare definitivamente?
            </DialogTitle>
            <DialogDescription className="text-sm text-foreground">
              Sei sicuro di voler eliminare il gruppo{' '}
              <strong className="text-[#111]">{deleteGroup?.name}</strong> (codice:{' '}
              <span className="font-mono">{deleteGroup?.code}</span>)?
            </DialogDescription>
          </DialogHeader>

          <p className="mt-2 text-xs text-muted-foreground">
            Questa operazione rimuove completamente il gruppo, il suo codice biglietto e tutte le tappe associate dal sistema.
          </p>

          <DialogFooter className="mt-6 flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pendingId !== null}
              onClick={() => setDeleteGroup(null)}
              className="h-10 rounded-none border-[#111]"
            >
              Annulla
            </Button>
            <Button
              type="button"
              disabled={pendingId !== null}
              onClick={confirmDeleteGroup}
              className="h-10 rounded-none bg-[#e61919] text-white hover:bg-red-700"
            >
              {pendingId === deleteGroup?.id ? (
                <>
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                  Eliminazione...
                </>
              ) : (
                'Elimina definitivamente'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
