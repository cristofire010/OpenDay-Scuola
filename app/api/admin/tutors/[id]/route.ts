import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/auth'
import { TutorAccountError, deleteTutorAccount, getTutorAccount, updateTutorAccount } from '@/lib/tutor-accounts'
import { promoteQueuedGroups, reassignTutorGroups } from '@/lib/assignments'

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

  try {
    // Serve il nome precedente: i gruppi sono collegati al displayName, quindi se il
    // tutor viene rinominato o disattivato vanno cercati con il vecchio nome.
    const before = await getTutorAccount(id)
    if (!before) {
      return NextResponse.json({ error: 'Account non trovato.' }, { status: 404 })
    }

    const account = await updateTutorAccount(id, {
      active: typeof body.active === 'boolean' ? body.active : undefined,
      displayName: typeof body.displayName === 'string' ? body.displayName : undefined,
      password: typeof body.password === 'string' ? body.password : undefined,
    })

    const previousName = before.displayName
    const deactivated = before.active && !account.active
    const reactivated = !before.active && account.active
    const renamed = previousName !== account.displayName

    // Disattivazione e rinomina lasciano gruppi "orfani" sul vecchio nome: vanno
    // riassegnati subito (o rimessi in coda se non c'è nessun tutor disponibile).
    // Anche la riattivazione ripulisce eventuali gruppi rimasti appesi al tutor.
    if (deactivated || reactivated || renamed) {
      await reassignTutorGroups(previousName).catch((error) => {
        console.error('Riassegnazione dei gruppi del tutor non riuscita', error)
      })
    }

    // Con un tutor in più la coda può avanzare immediatamente.
    if (reactivated) {
      await promoteQueuedGroups().catch((error) => {
        console.error('Avanzamento della coda dopo la riattivazione non riuscito', error)
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
    const before = await getTutorAccount(id)
    await deleteTutorAccount(id)

    // Anche eliminare un account libera i suoi gruppi: senza questo passaggio
    // resterebbero assegnati a un tutor che non esiste più.
    if (before) {
      await reassignTutorGroups(before.displayName).catch((error) => {
        console.error('Riassegnazione dei gruppi del tutor eliminato non riuscita', error)
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof TutorAccountError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('Eliminazione account tutor non riuscita', error)
    return NextResponse.json({ error: 'Non siamo riusciti a eliminare l’account.' }, { status: 500 })
  }
}
