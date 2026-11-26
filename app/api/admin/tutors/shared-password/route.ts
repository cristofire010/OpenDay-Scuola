import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/auth'
import {
  SharedPasswordError,
  getSharedTutorPasswordState,
  setSharedTutorPassword,
  setSharedTutorPasswordEnabled,
} from '@/lib/tutor-settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await guardApi('staff')
  if (denied) return denied

  const state = await getSharedTutorPasswordState()
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: Request) {
  const denied = await guardApi('staff')
  if (denied) return denied

  let body: { enabled?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  const password = typeof body.password === 'string' ? body.password : ''
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : undefined

  if (!password && enabled === undefined) {
    return NextResponse.json({ error: 'Nessuna modifica da salvare.' }, { status: 400 })
  }

  try {
    // Una nuova password viene salvata e attivata, a meno che lo staff non la
    // voglia tenere pronta ma spenta.
    if (password) {
      await setSharedTutorPassword(password)
      const state = enabled === false
        ? await setSharedTutorPasswordEnabled(false)
        : await getSharedTutorPasswordState()
      return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } })
    }

    const state = await setSharedTutorPasswordEnabled(enabled === true)
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof SharedPasswordError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Aggiornamento della password comune non riuscito', error)
    return NextResponse.json({ error: 'Non siamo riusciti a salvare la password comune.' }, { status: 500 })
  }
}
