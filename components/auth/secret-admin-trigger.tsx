'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SEQUENCE = 'admin'

/**
 * Porta segreta all'area accessi: nessun link visibile.
 * Digitando "admin" (fuori da un campo di testo) si apre il login riservato.
 */
export function SecretAdminTrigger() {
  const router = useRouter()

  useEffect(() => {
    let buffer = ''

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (event.key.length !== 1) return

      buffer = (buffer + event.key.toLowerCase()).slice(-SEQUENCE.length)
      if (buffer === SEQUENCE) {
        buffer = ''
        router.push('/admin/accesso?next=%2Fadmin')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [router])

  return null
}
