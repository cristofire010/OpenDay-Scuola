import { getLine } from '@/lib/experiments'

interface BadgeProps {
  stop: {
    stationCode: string
    title: string
    room: string
    directions?: string | null
    meetingPoint?: string | null
    accent: string
  }
}

export function Badge({ stop }: BadgeProps) {
  const line = getLine(stop.accent)
  const color = line.colorName === 'blu'
    ? '#2E5CE6'
    : line.colorName === 'arancione'
      ? '#F4B860'
      : line.colorName === 'viola'
        ? '#7C4DDB'
        : '#2E9B4E'
  // Ombreggiatura: scurisci la tonalità per che il testo scuro resti leggibile.
  const shadowColor = color.replace(')', ',0.35)').replace('rgb', 'rgba')

  return (
    <span
      className="flex shrink-0 size-9 items-center justify-center rounded-full text-sm font-bold shadow-[0_2px_5px_-1px_rgba(0,0,0,0.1)]"
      style={{
        background: color,
        boxShadow: `0 2px 5px -1px ${shadowColor}`,
      }}
    >
      {stop.stationCode}
    </span>
  )
}