import Link from 'next/link'
import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={cn('size-9', className)} aria-hidden="true">
      <g fill="none" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 18h5l5-8h10" stroke="var(--blu)" />
        <path d="M8 18h20" stroke="var(--arancio)" />
        <path d="M8 18h5l5 8h10" stroke="var(--verde)" />
      </g>
      <circle cx="8" cy="18" r="4.2" fill="var(--giallo)" stroke="var(--foreground)" strokeWidth="2.2" />
    </svg>
  )
}

export function Brand({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return (
    <Link
      href="/"
      className={cn(
        'group inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4',
        tone === 'light' && 'text-background',
        className,
      )}
      aria-label="OpenVolta, torna alla schermata iniziale"
    >
      <BrandMark className="transition-transform duration-300 group-hover:translate-x-0.5" />
      <span className="display-sm text-lg leading-none">OpenVolta</span>
    </Link>
  )
}
