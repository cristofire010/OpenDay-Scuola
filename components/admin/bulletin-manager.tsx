'use client'

import { useState } from 'react'
import { LoaderCircle, Megaphone, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type AdminBulletinMessage = {
  id: string
  author: string
  body: string
  createdAt: string
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Sezione admin per creare e gestire le comunicazioni della bacheca. */
export function BulletinManager({ initialMessages }: { initialMessages: AdminBulletinMessage[] }) {
  const [messages, setMessages] = useState<AdminBulletinMessage[]>(initialMessages)
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = body.trim()
    if (!text) return

    setPending(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch('/api/tutor/bulletin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const result = await response.json() as { error?: string; message?: AdminBulletinMessage }

      if (!response.ok || !result.message) {
        setError(result.error ?? 'Non siamo riusciti a pubblicare il comunicato.')
        return
      }

      setMessages((current) => [result.message as AdminBulletinMessage, ...current])
      setBody('')
      setNotice('Comunicato pubblicato sulla bacheca.')
    } catch {
      setError('Controlla la connessione e riprova.')
    } finally {
      setPending(false)
    }
  }

  async function remove(id: string) {
    setDeletingId(id)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch(`/api/admin/bulletin/${id}`, { method: 'DELETE' })
      const result = await response.json() as { error?: string }

      if (!response.ok) {
        setError(result.error ?? 'Non siamo riusciti a eliminare il comunicato.')
        return
      }

      setMessages((current) => current.filter((message) => message.id !== id))
      setConfirmId(null)
      setNotice('Comunicato eliminato.')
    } catch {
      setError('Controlla la connessione e riprova.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="bulletin-new-title" className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 id="bulletin-new-title" className="display-sm flex items-center gap-2 text-xl">
          <Megaphone className="size-5" aria-hidden="true" />
          Nuovo comunicato
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-snug text-muted-foreground">
          Il testo compare subito nella bacheca dei tutor. Resta visibile finché non lo elimini da questa pagina.
        </p>

        <form onSubmit={publish} className="mt-4 flex flex-col gap-2">
          <label htmlFor="admin-bulletin-body" className="sr-only">Testo del comunicato</label>
          <textarea
            id="admin-bulletin-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Scrivi un comunicato per il personale…"
            className="w-full rounded-lg border border-input bg-background p-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{body.length}/500</span>
            <Button type="submit" disabled={pending || body.trim().length === 0} className="h-10 rounded-md text-sm">
              {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              Pubblica
            </Button>
          </div>
        </form>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        )}
        {notice && (
          <p className="mt-3 rounded-lg bg-muted p-3 text-sm font-bold">{notice}</p>
        )}
      </section>

      <section aria-labelledby="bulletin-list-title" className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="bulletin-list-title" className="display-sm text-xl">Comunicazioni pubblicate</h2>
          <span className="text-sm text-muted-foreground">{messages.length} in bacheca</span>
        </div>

        {messages.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed p-4 text-base text-muted-foreground">
            La bacheca è ancora vuota: pubblica il primo comunicato qui sopra.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {messages.map((message) => (
              <li key={message.id} className="rounded-lg border bg-background p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-bold">{message.author}</span>
                  <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-base leading-snug">{message.body}</p>

                <div className="mt-3 flex items-center gap-2">
                  {confirmId === message.id ? (
                    <>
                      <Button
                        type="button"
                        onClick={() => remove(message.id)}
                        disabled={deletingId === message.id}
                        className="h-9 rounded-md bg-destructive px-3 text-sm text-white hover:bg-destructive/90"
                      >
                        {deletingId === message.id ? (
                          <LoaderCircle className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 aria-hidden="true" />
                        )}
                        Elimina
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setConfirmId(null)}
                        disabled={deletingId === message.id}
                        className="h-9 rounded-md px-3 text-sm"
                      >
                        Annulla
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setConfirmId(message.id); setNotice(null); setError(null) }}
                      className="h-9 rounded-md px-3 text-sm"
                    >
                      <Trash2 aria-hidden="true" />
                      Elimina
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
