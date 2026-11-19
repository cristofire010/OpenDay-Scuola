import type { ExperimentAccent } from './experiments'

export type StationAvailability = {
  slug: string
  code: string
  title: string
  guideName: string
  guideRole: string
  room: string
  meetingPoint: string
  directions: string
  accent: ExperimentAccent
  capacity: number
  total: number
  arrived: number
  remaining: number
}

export type StaffOverview = {
  stations: StationAvailability[]
  total: number
  arrived: number
  activeStations: number
}
