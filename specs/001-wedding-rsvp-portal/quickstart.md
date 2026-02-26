# Quickstart: Wedding RSVP Portal

**Date**: February 26, 2026  
**Branch**: `001-wedding-rsvp-portal`  
**Prerequisites**: Node.js 18+, Wrangler CLI, existing chrisandkatie.net project setup

## Overview

This guide walks through setting up and developing the Wedding RSVP Portal feature. It covers:
1. Database schema setup (Drizzle + D1)
2. Authentication configuration (Auth.js)
3. Implementing core pages and forms
4. Testing the RSVP workflow
5. Deployment to Cloudflare Workers

---

## Step 1: Database Schema & Migrations

### 1.1 Define Schema

Update `src/lib/db/schema.ts` with entities from [data-model.md](data-model.md):

```typescript
import { sqliteTable, integer, text, primaryKey, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Copy all table definitions from data-model.md
export const invitation = sqliteTable('invitation', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  maxGuests: integer('max_guests').notNull(),
  notes: text('notes'),
  // ... (see data-model.md for full schema)
});

export const guest = sqliteTable('guest', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  invitationId: integer('invitation_id').notNull().references(() => invitation.id, { onDelete: 'cascade' }),
  // ... (see data-model.md for full schema)
});

// Continue with event, guest_event, rsvp_response, attendee, photo
// [Paste complete schema from data-model.md]
```

### 1.2 Generate Migration

```bash
# Generate migration files
npx drizzle-kit generate --name initial_schema

# Review migration in migrations/
# Should contain CREATE TABLE statements for all entities
```

### 1.3 Apply Migration to D1

```bash
# Local development
npm run db:migrate

# Production deployment via wrangler
wrangler d1 migrations apply <DATABASE_NAME> --local
wrangler d1 migrations apply <DATABASE_NAME> --remote
```

---

## Step 2: Load Test Data

Before RSVP goes live, populate the guest list and schedule:

### 2.1 Create Seed Script

`scripts/seed-rsvp-data.ts`:

```typescript
import { db } from '@/lib/db';
import { invitation, guest, event, guestEvent } from '@/lib/db/schema';

async function seedRsvpData() {
  // Create main wedding invitation
  const mainInvite = await db.insert(invitation).values({
    maxGuests: 2,
    notes: 'Chris & Katie - Main Ceremony',
  }).returning();

  // Add guests to invitation
  await db.insert(guest).values([
    { firstName: 'John', lastName: 'Smith', invitationId: mainInvite[0].id },
    { firstName: 'Jane', lastName: 'Smith', invitationId: mainInvite[0].id },
  ]);

  // Create wedding events
  const ceremonyEvent = await db.insert(event).values({
    name: 'Wedding Ceremony',
    description: 'Join us for the ceremony',
    location: 'Central Park Pavilion',
    eventDate: '2026-06-27',
    eventTime: '18:00',
    duration: 60,
    type: 'main',
    sortOrder: 1,
  }).returning();

  // Link guests to ceremony
  const guests = await db.select().from(guest);
  for (const g of guests) {
    await db.insert(guestEvent).values({
      guestId: g.id,
      eventId: ceremonyEvent[0].id,
    });
  }

  console.log('✅ Seed data loaded');
}

seedRsvpData().catch(console.error);
```

Run: `npm run ts-node scripts/seed-rsvp-data.ts`

---

## Step 3: Authentication Setup

### 3.1 Update Auth.js Configuration

`src/lib/auth.ts`:

