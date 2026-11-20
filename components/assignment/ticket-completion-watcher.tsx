'use client'

import { useEffect } from 'react'

interface QueueStatus {
  queued?: boolean
  position?: number
  tutorName?: string | null
  completed?: boolean
}

export function TicketCompletionWatcher({ id }: { id: string }) {
  useEffect(() => {
    let active = true
    let checking = false
    let prevQueued: boolean | null = null
    let prevTutorName: string | null = null

    async function check() {
      if (checking) return
      checking = true

      try {
        const response = await fetch(`/api/assignments/${id}/status`, { cache: 'no-store' })
        if (!active || !response.ok) return

        const status = (await response.json()) as QueueStatus
        if (!active) return

        // Aggiorna la posizione in coda direttamente nel DOM, senza ricaricare la pagina.
        document.querySelectorAll<HTMLElement>('#queue-position').forEach((el) => {
          if (typeof status.position === 'number') {
            el.textContent = String(status.position)
          }
        })

        // Il biglietto era in coda ed ora ha un tutor: ricarica per renderlo solidamente
        // server-side (il nome del tutor, le indicazioni e il QR restano uguali, ma il
        // biglietto passa da "in attesa" a "tutor assegnato").
        if (prevQueued === true && status.queued !== true && status.tutorName) {
          window.location.reload()
          return
        }

        if (status.completed === true) window.location.reload()

        prevQueued = status.queued ?? false
        prevTutorName = status.tutorName ?? null
      } catch {
        // Un errore temporaneo della rete viene ripreso al prossimo controllo.
      } finally {
        checking = false
      }
    }

    void check()
    const interval = window.setInterval(() => void check(), 2000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [id])

  return null
}
