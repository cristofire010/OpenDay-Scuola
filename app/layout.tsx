import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Archivo, Atkinson_Hyperlegible } from 'next/font/google'
import { SecretAdminTrigger } from '@/components/auth/secret-admin-trigger'
import { Toaster } from '@/components/ui/toast'
import './globals.css'

// Titoli: Archivo con asse di larghezza (usiamo la versione espansa, come sui cartelli).
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
})

// Testi: Atkinson Hyperlegible, pensato per la massima leggibilità.
const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-atkinson',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'OpenVolta — Open Day di Fisica',
    template: '%s · OpenVolta',
  },
  description: 'Scegli un percorso sulla mappa, trova un tutor libero e scopri i laboratori di fisica dell’open day.',
  applicationName: 'OpenVolta',
  keywords: ['open day', 'fisica', 'laboratorio', 'scuola', 'esperimenti'],
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f4f7fb',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${archivo.variable} ${atkinson.variable}`} data-scroll-behavior="smooth">
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-md focus-visible:bg-foreground focus-visible:px-4 focus-visible:py-3 focus-visible:text-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          Salta al contenuto
        </a>
        <Toaster>{children}</Toaster>
        <SecretAdminTrigger />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
