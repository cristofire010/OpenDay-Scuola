'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, KeyRound, LoaderCircle, Plus, Trash2, UserRoundCheck, UserRoundX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type TutorAccountView = {
  id: string
  username: string
  displayName: string
  active: boolean
  lastLoginAt: string | null
  createdAt: string
}

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generatePassword(length = 12) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join('')
}

// L'apostrofo non separa le parti del nome utente: "D'Angelo" diventa "dangelo",
// non "d.angelo". Restano separatori solo gli spazi e gli altri segni.
const APOSTROPHES = /['\u2018\u2019\u0060\u00b4]/g

function suggestUsername(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(APOSTROPHES, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 32)
}

function formatDate(value: string | null) {
  if (!value) return 'mai entrato'
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const emptyForm = { displayName: '', username: '', password: '' }

export function TutorAccountsManager({ accounts }: { accounts: TutorAccountView[] }) {
  const router = useRouter()
  const [form, setForm] = useState(emptyForm)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function update<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/tutors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json() as { error?: string }

      if (!response.ok) {
        setError(result.error ?? 'Non siamo riusciti a creare l’account.')
        return
      }

      setCredentials({ username: form.username.trim().toLowerCase(), password: form.password })
      setCopied(false)
      setForm(emptyForm)
      router.refresh()
    } catch {
      setError('Controlla la connessione e riprova.')
    } finally {
      setPending(false)
    }
  }

  async function patchAccount(id: string, body: Record<string, unknown>) {
    setBusyId(id)
    setError(null)
    try {
      const response = await fetch(`/api/admin/tutors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) {
        setError(result.error ?? 'Non siamo riusciti a salvare le modifiche.')
        return false
      }
      router.refresh()
      return true
    } catch {
      setError('Controlla la connessione e riprova.')
      return false
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(account: TutorAccountView) {
    await patchAccount(account.id, { active: !account.active })
  }

  async function resetPassword(account: TutorAccountView) {
    const password = generatePassword()
    const ok = await patchAccount(account.id, { password })
    if (ok) {
      setCredentials({ username: account.username, password })
      setCopied(false)
    }
  }

  async function removeAccount(account: TutorAccountView) {
    if (!window.confirm(`Eliminare l’account di ${account.displayName}? L’operazione non si può annullare.`)) return

    setBusyId(account.id)
    setError(null)
    try {
      const response = await fetch(`/api/admin/tutors/${account.id}`, { method: 'DELETE' })
      const result = await response.json() as { error?: string }
      if (!response.ok) {
        setError(result.error ?? 'Non siamo riusciti a eliminare l’account.')
        return
      }
      router.refresh()
    } catch {
      setError('Controlla la connessione e riprova.')
    } finally {
      setBusyId(null)
    }
  }

  async function copyCredentials() {
    if (!credentials) return
    try {
      await navigator.clipboard.writeText(`Nome utente: ${credentials.username}\nPassword: ${credentials.password}`)
      setCopied(true)
    } catch {
      setError('Copia non disponibile: seleziona le credenziali a mano.')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <section aria-labelledby="accounts-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="accounts-title" className="display-sm text-2xl">Account tutor</h2>
            <p className="mt-1 text-base text-muted-foreground">
              {accounts.length === 0
                ? 'Nessun account: creane uno per far entrare i tutor.'
                : `${accounts.length} account · ${accounts.filter((account) => account.active).length} attivi`}
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-base text-destructive">{error}</p>
        )}

        {credentials && (
          <div role="status" className="mt-4 rounded-xl border-2 border-foreground bg-giallo p-4 text-giallo-foreground">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide">Credenziali da consegnare ora</p>
                <p className="mt-2 font-mono text-base font-bold">{credentials.username}</p>
                <p className="font-mono text-base">{credentials.password}</p>
                <p className="mt-2 text-sm">La password non verrà più mostrata: copiala adesso.</p>
              </div>
              <Button type="button" variant="outline" onClick={copyCredentials} className="h-10 rounded-lg border-foreground bg-background">
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? 'Copiato' : 'Copia'}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3">
          {accounts.length === 0 && (
            <p className="rounded-xl border border-dashed p-6 text-base text-muted-foreground">
              Crea il primo account dal modulo qui accanto: il tutor userà nome utente e password per entrare.
            </p>
          )}

          {accounts.map((account) => (
            <article key={account.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="display flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-base">
                    {account.displayName.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">{account.displayName}</h3>
                    <p className="truncate font-mono text-sm text-muted-foreground">@{account.username}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      Ultimo accesso: {formatDate(account.lastLoginAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-sm font-bold',
                      account.active ? 'bg-verde/20 text-foreground' : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {account.active ? 'Attivo' : 'Disattivato'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resetPassword(account)}
                    disabled={busyId === account.id}
                    className="h-9 rounded-lg"
                  >
                    {busyId === account.id ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
                    Nuova password
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => toggleActive(account)}
                    disabled={busyId === account.id}
                    className="h-9 rounded-lg"
                  >
                    {account.active ? <UserRoundX aria-hidden="true" /> : <UserRoundCheck aria-hidden="true" />}
                    {account.active ? 'Disattiva' : 'Riattiva'}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => removeAccount(account)}
                    disabled={busyId === account.id}
                    className="h-9 rounded-lg"
                    aria-label={`Elimina account di ${account.displayName}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="new-account-title" className="rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-6">
        <h2 id="new-account-title" className="display-sm text-xl">Nuovo tutor</h2>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">
          Il nome è quello con cui il tutor accompagna i gruppi: i partecipanti lo vedono sul biglietto.
        </p>

        <form onSubmit={createAccount} className="mt-5 flex flex-col gap-4">
          <div>
            <Label htmlFor="displayName" className="text-base font-bold">Nome e cognome</Label>
            <Input
              id="displayName"
              value={form.displayName}
              onChange={(event) => {
                const value = event.target.value
                setForm((current) => ({
                  ...current,
                  displayName: value,
                  username: current.username === suggestUsername(current.displayName) || current.username === ''
                    ? suggestUsername(value)
                    : current.username,
                }))
              }}
              placeholder="Giulia Rinaldi"
              maxLength={80}
              required
              disabled={pending}
              className="mt-2 h-11 rounded-lg bg-background px-3.5 text-base"
            />
          </div>

          <div>
            <Label htmlFor="new-username" className="text-base font-bold">Nome utente</Label>
            <Input
              id="new-username"
              value={form.username}
              onChange={(event) => update('username', event.target.value.toLowerCase().replace(APOSTROPHES, ''))}
              placeholder="giulia.rinaldi"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={32}
              required
              disabled={pending}
              className="mt-2 h-11 rounded-lg bg-background px-3.5 font-mono text-base"
            />
          </div>

          <div>
            <Label htmlFor="new-password" className="text-base font-bold">Password</Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="new-password"
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
                placeholder="Almeno 8 caratteri"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={pending}
                className="h-11 rounded-lg bg-background px-3.5 font-mono text-base"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => update('password', generatePassword())}
                disabled={pending}
                className="h-11 shrink-0 rounded-lg"
                aria-label="Genera una password"
              >
                <KeyRound aria-hidden="true" />
                Genera
              </Button>
            </div>
          </div>

          <Button type="submit" disabled={pending} className="h-11 rounded-lg text-base font-bold">
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            Crea account
          </Button>
        </form>
      </section>
    </div>
  )
}