```typescript
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db';
import { guest, invitation } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Credentials({
      name: 'Name',
      credentials: {
        firstName: { label: 'First Name', type: 'text' },
        lastName: { label: 'Last Name', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.firstName || !credentials?.lastName) {
          return null;
        }

        // Query guest by name
        const guests = await db
          .select()
          .from(guest)
          .where(
            and(
              eq(guest.firstName, credentials.firstName as string),
              eq(guest.lastName, credentials.lastName as string)
            )
          );

        if (!guests.length) {
          throw new Error('Guest not found. Please check the spelling of your name.');
        }

        const guestRecord = guests[0];

        // Return user object
        return {
          id: String(guestRecord.id),
          name: `${guestRecord.firstName} ${guestRecord.lastName}`,
          guestId: guestRecord.id,
          invitationId: guestRecord.invitationId,
          email: `${guestRecord.firstName}.${guestRecord.lastName}@wedding.local`,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.guestId = user.guestId;
        token.invitationId = user.invitationId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.guestId = token.guestId;
        session.user.invitationId = token.invitationId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login', // Redirect errors back to login
  },
});
```

### 3.2 Update Session Provider

`src/components/SessionProvider.tsx`:

```typescript
'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
```

Wrap app in `src/app/layout.tsx`:
```typescript
import SessionProvider from '@/components/SessionProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

---

## Step 4: Implement Core Pages

### 4.1 Login Page

`src/app/login/page.tsx`:

```typescript
'use client';

