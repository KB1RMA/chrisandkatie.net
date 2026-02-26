import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { index, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

const timestampDefault = sql`CURRENT_TIMESTAMP`;

export const users = sqliteTable(
  'User',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    email: text('email'),
    emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
    image: text('image'),
    createdAt: text('createdAt').notNull().default(timestampDefault),
    updatedAt: text('updatedAt').notNull().default(timestampDefault),
  },
  (table) => ({
    emailIndex: uniqueIndex('User_email_key').on(table.email),
  }),
);

export const accounts = sqliteTable(
  'Account',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => ({
    providerAccountIndex: uniqueIndex(
      'Account_provider_providerAccountId_key',
    ).on(table.provider, table.providerAccountId),
  }),
);

export const sessions = sqliteTable(
  'Session',
  {
    sessionToken: text('sessionToken').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    sessionTokenIndex: uniqueIndex('Session_sessionToken_key').on(
      table.sessionToken,
    ),
  }),
);

export const verificationTokens = sqliteTable(
  'VerificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    tokenIndex: uniqueIndex('VerificationToken_token_key').on(table.token),
    identifierTokenIndex: uniqueIndex(
      'VerificationToken_identifier_token_key',
    ).on(table.identifier, table.token),
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  }),
);

export const invitations = sqliteTable('Invitation', {
  id: text('id').primaryKey(),
  relationshipToCouple: text('relationshipToCouple'),
  totalInvited: integer('totalInvited').notNull().default(1),
  address: text('address'),
  addressLine2: text('addressLine2'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zipCode'),
  country: text('country'),
  mailingAddress: text('mailingAddress'),
  visibleEvents: text('visibleEvents').notNull().default('[0,1,2,3]'),
  createdAt: text('createdAt').notNull().default(timestampDefault),
  updatedAt: text('updatedAt').notNull().default(timestampDefault),
});

export const guests = sqliteTable(
  'Guest',
  {
    id: text('id').primaryKey(),
    invitationId: text('invitationId')
      .notNull()
      .references(() => invitations.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    userId: text('userId')
      .references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' })
      .unique(),
    firstName: text('firstName').notNull(),
    lastName: text('lastName').notNull(),
    type: text('type', { enum: ['adult', 'child'] })
      .notNull()
      .default('adult'),
    attending: integer('attending', { mode: 'boolean' }),
    mealChoice: text('mealChoice'),
    dietaryRestrictions: text('dietaryRestrictions'),
    notes: text('notes'),
    createdAt: text('createdAt').notNull().default(timestampDefault),
    updatedAt: text('updatedAt').notNull().default(timestampDefault),
  },
  (table) => ({
    nameIndex: index('Guest_firstName_lastName_idx').on(
      table.firstName,
      table.lastName,
    ),
    userIdIndex: uniqueIndex('Guest_userId_key').on(table.userId),
    invitationIndex: index('Guest_invitationId_idx').on(table.invitationId),
  }),
);

export const usersRelations = relations(users, ({ one, many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  guest: one(guests, {
    fields: [users.id],
    references: [guests.userId],
  }),
}));

export const invitationsRelations = relations(invitations, ({ many }) => ({
  guests: many(guests),
}));

export const guestsRelations = relations(guests, ({ one, many }) => ({
  user: one(users, {
    fields: [guests.userId],
    references: [users.id],
  }),
  invitation: one(invitations, {
    fields: [guests.invitationId],
    references: [invitations.id],
  }),
  guestEvents: many(guestEvents),
  rsvpResponses: many(rsvpResponses),
}));

// Event table for wedding & additional events
export const events = sqliteTable(
  'Event',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    location: text('location'),
    eventDate: text('eventDate').notNull(), // ISO 8601 date
    startTime: text('startTime').notNull(), // HH:MM format
    endTime: text('endTime').notNull(), // HH:MM format
    type: text('type', { enum: ['main', 'rehearsal', 'brunch', 'other'] })
      .notNull()
      .default('main'),
    dressCode: text('dressCode'),
    parkingInfo: text('parkingInfo'),
    sortOrder: integer('sortOrder').notNull().default(0),
    createdAt: text('createdAt').notNull().default(timestampDefault),
    updatedAt: text('updatedAt').notNull().default(timestampDefault),
  },
  (table) => ({
    eventDateIndex: index('Event_eventDate_idx').on(table.eventDate),
    typeIndex: index('Event_type_idx').on(table.type),
  }),
);

// Junction table: links guests to events (M:N relationship)
export const guestEvents = sqliteTable(
  'GuestEvent',
  {
    id: text('id').primaryKey(),
    guestId: text('guestId')
      .notNull()
      .references(() => guests.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    eventId: text('eventId')
      .notNull()
      .references(() => events.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
  },
  (table) => ({
    guestEventUniqueIndex: uniqueIndex('GuestEvent_guestId_eventId_key').on(
      table.guestId,
      table.eventId,
    ),
    guestIdIndex: index('GuestEvent_guestId_idx').on(table.guestId),
    eventIdIndex: index('GuestEvent_eventId_idx').on(table.eventId),
  }),
);

// RSVP response table: tracks guest's response for each event
export const rsvpResponses = sqliteTable(
  'RsvpResponse',
  {
    id: text('id').primaryKey(),
    guestId: text('guestId')
      .notNull()
      .references(() => guests.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    eventId: text('eventId')
      .notNull()
      .references(() => events.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    attendanceStatus: text('attendanceStatus', {
      enum: ['attending', 'not_attending'],
    }).notNull(),
    numberOfAttending: integer('numberOfAttending').notNull().default(0),
    specialRequests: text('specialRequests'),
    submittedAt: text('submittedAt').notNull().default(timestampDefault),
    updatedAt: text('updatedAt').notNull().default(timestampDefault),
  },
  (table) => ({
    rsvpUniqueIndex: uniqueIndex('RsvpResponse_guestId_eventId_key').on(
      table.guestId,
      table.eventId,
    ),
    guestIdIndex: index('RsvpResponse_guestId_idx').on(table.guestId),
    eventIdIndex: index('RsvpResponse_eventId_idx').on(table.eventId),
  }),
);

// Attendee table: individual attendees within an RSVP response
export const attendees = sqliteTable(
  'Attendee',
  {
    id: text('id').primaryKey(),
    rsvpResponseId: text('rsvpResponseId')
      .notNull()
      .references(() => rsvpResponses.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    name: text('name').notNull(),
    mealOption: text('mealOption', {
      enum: ['option_a', 'option_b'],
    }).notNull(),
    dietaryRestrictions: text('dietaryRestrictions'),
    sortOrder: integer('sortOrder').notNull().default(0),
    createdAt: text('createdAt').notNull().default(timestampDefault),
  },
  (table) => ({
    rsvpResponseIdIndex: index('Attendee_rsvpResponseId_idx').on(
      table.rsvpResponseId,
    ),
  }),
);

// Photo table for gallery
export const photos = sqliteTable(
  'Photo',
  {
    id: text('id').primaryKey(),
    imageUrl: text('imageUrl').notNull(),
    caption: text('caption'),
    description: text('description'),
    dateTaken: text('dateTaken'), // ISO 8601 date
    milestone: text('milestone'),
    album: text('album'),
    sortOrder: integer('sortOrder').notNull().default(0),
    createdAt: text('createdAt').notNull().default(timestampDefault),
  },
  (table) => ({
    albumIndex: index('Photo_album_idx').on(table.album),
    dateTakenIndex: index('Photo_dateTaken_idx').on(table.dateTaken),
  }),
);

// Relations
export const eventsRelations = relations(events, ({ many }) => ({
  guestEvents: many(guestEvents),
  rsvpResponses: many(rsvpResponses),
}));

export const guestEventsRelations = relations(guestEvents, ({ one }) => ({
  guest: one(guests, {
    fields: [guestEvents.guestId],
    references: [guests.id],
  }),
  event: one(events, {
    fields: [guestEvents.eventId],
    references: [events.id],
  }),
}));

export const rsvpResponsesRelations = relations(
  rsvpResponses,
  ({ one, many }) => ({
    guest: one(guests, {
      fields: [rsvpResponses.guestId],
      references: [guests.id],
    }),
    event: one(events, {
      fields: [rsvpResponses.eventId],
      references: [events.id],
    }),
    attendees: many(attendees),
  }),
);

export const attendeesRelations = relations(attendees, ({ one }) => ({
  rsvpResponse: one(rsvpResponses, {
    fields: [attendees.rsvpResponseId],
    references: [rsvpResponses.id],
  }),
}));

// Inferred type aliases for schema tables
export type Guest = typeof guests.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type WeddingEvent = typeof events.$inferSelect;
export type GuestEvent = typeof guestEvents.$inferSelect;
export type RsvpResponse = typeof rsvpResponses.$inferSelect;
export type Attendee = typeof attendees.$inferSelect;
