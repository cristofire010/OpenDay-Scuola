"use client"

import { useState, useEffect } from 'react'
import { OpenVoltaExperience } from '@/components/home/openvolta-experience'

type CookieConsentState = 'idle' | 'shown' | 'accepted'

export interface HomeWrapperProps {
  stations: Array<{ slug: string; title: string }>
  children: React.ReactNode
}

export function HomeWrapper({ stations, children }: HomeWrapperProps) {

  const [consentState, setConsentState] = useState<CookieConsentState>('idle')
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [hasExistingTicket, setHasExistingTicket] = useState(false)

  useEffect(() => {
    const checkConsent = () => {
      const consentGiven = localStorage.getItem('openvolta_cookie_consent') === 'yes'
      if (!consentGiven) return

      const storedDeviceId = document.cookie
        .split('; ')
        .find((row) => row.startsWith('openvolta_device_id='))

      if (storedDeviceId) {
        const id = storedDeviceId.split('=')[1]
        setDeviceId(id)
        ;(async () => {
          try {
            const assignments = await fetch(
              `/api/assignments/device/${id}`,
            ).then((res) => res.json()).catch(() => null)
            setHasExistingTicket(!!(assignments && assignments.length > 0))
          } catch {
            setHasExistingTicket(false)
          }
        })()
      }
    }

    checkConsent()

    const interval = setInterval(checkConsent, 2000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (deviceId) {
      ;(async () => {
        try {
          const assignments = await fetch(
            `/api/assignments/device/${deviceId}`,
          ).then((res) => res.json()).catch(() => null)
          setHasExistingTicket(!!(assignments && assignments.length > 0))
        } catch {
          setHasExistingTicket(false)
        }
      })()
    }
  }, [deviceId])

  return (
    <div>
      {children}
      {/* Consent state and deviceId are hidden inputs for reference */}
      <input
        value={consentState}
        style={{ display: 'none' }}
      />
      <input
        value={deviceId || ''}
        style={{ display: 'none' }}
      />
    </div>
  )
}