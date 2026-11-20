import { NextResponse } from 'next/server'
import {
  getQueueStatus,
  promoteNextFromQueue,
} from '@/lib/assignments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const status = await getQueueStatus(id)
  if (!status) {
    return NextResponse.json({ error: 'Assegnazione non trovata.' }, { status: 404 })
  }

  // Se il biglietto è ancora in coda, il polling stesso può far avanzare la coda:
  // il primo gruppo in coda viene servito non appena un tutor è libero.
  if (status.queued) {
    await promoteNextFromQueue().catch((error) => {
      console.error('promoteNextFromQueue fallita durante il polling dello stato', error)
    })
    const refreshed = await getQueueStatus(id)
    if (refreshed) {
      return NextResponse.json(refreshed, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }
  }

  return NextResponse.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
