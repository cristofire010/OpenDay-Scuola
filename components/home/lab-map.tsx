'use client'

import { useState } from 'react'
import { LINES, experiments, type Experiment } from '@/lib/experiments'

type Orientation = 'horizontal' | 'vertical'

// Coordinate "di linea": u = distanza dall'accoglienza lungo la linea, w = scostamento laterale.
const STOP_U = [270, 440]
const END_U = 540
const BRANCH_U = 60
const SPREAD = 125
const LINE_OFFSETS = [-SPREAD, 0, SPREAD]

function project(orientation: Orientation, u: number, w: number): [number, number] {
  if (orientation === 'horizontal') return [70 + u, 215 + w]
  return [180 + w * 0.88, 42 + u * 0.64]
}

function wrapTitle(title: string): string[] {
  const words = title.split(' ')
  if (title.length <= 13 || words.length === 1) return [title]
  let best: [string, string] = [title, '']
  let bestDiff = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const diff = Math.abs(a.length - b.length)
    if (diff < bestDiff) {
      bestDiff = diff
      best = [a, b]
    }
  }
  return best
}

function lineIndex(experiment: Experiment) {
  return LINES.findIndex((line) => line.letter === experiment.station[0])
}

function stopIndex(experiment: Experiment) {
  return Number(experiment.station.slice(1)) - 1
}

