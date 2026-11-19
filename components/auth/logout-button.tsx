'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LogoutButton({ redirectTo = '/accesso' }: { redirectTo?: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function logout() {
    setPending(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push(redirectTo)
      router.refresh()
    }
  }

  return (
    <Button type="button" variant="ghost" className="h-10 rounded-md" onClick={logout} disabled={pending}>
      <LogOut aria-hidden="true" />
      Esci
    </Button>
  )
}
