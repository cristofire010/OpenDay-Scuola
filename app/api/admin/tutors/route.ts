import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/auth'
import { TutorAccountError, createTutorAccount, listTutorAccounts } from '@/lib/tutor-accounts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await guardApi('staff')
  if (denied) return denied

  const accounts = await listTutorAccounts()
  return NextResponse.json({ accounts }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const denied = await guardApi('staff')
  if (denied) return denied

  let body: { username?: unknown; displayName?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }

  try {
    const account = await createTutorAccount({
      username: typeof body.username === 'string' ? body.username : '',
      displayName: typeof body.displayName === 'string' ? body.displayName : '',
      password: typeof body.password === 'string' ? body.password : '',
    })
    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    if (error instanceof TutorAccountError) {
      return NextResponse.json({ error: error.message }, { status: error.code === 'DUPLICATE' ? 409 : 400 })
    }
    console.error('Creazione account tutor non riuscita', error)
    return NextResponse.json({ error: 'Non siamo riusciti a creare l’account.' }, { status: 500 })
  }
}