import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50 px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Wedding Celebration</h1>
        <p className="text-gray-600 mb-6">Log in to RSVP and view details</p>
        <LoginForm />
      </div>
    </div>
  );
}
```

### 4.2 RSVP Dashboard

`src/app/rsvp/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { event, guestEvent, guest } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default async function RsvpPage() {
  const session = await auth();
  if (!session?.user?.guestId) {
    redirect('/login');
  }

  // Fetch guest with associated invitation
  const guestData = await db
    .select()
    .from(guest)
    .where(eq(guest.id, parseInt(session.user.guestId as string)))
    .limit(1);

  if (!guestData.length) {
    redirect('/login');
  }

  // Fetch events guest is invited to
  const invitedTo = await db
    .selectDistinct()
    .from(event)
    .innerJoin(guestEvent, eq(event.id, guestEvent.eventId))
    .where(eq(guestEvent.guestId, parseInt(session.user.guestId as string)))
    .orderBy(event.eventDate, event.eventTime);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Welcome, {guestData[0].firstName}!</h1>
        <p className="text-lg text-gray-600 mb-8">You're invited to {invitedTo.length} event(s)</p>

        <div className="space-y-6">
          {invitedTo.map((row) => (
            <div key={row.event.id} className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-semibold mb-2">{row.event.name}</h2>
              <p className="text-gray-600 mb-4">
                {new Date(`${row.event.eventDate}T${row.event.eventTime}`).toLocaleDateString()} at{' '}
                {row.event.eventTime}
              </p>
              <a
                href={`/rsvp/${row.event.type === 'main' ? 'wedding' : row.event.id}`}
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                RSVP to This Event
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 4.3 RSVP Form Page

`src/app/rsvp/wedding/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import RSVPForm from '@/components/RSVPForm';
import { db } from '@/lib/db';
import { guest, invitation, event } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default async function WeddingRsvpPage() {
  const session = await auth();
  if (!session?.user?.guestId) {
    redirect('/login');
  }

  // Fetch invitation details
  const guestData = await db
    .select()
    .from(guest)
    .where(eq(guest.id, parseInt(session.user.guestId as string)))
    .limit(1);

  const invitationData = await db
    .select()
    .from(invitation)
    .where(eq(invitation.id, guestData[0].invitationId))
    .limit(1);

  // Fetch all guests on this invitation
  const invitedGuests = await db
    .select()
    .from(guest)
    .where(eq(guest.invitationId, invitationData[0].id));

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-2">Main Wedding RSVP</h1>
        <p className="text-gray-600 mb-6">
          You have been invited with {invitationData[0].maxGuests} total guest{invitationData[0].maxGuests !== 1 ? 's' : ''}
        </p>

        <RSVPForm
          guestId={parseInt(session.user.guestId as string)}
          invitedGuests={invitedGuests}
          maxGuests={invitationData[0].maxGuests}
          eventId={1} // TODO: Fetch main wedding event ID
        />
      </div>
    </div>
  );
}
```

---

## Step 5: Implement Forms with Zod + React Hook Form

### 5.1 Validation Schema

`src/lib/schemas/rsvp.ts`:

```typescript
import { z } from 'zod';

export const mealOptions = ['option_a', 'option_b'] as const;

export const attendeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  mealOption: z.enum(mealOptions),
  dietaryRestrictions: z.string().optional(),
});

export const rsvpSchema = z.object({
  attendanceStatus: z.enum(['attending', 'not_attending']),
  attendees: z.array(attendeeSchema).min(0),
  specialRequests: z.string().optional(),
});

export type AttendeeFormData = z.infer<typeof attendeeSchema>;
export type RsvpFormData = z.infer<typeof rsvpSchema>;
```

### 5.2 Client Form Component

`src/components/RSVPForm.tsx`:

```typescript
'use client';

import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { rsvpSchema, type RsvpFormData } from '@/lib/schemas/rsvp';
import { submitRsvp } from '@/app/rsvp/actions';
import { useState } from 'react';

export default function RSVPForm({
  guestId,
  invitedGuests,
  maxGuests,
  eventId,
}: {
  guestId: number;
  invitedGuests: any[];
  maxGuests: number;
  eventId: number;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const methods = useForm<RsvpFormData>({
    resolver: zodResolver(rsvpSchema),
    defaultValues: { attendanceStatus: 'attending', attendees: [] },
  });

  const { fields, append, remove } = useFieldArray({
    control: methods.control,
    name: 'attendees',
  });

  const attendanceStatus = methods.watch('attendanceStatus');

  const onSubmit = async (data: RsvpFormData) => {
    setIsSubmitting(true);
    try {
      await submitRsvp({
        guestId,
        eventId,
        ...data,
      });
      // Show success message
      alert('RSVP submitted successfully!');
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      alert('Error submitting RSVP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        {/* Attendance Status */}
        <div>
          <label className="block text-lg font-semibold mb-3">Will you attend?</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="attending"
                {...methods.register('attendanceStatus')}
                className="mr-2"
              />
              <span>Yes, I will attend</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="not_attending"
                {...methods.register('attendanceStatus')}
                className="mr-2"
              />
              <span>No, I cannot attend</span>
            </label>
          </div>
        </div>

        {/* Attendees */}
        {attendanceStatus === 'attending' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Who will be attending?</h3>
            <div className="space-y-4">
              {invitedGuests.map((g, idx) => (
                <div
                  key={idx}
                  className="border border-gray-300 rounded-lg p-4"
                >
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={!!fields.find((f) => f.name === `${g.firstName} ${g.lastName}`)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          append({ name: `${g.firstName} ${g.lastName}`, mealOption: 'option_a' });
                        } else {
                          const idx = fields.findIndex((f) => f.name === `${g.firstName} ${g.lastName}`);
                          if (idx !== -1) remove(idx);
                        }
                      }}
                      className="mr-2"
                    />
                    <span>{g.firstName} {g.lastName}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meal Options */}
        {attendanceStatus === 'attending' &&
          fields.map((field, idx) => (
            <div key={field.id} className="border-l-4 border-blue-500 pl-4 py-2">
              <h4 className="font-semibold mb-3">{field.name} - Meal Preference</h4>
              <div className="space-y-2 mb-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="option_a"
                    {...methods.register(`attendees.${idx}.mealOption`)}
                    className="mr-2"
                  />
                  <span>Chicken Entree</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="option_b"
                    {...methods.register(`attendees.${idx}.mealOption`)}
                    className="mr-2"
                  />
                  <span>Vegetarian Entree</span>
                </label>
              </div>
              <input
                {...methods.register(`attendees.${idx}.dietaryRestrictions`)}
                placeholder="Dietary restrictions / allergies"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
          ))}

        {/* Special Requests */}
        <div>
          <label htmlFor="specialRequests" className="block text-lg font-semibold mb-2">
            Special Requests (Optional)
          </label>
          <textarea
            {...methods.register('specialRequests')}
            placeholder="Any special accommodations or requests?"
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Submit RSVP'}
        </button>
      </form>
    </FormProvider>
  );
}
```

### 5.3 Server Action

`src/app/rsvp/actions.ts`:

```typescript
'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rsvpResponse, attendee } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { RsvpFormData } from '@/lib/schemas/rsvp';

export async function submitRsvp({
  guestId,
  eventId,
  attendanceStatus,
  attendees,
  specialRequests,
}: {
  guestId: number;
  eventId: number;
} & RsvpFormData) {
  const session = await auth();
  if (!session?.user?.guestId) {
    throw new Error('Unauthorized');
  }

  if (Number(session.user.guestId) !== guestId) {
    throw new Error('Guest ID mismatch');
  }

  const numberOfAttending = attendanceStatus === 'attending' ? attendees.length : 0;

  // Upsert RSVP
  const [rsvp] = await db
    .insert(rsvpResponse)
    .values({
      guestId,
      eventId,
      attendanceStatus,
      numberOfAttending,
      specialRequests: specialRequests || null,
    })
    .onConflictDoUpdate({
      target: [rsvpResponse.guestId, rsvpResponse.eventId],
      set: {
        attendanceStatus,
        numberOfAttending,
        specialRequests: specialRequests || null,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning();

  // Delete existing attendees for this RSVP
  await db.delete(attendee).where(eq(attendee.rsvpResponseId, rsvp.id));

  // Insert new attendees
  if (attendees.length > 0) {
    await db.insert(attendee).values(
      attendees.map((a, idx) => ({
        rsvpResponseId: rsvp.id,
        name: a.name,
        mealOption: a.mealOption,
        dietaryRestrictions: a.dietaryRestrictions || null,
        sortOrder: idx,
      }))
    );
  }

  return rsvp;
}
```

---

## Step 6: Testing

### 6.1 Unit Test Example

`src/lib/rsvp.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateHeadCount, getMealCounts } from '@/lib/rsvp';

describe('RSVP Logic', () => {
  it('should calculate head count correctly', () => {
    const rsvps = [
      { attendanceStatus: 'attending', numberOfAttending: 2 },
      { attendanceStatus: 'attending', numberOfAttending: 3 },
      { attendanceStatus: 'not_attending', numberOfAttending: 0 },
    ];
    expect(calculateHeadCount(rsvps)).toBe(5);
  });

  it('should break down meal counts', () => {
    const attendees = [
      { mealOption: 'option_a' },
      { mealOption: 'option_a' },
      { mealOption: 'option_b' },
    ];
    expect(getMealCounts(attendees)).toEqual({
      option_a: 2,
      option_b: 1,
    });
  });
});
```

### 6.2 Manual Testing Checklist

- [ ] Login with valid guest name → Dashboard loads
- [ ] Login with invalid name → Error message shown
- [ ] Select "Not Attending" → Submit works, no attendees required
- [ ] Select "Attending" → Attendee selection appears
- [ ] Exceed max guests → Validation error shown
- [ ] Submit → Confirmation message appears
- [ ] Return and re-authenticate → Previous RSVP loads
- [ ] Modify and re-submit → Updated data persists
- [ ] Check deadline passed → Form becomes read-only

---

## Step 7: Deployment

### 7.1 Build & Deploy

```bash
# Build for Cloudflare
npm run build

# Deploy
wrangler deploy

# Verify D1 migration
wrangler d1 info <DATABASE_NAME>
```

### 7.2 Environment Variables

`.env.production`:
```
DATABASE_URL=file:./data.db  # Local
# OR
CLOUDFLARE_D1_BINDING=RSVP_DB  # For wrangler
AUTH_SECRET=<generate-with-`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"'>
NEXTAUTH_URL=https://chrisandkatie.net
```

---

## Next Steps

1. Start with database schema + migrations (Step 1)
2. Seed test data (Step 2)
3. Implement authentication (Step 3)
4. Build pages incrementally (Step 4 → 5)
5. Test thoroughly (Step 6)
6. Deploy (Step 7)
7. Invite early testers to verify RSVP workflows

For detailed requirements, see [spec.md](spec.md). For data structure details, see [data-model.md](data-model.md).

