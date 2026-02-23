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

export const guestsRelations = relations(guests, ({ one }) => ({
  user: one(users, {
    fields: [guests.userId],
    references: [users.id],
  }),
  invitation: one(invitations, {
    fields: [guests.invitationId],
    references: [invitations.id],
  }),
}));