function MapSvg({
  orientation,
  selectedSlugs,
  onToggle,
  unavailableSlugs,
}: {
  orientation: Orientation
  selectedSlugs: string[]
  onToggle: (slug: string) => void
  unavailableSlugs: string[]
}) {
  const horizontal = orientation === 'horizontal'
  const p = (u: number, w: number) => project(orientation, u, w).join(',')
  const [rx, ry] = project(orientation, 0, 0)

  return (
    <svg
      viewBox={horizontal ? '0 0 840 410' : '0 0 360 490'}
      className="h-auto w-full"
      role="group"
      aria-label="Schema orientativo dei laboratori, con accoglienza e sei postazioni"
    >
      {/* Le linee */}
      {LINES.map((line, index) => {
        const w = LINE_OFFSETS[index]
        const d = `M${p(0, 0)} L${p(BRANCH_U, 0)} L${p(BRANCH_U + Math.abs(w), w)} L${p(END_U, w)}`
        return (
          <path
            key={line.accent}
            d={d}
            pathLength={1}
            fill="none"
            strokeWidth={16}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              stroke: `var(--${line.accent})`,
              strokeDasharray: 1,
              animation: `draw-line 1.1s cubic-bezier(0.4, 0, 0.2, 1) ${index * 160}ms both`,
            }}
          />
        )
      })}

      {/* Capolinea con il nome dell'aula */}
      {LINES.map((line, index) => {
        const w = LINE_OFFSETS[index]
        const [x, y] = project(orientation, END_U, w)
        return (
          <g key={`end-${line.accent}`}>
            <circle cx={x} cy={y} r={9} style={{ fill: 'var(--card)', stroke: 'var(--foreground)' }} strokeWidth={4} />
            {horizontal ? (
              <>
                <text x={x + 24} y={y - 1} className="fill-foreground text-[16px] font-bold" style={{ fontFamily: 'var(--font-atkinson)' }}>
                  {line.room}
                </text>
                <text x={x + 24} y={y + 19} className="fill-muted-foreground text-[14px]" style={{ fontFamily: 'var(--font-atkinson)' }}>
                  {line.floor}
                </text>
              </>
            ) : (
              <>
                <text x={x} y={y + 36} textAnchor="middle" className="fill-foreground text-[15px] font-bold" style={{ fontFamily: 'var(--font-atkinson)' }}>
                  {line.room.replace(/^(Laboratorio|Aula) /, '')}
                </text>
                <text x={x} y={y + 55} textAnchor="middle" className="fill-muted-foreground text-[13px]" style={{ fontFamily: 'var(--font-atkinson)' }}>
                  {line.floor}
                </text>
              </>
            )}
          </g>
        )
      })}

      {/* Accoglienza */}
      <g>
        <circle cx={rx} cy={ry} r={32} style={{ fill: 'var(--giallo)', stroke: 'var(--foreground)' }} strokeWidth={6} />
        <text
          x={horizontal ? rx : rx + 48}
          y={horizontal ? ry + 62 : ry + 6}
          textAnchor={horizontal ? 'middle' : 'start'}
          className="fill-foreground text-[16px] font-bold"
          style={{ fontFamily: 'var(--font-atkinson)' }}
        >
          Accoglienza
        </text>
      </g>

      {/* Le postazioni */}
      {experiments.map((experiment) => {
        const li = lineIndex(experiment)
        const w = LINE_OFFSETS[li]
        const [x, y] = project(orientation, STOP_U[stopIndex(experiment)], w)
        const isSelected = selectedSlugs.includes(experiment.slug)
        const isUnavailable = unavailableSlugs.includes(experiment.slug)
        const lines = wrapTitle(experiment.title)
        const toggle = () => {
          if (!isUnavailable) onToggle(experiment.slug)
        }

        return (
          <g
            key={experiment.slug}
            role="button"
            tabIndex={isUnavailable ? -1 : 0}
            aria-pressed={isSelected}
            aria-disabled={isUnavailable}
            aria-label={`${experiment.station}: ${experiment.title}`}
            className={`group outline-none ${isUnavailable ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
            onClick={toggle}
            onKeyDown={(event) => {
              if (isUnavailable) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                toggle()
              }
            }}
          >
            <circle cx={x} cy={y} r={44} fill="transparent" />
            {isSelected && <circle cx={x} cy={y} r={36} style={{ fill: 'var(--giallo)' }} />}
            <circle
              cx={x}
              cy={y}
              r={42}
              fill="none"
              strokeWidth={3}
              strokeDasharray="5 5"
              className="opacity-0 group-focus-visible:opacity-100"
              style={{ stroke: 'var(--ring)' }}
            />
            <circle
              cx={x}
              cy={y}
              r={27}
              strokeWidth={5}
              style={{
                fill: isSelected ? `var(--${experiment.accent})` : 'var(--card)',
                stroke: 'var(--foreground)',
              }}
            />
            <text
              x={x}
              y={y + 7}
              textAnchor="middle"
              className="text-[20px]"
              style={{
                fontFamily: 'var(--font-archivo)',
                fontStretch: '118%',
                fontWeight: 800,
                fill: isSelected ? `var(--${experiment.accent}-foreground)` : 'var(--foreground)',
              }}
            >
              {experiment.station}
            </text>
            {horizontal &&
              lines.map((text, i) => (
                <text
                  key={text}
                  x={x}
                  y={y - 64 + (lines.length === 1 ? 18 : i * 18)}
                  textAnchor="middle"
                  className="fill-foreground text-[15px] font-bold"
                  style={{ fontFamily: 'var(--font-atkinson)' }}
                >
                  {text}
                </text>
              ))}
          </g>
        )
      })}
    </svg>
  )
}

export function LabMap({
  selectedSlugs: controlledSelection,
  onToggle,
  unavailableSlugs = [],
}: {
  selectedSlugs?: string[]
  onToggle?: (slug: string) => void
  unavailableSlugs?: string[]
}) {
  const [localSelection, setLocalSelection] = useState<string[]>([])
  const selectedSlugs = controlledSelection ?? localSelection

  function toggleStation(slug: string) {
    if (onToggle) {
      onToggle(slug)
    } else {
      setLocalSelection((current) =>
        current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
      )
    }
  }

  return (
    <div className="bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="display-sm text-xl">Scegli le tappe sulla mappa</h2>
        <p className="text-sm text-muted-foreground">Schema orientativo dei laboratori</p>
      </div>

      <div className="mt-3 sm:hidden">
        <MapSvg orientation="vertical" selectedSlugs={selectedSlugs} onToggle={toggleStation} unavailableSlugs={unavailableSlugs} />
      </div>
      <div className="mt-2 hidden sm:block">
        <MapSvg orientation="horizontal" selectedSlugs={selectedSlugs} onToggle={toggleStation} unavailableSlugs={unavailableSlugs} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {experiments.map((experiment) => {
          const selected = selectedSlugs.includes(experiment.slug)
          const unavailable = unavailableSlugs.includes(experiment.slug)
          return (
            <button
              key={experiment.slug}
              type="button"
              data-line={experiment.accent}
              aria-pressed={selected}
              disabled={unavailable}
              onClick={() => toggleStation(experiment.slug)}
              className={`flex min-h-14 items-center gap-2 bg-line-soft px-3 py-2 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'ring-2 ring-foreground' : 'hover:bg-line/15'}`}
            >
              <span className="display flex size-9 shrink-0 items-center justify-center bg-line text-sm text-line-foreground">
                {experiment.station}
              </span>
              <span className="min-w-0 text-sm font-bold leading-tight">{experiment.title}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
        {selectedSlugs.length === 0
          ? 'Tocca una o più tappe, oppure scegli “Sorprendimi”.'
          : `${selectedSlugs.length} ${selectedSlugs.length === 1 ? 'tappa scelta' : 'tappe scelte'}. Tocca di nuovo per rimuoverne una.`}
      </p>
    </div>
  )
}
