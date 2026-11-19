'use client'

import { experiments } from '@/lib/experiments'

type Point = [number, number]
type Orientation = 'horizontal' | 'vertical'

const DESKTOP_POINTS: Record<string, Point> = {
  A1: [145, 123],
  A2: [278, 123],
  C1: [562, 123],
  C2: [695, 123],
  B1: [390, 355],
  B2: [535, 355],
}

const MOBILE_POINTS: Record<string, Point> = {
  A1: [145, 102],
  A2: [270, 102],
  C1: [145, 190],
  C2: [270, 190],
  B1: [145, 375],
  B2: [270, 375],
}

function FloorPlan({
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
  const points = horizontal ? DESKTOP_POINTS : MOBILE_POINTS

  return (
    <svg
      viewBox={horizontal ? '0 0 840 420' : '0 0 360 500'}
      className="h-auto w-full"
      role="group"
      aria-label="Pianta orientativa su due piani con sei laboratori selezionabili"
    >
      <rect
        x={horizontal ? 10 : 10}
        y={10}
        width={horizontal ? 820 : 340}
        height={horizontal ? 398 : 480}
        fill="var(--background)"
        stroke="var(--foreground)"
        strokeWidth={4}
      />

      {horizontal ? (
        <>
          <text x="30" y="38" className="fill-foreground text-[17px] font-bold">Primo piano</text>
          <g data-line="blu">
            <rect x="28" y="51" width="370" height="138" fill="var(--line-soft)" stroke="var(--foreground)" strokeWidth="3" />
            <text x="48" y="78" className="fill-foreground text-[16px] font-bold">Laboratorio Ottica</text>
          </g>
          <g data-line="verde">
            <rect x="442" y="51" width="370" height="138" fill="var(--line-soft)" stroke="var(--foreground)" strokeWidth="3" />
            <text x="462" y="78" className="fill-foreground text-[16px] font-bold">Aula Onde</text>
          </g>
          <rect x="398" y="190" width="44" height="64" fill="var(--secondary)" stroke="var(--foreground)" strokeWidth="3" />
          <path d="M405 244l30-44M405 232l22-33M405 220l14-21" fill="none" stroke="var(--foreground)" strokeWidth="3" />
          <text x="420" y="270" textAnchor="middle" className="fill-foreground text-[14px] font-bold">Scale</text>
          <text x="30" y="292" className="fill-foreground text-[17px] font-bold">Piano terra</text>
          <g data-line="arancio">
            <rect x="220" y="304" width="430" height="84" fill="var(--line-soft)" stroke="var(--foreground)" strokeWidth="3" />
            <text x="242" y="324" className="fill-foreground text-[16px] font-bold">Laboratorio Meccanica</text>
          </g>
          <circle cx="92" cy="342" r="24" fill="var(--giallo)" stroke="var(--foreground)" strokeWidth="4" />
          <text x="92" y="347" textAnchor="middle" className="fill-foreground text-[12px] font-bold">IN</text>
          <text x="48" y="380" className="fill-foreground text-[14px] font-bold">Ingresso</text>
        </>
      ) : (
        <>
          <text x="24" y="36" className="fill-foreground text-[16px] font-bold">Primo piano</text>
          <g data-line="blu">
            <rect x="24" y="49" width="312" height="78" fill="var(--line-soft)" stroke="var(--foreground)" strokeWidth="3" />
            <text x="38" y="72" className="fill-foreground text-[14px] font-bold">Laboratorio Ottica</text>
          </g>
          <g data-line="verde">
            <rect x="24" y="137" width="312" height="78" fill="var(--line-soft)" stroke="var(--foreground)" strokeWidth="3" />
            <text x="38" y="160" className="fill-foreground text-[14px] font-bold">Aula Onde</text>
          </g>
          <rect x="148" y="225" width="64" height="46" fill="var(--secondary)" stroke="var(--foreground)" strokeWidth="3" />
          <path d="M156 260l48-34M156 248l32-23M156 236l16-11" fill="none" stroke="var(--foreground)" strokeWidth="3" />
          <text x="180" y="290" textAnchor="middle" className="fill-foreground text-[14px] font-bold">Scale</text>
          <text x="24" y="316" className="fill-foreground text-[16px] font-bold">Piano terra</text>
          <g data-line="arancio">
            <rect x="24" y="328" width="312" height="88" fill="var(--line-soft)" stroke="var(--foreground)" strokeWidth="3" />
            <text x="38" y="352" className="fill-foreground text-[14px] font-bold">Laboratorio Meccanica</text>
          </g>
          <circle cx="68" cy="460" r="22" fill="var(--giallo)" stroke="var(--foreground)" strokeWidth="4" />
          <text x="68" y="464" textAnchor="middle" className="fill-foreground text-[12px] font-bold">IN</text>
          <text x="101" y="465" className="fill-foreground text-[14px] font-bold">Ingresso e accoglienza</text>
        </>
      )}

      {experiments.map((experiment) => {
        const [x, y] = points[experiment.station]
        const selected = selectedSlugs.includes(experiment.slug)
        const unavailable = unavailableSlugs.includes(experiment.slug)

        return (
          <g
            key={experiment.slug}
            role="button"
            tabIndex={unavailable ? -1 : 0}
            aria-pressed={selected}
            aria-disabled={unavailable}
            aria-label={`${experiment.station}: ${experiment.title}`}
            className={`group outline-none ${unavailable ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
            onClick={() => {
              if (!unavailable) onToggle(experiment.slug)
            }}
            onKeyDown={(event) => {
              if (unavailable) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onToggle(experiment.slug)
              }
            }}
          >
            <circle cx={x} cy={y} r={30} fill="transparent" />
            {selected && <circle cx={x} cy={y} r={27} fill="var(--giallo)" />}
            <circle
              cx={x}
              cy={y}
              r={21}
              stroke="var(--foreground)"
              strokeWidth={4}
              className="group-focus-visible:stroke-[6px]"
              style={{ fill: `var(--${experiment.accent})` }}
            />
            <text
              x={x}
              y={y + 6}
              textAnchor="middle"
              className="text-[15px] font-bold"
              style={{
                fontFamily: 'var(--font-archivo)',
                fill: `var(--${experiment.accent}-foreground)`,
              }}
            >
              {experiment.station}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function BuildingMap({
  selectedSlugs,
  onToggle,
  unavailableSlugs,
}: {
  selectedSlugs: string[]
  onToggle: (slug: string) => void
  unavailableSlugs: string[]
}) {
  return (
    <div className="bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="display-sm text-xl">Scegli le tappe sulla mappa</h2>
        <p className="text-sm text-muted-foreground">Schema orientativo su due piani</p>
      </div>

      <div className="mt-3 sm:hidden">
        <FloorPlan
          orientation="vertical"
          selectedSlugs={selectedSlugs}
          onToggle={onToggle}
          unavailableSlugs={unavailableSlugs}
        />
      </div>
      <div className="mt-2 hidden sm:block">
        <FloorPlan
          orientation="horizontal"
          selectedSlugs={selectedSlugs}
          onToggle={onToggle}
          unavailableSlugs={unavailableSlugs}
        />
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
              onClick={() => onToggle(experiment.slug)}
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
