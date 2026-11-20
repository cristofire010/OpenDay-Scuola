import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/auth'
import { TutorAccountError, deleteTutorAccount, updateTutorAccount } from '@/lib/tutor-accounts'
import { promoteNextFromQueue } from '@/lib/assignments'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardApi('staff')
  if (denied) return denied

  const { id } = await params
  let body: { active?: unknown; displayName?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  const activeBefore = typeof body.active === 'boolean' ? body.active : undefined

  try {
    const account = await updateTutorAccount(id, {
      active: typeof body.active === 'boolean' ? body.active : undefined,
      displayName: typeof body.displayName === 'string' ? body.displayName : undefined,
      password: typeof body.password === 'string' ? body.password : undefined,
    })
    // Un tutor riattivato può servire il primo gruppo in coda.
    if (activeBefore === false && account.active === true) {
      await promoteNextFromQueue().catch((error) => {
        console.error('promoteNextFromQueue fallita dopo la riattivazione di un tutor', error)
      })
    }
    return NextResponse.json({ account })
  } catch (error) {
    if (error instanceof TutorAccountError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'NOT_FOUND' ? 404 : 400 },
      )
    }
    console.error('Aggiornamento account tutor non riuscito', error)
    return NextResponse.json({ error: 'Non siamo riusciti a salvare le modifiche.' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardApi('staff')
  if (denied) return denied

  const { id } = await params
  try {
    await deleteTutorAccount(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof TutorAccountError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('Eliminazione account tutor non riuscita', error)
    return NextResponse.json({ error: 'Non siamo riusciti a eliminare l’account.' }, { status: 500 })
  }
}
