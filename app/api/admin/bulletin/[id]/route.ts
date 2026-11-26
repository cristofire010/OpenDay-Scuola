import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/auth'
import { deleteBulletinMessage } from '@/lib/bulletin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardApi('staff')
  if (denied) return denied

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Comunicato non valido.' }, { status: 400 })

  try {
    const removed = await deleteBulletinMessage(id)
    if (!removed) return NextResponse.json({ error: 'Comunicato non trovato.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Non siamo riusciti a eliminare il comunicato.' }, { status: 500 })
  }
}
