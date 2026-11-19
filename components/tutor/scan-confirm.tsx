'use client'

import { useState } from 'react'
import { Check, LoaderCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ScanConfirm({ id, initialArrived }: { id: string; initialArrived: boolean }) {
  const [arrived, setArrived] = useState(initialArrived)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function update(next: boolean) {
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/tutor/arrivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, arrived: next }),
      })
      if (!response.ok) {
        const result = await response.json() as { error?: string }
        setError(result.error ?? 'Non siamo riusciti a registrare la presenza.')
      } else {
        setArrived(next)
      }
    } catch {
      setError('Controlla la connessione e riprova.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div aria-live="polite" className="mt-6">
      {arrived ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-lg font-bold text-background">
            <Check className="size-5" aria-hidden="true" />
            Presenza confermata
          </p>
          <Button type="button" variant="outline" disabled={pending} onClick={() => update(false)} className="h-11 rounded-md text-base">
            <RotateCcw aria-hidden="true" />
            Annulla conferma
          </Button>
        </div>
      ) : (
        <Button type="button" disabled={pending} onClick={() => update(true)} className="h-14 w-full rounded-md text-lg font-bold">
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
          Conferma arrivo
        </Button>
      )}
      {error && <p role="alert" className="mt-3 text-base text-destructive">{error}</p>}
    </div>
  )
}
