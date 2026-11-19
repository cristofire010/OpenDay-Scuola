import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/auth'
import { getStaffOverview } from '@/lib/assignments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await guardApi('staff')
  if (denied) return denied

  const overview = await getStaffOverview()

  return NextResponse.json(overview, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
