'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AdminLoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: '', password, next }),
      })
      const result = await response.json() as { next?: string; error?: string }

      if (!response.ok) {
        setError(result.error ?? 'Accesso non riuscito. Riprova.')
        setPending(false)
        return
      }

      router.push(result.next ?? next)
      router.refresh()
    } catch {
      setError('Controlla la connessione e riprova.')
      setPending(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="admin-password" className="text-base font-bold">Password di accesso</Label>
          <Input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={pending}
            className="mt-2 h-12 rounded-lg bg-background px-4 text-base"
          />
        </div>

        <div aria-live="polite">
          {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-base text-destructive">{error}</p>}
        </div>

        <Button type="submit" size="lg" disabled={pending || password.length === 0} className="h-12 rounded-lg text-base font-bold">
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" />
              Accesso in corso
            </>
          ) : (
            <>
              Entra
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-5 text-sm leading-snug text-muted-foreground">Accesso riservato allo staff dell’open day.</p>
    </div>
  )
}
