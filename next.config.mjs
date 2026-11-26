import os from 'node:os'

/**
 * Next.js blocks cross-origin requests to its dev resources (HMR, dev overlay)
 * unless the host is listed here. When the site is opened from a phone via the
 * computer's LAN address the IP changes with the network, so we collect every
 * local IPv4 address instead of hard-coding one.
 */
function localDevOrigins() {
  const origins = new Set(['localhost', '127.0.0.1', '192.168.1.8'])

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        origins.add(entry.address)
      }
    }
  }

  return [...origins]
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permette di aprire il dev server dal telefono: rete locale e tunnel HTTPS
  allowedDevOrigins: [...localDevOrigins(), '*.trycloudflare.com', '*.loca.lt'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // HSTS only makes sense over HTTPS: in development the site is served
          // over plain HTTP on the LAN, so the header is skipped there.
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000' }]
            : []),
          // La fotocamera serve allo scanner QR dell'area tutor.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
