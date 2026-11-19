import { NextResponse } from 'next/server'
import { getParticipantStatus } from '@/lib/assignments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const status = await getParticipantStatus(id)

  if (!status) return NextResponse.json({ error: 'Assegnazione non trovata.' }, { status: 404 })

  return NextResponse.json({ arrived: status === 'arrived' }, { headers: { 'Cache-Control': 'no-store' } })
}
