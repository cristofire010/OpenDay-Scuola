import { boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const openDayStations = pgTable('open_day_stations', {
  slug: text('slug').primaryKey(),
  stationCode: text('station_code').notNull().unique(),
  title: text('title').notNull(),
  guideName: text('guide_name').notNull(),
  guideRole: text('guide_role').notNull(),
  room: text('room').notNull(),
  meetingPoint: text('meeting_point').notNull(),
  directions: text('directions').notNull(),
  accent: text('accent').notNull(),
  capacity: integer('capacity').notNull().default(36),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const openDayParticipants = pgTable(
  'open_day_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    displayName: text('display_name').notNull(),
    scanCode: text('scan_code').notNull().unique(),
    requestedStationSlug: text('requested_station_slug'),
    assignedStationSlug: text('assigned_station_slug').notNull(),
    assignedTutorName: text('assigned_tutor_name'),
    groupSize: integer('group_size').notNull().default(1),
    status: text('status').notNull().default('assigned'),
    deviceId: text('device_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    arrivedAt: timestamp('arrived_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    check('open_day_participants_group_size_check', sql`${table.groupSize} between 1 and 6`),
    index('open_day_participants_station_idx').on(table.assignedStationSlug),
    index('open_day_participants_device_idx').on(table.deviceId),
  ],
)

export const openDayParticipantStations = pgTable(
  'open_day_participant_stations',
  {
    participantId: uuid('participant_id')
      .notNull()
      .references(() => openDayParticipants.id, { onDelete: 'cascade' }),
    stationSlug: text('station_slug')
      .notNull()
      .references(() => openDayStations.slug),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('open_day_participant_stations_participant_station_idx').on(table.participantId, table.stationSlug),
    uniqueIndex('open_day_participant_stations_order_idx').on(table.participantId, table.sortOrder),
    index('open_day_participant_stations_station_idx').on(table.stationSlug),
  ],
)

export const openDayTutorAccounts = pgTable('open_day_tutor_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  active: boolean('active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const openDayRateLimits = pgTable('open_day_rate_limits', {
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
  hits: integer('hits').notNull().default(0),
})
