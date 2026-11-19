import os from 'node:os'
import { headers } from 'next/headers'

const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

export async function getClientIp() {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || h.get('x-real-ip') || 'unknown'
}

/** IPv4 della macchina sulla rete locale: serve ai QR inquadrati dai telefoni. */
function lanAddress() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address
    }
  }
  return null
}

/** SITE_URL è affidabile solo se punta a un dominio: gli IP di rete cambiano. */
function configuredOrigin() {
  const explicit = (process.env.SITE_URL || process.env.V0_RUNTIME_URL)?.replace(/\/$/, '')
  if (!explicit) return null
  try {
    const { hostname } = new URL(explicit)
    if (IPV4.test(hostname)) return null
    return explicit
  } catch {
    return null
  }
}

function protocolFor(hostname: string, forwarded: string | null) {
  if (forwarded) return forwarded
  const bare = hostname.split(':')[0]
  if (LOOPBACK_HOST.test(hostname) || IPV4.test(bare)) return 'http'
  return 'https'
}

/** URL pubblico del sito, usato per i QR. SITE_URL ha la precedenza. */
export async function getOrigin() {
  const configured = configuredOrigin()
  if (configured) return configured
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const forwarded = h.get('x-forwarded-proto')

  // Un QR che punta a localhost, sul telefono, apre il telefono stesso:
  // in sviluppo usiamo l'indirizzo di rete della macchina.
  if (LOOPBACK_HOST.test(host)) {
    const lan = lanAddress()
    const port = host.match(/:(\d+)$/)?.[1]
    if (lan) return `http://${lan}${port ? `:${port}` : ''}`
  }

  return `${protocolFor(host, forwarded)}://${host}`
}
