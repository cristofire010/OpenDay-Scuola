import { redirect } from 'next/navigation'

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ esperimento?: string }>
}) {
  const { esperimento } = await searchParams
  redirect(esperimento ? `/?esperimento=${encodeURIComponent(esperimento)}` : '/')
}
