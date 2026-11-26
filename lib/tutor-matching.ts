/** Regole con cui i gruppi vengono affidati ai tutor. */

/** Un tutor accompagna al massimo un gruppo. */
export const MAX_GROUPS_PER_TUTOR = 1

/** E oltre i dodici ragazzi in tutto non ne prende altri. */
export const MAX_TUTOR_PEOPLE = 12

/** Due giri sono "simili" se differiscono per al massimo due laboratori. */
export const ROUTE_TOLERANCE = 2

/** Distanza usata quando il tutor non ha ancora gruppi da confrontare. */
const NO_ROUTE = 99

export type TutorLoad = {
  name: string
  groups: Array<{ size: number; slugs: string[] }>
}

/** Laboratori in uno ma non nell'altro (differenza simmetrica). */
export function routeDistance(a: string[], b: string[]) {
  const first = new Set(a)
  const second = new Set(b)
  let distance = 0
  for (const slug of first) if (!second.has(slug)) distance += 1
  for (const slug of second) if (!first.has(slug)) distance += 1
  return distance
}

/**
 * Sceglie il tutor per un giro: prima chi ha già un gruppo con le stesse tappe,
 * poi chi ne ha uno simile (1–2 laboratori di differenza), poi il meno carico.
 */
export function pickTutor(loads: TutorLoad[], routeSlugs: string[], groupSize: number): string | null {
  const candidates = loads
    .map((load) => {
      const people = load.groups.reduce((sum, group) => sum + group.size, 0)
      if (load.groups.length >= MAX_GROUPS_PER_TUTOR) return null
      if (people + groupSize > MAX_TUTOR_PEOPLE) return null

      const distances = load.groups.map((group) => routeDistance(group.slugs, routeSlugs))
      const best = distances.length > 0 ? Math.min(...distances) : NO_ROUTE

      return {
        name: load.name,
        sameRoute: best === 0,
        nearRoute: best <= ROUTE_TOLERANCE,
        best,
        people,
        groups: load.groups.length,
      }
    })
    .filter((candidate) => candidate !== null)

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (a.sameRoute !== b.sameRoute) return a.sameRoute ? -1 : 1
    if (a.nearRoute !== b.nearRoute) return a.nearRoute ? -1 : 1
    // La distanza conta solo fra giri simili: altrimenti si bilancia il carico.
    if (a.nearRoute && b.nearRoute && a.best !== b.best) return a.best - b.best
    if (a.people !== b.people) return a.people - b.people
    if (a.groups !== b.groups) return a.groups - b.groups
    return a.name.localeCompare(b.name, 'it')
  })

  return candidates[0].name
}
