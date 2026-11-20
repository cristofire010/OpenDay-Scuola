'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type CookieConsentState = 'idle' | 'shown' | 'accepted'

export function useCookieConsent() {
  const [state, setState] = useState<CookieConsentState>('idle')
  const [deviceId, setDeviceId] = useState<string | null>(null)

  useEffect(() => {
    const checkConsent = () => {
      const consented = localStorage.getItem('openvolta_cookie_consent')
      if (consented === 'yes') {
        setState('accepted')
        // Try to restore device ID from cookie
        const storedDeviceId = document.cookie
          .split('; ')
          .find((row) => row.startsWith('openvolta_device_id='))
        if (storedDeviceId) {
          setDeviceId(storedDeviceId.split('=')[1])
        } else {
          const newDeviceId = generateDeviceId()
          setDeviceId(newDeviceId)
          // Set cookie (necessary for tracking)
          document.cookie = `${DEVICE_ID_KEY}=${newDeviceId};path=/;max-age=31536000;secure;same-site=lax`
        }
      } else {
        const dismissed = localStorage.getItem('openvolta_cookie_dismissed')
        if (dismissed === 'yes') {
          setState('idle')
        } else {
          setState('shown')
        }
      }
    }

    checkConsent()

    // Poll every 2 seconds for consent if not already given
    const interval = setInterval(checkConsent, 2000)

    return () => clearInterval(interval)
  }, [])

  const accept = () => {
    localStorage.setItem('openvolta_cookie_consent', 'yes')
    setState('accepted')
  }

  const dismiss = () => {
    localStorage.setItem('openvolta_cookie_dismissed', 'yes')
    setState('idle')
  }

  const generateDeviceId = (): string => {
    const hash = `${window.location.hostname}-${Math.random().toString(36).slice(2, 15)}`
    return hash
  }

  const DEVICE_ID_KEY = 'openvolta_device_id'

  return { state, deviceId, accept, dismiss }
}

export function useExistingTicket(deviceId: string | null) {
  const [hasExistingTicket, setHasExistingTicket] = useState<boolean>(false)

  useEffect(() => {
    if (!deviceId) return

    const checkTicket = async () => {
      try {
        const assignments = await fetch(
          `/api/assignments/device/${deviceId}`,
        ).then((res) => res.json()).catch(() => null)
        setHasExistingTicket(!!(assignments && assignments.length > 0))
      } catch {
        setHasExistingTicket(false)
      }
    }

    checkTicket()
  }, [deviceId])

  return hasExistingTicket
}