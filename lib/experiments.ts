import data from './experiments.json'

/** Dimensione massima di un gruppo. */
export const GROUP_SIZE = 6

export type ExperimentCategory = 'Luce e suono' | 'Moto' | 'Elettricità' | 'Finale'
export type ExperimentAccent = 'blu' | 'arancio' | 'verde' | 'viola'

export type Experiment = {
  slug: string
  number: string
  title: string
  shortDescription: string
  description: string
  question: string
  image: string
  imageAlt: string
  category: ExperimentCategory
  duration: string
  age: string
  station: string
  room: string
  meetingPoint: string
  directions: string
  guide: string
  guideRole: string
  guideInitials: string
  accent: ExperimentAccent
  /** true per la tappa finale: non compare fra i laboratori scegliibili. */
  mandatory?: boolean
  materials: string[]
  steps: string[]
}

/**
 * Le linee del laboratorio: ogni linea ha un colore, un'aula e un cartello a terra.
 * Se cambi i colori della segnaletica, aggiorna qui e in lib/experiments.json
 * (poi rilancia `pnpm db:setup` per aggiornare il database).
 */
export type Line = {
  accent: ExperimentAccent
  letter: 'A' | 'B' | 'C' | 'D'
  name: string
  colorName: string
  room: string
  floor: string
}

export const LINES: Line[] = [
  { accent: 'blu', letter: 'A', name: 'Linea blu', colorName: 'blu', room: 'Laboratorio Ottica', floor: 'Primo piano' },
  { accent: 'arancio', letter: 'B', name: 'Linea arancione', colorName: 'arancione', room: 'Laboratorio Meccanica', floor: 'Piano terra' },
  { accent: 'verde', letter: 'C', name: 'Linea verde', colorName: 'verde', room: 'Aula Onde', floor: 'Primo piano' },
  { accent: 'viola', letter: 'D', name: 'Linea viola', colorName: 'viola', room: 'Aula Magna', floor: 'Piano terra' },
]

export const experiments = data as Experiment[]

/** I laboratori che si possono scegliere: la tappa finale non compare nell'elenco. */
export const selectableExperiments = experiments.filter((experiment) => !experiment.mandatory)

/** La tappa finale obbligatoria, aggiunta automaticamente in fondo a ogni giro. */
export const finalStopExperiment = experiments.find((experiment) => experiment.mandatory) ?? null
export const FINAL_STOP_SLUG = finalStopExperiment?.slug ?? null

export function isMandatorySlug(slug: string) {
  return Boolean(FINAL_STOP_SLUG && slug === FINAL_STOP_SLUG)
}

export function getExperiment(slug: string) {
  return experiments.find((experiment) => experiment.slug === slug)
}

export function getLine(accent: string): Line {
  return LINES.find((line) => line.accent === accent) ?? LINES[0]
}
