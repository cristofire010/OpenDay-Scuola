'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { KeyRound, LoaderCircle, ShieldCheck, TriangleAlert, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Brand } from '@/components/brand'
import { Suspense, useState } from 'react'

export default function TutorAccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      < TutorAccessForm />
    </Suspense>
  )
}

function TutorAccessForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/tutor'
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const form = event.currentTarget
    const username = form.username.value.trim().toLowerCase()
    const password = form.password.value

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const result = await response.json() as { error?: string }

      if (!response.ok) {
        setError(result.error ?? 'Nome utente o password non corretti.')
        return
      }

      // Login succeeded: reload per leggere il cookie di sessione
      router.refresh()
      window.location.href = next
    } catch {
      setError('Controlla la connessione e riprova.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="section-shell flex h-[72px] items-center justify-between gap-4">
          <Brand />
          <Button nativeButton={false} render={<a href="/" />} variant="ghost" className="h-10 rounded-lg">
            <ArrowLeft aria-hidden="true" />
            Torna al sito
          </Button>
        </div>
      </header>
      <main id="main-content" className="section-shell flex justify-center py-12 sm:py-20">
        <div className="w-full max-w-md">
          <p className="inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-sm font-bold text-background">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Area tutor
          </p>
          <h1 className="display mt-4 text-3xl sm:text-4xl">Accesso tutor</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
            Inserisci nome utente e password per entrare nella tua area.
          </p>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-4 text-base text-destructive">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="mt-8 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
            <form onSubmit={login} className="flex flex-col gap-4">
              <div>
                <label htmlFor="username" className="block text-base font-bold">Nome utente</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="mt-2 h-11 rounded-lg bg-background px-3.5 text-base font-mono"
                  placeholder="giulia.rinaldi"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-base font-bold">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  className="mt-2 h-11 rounded-lg bg-background px-3.5 text-base font-mono"
                  placeholder="La tua password"
                />
              </div>
              <Button type="submit" disabled={pending} className="h-11 rounded-lg text-base font-bold">
                {pending ? <LoaderCircle className="animate-spin mr-2" aria-hidden="true" /> : <KeyRound className="mr-2" aria-hidden="true" />}
                Accedi
              </Button>
            </form>
          </div>

          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <KeyRound className="size-4" aria-hidden="true" />
            Non ti è stato dato un account? Chiedi alla regia.
          </p>
        </div>
      </main>
    </div>
  )
}