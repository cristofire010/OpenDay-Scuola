import { NextResponse } from 'next/server'
import { getStaffOverview } from '@/lib/assignments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const overview = await getStaffOverview()
  return NextResponse.json(
    { stations: overview.stations },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
