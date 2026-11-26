'use client'

import { useEffect, useState } from 'react'

type CookieConsentState = 'idle' | 'shown' | 'accepted'

const COOKIE_CONSENT_KEY = 'openvolta_cookie_consent'

export function CookieConsent() {
  const [state, setState] = useState<CookieConsentState>('idle')

  useEffect(() => {
    // Check if consent was already given
    const consented = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (consented === 'yes') {
      setState('accepted')
      return
    }

    // Check if already dismissed
    const dismissed = localStorage.getItem('openvolta_cookie_dismissed')
    if (dismissed === 'yes') {
      setState('idle')
      return
    }

    // Show consent banner immediately on entry
    setState('shown')
  }, [])

  const accept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'yes')
    setState('accepted')
  }

  const dismiss = () => {
    localStorage.setItem('openvolta_cookie_dismissed', 'yes')
    setState('idle')
  }

  if (state === 'accepted' || state === 'idle') {
    return null
  }

  return (
    <div
      className="sticky top-0 z-50 w-full border-b border-border bg-background/95 px-4 py-3 shadow-xl"
    >
      <div className="max-w-2xl mx-auto w-full">
        <p className="text-sm text-foreground/80 mb-2">
          Per offrirti la migliore esperienza e per ricordare il tuo biglietto su questo dispositivo, accettiamo i cookie necessari.
        </p>
        <div className="flex gap-3">
          <button
            onClick={accept}
            className="rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/80"
          >
            Accetta cookie necessari
          </button>
          <button
            onClick={dismiss}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/60 hover:bg-background/50"
          >
            No, grazie
          </button>
        </div>
      </div>
    </div>
  )
}