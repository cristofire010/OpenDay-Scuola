'use client'

import { useState } from 'react'
import { KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type SharedPasswordState = {
  configured: boolean
  enabled: boolean
}

export function SharedTutorPassword({ initialState }: { initialState: SharedPasswordState }) {
  const [configured, setConfigured] = useState(initialState.configured)
  const [enabled, setEnabled] = useState(initialState.enabled)
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaved(null)

    if (enabled && !configured && !password.trim()) {
      setError('Per attivarla serve una password comune: scrivila qui sotto.')
      return
    }

    setPending(true)

    try {
      const response = await fetch('/api/admin/tutors/shared-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, password: password.trim() || undefined }),
      })
      const result = await response.json() as { error?: string; configured?: boolean; enabled?: boolean }

      if (!response.ok) {
        setError(result.error ?? 'Non siamo riusciti a salvare la password comune.')
        return
      }

      setConfigured(Boolean(result.configured))
      setEnabled(Boolean(result.enabled))
      setPassword('')
      setSaved(result.enabled ? 'Password comune attiva.' : 'Password comune non attiva.')
    } catch {
      setError('Controlla la connessione e riprova.')
    } finally {
      setPending(false)
    }
  }

  const status = !configured ? 'Nessuna password impostata' : enabled ? 'Attiva' : 'Impostata ma non attiva'

  return (
    <section aria-labelledby="shared-password-title" className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="shared-password-title" className="display-sm flex items-center gap-2 text-xl">
            <KeyRound className="size-5" aria-hidden="true" />
            Password comune dei tutor
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-snug text-muted-foreground">
            Se la attivi, ogni tutor attivo può entrare con il proprio nome utente e questa password, senza usare la
            password personale. È una scelta: puoi tenerla spenta e usare solo le password individuali.
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-sm font-bold">
          {status}
        </span>
      </div>

      <form onSubmit={save} className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="shared-tutor-password" className="text-base font-bold">
            {configured ? 'Nuova password comune' : 'Password comune'}
          </Label>
          <Input
            id="shared-tutor-password"
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={configured ? 'Lascia vuoto per tenere quella attuale' : 'Almeno 8 caratteri'}
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
            className="mt-2 h-11 rounded-lg bg-background px-3.5 font-mono text-base"
          />
        </div>

        <label className="flex h-11 items-center gap-2 rounded-lg border px-3.5 text-base font-bold">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={pending || (!configured && !password.trim())}
            className="size-4 accent-foreground"
          />
          Usa la password comune
        </label>

        <Button type="submit" disabled={pending} className="h-11 rounded-lg font-bold">
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
          Salva
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {saved && (
        <p className="mt-3 rounded-lg bg-muted p-3 text-sm font-bold">{saved}</p>
      )}
    </section>
  )
}
