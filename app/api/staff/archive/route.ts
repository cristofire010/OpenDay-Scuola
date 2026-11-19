import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/auth'
import { deleteArchivedGroup, listArchive, purgeArchive } from '@/lib/archive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await guardApi('staff')
  if (denied) return denied

  const archive = await listArchive()
  return NextResponse.json(archive, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: Request) {
  const denied = await guardApi('staff')
  if (denied) return denied

  const id = new URL(request.url).searchParams.get('id')?.trim()

  if (id) {
    const deleted = await deleteArchivedGroup(id)
    if (!deleted) return NextResponse.json({ error: 'Gruppo archiviato non trovato.' }, { status: 404 })
    return NextResponse.json({ ok: true, deleted: 1 })
  }

  const deleted = await purgeArchive(true)
  return NextResponse.json({ ok: true, deleted })
}
