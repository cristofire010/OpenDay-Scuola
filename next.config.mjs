/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permette di aprire il dev server dal telefono: rete locale e tunnel HTTPS
  allowedDevOrigins: ['192.168.1.8', '*.trycloudflare.com'],
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
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          // La fotocamera serve allo scanner QR dell'area tutor.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
