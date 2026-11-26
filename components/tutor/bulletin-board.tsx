'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { LoaderCircle, Megaphone, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

type BulletinMessage = {
  id: string
  author: string
  body: string
  createdAt: string
}

async function fetchMessages(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Bacheca non disponibile')
  return response.json() as Promise<{ messages: BulletinMessage[] }>
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

type BulletinBoardProps = {
  /** Solo lo staff può pubblicare: i tutor vedono soltanto i messaggi. */
  canPublish?: boolean
}

/** Bacheca: solo il personale amministrativo può pubblicare, tutti possono visualizzare. */
export function BulletinBoard({ canPublish = false }: BulletinBoardProps) {
  const { data, error, mutate } = useSWR<{ messages: BulletinMessage[] }>('/api/tutor/bulletin', fetchMessages, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  })
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = body.trim()
    if (!text) return

    setPending(true)
    setPostError(null)

    try {
      const response = await fetch('/api/tutor/bulletin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      if (!response.ok) {
        const result = await response.json() as { error?: string }
        setPostError(result.error ?? 'Non siamo riusciti a pubblicare il messaggio.')
        return
      }
      setBody('')
      await mutate()
    } catch {
      setPostError('Controlla la connessione e riprova.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section aria-labelledby="bulletin-title" className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <h2 id="bulletin-title" className="display-sm flex items-center gap-2 text-2xl">
        <Megaphone className="size-5" aria-hidden="true" />
        Bacheca delle comunicazioni
      </h2>
      <p className="mt-2 max-w-2xl text-base leading-snug text-muted-foreground">
        Comunicazioni per il personale: avvisi rapidi, cambi di turno e cose da sapere durante l’apertura.
      </p>

      {canPublish && (
        <form onSubmit={publish} className="mt-4 flex flex-col gap-2">
          <label htmlFor="bulletin-body" className="sr-only">Nuovo messaggio per la bacheca</label>
          <textarea
            id="bulletin-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Scrivi un comunicato per il personale…"
            className="w-full rounded-lg border border-input bg-background p-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{body.length}/500</span>
            <Button type="submit" disabled={pending || body.trim().length === 0} className="h-10 rounded-md text-sm">
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Send aria-hidden="true" />
              )}
              Pubblica
            </Button>
          </div>
        </form>
      )}

      {postError && (
        <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{postError}</p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">La bacheca non si aggiorna. Riprova tra poco.</p>
      )}

      {data && data.messages.length === 0 && (
        <p className="mt-5 rounded-lg border border-dashed p-4 text-base text-muted-foreground">
          Nessun messaggio: la bacheca è ancora vuota.
        </p>
      )}

      {data && data.messages.length > 0 && (
        <ul className="mt-5 flex flex-col gap-3">
          {data.messages.map((message) => (
            <li key={message.id} className="rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-bold">{message.author}</span>
                <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-base leading-snug">{message.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}